import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { AUTHENTICATED_ROUTE } from '@/constants/routes';
import { useColors } from '@/hooks/useColors';

const OTP_LENGTH = 8;
const normalizeOtp = (value: string) => value.replace(/\D/g, '').slice(0, OTP_LENGTH);

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);

  const styles = makeStyles(colors, insets);
  const notify = (type: Haptics.NotificationFeedbackType) => {
    if (Platform.OS === 'web') return;
    try {
      void Haptics.notificationAsync(type).catch((error) => {
        if (__DEV__) {
          const message = error instanceof Error ? error.message : 'unknown error';
          console.warn(`[auth][haptics] notification failed: ${message}`);
        }
      });
    } catch (error) {
      if (__DEV__) {
        const message = error instanceof Error ? error.message : 'unknown error';
        console.warn(`[auth][haptics] notification failed: ${message}`);
      }
    }
  };

  const sendOtp = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert('Email mancante', 'Inserisci la tua email per ricevere il codice.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: trimmedEmail });
      if (error) {
        Alert.alert('Errore', error.message);
      } else {
        notify(Haptics.NotificationFeedbackType.Success);
        setStep('otp');
      }
    } catch (error) {
      Alert.alert('Errore', error instanceof Error ? error.message : 'Impossibile inviare il codice. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    const normalizedOtp = normalizeOtp(otp);
    if (normalizedOtp.length !== OTP_LENGTH) {
      Alert.alert('Codice non valido', `Inserisci un codice di ${OTP_LENGTH} cifre.`);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: normalizedOtp,
        type: 'email',
      });
      if (error) {
        Alert.alert('Codice non valido', 'Controlla il codice e riprova.');
        notify(Haptics.NotificationFeedbackType.Error);
      } else {
        notify(Haptics.NotificationFeedbackType.Success);
        router.replace(AUTHENTICATED_ROUTE);
      }
    } catch (error) {
      Alert.alert('Errore', error instanceof Error ? error.message : 'Impossibile verificare il codice. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="compass" size={32} color={colors.primaryForeground} />
          </View>
          <Text style={styles.appName}>motonui</Text>
          <Text style={styles.tagline}>Il tuo compagno di viaggio</Text>
        </View>

        <View style={styles.card}>
          {step === 'email' ? (
            <>
              <Text style={styles.title}>Accedi</Text>
              <Text style={styles.subtitle}>
                Inserisci la tua email. Ti invieremo un codice di accesso.
              </Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="la-tua@email.com"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  returnKeyType="send"
                  onSubmitEditing={sendOtp}
                />
              </View>
              <TouchableOpacity
                style={[styles.button, (loading || !email.trim()) && styles.buttonDisabled]}
                onPress={sendOtp}
                disabled={loading || !email.trim()}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.buttonText}>Invia codice</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={() => setStep('email')} style={styles.backButton}>
                <Ionicons name="arrow-back" size={20} color={colors.foreground} />
                <Text style={styles.backText}>Cambia email</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Controlla la tua email</Text>
              <Text style={styles.subtitle}>
                Abbiamo inviato un codice a{' '}
                <Text style={{ fontFamily: 'DMSans_700Bold', color: colors.foreground }}>{email}</Text>
              </Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="key-outline" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder={`Codice a ${OTP_LENGTH} cifre`}
                  placeholderTextColor={colors.mutedForeground}
                  value={otp}
                  onChangeText={(value) => setOtp(normalizeOtp(value))}
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={verifyOtp}
                />
              </View>
              <TouchableOpacity
                style={[styles.button, (loading || otp.length < OTP_LENGTH) && styles.buttonDisabled]}
                onPress={verifyOtp}
                disabled={loading || otp.length < OTP_LENGTH}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.buttonText}>Accedi</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.resendButton} onPress={sendOtp}>
                <Text style={styles.resendText}>Non hai ricevuto il codice? Rinvia</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>, insets: ReturnType<typeof import('react-native-safe-area-context').useSafeAreaInsets>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingTop: insets.top + 40,
      paddingBottom: insets.bottom + 40,
    },
    header: {
      alignItems: 'center',
      marginBottom: 40,
    },
    logoContainer: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    appName: {
      fontSize: 28,
      fontFamily: 'DMSans_700Bold',
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    tagline: {
      fontSize: 15,
      fontFamily: 'DMSans_400Regular',
      color: colors.mutedForeground,
      marginTop: 4,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      fontSize: 22,
      fontFamily: 'DMSans_700Bold',
      color: colors.foreground,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      fontFamily: 'DMSans_400Regular',
      color: colors.mutedForeground,
      marginBottom: 24,
      lineHeight: 20,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
      paddingHorizontal: 14,
    },
    inputIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      height: 50,
      fontSize: 16,
      fontFamily: 'DMSans_400Regular',
      color: colors.foreground,
    },
    otpInput: {
      letterSpacing: 4,
      fontSize: 20,
      fontFamily: 'DMSans_700Bold',
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontFamily: 'DMSans_700Bold',
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      gap: 6,
    },
    backText: {
      fontSize: 14,
      fontFamily: 'DMSans_500Medium',
      color: colors.foreground,
    },
    resendButton: {
      alignItems: 'center',
      marginTop: 16,
    },
    resendText: {
      fontSize: 13,
      fontFamily: 'DMSans_400Regular',
      color: colors.mutedForeground,
    },
  });
}
