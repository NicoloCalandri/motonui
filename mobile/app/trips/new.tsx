import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useColors } from '@/hooks/useColors';
import { queryClient } from '@/lib/queryClient';
import { validateTripInput, type NewTripData } from '@/lib/validation';

function generateUuidV4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : [8, 9, 10, 11][Math.floor(Math.random() * 4)];
    return value.toString(16);
  });
}

async function createTrip(data: NewTripData, userId: string) {
  const tripId = generateUuidV4();

  const { error } = await supabase
    .from('trips')
    .insert({
      id: tripId,
      title: data.title,
      destination: data.destination,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      description: data.description || null,
      owner_id: userId,
      status: 'planning',
    });
  if (error) throw error;

  const { error: memberError } = await supabase.from('trip_members').insert({
    trip_id: tripId,
    user_id: userId,
    role: 'owner',
  });
  if (memberError) {
    const { error: rollbackError } = await supabase.from('trips').delete().eq('id', tripId);
    if (rollbackError && __DEV__) {
      console.warn(`[trips][create] rollback failed: ${rollbackError.message}`);
    }
    throw new Error(`Impossibile aggiungere il creatore al viaggio: ${memberError.message}`);
  }

  const { data: trip, error: tripFetchError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();
  if (tripFetchError) {
    throw new Error(`Viaggio creato ma non recuperabile: ${tripFetchError.message}`);
  }

  return trip;
}

export default function NewTripScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, loading } = useAuth();

  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');

  const styles = makeStyles(colors, insets);

  const mutation = useMutation({
    mutationFn: (data: NewTripData) => createTrip(validateTripInput(data), user!.id),
    onSuccess: (trip) => {
      queryClient.invalidateQueries({ queryKey: ['trips', user?.id] });
      queryClient.setQueryData(['trip', trip.id], trip);
      if (Platform.OS !== 'web') {
        try {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch((error) => {
            if (__DEV__) {
              const message = error instanceof Error ? error.message : 'unknown error';
              console.warn(`[trips][create][haptics] notification failed: ${message}`);
            }
          });
        } catch (error) {
          if (__DEV__) {
            const message = error instanceof Error ? error.message : 'unknown error';
            console.warn(`[trips][create][haptics] notification failed: ${message}`);
          }
        }
      }
      router.replace(`/trips/${trip.id}` as any);
    },
    onError: (err: Error) => {
      Alert.alert('Errore', err.message);
    },
  });

  const handleCreate = () => {
    if (loading || !user?.id) {
      Alert.alert('Attendi', 'Stiamo ancora caricando il tuo account. Riprova tra un attimo.');
      return;
    }

    const payload: NewTripData = {
      title,
      destination,
      start_date: startDate,
      end_date: endDate,
      description,
    };

    try {
      const validated = validateTripInput(payload);
      mutation.mutate(validated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dati non validi.';
      Alert.alert('Dati non validi', message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} activeOpacity={0.7}>
          <Ionicons name="close" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.modalTitle}>Nuovo viaggio</Text>
        <TouchableOpacity
          style={[styles.saveBtn, (loading || !user?.id || !title.trim() || !destination.trim()) && styles.saveBtnDisabled]}
          onPress={handleCreate}
          disabled={loading || mutation.isPending || !user?.id || !title.trim() || !destination.trim()}
          activeOpacity={0.8}
        >
          {mutation.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Crea</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.form}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Nome viaggio *</Text>
          <TextInput
            style={styles.input}
            placeholder="es. Viaggio in Giappone"
            placeholderTextColor={colors.mutedForeground}
            value={title}
            onChangeText={setTitle}
            autoFocus
            returnKeyType="next"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Destinazione *</Text>
          <TextInput
            style={styles.input}
            placeholder="es. Tokyo, Osaka, Kyoto"
            placeholderTextColor={colors.mutedForeground}
            value={destination}
            onChangeText={setDestination}
            returnKeyType="next"
          />
        </View>

        <View style={styles.dateRow}>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.label}>Data inizio</Text>
            <TextInput
              style={styles.input}
              placeholder="AAAA-MM-GG"
              placeholderTextColor={colors.mutedForeground}
              value={startDate}
              onChangeText={setStartDate}
              keyboardType="numbers-and-punctuation"
              returnKeyType="next"
            />
          </View>
          <View style={styles.dateSeparator} />
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.label}>Data fine</Text>
            <TextInput
              style={styles.input}
              placeholder="AAAA-MM-GG"
              placeholderTextColor={colors.mutedForeground}
              value={endDate}
              onChangeText={setEndDate}
              keyboardType="numbers-and-punctuation"
              returnKeyType="next"
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Descrizione</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Note, obiettivi del viaggio..."
            placeholderTextColor={colors.mutedForeground}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            returnKeyType="done"
          />
        </View>

        <View style={styles.tip}>
          <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
          <Text style={styles.tipText}>
            Puoi aggiungere l'itinerario, le spese e i media dopo aver creato il viaggio.
          </Text>
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
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 12),
      paddingBottom: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalTitle: {
      fontSize: 17,
      fontFamily: 'DMSans_700Bold',
      color: colors.foreground,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 8,
      minWidth: 60,
      alignItems: 'center',
    },
    saveBtnDisabled: {
      opacity: 0.4,
    },
    saveBtnText: {
      color: colors.primaryForeground,
      fontSize: 15,
      fontFamily: 'DMSans_700Bold',
    },
    form: {
      flex: 1,
    },
    formContent: {
      padding: 20,
      gap: 4,
    },
    fieldGroup: {
      marginBottom: 16,
    },
    label: {
      fontSize: 13,
      fontFamily: 'DMSans_700Bold',
      color: colors.foreground,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: 'DMSans_400Regular',
      color: colors.foreground,
    },
    textArea: {
      height: 100,
      paddingTop: 12,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    dateSeparator: {
      width: 12,
    },
    tip: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: 12,
      padding: 14,
      marginTop: 8,
    },
    tipText: {
      flex: 1,
      fontSize: 13,
      fontFamily: 'DMSans_400Regular',
      color: colors.mutedForeground,
      lineHeight: 18,
    },
  });
}
