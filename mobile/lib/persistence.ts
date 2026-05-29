import { Platform } from 'react-native';

interface KeyValueStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

const webStorage: KeyValueStorage = {
  getItem: (key: string): Promise<string | null> => {
    if (typeof localStorage === 'undefined') return Promise.resolve(null);
    return Promise.resolve(localStorage.getItem(key));
  },
  setItem: (key: string, value: string): Promise<void> => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
    return Promise.resolve();
  },
};

let secureStorage: KeyValueStorage | null = null;

async function getNativeStorage(): Promise<KeyValueStorage> {
  if (secureStorage) return secureStorage;

  const SecureStore = await import('expo-secure-store');
  secureStorage = {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key),
  };
  return secureStorage;
}

async function resolveStorage(): Promise<KeyValueStorage> {
  if (Platform.OS === 'web') return webStorage;
  return getNativeStorage();
}

export async function persistGetItem(key: string): Promise<string | null> {
  const storage = await resolveStorage();
  return storage.getItem(key);
}

export async function persistSetItem(key: string, value: string): Promise<void> {
  const storage = await resolveStorage();
  await storage.setItem(key, value);
}

export async function persistRemoveItem(key: string): Promise<void> {
  const storage = await resolveStorage();
  await storage.removeItem(key);
}
