import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { ThemePreference, usePreferences } from '@/hooks/usePreferences';

const OPTIONS: Array<{ key: ThemePreference; title: string; subtitle: string }> = [
  { key: 'system', title: 'Sistema', subtitle: 'Segue le impostazioni del dispositivo' },
  { key: 'light', title: 'Chiaro', subtitle: 'Sempre tema chiaro' },
  { key: 'dark', title: 'Scuro', subtitle: 'Sempre tema scuro' },
];

export default function AppearanceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { themePreference, setThemePreference } = usePreferences();

  const styles = makeStyles(colors, insets);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Aspetto</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
          {OPTIONS.map((option, index) => (
            <View key={option.key}>
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => setThemePreference(option.key)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                </View>
                <Ionicons
                  name={themePreference === option.key ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={themePreference === option.key ? colors.primary : colors.mutedForeground}
                />
              </TouchableOpacity>
              {index < OPTIONS.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

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
      overflow: 'hidden',
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    optionTitle: {
      fontSize: 15,
      fontFamily: 'DMSans_500Medium',
      color: colors.foreground,
      marginBottom: 2,
    },
    optionSubtitle: {
      fontSize: 12,
      fontFamily: 'DMSans_400Regular',
      color: colors.mutedForeground,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 14,
    },
  });
}
