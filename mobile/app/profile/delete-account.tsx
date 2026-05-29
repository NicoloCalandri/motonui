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
import { queryClient } from '@/lib/queryClient';

export default function DeleteAccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();

  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [confirmCheck, setConfirmCheck] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!confirmCheck) {
        throw new Error('Conferma prima di aver letto gli effetti della cancellazione.');
      }

      if (confirmPhrase.trim().toUpperCase() !== 'ELIMINA') {
        throw new Error('Scrivi ELIMINA per confermare.');
      }

      const { error } = await supabase.rpc('delete_my_account', {
        confirm_text: 'DELETE',
      });

      if (error) {
        throw new Error(error.message);
      }

      await signOut();
      queryClient.clear();
    },
    onSuccess: () => {
      Alert.alert('Account eliminato', 'Il tuo account e i dati associati sono stati eliminati.');
      router.replace('/auth/login');
    },
    onError: (error: Error) => {
      Alert.alert('Eliminazione non riuscita', error.message);
    },
  });

  const styles = makeStyles(colors, insets);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Elimina account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.warningCard}>
          <Ionicons name="warning-outline" size={20} color={colors.destructive} />
          <Text style={styles.warningTitle}>Azione irreversibile</Text>
          <Text style={styles.warningText}>
            Eliminando l account perderai accesso a profilo, viaggi, post e contenuti associati.
          </Text>

          <TouchableOpacity style={styles.checkRow} onPress={() => setConfirmCheck((prev) => !prev)} activeOpacity={0.8}>
            <Ionicons
              name={confirmCheck ? 'checkbox' : 'square-outline'}
              size={20}
              color={confirmCheck ? colors.destructive : colors.mutedForeground}
            />
            <Text style={styles.checkLabel}>Ho letto e compreso le conseguenze.</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Scrivi ELIMINA per confermare</Text>
          <TextInput
            value={confirmPhrase}
            onChangeText={setConfirmPhrase}
            style={styles.input}
            autoCapitalize="characters"
            placeholder="ELIMINA"
            placeholderTextColor={colors.mutedForeground}
          />

          <TouchableOpacity
            style={[styles.dangerButton, deleteMutation.isPending && styles.disabled]}
            onPress={() => {
              Alert.alert('Ultima conferma', 'Vuoi davvero eliminare definitivamente il tuo account?', [
                { text: 'Annulla', style: 'cancel' },
                {
                  text: 'Elimina',
                  style: 'destructive',
                  onPress: () => deleteMutation.mutate(),
                },
              ]);
            }}
            disabled={deleteMutation.isPending}
            activeOpacity={0.85}
          >
            {deleteMutation.isPending
              ? <ActivityIndicator color={colors.destructiveForeground} size="small" />
              : <Text style={styles.dangerButtonText}>Elimina definitivamente</Text>}
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
    },
    warningCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    warningTitle: {
      marginTop: 10,
      fontSize: 16,
      fontFamily: 'DMSans_700Bold',
      color: colors.foreground,
    },
    warningText: {
      marginTop: 6,
      fontSize: 13,
      lineHeight: 20,
      fontFamily: 'DMSans_400Regular',
      color: colors.mutedForeground,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 14,
      marginBottom: 14,
    },
    checkLabel: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: 'DMSans_500Medium',
      color: colors.foreground,
    },
    label: {
      fontSize: 12,
      fontFamily: 'DMSans_700Bold',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: colors.mutedForeground,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 10,
      color: colors.foreground,
      fontSize: 15,
      fontFamily: 'DMSans_500Medium',
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
    },
    dangerButton: {
      minHeight: 46,
      borderRadius: 10,
      backgroundColor: colors.destructive,
      alignItems: 'center',
      justifyContent: 'center',
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
  });
}
