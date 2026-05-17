import { useColorScheme } from 'react-native';
import { colors, ColorScheme } from '@/constants/colors';

export function useColors(): ColorScheme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? colors.dark : colors.light;
}
