import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useColors } from '@/hooks/useColors';

export default function Index() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const colors = useColors();

  useEffect(() => {
    if (loading) return;
    if (session) {
      router.replace('/(tabs)/trips');
    } else {
      router.replace('/auth/login');
    }
  }, [session, loading]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.foreground} />
    </View>
  );
}
