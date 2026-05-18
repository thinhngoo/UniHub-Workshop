import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useFocusEffect } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@unihub/api-client';
import type { CheckInBatchItemStatus } from '@unihub/types';
import { api } from '@/lib/api';
import { colors } from '@/lib/colors';
import { formatDateTime, shorten } from '@/lib/format';
import {
  clearSynced,
  deleteOne,
  listAll,
  listPending,
  markBatchFailed,
  markResults,
  type OutboxRow,
} from '@/lib/outbox';
import { newUuid } from '@/lib/uuid';

const QUEUE_KEY = ['outbox'] as const;

export default function QueueScreen() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const rowsQuery = useQuery({
    queryKey: QUEUE_KEY,
    queryFn: listAll,
  });

  const { refetch } = rowsQuery;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const sync = useMutation({
    mutationFn: async () => {
      const pending = await listPending();
      if (pending.length === 0) return { synced: 0 };

      try {
        const res = await api.checkin.batch(
          {
            items: pending.map((r) => ({
              clientEventId: r.clientEventId,
              qrToken: r.qrToken,
              scannedAt: r.scannedAt,
            })),
          },
          // One Idempotency-Key per sync attempt — retries replay the same batch.
          newUuid(),
        );

        const byId = new Map(res.results.map((r) => [r.clientEventId, r]));
        await markResults(
          pending.map((row) => {
            const result = byId.get(row.clientEventId);
            return {
              clientEventId: row.clientEventId,
              status: result ? 'sent' : 'failed',
              resultStatus: result?.status ?? null,
              registrationId: result?.registrationId ?? null,
              message: result?.message ?? null,
            };
          }),
        );
        return { synced: pending.length };
      } catch (e) {
        const message =
          e instanceof ApiError
            ? `${e.code}: ${e.message}`
            : ((e as Error)?.message ?? 'unknown_error');
        await markBatchFailed(
          pending.map((r) => r.clientEventId),
          message,
        );
        throw e;
      }
    },
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: QUEUE_KEY });
    },
    onError: (e) => {
      const msg =
        e instanceof ApiError ? e.message : ((e as Error)?.message ?? 'Đồng bộ thất bại.');
      setError(msg);
      void qc.invalidateQueries({ queryKey: QUEUE_KEY });
    },
  });

  const onClearSynced = useCallback(() => {
    Alert.alert('Dọn các mục đã đồng bộ', 'Xóa toàn bộ mục đã gửi thành công khỏi hàng đợi?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          await clearSynced();
          void qc.invalidateQueries({ queryKey: QUEUE_KEY });
        },
      },
    ]);
  }, [qc]);

  const syncOneItem = useCallback(
    async (item: OutboxRow) => {
      try {
        const res = await api.checkin.batch(
          {
            items: [
              {
                clientEventId: item.clientEventId,
                qrToken: item.qrToken,
                scannedAt: item.scannedAt,
              },
            ],
          },
          newUuid(),
        );
        const result = res.results[0];
        await markResults([
          {
            clientEventId: item.clientEventId,
            status: result ? 'sent' : 'failed',
            resultStatus: result?.status ?? null,
            registrationId: result?.registrationId ?? null,
            message: result?.message ?? null,
          },
        ]);
      } catch (e) {
        const message =
          e instanceof ApiError
            ? `${e.code}: ${e.message}`
            : ((e as Error)?.message ?? 'unknown_error');
        await markBatchFailed([item.clientEventId], message);
      }
      void qc.invalidateQueries({ queryKey: QUEUE_KEY });
    },
    [qc],
  );

  const deleteOneItem = useCallback(
    async (item: OutboxRow) => {
      await deleteOne(item.clientEventId);
      void qc.invalidateQueries({ queryKey: QUEUE_KEY });
    },
    [qc],
  );

  const rows = rowsQuery.data ?? [];
  const pendingCount = rows.filter((r) => r.status === 'pending').length;
  const sentCount = rows.filter((r) => r.status === 'sent').length;
  const failedCount = rows.filter((r) => r.status === 'failed').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Hàng đợi check-in</Text>
          <Text style={styles.subtitle}>
            {pendingCount} chờ · {sentCount} đã đồng bộ · {failedCount} lỗi
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.syncBtn, (sync.isPending || pendingCount === 0) && styles.syncBtnDisabled]}
          disabled={sync.isPending || pendingCount === 0}
          onPress={() => sync.mutate()}
          accessibilityRole="button"
        >
          {sync.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.syncBtnText}>
              {pendingCount > 0 ? `Đồng bộ (${pendingCount})` : 'Không có chờ'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList<OutboxRow>
        data={rows}
        keyExtractor={(item) => item.clientEventId}
        contentContainerStyle={rows.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={rowsQuery.isRefetching}
            onRefresh={() => {
              setError(null);
              void rowsQuery.refetch();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Chưa có mục nào</Text>
            <Text style={styles.emptyBody}>Quét QR để thêm lượt check-in vào hàng đợi.</Text>
          </View>
        }
        renderItem={({ item }) => <Row item={item} onSync={syncOneItem} onDelete={deleteOneItem} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {sentCount > 0 && (
        <TouchableOpacity style={styles.footerBtn} onPress={onClearSynced}>
          <Text style={styles.footerBtnText}>Dọn các mục đã đồng bộ</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Row({
  item,
  onSync,
  onDelete,
}: {
  item: OutboxRow;
  onSync: (item: OutboxRow) => Promise<void>;
  onDelete: (item: OutboxRow) => Promise<void>;
}) {
  const ref = useRef<Swipeable>(null);
  const headline = headlineFor(item);
  const canSync = item.status === 'pending' || item.status === 'failed';

  const renderLeftActions = canSync
    ? () => (
        <TouchableOpacity
          style={styles.actionSync}
          onPress={() => {
            ref.current?.close();
            void onSync(item);
          }}
        >
          <Text style={styles.actionText}>Đồng bộ</Text>
        </TouchableOpacity>
      )
    : undefined;

  const renderRightActions = () => (
    <TouchableOpacity
      style={styles.actionDelete}
      onPress={() => {
        ref.current?.close();
        void onDelete(item);
      }}
    >
      <Text style={styles.actionText}>Xóa</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable
      ref={ref}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
    >
      <View style={styles.row}>
        <View style={[styles.statusDot, { backgroundColor: headline.color }]} />
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{headline.label}</Text>
          <Text style={styles.rowSub}>
            {shorten(item.qrToken, 12, 4)} · {formatDateTime(item.scannedAt)}
          </Text>
          {item.message && (
            <Text style={styles.rowMessage} numberOfLines={2}>
              {item.message}
            </Text>
          )}
        </View>
      </View>
    </Swipeable>
  );
}

function headlineFor(row: OutboxRow): { label: string; color: string } {
  if (row.status === 'pending') {
    return { label: 'Đang chờ đồng bộ', color: colors.warning };
  }
  if (row.status === 'failed') {
    return { label: 'Lỗi đồng bộ', color: colors.danger };
  }
  return {
    label: SERVER_LABEL[row.resultStatus ?? 'accepted'],
    color: SERVER_COLOR[row.resultStatus ?? 'accepted'],
  };
}

const SERVER_LABEL: Record<CheckInBatchItemStatus, string> = {
  accepted: 'Đã check-in',
  duplicate: 'Trùng — đã check-in trước đó',
  invalid_qr: 'QR không hợp lệ',
  not_registered: 'Chưa đăng ký / không hợp lệ',
  cancelled: 'Đăng ký đã hủy',
};

const SERVER_COLOR: Record<CheckInBatchItemStatus, string> = {
  accepted: colors.success,
  duplicate: colors.neutral,
  invalid_qr: colors.danger,
  not_registered: colors.danger,
  cancelled: colors.neutral,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  syncBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 130,
    alignItems: 'center',
  },
  syncBtnDisabled: { opacity: 0.5 },
  syncBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  errorBanner: {
    margin: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    borderLeftColor: colors.danger,
    borderLeftWidth: 4,
  },
  errorText: { color: '#991b1b', fontSize: 13 },
  list: { padding: 12 },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  empty: { alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  emptyBody: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  separator: { height: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 12, color: colors.textMuted },
  rowMessage: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  actionSync: {
    backgroundColor: colors.brand,
    justifyContent: 'center',
    alignItems: 'center',
    width: 76,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  actionDelete: {
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 76,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  footerBtn: {
    margin: 12,
    padding: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footerBtnText: { color: colors.brand, fontWeight: '600' },
});
