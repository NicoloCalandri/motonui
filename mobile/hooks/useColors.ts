import { colors, ColorScheme } from '@/constants/colors';
import { usePreferences } from '@/hooks/usePreferences';

export function useColors(): ColorScheme {
  const { resolvedTheme } = usePreferences();
  return resolvedTheme === 'dark' ? colors.dark : colors.light;
}
