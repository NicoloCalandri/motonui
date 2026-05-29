import { Tabs, Redirect } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { View, ActivityIndicator } from 'react-native';

async function fetchAccessProfile(userId: string): Promise<{ suspended_at: string | null } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

export default function TabLayout() {
  const colors = useColors();
  const { session, loading, signOut } = useAuth();
  const hasSignedOutSuspendedUser = useRef(false);

  const { data: accessProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['mobile-access-profile', session?.user?.id],
    queryFn: () => fetchAccessProfile(session!.user.id),
    enabled: !!session?.user?.id,
  });

  useEffect(() => {
    if (!accessProfile?.suspended_at || hasSignedOutSuspendedUser.current) return;
    hasSignedOutSuspendedUser.current = true;
    void signOut().catch(() => undefined);
  }, [accessProfile?.suspended_at, signOut]);

  if (loading || (session && profileLoading)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.foreground} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/auth/login" />;
  }

  if (accessProfile?.suspended_at) {
    return <Redirect href="/auth/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontFamily: 'DMSans_500Medium',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Viaggi',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="blog"
        options={{
          title: 'Blog',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profilo',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
