import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (isDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const buttonStyle = [
    styles.base,
    variant === 'secondary' && styles.secondary,
    variant === 'destructive' && styles.destructive,
    isDisabled && styles.disabled,
    isDisabled && styles.noPointerEvents,
    style,
  ];

  const textStyle = [
    styles.text,
    variant === 'secondary' && styles.textSecondary,
    variant === 'destructive' && styles.textDestructive,
  ];

  return (
    <TouchableOpacity style={buttonStyle} onPress={handlePress} activeOpacity={0.8} accessibilityState={{ disabled: isDisabled }}>
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.foreground : colors.primaryForeground} size="small" />
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>) {
  return StyleSheet.create({
    base: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    secondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    destructive: {
      backgroundColor: colors.destructive,
    },
    disabled: {
      opacity: 0.5,
    },
    noPointerEvents: {
      pointerEvents: 'none',
    },
    text: {
      color: colors.primaryForeground,
      fontSize: 15,
      fontFamily: 'DMSans_700Bold',
    },
    textSecondary: {
      color: colors.foreground,
    },
    textDestructive: {
      color: colors.destructiveForeground,
    },
  });
}
