import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Trip } from '@/types';

interface TripCardProps {
  trip: Trip;
  onPress: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  planning: 'In piano',
  active: 'In corso',
  completed: 'Completato',
  archived: 'Archiviato',
};

const STATUS_COLORS: Record<string, string> = {
  planning: '#F59E0B',
  active: '#10B981',
  completed: '#6B7280',
  archived: '#9CA3AF',
};

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'Date non definite';
  const fmt = (d: string) => new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `Dal ${fmt(start)}`;
  return `Fino al ${fmt(end!)}`;
}

export function TripCard({ trip, onPress }: TripCardProps) {
  const colors = useColors();
  const styles = makeStyles(colors);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.imageContainer}>
        {trip.cover_image ? (
          <Image source={{ uri: trip.cover_image }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="compass" size={32} color={colors.mutedForeground} />
          </View>
        )}
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[trip.status] + '22', borderColor: STATUS_COLORS[trip.status] + '44' }]}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[trip.status] }]} />
          <Text style={[styles.statusText, { color: STATUS_COLORS[trip.status] }]}>
            {STATUS_LABELS[trip.status] ?? trip.status}
          </Text>
        </View>
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{trip.title}</Text>
        <View style={styles.destinationRow}>
          <Ionicons name="location-outline" size={13} color={colors.mutedForeground} />
          <Text style={styles.destination} numberOfLines={1}>{trip.destination}</Text>
        </View>
        <Text style={styles.dates}>{formatDateRange(trip.start_date, trip.end_date)}</Text>
        {trip.description ? (
          <Text style={styles.description} numberOfLines={2}>{trip.description}</Text>
        ) : null}
        <View style={styles.footer}>
          <Ionicons name="arrow-forward" size={16} color={colors.mutedForeground} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginBottom: 16,
    },
    imageContainer: {
      height: 160,
      position: 'relative',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    imagePlaceholder: {
      flex: 1,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 11,
      fontFamily: 'DMSans_700Bold',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    content: {
      padding: 16,
    },
    title: {
      fontSize: 18,
      fontFamily: 'DMSans_700Bold',
      color: colors.foreground,
      marginBottom: 4,
    },
    destinationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 4,
    },
    destination: {
      fontSize: 13,
      fontFamily: 'DMSans_400Regular',
      color: colors.mutedForeground,
    },
    dates: {
      fontSize: 13,
      fontFamily: 'DMSans_500Medium',
      color: colors.mutedForeground,
      marginBottom: 8,
    },
    description: {
      fontSize: 13,
      fontFamily: 'DMSans_400Regular',
      color: colors.mutedForeground,
      lineHeight: 18,
      marginBottom: 8,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
  });
}
