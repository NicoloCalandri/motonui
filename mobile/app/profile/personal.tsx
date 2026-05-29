import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useColors } from '@/hooks/useColors';
import { sanitizeTextInput } from '@/lib/validation';
import type { Profile } from '@/types';

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) return null;
  return data;
}

export default function PersonalDataScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user?.id,
  });

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '');
    setAvatarUrl(profile?.avatar_url ?? '');
  }, [profile?.display_name, profile?.avatar_url]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Utente non autenticato.');
      const cleanDisplayName = sanitizeTextInput(displayName, 120);
      const cleanAvatarUrl = avatarUrl.trim();

      if (!cleanDisplayName) {
        throw new Error('Inserisci un nome visualizzato valido.');
      }

      if (cleanAvatarUrl && !/^https?:\/\//i.test(cleanAvatarUrl)) {
        throw new Error('URL avatar non valido. Usa un URL http o https.');
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: cleanDisplayName,
          avatar_url: cleanAvatarUrl || null,
        })
        .eq('id', user.id);

      if (error) throw error;
      return { display_name: cleanDisplayName, avatar_url: cleanAvatarUrl || null };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['profile', user?.id], (prev: Profile | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          display_name: data.display_name,
          avatar_url: data.avatar_url,
        };
      });
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      Alert.alert('Salvato', 'Dati personali aggiornati con successo.');
    },
    onError: (error: Error) => {
      Alert.alert('Errore', error.message);
    },
  });

  const avatarMutation = useMutation({
    mutationFn: async (source: 'camera' | 'gallery') => {
      if (!user?.id) throw new Error('Utente non autenticato.');

      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          throw new Error('Permesso fotocamera non concesso.');
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          throw new Error('Permesso galleria non concesso.');
        }
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.9,
        })
        : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.9,
        });

      if (result.canceled || !result.assets?.[0]) {
        return null;
      }

      const asset = result.assets[0];
      const uri = asset.uri;
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const ext = mimeType.includes('png')
        ? 'png'
        : mimeType.includes('webp')
          ? 'webp'
          : mimeType.includes('heic')
            ? 'heic'
            : 'jpg';

      if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(mimeType)) {
        throw new Error('Formato non supportato. Usa JPEG, PNG, WebP o HEIC.');
      }

      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        throw new Error('Immagine troppo grande. Massimo 5 MB.');
      }

      const response = await fetch(uri);
      const blob = await response.blob();

      if (blob.size > 5 * 1024 * 1024) {
        throw new Error('Immagine troppo grande. Massimo 5 MB.');
      }

      const storagePath = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(storagePath, blob, { contentType: mimeType, upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(storagePath);
      const nextAvatarUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: nextAvatarUrl })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      return nextAvatarUrl;
    },
    onSuccess: (nextAvatarUrl) => {
      if (!nextAvatarUrl) return;
      setAvatarUrl(nextAvatarUrl);
      queryClient.setQueryData(['profile', user?.id], (prev: Profile | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          avatar_url: nextAvatarUrl,
        };
      });
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      Alert.alert('Avatar aggiornato', 'Nuova immagine profilo salvata.');
    },
    onError: (error: Error) => {
      Alert.alert('Errore upload avatar', error.message);
    },
  });

  const styles = makeStyles(colors, insets);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.foreground} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dati personali</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
          <Text style={styles.label}>Avatar</Text>
          <View style={styles.avatarRow}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarPreview} />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={26} color={colors.mutedForeground} />
              </View>
            )}
            <View style={{ flex: 1, gap: 8 }}>
              <TouchableOpacity
                style={[styles.secondaryButton, avatarMutation.isPending && styles.primaryButtonDisabled]}
                onPress={() => avatarMutation.mutate('gallery')}
                disabled={avatarMutation.isPending}
                activeOpacity={0.85}
              >
                <Ionicons name="images-outline" size={16} color={colors.foreground} />
                <Text style={styles.secondaryButtonText}>Scegli dalla galleria</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, avatarMutation.isPending && styles.primaryButtonDisabled]}
                onPress={() => avatarMutation.mutate('camera')}
                disabled={avatarMutation.isPending}
                activeOpacity={0.85}
              >
                <Ionicons name="camera-outline" size={16} color={colors.foreground} />
                <Text style={styles.secondaryButtonText}>Scatta una foto</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.label}>Nome visualizzato</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            style={styles.input}
            placeholder="Il tuo nome"
            placeholderTextColor={colors.mutedForeground}
            maxLength={120}
          />

          <Text style={styles.label}>URL avatar</Text>
          <TextInput
            value={avatarUrl}
            onChangeText={setAvatarUrl}
            style={styles.input}
            placeholder="https://..."
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            keyboardType="url"
          />

          <TouchableOpacity
            style={[styles.primaryButton, mutation.isPending && styles.primaryButtonDisabled]}
            onPress={() => mutation.mutate()}
            disabled={mutation.isPending}
            activeOpacity={0.85}
          >
            {mutation.isPending
              ? <ActivityIndicator color={colors.primaryForeground} size="small" />
              : <Text style={styles.primaryButtonText}>Salva modifiche</Text>}
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
    center: {
      alignItems: 'center',
      justifyContent: 'center',
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
      padding: 14,
    },
    avatarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 10,
    },
    avatarPreview: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.muted,
    },
    avatarFallback: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      fontSize: 12,
      fontFamily: 'DMSans_700Bold',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: colors.mutedForeground,
      marginBottom: 8,
      marginTop: 4,
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
      marginTop: 8,
      backgroundColor: colors.primary,
      borderRadius: 10,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: colors.primaryForeground,
      fontSize: 14,
      fontFamily: 'DMSans_700Bold',
    },
    secondaryButton: {
      minHeight: 40,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
      flexDirection: 'row',
      gap: 6,
    },
    secondaryButtonText: {
      color: colors.foreground,
      fontSize: 13,
      fontFamily: 'DMSans_500Medium',
    },
  });
}
