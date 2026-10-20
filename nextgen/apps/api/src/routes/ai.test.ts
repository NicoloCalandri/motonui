import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * AI routes and the quota: one accepted call consumes exactly one unit,
 * through the consume_feature_quota RPC and nothing else; a request refused
 * before the model is called consumes none.
 */

const TRIP = '10000000-0000-4000-8000-00000000000a';
const USER = { id: '00000000-0000-4000-8000-00000000000c', email: 'user@example.com' };

const state = vi.hoisted(() => ({
    rpc: [] as Array<{ fn: string; args: Record<string, unknown> }>,
    tables: [] as string[],
    quotaError: null as null | { message: string; details?: string },
    member: true,
}));

function stubClient() {
    const rows: Record<string, unknown> = {
        profiles: { role: 'user', plan: 'premium', premium_until: null, suspended_at: null },
        feature_controls: { enabled: true, hard_daily_cap: null, daily_usage: 0, usage_date: '2026-10-10', alert_thresholds: [70, 85, 100], alerted_thresholds: [] },
        trips: { id: TRIP, owner_id: 'someone-else', title: 'Rapa Nui', destination: 'Isola di Pasqua', start_date: '2026-10-01', end_date: '2026-10-05', days: [], expenses: [] },
    };
    const builder = (table: string) => {
        state.tables.push(table);
        const chain: Record<string, unknown> = {};
        for (const method of ['select', 'eq', 'neq', 'in', 'order', 'limit', 'insert', 'update', 'upsert', 'delete', 'gte', 'lte']) chain[method] = () => chain;
        const one = async () => {
            if (table === 'trip_members') return { data: state.member ? { trip_id: TRIP } : null, error: null };
            return { data: rows[table] ?? null, error: null };
        };
        chain.single = one;
        chain.maybeSingle = one;
        chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(resolve);
        return chain;
    };
    return {
        auth: { getUser: async () => ({ data: { user: USER } }) },
        from: builder,
        rpc: async (fn: string, args: Record<string, unknown>) => {
            state.rpc.push({ fn, args });
            if (fn === 'check_rate_limit') return { data: [{ allowed: true, hits: 1, reset_at: new Date(Date.now() + 1000).toISOString() }], error: null };
            if (fn === 'consume_feature_quota') return state.quotaError ? { data: null, error: state.quotaError } : { data: 1, error: null };
            return { data: null, error: null };
        },
    };
}

vi.mock('../lib/supabase/server', () => ({
    createUserClient: () => stubClient(),
    createAnonClient: () => stubClient(),
    createAdminClient: () => stubClient(),
}));

const ai = vi.hoisted(() => ({ stream: vi.fn(), briefing: vi.fn(), summary: vi.fn() }));
vi.mock('../lib/ai/blog-assistant', () => ({ streamBlogAssistant: ai.stream }));
vi.mock('../lib/ai/destination', () => ({ getDestinationBriefing: ai.briefing }));
vi.mock('../lib/ai/trip-summary', () => ({ generateTripSummary: ai.summary }));

import { createApp } from '../app';

function post(path: string, body: unknown) {
    return createApp().request(path, {
        method: 'POST',
        headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

const quotaCalls = () => state.rpc.filter((call) => call.fn === 'consume_feature_quota');

const CALLS: Array<[string, unknown, string]> = [
    ['/api/ai/blog', { command: 'improve', selectedText: 'testo' }, 'ai_blog'],
    ['/api/ai/destination', { destination: 'Rapa Nui' }, 'ai_destination'],
    ['/api/ai/generate-post', { tripId: TRIP }, 'ai_generate_post'],
];

describe('AI routes and the quota', () => {
    beforeEach(() => {
        state.rpc = [];
        state.tables = [];
        state.quotaError = null;
        state.member = true;
        vi.clearAllMocks();
        ai.stream.mockReturnValue(new ReadableStream({ start: (controller) => controller.close() }));
        ai.briefing.mockResolvedValue({ summary: 'ok' });
        ai.summary.mockResolvedValue({ title: 'Rapa Nui', content_json: { type: 'doc', content: [] }, seo_description: 'x' });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it.each(CALLS)('%s consumes one unit of its feature through the RPC, and nothing else', async (path, body, feature) => {
        const res = await post(path, body);

        expect(res.status).toBe(200);
        expect(quotaCalls()).toHaveLength(1);
        expect(quotaCalls()[0].args).toMatchObject({ p_user_id: USER.id, p_feature: feature, p_amount: 1 });
        // The old per-model limiter wrote to ai_usage: it must be gone.
        expect(state.tables).not.toContain('ai_usage');
    });

    it.each(CALLS)('%s with an invalid body consumes nothing and never reaches the model', async (path) => {
        const res = await post(path, { command: 'nope', destination: '', tripId: 'abc' });

        expect(res.status).toBe(400);
        expect(quotaCalls()).toEqual([]);
        expect(ai.stream).not.toHaveBeenCalled();
        expect(ai.briefing).not.toHaveBeenCalled();
        expect(ai.summary).not.toHaveBeenCalled();
    });

    it.each(CALLS)('%s over the daily quota answers 429 and does not call the model', async (path, body) => {
        state.quotaError = { message: 'QUOTA_EXCEEDED', details: 'ai_total:day' };

        const res = await post(path, body);

        expect(res.status).toBe(429);
        expect(await res.json()).toMatchObject({ code: 'AI_DAILY_LIMIT_REACHED', status: 429 });
        expect(ai.stream).not.toHaveBeenCalled();
        expect(ai.briefing).not.toHaveBeenCalled();
        expect(ai.summary).not.toHaveBeenCalled();
    });

    it('generate-post for a trip the caller is not in consumes nothing', async () => {
        state.member = false;

        const res = await post('/api/ai/generate-post', { tripId: TRIP });

        expect(res.status).toBe(403);
        expect(quotaCalls()).toEqual([]);
        expect(ai.summary).not.toHaveBeenCalled();
    });
});
