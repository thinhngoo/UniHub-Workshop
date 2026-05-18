import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/colors';
import { enqueue } from '@/lib/outbox';
import { verifyQr } from '@/lib/qr';
import { newUuid } from '@/lib/uuid';

interface Banner {
  tone: 'success' | 'warning' | 'danger';
  title: string;
  detail?: string;
}

/** Debounce window for identical scans. */
const RESCAN_WINDOW_MS = 2_500;

export default function ScanScreen() {
  const { user, clear } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [banner, setBanner] = useState<Banner | null>(null);
  const [active, setActive] = useState(true);

  // Track last-seen token to debounce — useRef so we don't re-render on writes.
  const lastScanRef = useRef<{ token: string; at: number }>({ token: '', at: 0 });
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = useCallback((next: Banner) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setBanner(next);
    bannerTimerRef.current = setTimeout(() => setBanner(null), 2_000);
  }, []);

  useEffect(
    () => () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      setActive(true);
      return () => setActive(false);
    }, []),
  );

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const onScanned = useCallback(
    async ({ data }: { data: string }) => {
      const now = Date.now();
      if (data === lastScanRef.current.token && now - lastScanRef.current.at < RESCAN_WINDOW_MS) {
        return;
      }
      lastScanRef.current = { token: data, at: now };

      const result = verifyQr(data);
      if (!result.ok) {
        showBanner({
          tone: 'danger',
          title: 'QR không hợp lệ',
          detail: result.reason,
        });
        return;
      }

      try {
        await enqueue({
          clientEventId: newUuid(),
          qrToken: result.token,
          scannedAt: new Date().toISOString(),
        });
        showBanner({
          tone: 'success',
          title: 'Đã ghi vào hàng đợi',
          detail: result.token,
        });
      } catch (e) {
        showBanner({
          tone: 'danger',
          title: 'Lỗi lưu outbox',
          detail: (e as Error)?.message,
        });
      }
    },
    [showBanner],
  );

  const onLogout = useCallback(() => {
    Alert.alert('Đăng xuất', 'Bạn chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => void clear() },
    ]);
  }, [clear]);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionTitle}>Cần quyền truy cập camera</Text>
        <Text style={styles.permissionBody}>
          Ứng dụng cần camera để quét mã QR check-in. Vui lòng cấp quyền trong cài đặt hệ thống.
        </Text>
        {permission.canAskAgain && (
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Cấp quyền</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {active && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onScanned}
        />
      )}

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <View style={styles.staffPill}>
            <Text style={styles.staffPillLabel}>NHÂN VIÊN</Text>
            <Text style={styles.staffPillName} numberOfLines={1}>
              {user?.fullName ?? 'Đang xác thực…'}
            </Text>
          </View>
          <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>

        <View pointerEvents="none" style={styles.reticleWrap}>
          <View style={styles.reticle} />
          <Text style={styles.reticleHint}>Đưa mã QR vào khung</Text>
        </View>

        <View style={styles.bottomBar}>
          <Text style={styles.bottomHint}>
            Đã quét sẽ vào hàng đợi offline; điều hướng đến tab &quot;Hàng đợi&quot; để đồng bộ.
          </Text>
        </View>

        {banner && (
          <View style={styles.bannerWrap} pointerEvents="box-none">
            <BannerCard banner={banner} onDismiss={() => setBanner(null)} />
          </View>
        )}
      </View>
    </View>
  );
}

function BannerCard({ banner, onDismiss }: { banner: Banner; onDismiss: () => void }) {
  const accent =
    banner.tone === 'success'
      ? colors.success
      : banner.tone === 'warning'
        ? colors.warning
        : colors.danger;

  return (
    <View style={[styles.banner, { borderLeftColor: accent }]}>
      <View style={styles.bannerBody}>
        <Text style={styles.bannerTitle}>{banner.title}</Text>
        {banner.detail && (
          <Text style={styles.bannerDetail} numberOfLines={2}>
            {banner.detail}
          </Text>
        )}
      </View>
      <TouchableOpacity onPress={onDismiss}>
        <Text style={styles.bannerDismiss}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  permissionTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  permissionBody: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: colors.brand,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 16 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
  },
  staffPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(15,23,42,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    maxWidth: '70%',
  },
  staffPillLabel: {
    fontSize: 10,
    color: '#cbd5e1',
    letterSpacing: 1,
    fontWeight: '700',
  },
  staffPillName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.7)',
  },
  logoutText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  reticleWrap: { alignItems: 'center', gap: 10 },
  reticle: {
    width: 260,
    height: 260,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'transparent',
  },
  reticleHint: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  bottomBar: { paddingBottom: 40 },
  bannerWrap: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  bottomHint: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.85,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerBody: { flex: 1, gap: 2 },
  bannerTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  bannerDetail: { fontSize: 12, color: colors.textMuted },
  bannerDismiss: { fontSize: 16, color: colors.textMuted, paddingHorizontal: 4 },
});
