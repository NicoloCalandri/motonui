import { describe, it, expect } from 'vitest';
import { getAuthUser, getOptionalAuthUser } from './get-user';

const supabaseWith = (user: { id: string } | null) => ({
    auth: { getUser: async () => ({ data: { user } }) },
});

describe('getAuthUser', () => {
    it('returns the signed-in user', async () => {
        await expect(getAuthUser(supabaseWith({ id: 'user-1' }))).resolves.toEqual({ id: 'user-1' });
    });

    it('throws UNAUTHORIZED without a session', async () => {
        await expect(getAuthUser(supabaseWith(null))).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
});

describe('getOptionalAuthUser', () => {
    it('returns the signed-in user', async () => {
        await expect(getOptionalAuthUser(supabaseWith({ id: 'user-1' }))).resolves.toEqual({ id: 'user-1' });
    });

    it('returns null without a session instead of throwing', async () => {
        await expect(getOptionalAuthUser(supabaseWith(null))).resolves.toBeNull();
    });
});
