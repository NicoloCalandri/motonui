// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryChain, type QueryChain } from '@/test/supabase-mock';

const TRIP = '10000000-0000-0000-0000-00000000000a';
const POST_ID = '40000000-0000-0000-0000-00000000000e';
const USER = { id: '00000000-0000-0000-0000-00000000000a' };

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    posts: vi.fn(),
    requireTripMember: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mocks.getUser },
        from: vi.fn(() => mocks.posts()),
    })),
}));
vi.mock('@/lib/authz', () => ({ requireTripMember: mocks.requireTripMember, requireDayInTrip: vi.fn() }));

import { POST } from './route';
import { PUT } from './[postId]/route';

const tripCtx = { params: Promise.resolve({ id: TRIP }) };
const postCtx = { params: Promise.resolve({ id: TRIP, postId: POST_ID }) };

function json(method: 'POST' | 'PUT', body: unknown) {
    const url = `http://localhost/api/trips/${TRIP}/posts${method === 'PUT' ? `/${POST_ID}` : ''}`;
    // The raw string keeps "__proto__" as an own key, as a real request body would.
    return new Request(url, { method, headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

// What a trip member could send straight to the API, bypassing the editor.
const HOSTILE_DOC = `{"type":"doc","content":[
  {"type":"paragraph","attrs":{"__proto__":{"onclick":"alert(1)"},"onmouseover":"alert(2)"},"content":[
    {"type":"text","text":"ciao","marks":[{"type":"link","attrs":{"href":"https://a.example","onfocus":"alert(3)"}},{"type":"script"}]}]},
  {"type":"iframe","attrs":{"src":"https://evil.example"}},
  {"type":"image","attrs":{"src":"javascript:alert(4)"}}]}`;

const CLEAN_DOC = {
    type: 'doc',
    content: [{
        type: 'paragraph',
        content: [{
            type: 'text',
            text: 'ciao',
            marks: [{ type: 'link', attrs: { href: 'https://a.example/', target: '_blank', rel: 'noopener noreferrer nofollow' } }],
        }],
    }],
};

let chain: QueryChain;

describe('posts routes sanitize content_json', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.getUser.mockResolvedValue({ data: { user: USER } });
        mocks.requireTripMember.mockResolvedValue(undefined);
        chain = queryChain({ data: { id: POST_ID }, error: null });
        mocks.posts.mockReturnValue(chain);
    });

    it('PUT stores the sanitized document, not the one received', async () => {
        const res = await PUT(json('PUT', `{"content_json":${HOSTILE_DOC}}`), postCtx);

        expect(res.status).toBe(200);
        const [saved] = chain.update.mock.calls[0] as [{ content_json: unknown }];
        expect(saved.content_json).toEqual(CLEAN_DOC);
        expect(JSON.stringify(saved.content_json)).not.toMatch(/alert|iframe|__proto__/);
    });

    it('PUT leaves content_json untouched when it is not sent', async () => {
        const res = await PUT(json('PUT', { title: 'Nuovo titolo' }), postCtx);

        expect(res.status).toBe(200);
        const [saved] = chain.update.mock.calls[0] as [Record<string, unknown>];
        expect(saved.title).toBe('Nuovo titolo');
        expect('content_json' in saved).toBe(false);
    });

    it('PUT clears the content when null is sent', async () => {
        await PUT(json('PUT', { content_json: null }), postCtx);

        const [saved] = chain.update.mock.calls[0] as [{ content_json: unknown }];
        expect(saved.content_json).toBeNull();
    });

    it.each([
        ['not a document', { type: 'paragraph' }],
        ['a string', 'ciao'],
        ['an array', []],
    ])('PUT answers 400 for %s and saves nothing', async (_label, content) => {
        const res = await PUT(json('PUT', { content_json: content }), postCtx);

        expect(res.status).toBe(400);
        expect(chain.update).not.toHaveBeenCalled();
    });

    it('POST stores the sanitized document', async () => {
        const res = await POST(json('POST', `{"title":"Rapa Nui","slug":"rapa-nui","content_json":${HOSTILE_DOC}}`), tripCtx);

        expect(res.status).toBe(201);
        const [saved] = chain.insert.mock.calls[0] as [{ content_json: unknown }];
        expect(saved.content_json).toEqual(CLEAN_DOC);
    });

    it('POST answers 400, not 500, for an invalid document', async () => {
        const res = await POST(json('POST', { title: 'Rapa Nui', slug: 'rapa-nui', content_json: { type: 'paragraph' } }), tripCtx);

        expect(res.status).toBe(400);
        expect(chain.insert).not.toHaveBeenCalled();
    });
});
