import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const webStorage = {
  getItem: (key: string): Promise<string | null> => {
    if (typeof localStorage === 'undefined') return Promise.resolve(null);
    return Promise.resolve(localStorage.getItem(key));
  },
  setItem: (key: string, value: string): Promise<void> => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    return Promise.resolve();
  },
};

let secureStorage: typeof webStorage | null = null;

const nativeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (!secureStorage) {
      const SecureStore = await import('expo-secure-store');
      secureStorage = {
        getItem: (k: string) => SecureStore.getItemAsync(k),
        setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v),
        removeItem: (k: string) => SecureStore.deleteItemAsync(k),
      };
    }
    return secureStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (!secureStorage) {
      const SecureStore = await import('expo-secure-store');
      secureStorage = {
        getItem: (k: string) => SecureStore.getItemAsync(k),
        setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v),
        removeItem: (k: string) => SecureStore.deleteItemAsync(k),
      };
    }
    return secureStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (!secureStorage) {
      const SecureStore = await import('expo-secure-store');
      secureStorage = {
        getItem: (k: string) => SecureStore.getItemAsync(k),
        setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v),
        removeItem: (k: string) => SecureStore.deleteItemAsync(k),
      };
    }
    return secureStorage.removeItem(key);
  },
};

// Provide ws transport for Node.js SSR (Expo web SSR with Node.js < 22)
// In the browser, native WebSocket is used automatically
let wsTransport: any;
if (typeof WebSocket === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    wsTransport = require('ws');
  } catch {
    // ignore
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? webStorage : nativeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: wsTransport ? { transport: wsTransport } : undefined,
});
