import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  const colors = useColors();
  const styles = makeStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon as any} size={32} color={colors.mutedForeground} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      paddingHorizontal: 32,
    },
    iconContainer: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 16,
      fontFamily: 'DMSans_700Bold',
      color: colors.foreground,
      textAlign: 'center',
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 13,
      fontFamily: 'DMSans_400Regular',
      color: colors.mutedForeground,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
}
