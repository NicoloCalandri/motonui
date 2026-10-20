import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { requireParam } from './http';
import { handleAppError } from '../middleware/request-context';

function app() {
    const hono = new Hono();
    hono.onError(handleAppError);
    hono.get('/things/:thingId/:slug', (c) => c.json({ id: requireParam(c, 'thingId'), slug: requireParam(c, 'slug') }));
    return hono;
}

describe('requireParam', () => {
    it.each([
        '9b2f6c1e-3d4a-4f5b-8a6c-7d8e9f0a1b2c',
        // Postgres accepts any 8-4-4-4-12 hex value as a uuid: seed and test rows use ids like this one.
        '00000000-0000-0000-0000-000000000001',
        'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11',
    ])('accepts the id %s', async (id) => {
        const res = await app().request(`/things/${id}/my-slug`);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ id, slug: 'my-slug' });
    });

    it.each(['abc', '123', '9b2f6c1e3d4a4f5b8a6c7d8e9f0a1b2c', '9b2f6c1e-3d4a-4f5b-8a6c-7d8e9f0a1b2c-x', "1' or '1'='1"])(
        'refuses the id %s with a 400',
        async (id) => {
            const res = await app().request(`/things/${encodeURIComponent(id)}/my-slug`);
            expect(res.status).toBe(400);
            expect(await res.json()).toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
        },
    );
});
