import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { usePreferences } from '@/hooks/usePreferences';

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { notifications, updateNotifications } = usePreferences();

  const styles = makeStyles(colors, insets);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifiche</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
          <SettingToggle
            label="Promemoria viaggio"
            description="Avvisi per scadenze e tappe imminenti"
            value={notifications.tripReminders}
            onChange={(value) => updateNotifications({ tripReminders: value })}
            colors={colors}
          />
          <View style={styles.divider} />
          <SettingToggle
            label="Nuovi contenuti blog"
            description="Ricevi aggiornamenti sui post pubblicati"
            value={notifications.blogUpdates}
            onChange={(value) => updateNotifications({ blogUpdates: value })}
            colors={colors}
          />
          <View style={styles.divider} />
          <SettingToggle
            label="Novita prodotto"
            description="Novita e miglioramenti dell app"
            value={notifications.productNews}
            onChange={(value) => updateNotifications({ productNews: value })}
            colors={colors}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function SettingToggle({
  label,
  description,
  value,
  onChange,
  colors,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
}) {
  return (
    <View style={stylesLocal.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[stylesLocal.label, { color: colors.foreground }]}>{label}</Text>
        <Text style={[stylesLocal.description, { color: colors.mutedForeground }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        thumbColor={colors.surface}
        trackColor={{ false: colors.muted, true: colors.success }}
      />
    </View>
  );
}

const stylesLocal = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: {
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
});

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>, insets: ReturnType<typeof import('react-native-safe-area-context').useSafeAreaInsets>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 10),
      paddingBottom: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontFamily: 'DMSans_700Bold',
      color: colors.foreground,
    },
    headerSpacer: {
      width: 36,
      height: 36,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 16,
      paddingBottom: insets.bottom + 24,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
  });
}
