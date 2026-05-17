import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useColors } from '@/hooks/useColors';
import { TripCard } from '@/components/TripCard';
import { EmptyState } from '@/components/EmptyState';
import { Trip } from '@/types';

async function fetchTrips(userId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('*, trip_members!inner(user_id)')
    .eq('trip_members.user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export default function TripsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const { data: trips = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['trips', user?.id],
    queryFn: () => fetchTrips(user!.id),
    enabled: !!user?.id,
  });

  const styles = makeStyles(colors, insets);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>I miei viaggi</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/trips/new')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      <FlatList<Trip>
        data={trips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            onPress={() => router.push(`/trips/${item.id}` as any)}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.foreground}
          />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon="compass-outline"
              title="Nessun viaggio ancora"
              subtitle="Tocca + per pianificare il tuo primo viaggio insieme."
            />
          )
        }
      />
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
      paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 12),
      paddingBottom: 16,
      paddingHorizontal: 20,
      backgroundColor: colors.background,
    },
    headerTitle: {
      fontSize: 26,
      fontFamily: 'DMSans_700Bold',
      color: colors.foreground,
    },
    addButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
  });
}
