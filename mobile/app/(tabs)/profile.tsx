import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Platform, Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useColors } from '@/hooks/useColors';
import { Profile } from '@/types';

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

async function fetchStats(userId: string) {
  const [trips, posts] = await Promise.all([
    supabase.from('trip_members').select('id', { count: 'exact' }).eq('user_id', userId),
    supabase.from('posts').select('id', { count: 'exact' }).eq('author_id', userId),
  ]);
  return {
    trips: trips.count ?? 0,
    posts: posts.count ?? 0,
  };
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user?.id,
  });

  const { data: stats } = useQuery({
    queryKey: ['profile-stats', user?.id],
    queryFn: () => fetchStats(user!.id),
    enabled: !!user?.id,
  });

  const styles = makeStyles(colors, insets);

  const handleSignOut = () => {
    Alert.alert('Esci', 'Vuoi davvero uscire?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Esci',
        style: 'destructive',
        onPress: async () => {
          try {
            if (Platform.OS !== 'web') {
              try {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
              } catch {
                // no-op: haptics unavailable in current runtime
              }
            }
            await signOut();
            router.replace('/auth/login');
          } catch (error) {
            if (__DEV__) {
              console.warn('[profile][logout] sign out failed', error);
            }
            Alert.alert('Logout non riuscito', 'Riprova tra qualche secondo.');
          }
        },
      },
    ]);
  };

  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? 'Utente';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profilo</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatarRow}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>{displayName}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={[styles.planBadge, profile?.plan === 'premium' && styles.planBadgePremium]}>
              <Text style={[styles.planText, profile?.plan === 'premium' && styles.planTextPremium]}>
                {profile?.plan === 'premium' ? 'Premium' : 'Free'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats?.trips ?? 0}</Text>
          <Text style={styles.statLabel}>Viaggi</Text>
        </View>
        <View style={[styles.statBox, styles.statBoxMiddle]}>
          <Text style={styles.statValue}>{stats?.posts ?? 0}</Text>
          <Text style={styles.statLabel}>Post</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{profile?.plan === 'premium' ? '★' : '—'}</Text>
          <Text style={styles.statLabel}>Piano</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="person-outline"
            label="Dati personali"
            sublabel={user?.email ?? ''}
            colors={colors}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="shield-checkmark-outline"
            label="Sicurezza"
            sublabel="Password e accesso"
            colors={colors}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="notifications-outline"
            label="Notifiche"
            sublabel="Promemoria e avvisi"
            colors={colors}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="color-palette-outline"
            label="Aspetto"
            sublabel="Tema chiaro / scuro"
            colors={colors}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="language-outline"
            label="Lingua"
            sublabel="Italiano"
            colors={colors}
          />
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
        <Text style={styles.signOutText}>Esci dall'account</Text>
      </TouchableOpacity>

      <Text style={styles.version}>motonui v1.0.0</Text>
    </ScrollView>
  );
}

function MenuItem({ icon, label, sublabel, colors }: { icon: string; label: string; sublabel: string; colors: any }) {
  return (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 }}
      activeOpacity={0.7}
    >
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon as any} size={18} color={colors.mutedForeground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontFamily: 'DMSans_500Medium', color: colors.foreground }}>{label}</Text>
        <Text style={{ fontSize: 12, fontFamily: 'DMSans_400Regular', color: colors.mutedForeground, marginTop: 1 }}>{sublabel}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>, insets: ReturnType<typeof import('react-native-safe-area-context').useSafeAreaInsets>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingBottom: insets.bottom + 24,
    },
    header: {
      paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 12),
      paddingBottom: 16,
      paddingHorizontal: 20,
    },
    headerTitle: {
      fontSize: 26,
      fontFamily: 'DMSans_700Bold',
      color: colors.foreground,
    },
    profileCard: {
      marginHorizontal: 20,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      marginBottom: 16,
    },
    avatarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
    },
    avatarPlaceholder: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      fontSize: 22,
      fontFamily: 'DMSans_700Bold',
      color: colors.primaryForeground,
    },
    profileInfo: {
      flex: 1,
    },
    displayName: {
      fontSize: 18,
      fontFamily: 'DMSans_700Bold',
      color: colors.foreground,
      marginBottom: 2,
    },
    email: {
      fontSize: 13,
      fontFamily: 'DMSans_400Regular',
      color: colors.mutedForeground,
      marginBottom: 8,
    },
    planBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 20,
      backgroundColor: colors.muted,
    },
    planBadgePremium: {
      backgroundColor: '#F59E0B22',
    },
    planText: {
      fontSize: 11,
      fontFamily: 'DMSans_700Bold',
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    planTextPremium: {
      color: '#F59E0B',
    },
    statsRow: {
      flexDirection: 'row',
      marginHorizontal: 20,
      marginBottom: 24,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    statBox: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 16,
    },
    statBoxMiddle: {
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: colors.border,
    },
    statValue: {
      fontSize: 22,
      fontFamily: 'DMSans_700Bold',
      color: colors.foreground,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      fontFamily: 'DMSans_400Regular',
      color: colors.mutedForeground,
    },
    section: {
      marginBottom: 20,
      paddingHorizontal: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontFamily: 'DMSans_700Bold',
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
    },
    menuCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 64,
    },
    signOutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 20,
      marginTop: 8,
      paddingVertical: 16,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
    },
    signOutText: {
      fontSize: 15,
      fontFamily: 'DMSans_500Medium',
      color: colors.destructive,
    },
    version: {
      textAlign: 'center',
      fontSize: 12,
      fontFamily: 'DMSans_400Regular',
      color: colors.mutedForeground,
      marginTop: 20,
    },
  });
}
