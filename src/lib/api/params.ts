import { z } from 'zod';

const uuid = z.string().uuid();

/**
 * Zod schema for trip route params: `id` plus any nested ids, all UUIDs.
 * e.g. `tripParams('dayId', 'legId')` for /api/trips/[id]/days/[dayId]/legs/[legId].
 */
export function tripParams<K extends string>(...nested: K[]) {
    const shape = Object.fromEntries([['id', uuid], ...nested.map((key) => [key, uuid])]);
    return z.object(shape) as z.ZodObject<Record<'id' | K, z.ZodString>>;
}

/** Params with a single `id` UUID (e.g. /api/expenses/[id]). */
export const idParams = z.object({ id: uuid });
