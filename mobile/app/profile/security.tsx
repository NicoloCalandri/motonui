import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useColors } from '@/hooks/useColors';

export default function SecurityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [newEmail, setNewEmail] = useState(user?.email ?? '');

  const updateEmailMutation = useMutation({
    mutationFn: async () => {
      const email = newEmail.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Inserisci una email valida.');
      }
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
    },
    onSuccess: () => {
      Alert.alert('Conferma richiesta', 'Controlla la nuova email per confermare la modifica.');
    },
    onError: (error: Error) => {
      Alert.alert('Errore', error.message);
    },
  });

  const sendMagicLinkMutation = useMutation({
    mutationFn: async () => {
      if (!user?.email) {
        throw new Error('Nessuna email associata all account.');
      }
      const { error } = await supabase.auth.signInWithOtp({ email: user.email });
      if (error) throw error;
    },
    onSuccess: () => {
      Alert.alert('Link inviato', 'Ti abbiamo inviato un nuovo link di accesso via email.');
    },
    onError: (error: Error) => {
      Alert.alert('Errore', error.message);
    },
  });

  const closeAllSessionsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
      await signOut();
    },
    onSuccess: () => {
      Alert.alert('Sessioni chiuse', 'Hai disconnesso tutti i dispositivi.');
      router.replace('/auth/login');
    },
    onError: (error: Error) => {
      Alert.alert('Errore', error.message);
    },
  });

  const styles = makeStyles(colors, insets);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sicurezza</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
          <Text style={styles.label}>Email account</Text>
          <Text style={styles.currentEmail}>{user?.email ?? '—'}</Text>

          <Text style={styles.label}>Cambia email</Text>
          <TextInput
            style={styles.input}
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder="nuova@email.com"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TouchableOpacity
            style={[styles.primaryButton, updateEmailMutation.isPending && styles.disabled]}
            onPress={() => updateEmailMutation.mutate()}
            disabled={updateEmailMutation.isPending}
            activeOpacity={0.85}
          >
            {updateEmailMutation.isPending
              ? <ActivityIndicator color={colors.primaryForeground} size="small" />
              : <Text style={styles.primaryButtonText}>Aggiorna email</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Accesso rapido</Text>
          <TouchableOpacity
            style={[styles.secondaryButton, sendMagicLinkMutation.isPending && styles.disabled]}
            onPress={() => sendMagicLinkMutation.mutate()}
            disabled={sendMagicLinkMutation.isPending}
            activeOpacity={0.85}
          >
            <Ionicons name="mail-outline" size={16} color={colors.foreground} />
            <Text style={styles.secondaryButtonText}>Invia nuovo link di accesso</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Dispositivi</Text>
          <TouchableOpacity
            style={[styles.dangerButton, closeAllSessionsMutation.isPending && styles.disabled]}
            onPress={() => {
              Alert.alert('Conferma', 'Vuoi davvero chiudere tutte le sessioni attive?', [
                { text: 'Annulla', style: 'cancel' },
                {
                  text: 'Conferma',
                  style: 'destructive',
                  onPress: () => closeAllSessionsMutation.mutate(),
                },
              ]);
            }}
            disabled={closeAllSessionsMutation.isPending}
            activeOpacity={0.85}
          >
            <Ionicons name="log-out-outline" size={16} color={colors.destructiveForeground} />
            <Text style={styles.dangerButtonText}>Chiudi tutte le sessioni</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Area critica</Text>
          <TouchableOpacity
            style={styles.linkDangerRow}
            onPress={() => router.push('/profile/delete-account' as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="trash-outline" size={16} color={colors.destructive} />
            <Text style={styles.linkDangerText}>Elimina account</Text>
          </TouchableOpacity>
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
      gap: 12,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    label: {
      fontSize: 12,
      fontFamily: 'DMSans_700Bold',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: colors.mutedForeground,
      marginBottom: 8,
    },
    currentEmail: {
      fontSize: 15,
      fontFamily: 'DMSans_500Medium',
      color: colors.foreground,
      marginBottom: 14,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 10,
      color: colors.foreground,
      fontSize: 15,
      fontFamily: 'DMSans_400Regular',
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    primaryButtonText: {
      color: colors.primaryForeground,
      fontSize: 14,
      fontFamily: 'DMSans_700Bold',
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.muted,
      borderRadius: 10,
      minHeight: 44,
      paddingHorizontal: 14,
    },
    secondaryButtonText: {
      color: colors.foreground,
      fontSize: 14,
      fontFamily: 'DMSans_700Bold',
    },
    dangerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.destructive,
      borderRadius: 10,
      minHeight: 44,
      paddingHorizontal: 14,
    },
    dangerButtonText: {
      color: colors.destructiveForeground,
      fontSize: 14,
      fontFamily: 'DMSans_700Bold',
    },
    disabled: {
      opacity: 0.6,
    },
    linkDangerRow: {
      minHeight: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.destructive,
      backgroundColor: colors.destructive + '11',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      flexDirection: 'row',
      paddingHorizontal: 14,
    },
    linkDangerText: {
      color: colors.destructive,
      fontSize: 14,
      fontFamily: 'DMSans_700Bold',
    },
  });
}
