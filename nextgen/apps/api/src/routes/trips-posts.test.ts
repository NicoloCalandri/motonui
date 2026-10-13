import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The content of a post is sanitized on every save, create and update alike:
 * the editor's autosave goes through the update route. Counterpart of
 * src/app/api/trips/[id]/posts/** (postContentSchema).
 */

const TRIP = '10000000-0000-4000-8000-00000000000a';
const POST_ID = '50000000-0000-4000-8000-00000000000f';
const USER = { id: '00000000-0000-4000-8000-00000000000c', email: 'user@example.com' };

const state = vi.hoisted(() => ({ writes: [] as Array<{ op: string; payload: Record<string, unknown> }> }));

function stubClient() {
    const builder = (table: string) => {
        const chain: Record<string, unknown> = {};
        for (const method of ['select', 'eq', 'order', 'limit']) chain[method] = () => chain;
        for (const op of ['insert', 'update']) {
            chain[op] = (payload: Record<string, unknown>) => {
                if (table === 'posts') state.writes.push({ op, payload });
                return chain;
            };
        }
        const row = { id: POST_ID, trip_id: TRIP, user_id: USER.id, owner_id: USER.id, role: 'user', suspended_at: null };
        chain.single = async () => ({ data: row, error: null });
        chain.maybeSingle = async () => ({ data: row, error: null });
        chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [row], error: null }).then(resolve);
        return chain;
    };
    return { auth: { getUser: async () => ({ data: { user: USER } }) }, from: builder };
}

vi.mock('../lib/supabase/server', () => ({
    createUserClient: () => stubClient(),
    createAnonClient: () => stubClient(),
    createAdminClient: () => stubClient(),
}));

import { createApp } from '../app';

function send(method: string, path: string, body: Record<string, unknown>) {
    return createApp().request(`/api/trips/${TRIP}/posts${path}`, {
        method,
        headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

const paragraph = (marks: unknown[]) => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rapa Nui', marks }] }],
});
const HOSTILE = paragraph([{ type: 'link', attrs: { href: 'javascript:alert(document.cookie)' } }]);
const SAFE = paragraph([{ type: 'link', attrs: { href: 'https://motonui.app/blog' } }]);

const ROUTES: Array<[string, string, string, Record<string, unknown>]> = [
    ['create', 'POST', '', { title: 'Rapa Nui', slug: 'rapa-nui' }],
    ['update', 'PUT', `/${POST_ID}`, {}],
    // The editor autosaves with PATCH.
    ['autosave', 'PATCH', `/${POST_ID}`, {}],
];

beforeEach(() => {
    state.writes = [];
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe.each(ROUTES)('post content on %s', (_label, method, path, base) => {
    it('never stores a script link', async () => {
        const res = await send(method, path, { ...base, content_json: HOSTILE });

        expect(res.status).toBeLessThan(300);
        const stored = JSON.stringify(state.writes[0].payload.content_json);
        expect(stored).toContain('Rapa Nui');
        expect(stored).not.toContain('javascript:');
    });

    it('keeps a safe link', async () => {
        await send(method, path, { ...base, content_json: SAFE });

        expect(JSON.stringify(state.writes[0].payload.content_json)).toContain('https://motonui.app/blog');
    });

    it.each([
        ['a string', '<script>alert(1)</script>'],
        ['a document without the doc root', { type: 'paragraph', content: [] }],
        ['an array', [HOSTILE]],
    ])('refuses %s', async (_name, content_json) => {
        const res = await send(method, path, { ...base, content_json });

        expect(res.status).toBe(400);
        expect(state.writes).toEqual([]);
    });
});

describe('PUT /api/trips/:id/posts/:postId', () => {
    it('clears the content with null', async () => {
        const res = await send('PUT', `/${POST_ID}`, { content_json: null });

        expect(res.status).toBe(200);
        expect(state.writes[0].payload).toHaveProperty('content_json', null);
    });

    it('leaves the content alone when it is not sent', async () => {
        await send('PUT', `/${POST_ID}`, { title: 'Nuovo titolo' });

        expect(state.writes[0].payload).not.toHaveProperty('content_json');
    });
});
