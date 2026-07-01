const DEFAULT_APP_URL = 'http://localhost:3000';

export function getAppBaseUrl(value = process.env.NEXT_PUBLIC_APP_URL): URL {
    const normalizedValue = value?.trim();

    if (!normalizedValue) {
        return new URL(DEFAULT_APP_URL);
    }

    try {
        return new URL(normalizedValue);
    } catch {
        return new URL(DEFAULT_APP_URL);
    }
}
