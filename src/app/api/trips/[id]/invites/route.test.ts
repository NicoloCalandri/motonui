// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryChain } from '@/test/supabase-mock';

const TRIP = '10000000-0000-0000-0000-00000000000a';
const USER = { id: '00000000-0000-0000-0000-00000000000a', email: 'nicolo@test.local' };

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    rpc: vi.fn(),
    from: vi.fn(),
    requireTripMember: vi.fn(),
    sendEmail: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc, from: mocks.from })),
}));
vi.mock('@/lib/authz', () => ({ requireTripMember: mocks.requireTripMember, requireDayInTrip: vi.fn() }));
vi.mock('@/lib/email', () => ({ sendEmail: mocks.sendEmail, tripInviteEmail: vi.fn(() => '<p>invite</p>') }));

import { POST as INVITE } from './route';
import { POST as ACCEPT } from '../../../invites/accept/route';
import { POST as CREATE_TRIP } from '../../route';
import { hashInviteToken } from '@/lib/invites';

const tripCtx = { params: Promise.resolve({ id: TRIP }) };

function post(url: string, body: unknown) {
    return new Request(`http://localhost${url}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('partner invites (T-2.5)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://motonui.app');
        mocks.getUser.mockResolvedValue({ data: { user: USER } });
        mocks.requireTripMember.mockResolvedValue(undefined);
        mocks.from.mockReturnValue(queryChain({ data: { title: 'Rapa Nui', destination: 'Isola di Pasqua' }, error: null }));
    });

    it('creates the invite with only the token hash and emails the link', async () => {
        mocks.rpc.mockResolvedValue({
            data: { id: 'inv-1', email: 'giorgia@test.local', expires_at: '2026-10-06T00:00:00Z' },
            error: null,
        });

        const res = await INVITE(post(`/api/trips/${TRIP}/invites`, { email: ' Giorgia@Test.local ' }), tripCtx);

        expect(res.status).toBe(201);
        const body = await res.json();
        const token = body.invite_url.split('/invite/')[1];
        expect(body.invite_url).toMatch(/^https:\/\/motonui\.app\/invite\/[A-Za-z0-9_-]{43}$/);

        const [fn, args] = mocks.rpc.mock.calls[0];
        expect(fn).toBe('create_trip_invite');
        expect(args).toEqual({ p_trip_id: TRIP, p_email: 'giorgia@test.local', p_token_hash: hashInviteToken(token) });
        expect(JSON.stringify(args)).not.toContain(token);
        expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'giorgia@test.local' }));
    });

    it('still returns the link when the email cannot be sent', async () => {
        mocks.rpc.mockResolvedValue({ data: { id: 'inv-1', email: 'g@test.local', expires_at: 'x' }, error: null });
        mocks.sendEmail.mockRejectedValue(new Error('resend down'));

        const res = await INVITE(post(`/api/trips/${TRIP}/invites`, { email: 'g@test.local' }), tripCtx);

        expect(res.status).toBe(201);
        expect(await res.json()).toMatchObject({ email_sent: false });
    });

    it('refuses to invite yourself or an invalid address', async () => {
        for (const email of ['nicolo@test.local', 'not-an-email']) {
            const res = await INVITE(post(`/api/trips/${TRIP}/invites`, { email }), tripCtx);
            expect(res.status).toBe(400);
        }
        expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it('maps a full trip to 409', async () => {
        mocks.rpc.mockResolvedValue({ data: null, error: { message: 'TRIP_FULL: a trip has at most two members' } });

        const res = await INVITE(post(`/api/trips/${TRIP}/invites`, { email: 'terzo@test.local' }), tripCtx);

        expect(res.status).toBe(409);
        expect(await res.json()).toMatchObject({ code: 'TRIP_FULL' });
    });

    it('accepts a well-formed token through the RPC and returns the trip', async () => {
        const token = 'a'.repeat(43);
        mocks.rpc.mockResolvedValue({ data: TRIP, error: null });

        const res = await ACCEPT(post('/api/invites/accept', { token }), { params: Promise.resolve({}) });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ trip_id: TRIP });
        expect(mocks.rpc).toHaveBeenCalledWith('accept_trip_invite', { p_token: token });
    });

    it.each([
        ['INVITE_INVALID: invite not found, used or expired', 404],
        ['INVITE_EMAIL_MISMATCH: invite sent to another address', 403],
        ['TRIP_FULL: a trip has at most two members', 409],
    ])('maps %s on accept', async (message, status) => {
        mocks.rpc.mockResolvedValue({ data: null, error: { message } });
        const res = await ACCEPT(post('/api/invites/accept', { token: 'b'.repeat(43) }), { params: Promise.resolve({}) });
        expect(res.status).toBe(status);
    });

    it('rejects malformed tokens before calling the database', async () => {
        const res = await ACCEPT(post('/api/invites/accept', { token: "x' or 1=1" }), { params: Promise.resolve({}) });
        expect(res.status).toBe(400);
        expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it('creates trips through create_trip() with the user client', async () => {
        mocks.rpc.mockResolvedValue({ data: { id: TRIP, title: 'Rapa Nui' }, error: null });

        const res = await CREATE_TRIP(post('/api/trips', { title: 'Rapa Nui', destination: 'Isola di Pasqua', start_date: '2026-10-01' }), {
            params: Promise.resolve({}),
        });

        expect(res.status).toBe(201);
        expect(mocks.rpc).toHaveBeenCalledWith('create_trip', expect.objectContaining({
            p_title: 'Rapa Nui', p_destination: 'Isola di Pasqua', p_start_date: '2026-10-01', p_end_date: undefined,
        }));
    });
});
