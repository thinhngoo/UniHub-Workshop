import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth';

export default function AuthLayout() {
  const { isReady, isAuthenticated } = useAuth();
  if (!isReady) return null;
  if (isAuthenticated) return <Redirect href="/(tabs)/scan" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
