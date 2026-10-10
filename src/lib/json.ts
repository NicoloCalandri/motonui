import type { Json } from '@/lib/supabase/database.types';

/**
 * json/jsonb columns are typed `Json`. Domain interfaces (TiptapDoc,
 * PackingCategoryGroup, DailyWeather…) are plain JSON at runtime but lack
 * the index signature `Json` requires, so the conversion is stated once here
 * instead of as scattered double casts.
 */
export function toJson<T>(value: T): Json {
    return value as unknown as Json;
}

/** Reads a json/jsonb column as the domain type the app wrote into it. */
export function fromJson<T>(value: Json | null): T {
    return value as unknown as T;
}
