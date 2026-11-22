import { z } from 'zod';

/**
 * Row ids: 8-4-4-4-12 hexadecimal, any version. Zod 4's `z.string().uuid()`
 * follows RFC 9562 strictly (version and variant nibbles) and rejects ids
 * like the dev seed's `00000000-0000-0000-0000-000000000001`, which Zod 3
 * accepted. Postgres stores them all as `uuid`: the check here is about shape,
 * so a malformed id is a 400 before any query. A regex works the same on
 * Zod 3 (nextgen/) and Zod 4 (the app).
 */
export const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function guid() {
    return z.string().regex(GUID_PATTERN, 'identificativo non valido');
}
