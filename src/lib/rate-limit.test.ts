// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/database.types';
import { RATE_LIMITS, RateLimitError, clientIp, enforceRateLimit, ipSubject, userSubject } from './rate-limit';

const NOW = new Date('2026-10-06T10:00:30Z');

function admin(result: { data: unknown; error: { message: string } | null }) {
    const rpc = vi.fn(async () => result);
    return { client: { rpc } as unknown as SupabaseClient<Database>, rpc };
}

describe('enforceRateLimit (T-4.5)', () => {
    it('passes the bucket limits to check_rate_limit with a namespaced key', async () => {
        const { client, rpc } = admin({ data: [{ allowed: true, hits: 1, reset_at: '2026-10-06T10:01:00Z' }], error: null });

        await enforceRateLimit('ai', userSubject('u-1'), { admin: client, now: NOW });

        expect(rpc).toHaveBeenCalledWith('check_rate_limit', {
            p_key: 'user:u-1:ai', p_limit: RATE_LIMITS.ai.limit, p_window_seconds: RATE_LIMITS.ai.windowSeconds,
        });
    });

    it('throws a 429 with the seconds left in the window over the limit', async () => {
        const { client } = admin({ data: [{ allowed: false, hits: 11, reset_at: '2026-10-06T10:01:00Z' }], error: null });

        const err = await enforceRateLimit('ai', userSubject('u-1'), { admin: client, now: NOW }).catch((e: unknown) => e);

        expect(err).toBeInstanceOf(RateLimitError);
        expect(err).toMatchObject({ status: 429, code: 'TOO_MANY_REQUESTS', retryAfterSeconds: 30 });
    });

    it('fails open and logs when the counter is unavailable', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { client } = admin({ data: null, error: { message: 'connection refused' } });

        await expect(enforceRateLimit('publicPost', 'ip:x', { admin: client, now: NOW })).resolves.toBeUndefined();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});

describe('client keys', () => {
    it('takes the first forwarded address and never stores it in clear', () => {
        const request = new Request('http://x', { headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } });
        expect(clientIp(request)).toBe('203.0.113.7');
        expect(ipSubject(request)).toMatch(/^ip:[0-9a-f]{32}$/);
        expect(ipSubject(request)).not.toContain('203.0.113.7');
        expect(clientIp(new Request('http://x'))).toBe('unknown');
    });
});
