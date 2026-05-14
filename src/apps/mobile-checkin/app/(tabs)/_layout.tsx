import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/colors';

/** Extra space above/below the icon+label row inside the tab bar. */
const TAB_BAR_PAD_T = 2;
const TAB_BAR_PAD_B = 8;
/** Minimum inner height for icon + label (default tab row is ~48–52pt). */
const TAB_CONTENT_MIN = 52;
/** Bottom tab bar icon size (pt). React Navigation default is often ~24. */
const TAB_BAR_ICON_SIZE = 24;

function HeaderTitleWithIcon({
  title,
  icon,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.headerTitleRow}>
      <Ionicons name={icon} size={TAB_BAR_ICON_SIZE} color={colors.text} />
      <Text style={styles.headerTitleText} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { isReady, isAuthenticated } = useAuth();
  if (!isReady) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  const tabBarHeight = TAB_BAR_PAD_T + TAB_CONTENT_MIN + TAB_BAR_PAD_B + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleAlign: 'center',
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          borderTopColor: colors.border,
          paddingTop: TAB_BAR_PAD_T,
          paddingBottom: TAB_BAR_PAD_B + insets.bottom,
          height: tabBarHeight,
        },
        tabBarLabelStyle: {
          marginTop: -TAB_BAR_PAD_B / 2,
        },
      }}
    >
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Quét QR',
          headerTitle: () => <HeaderTitleWithIcon title="Quét QR" icon="qr-code-outline" />,
          tabBarIcon: ({ color }) => (
            <Ionicons name="qr-code-outline" size={TAB_BAR_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: 'Hàng đợi',
          headerTitle: () => <HeaderTitleWithIcon title="Hàng đợi" icon="list-outline" />,
          tabBarIcon: ({ color }) => (
            <Ionicons name="list-outline" size={TAB_BAR_ICON_SIZE} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  headerTitleText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
});
