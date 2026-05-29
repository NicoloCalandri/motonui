import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { persistGetItem, persistSetItem } from '@/lib/persistence';

export type ThemePreference = 'system' | 'light' | 'dark';
export type AppLanguage = 'it' | 'en';

export interface NotificationPreferences {
  tripReminders: boolean;
  blogUpdates: boolean;
  productNews: boolean;
}

interface PreferencesState {
  themePreference: ThemePreference;
  language: AppLanguage;
  notifications: NotificationPreferences;
}

interface PreferencesContextValue extends PreferencesState {
  resolvedTheme: 'light' | 'dark';
  isHydrated: boolean;
  setThemePreference: (theme: ThemePreference) => void;
  setLanguage: (language: AppLanguage) => void;
  setNotifications: (notifications: NotificationPreferences) => void;
  updateNotifications: (patch: Partial<NotificationPreferences>) => void;
}

const PREFERENCES_STORAGE_KEY = 'motonui.mobile.preferences.v1';

const DEFAULT_PREFERENCES: PreferencesState = {
  themePreference: 'system',
  language: 'it',
  notifications: {
    tripReminders: true,
    blogUpdates: true,
    productNews: false,
  },
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function parseStoredPreferences(raw: string | null): PreferencesState {
  if (!raw) return DEFAULT_PREFERENCES;

  try {
    const parsed = JSON.parse(raw) as Partial<PreferencesState>;
    return {
      themePreference:
        parsed.themePreference === 'light' || parsed.themePreference === 'dark' || parsed.themePreference === 'system'
          ? parsed.themePreference
          : DEFAULT_PREFERENCES.themePreference,
      language: parsed.language === 'en' || parsed.language === 'it' ? parsed.language : DEFAULT_PREFERENCES.language,
      notifications: {
        tripReminders: typeof parsed.notifications?.tripReminders === 'boolean'
          ? parsed.notifications.tripReminders
          : DEFAULT_PREFERENCES.notifications.tripReminders,
        blogUpdates: typeof parsed.notifications?.blogUpdates === 'boolean'
          ? parsed.notifications.blogUpdates
          : DEFAULT_PREFERENCES.notifications.blogUpdates,
        productNews: typeof parsed.notifications?.productNews === 'boolean'
          ? parsed.notifications.productNews
          : DEFAULT_PREFERENCES.notifications.productNews,
      },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const systemTheme = useColorScheme();
  const [state, setState] = useState<PreferencesState>(DEFAULT_PREFERENCES);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const raw = await persistGetItem(PREFERENCES_STORAGE_KEY);
      if (cancelled) return;
      setState(parseStoredPreferences(raw));
      setIsHydrated(true);
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    void persistSetItem(PREFERENCES_STORAGE_KEY, JSON.stringify(state));
  }, [state, isHydrated]);

  const setThemePreference = useCallback((themePreference: ThemePreference) => {
    setState((prev) => ({ ...prev, themePreference }));
  }, []);

  const setLanguage = useCallback((language: AppLanguage) => {
    setState((prev) => ({ ...prev, language }));
  }, []);

  const setNotifications = useCallback((notifications: NotificationPreferences) => {
    setState((prev) => ({ ...prev, notifications }));
  }, []);

  const updateNotifications = useCallback((patch: Partial<NotificationPreferences>) => {
    setState((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        ...patch,
      },
    }));
  }, []);

  const resolvedTheme: 'light' | 'dark' =
    state.themePreference === 'system'
      ? (systemTheme === 'dark' ? 'dark' : 'light')
      : state.themePreference;

  const value = useMemo<PreferencesContextValue>(() => ({
    ...state,
    resolvedTheme,
    isHydrated,
    setThemePreference,
    setLanguage,
    setNotifications,
    updateNotifications,
  }), [state, resolvedTheme, isHydrated, setThemePreference, setLanguage, setNotifications, updateNotifications]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used inside PreferencesProvider');
  }
  return ctx;
}
