import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError } from '@unihub/api-client';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/colors';

export default function LoginScreen() {
  const router = useRouter();
  const { setSession } = useAuth();

  const [email, setEmail] = useState('staff@unihub.edu.vn');
  const [password, setPassword] = useState('staff1234');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (submitting) return;
    setError(null);

    if (!email.trim() || !password) {
      setError('Vui lòng nhập email và mật khẩu.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.auth.login({
        email: email.trim(),
        password,
      });
      const allowed = res.user.role === 'staff' || res.user.role === 'admin';
      if (!allowed) {
        setError('Tài khoản này không có quyền truy cập.');
        return;
      }
      await setSession(
        {
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          expiresIn: res.expiresIn,
        },
        res.user,
      );
      router.replace('/(tabs)/scan');
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        const msg = (e as Error)?.message ?? '';
        setError(
          msg.includes('Network')
            ? 'Không kết nối được đến máy chủ.'
            : 'Không thể đăng nhập. Vui lòng thử lại.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const showHint = () =>
    Alert.alert('Tài khoản', 'staff@unihub.edu.vn / staff1234\nadmin@unihub.edu.vn / admin123');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <View style={styles.container}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>U</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>UniHub Check-in</Text>
            <Text style={styles.brandSubtitle}>Mobile app cho nhân sự</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Đăng nhập</Text>
          <Text style={styles.helper}>Sử dụng tài khoản được cấp cho bạn.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="staff@unihub.edu.vn"
              placeholderTextColor={colors.neutral}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mật khẩu</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.neutral}
              secureTextEntry
              autoComplete="current-password"
              style={styles.input}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={onSubmit}
            disabled={submitting}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Đăng nhập</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={showHint} style={styles.hintButton}>
            <Text style={styles.hintText}>Xem tài khoản</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surfaceMuted },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 80,
    backgroundColor: colors.surfaceMuted,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 28,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  brandTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  brandSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text },
  helper: { fontSize: 13, color: colors.textMuted, marginTop: -8 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '500', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  error: {
    color: colors.danger,
    backgroundColor: '#fee2e2',
    padding: 10,
    borderRadius: 8,
    fontSize: 13,
  },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  hintButton: { alignSelf: 'center', paddingVertical: 6 },
  hintText: { color: colors.brand, fontSize: 13 },
});
