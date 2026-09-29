// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/server', () => ({
    NextResponse: {
        json: (body: unknown, init?: { status?: number }) =>
            new Response(JSON.stringify(body), { status: init?.status ?? 200 }),
    },
}));

const TRIP = '11111111-1111-1111-1111-111111111111';
const OTHER_TRIP = '22222222-2222-2222-2222-222222222222';
const DAY = '33333333-3333-3333-3333-333333333333';
const LEG = '44444444-4444-4444-4444-444444444444';
const USER = { id: '55555555-5555-5555-5555-555555555555' };
const SUPABASE_URL = 'https://abc.supabase.co';
const OWN_PATH = `trips/${TRIP}/boarding-passes/${LEG}-old.pdf`;

const mockGetUser = vi.fn();
const mockLegSingle = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateSingle = vi.fn();
const mockUpdateEq = vi.fn();

function legsTable() {
    const selectChain = { eq: vi.fn(), single: mockLegSingle };
    selectChain.eq.mockReturnValue(selectChain);
    const updateChain = { eq: mockUpdateEq, select: vi.fn(() => ({ single: mockUpdateSingle })) };
    mockUpdateEq.mockReturnValue(updateChain);
    mockUpdate.mockReturnValue(updateChain);
    return { select: vi.fn(() => selectChain), update: mockUpdate };
}

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => ({
        auth: { getUser: mockGetUser },
        from: vi.fn(() => legsTable()),
    })),
}));

const mockRequireTripMember = vi.fn();
vi.mock('@/lib/authz', () => ({ requireTripMember: mockRequireTripMember }));

const mockDownloadFile = vi.fn();
const mockDeleteFile = vi.fn();
const mockUploadPrivateFile = vi.fn();
vi.mock('@/lib/storage', () => ({
    Buckets: { tripMedia: 'trip-media', tripDocuments: 'trip-documents' },
    validateFile: vi.fn(),
    downloadFile: mockDownloadFile,
    deleteFile: mockDeleteFile,
    uploadPrivateFile: mockUploadPrivateFile,
}));

const params = { params: Promise.resolve({ id: TRIP, dayId: DAY, legId: LEG }) };
const URL_BASE = `http://localhost/api/trips/${TRIP}/days/${DAY}/legs/${LEG}/boarding-pass`;

async function loadRoute() {
    return import('./route');
}

describe('boarding-pass route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL);
        mockGetUser.mockResolvedValue({ data: { user: USER } });
        mockRequireTripMember.mockResolvedValue(undefined);
        mockUpdateSingle.mockResolvedValue({ data: { id: LEG }, error: null });
    });

    describe('GET', () => {
        it('returns 401 without a session', async () => {
            mockGetUser.mockResolvedValue({ data: { user: null } });
            const { GET } = await loadRoute();
            const res = await GET(new Request(URL_BASE), params);
            expect(res.status).toBe(401);
            expect(mockDownloadFile).not.toHaveBeenCalled();
        });

        it('streams the private file with no-store and inline disposition', async () => {
            mockLegSingle.mockResolvedValue({ data: { id: LEG, boarding_pass_path: OWN_PATH, boarding_pass_url: null } });
            mockDownloadFile.mockResolvedValue(new Blob(['%PDF-1.4']));
            const { GET } = await loadRoute();

            const res = await GET(new Request(URL_BASE), params);

            expect(res.status).toBe(200);
            expect(mockDownloadFile).toHaveBeenCalledWith('trip-documents', OWN_PATH);
            expect(res.headers.get('Content-Type')).toBe('application/pdf');
            expect(res.headers.get('Cache-Control')).toBe('private, no-store');
            expect(res.headers.get('Content-Disposition')).toMatch(/^inline;/);
            expect(await res.text()).toBe('%PDF-1.4');
        });

        it('uses attachment disposition for ?download=1', async () => {
            mockLegSingle.mockResolvedValue({ data: { id: LEG, boarding_pass_path: OWN_PATH, boarding_pass_url: null } });
            mockDownloadFile.mockResolvedValue(new Blob(['x']));
            const { GET } = await loadRoute();
            const res = await GET(new Request(`${URL_BASE}?download=1`), params);
            expect(res.headers.get('Content-Disposition')).toMatch(/^attachment;/);
        });

        it('refuses a path that points to another trip (tampered via REST)', async () => {
            mockLegSingle.mockResolvedValue({
                data: { id: LEG, boarding_pass_path: `trips/${OTHER_TRIP}/boarding-passes/x.pdf`, boarding_pass_url: null },
            });
            const { GET } = await loadRoute();
            const res = await GET(new Request(URL_BASE), params);
            expect(res.status).toBe(404);
            expect(mockDownloadFile).not.toHaveBeenCalled();
        });

        it('returns 404 when the leg is not in this trip/day', async () => {
            mockLegSingle.mockResolvedValue({ data: null });
            const { GET } = await loadRoute();
            const res = await GET(new Request(URL_BASE), params);
            expect(res.status).toBe(404);
        });
    });

    describe('POST', () => {
        function uploadRequest(type: string, content = 'data') {
            const form = new FormData();
            form.append('file', new File([content], 'pass', { type }));
            return new Request(URL_BASE, { method: 'POST', body: form });
        }

        it('uploads to the private bucket with a non-guessable path and removes the old file', async () => {
            mockLegSingle.mockResolvedValue({ data: { id: LEG, boarding_pass_path: OWN_PATH, boarding_pass_url: null } });
            const { POST } = await loadRoute();

            const res = await POST(uploadRequest('application/pdf'), params);

            expect(res.status).toBe(200);
            const [bucket, path] = mockUploadPrivateFile.mock.calls[0];
            expect(bucket).toBe('trip-documents');
            expect(path).toMatch(new RegExp(`^trips/${TRIP}/boarding-passes/${LEG}-[0-9a-f-]{36}\\.pdf$`));
            expect(mockUpdate).toHaveBeenCalledWith({ boarding_pass_path: path, boarding_pass_url: null });
            expect(mockDeleteFile).toHaveBeenCalledWith('trip-documents', OWN_PATH);
        });

        it('deletes the legacy public file when replacing it', async () => {
            const legacyPath = `trips/${TRIP}/boarding-passes/${LEG}.jpg`;
            mockLegSingle.mockResolvedValue({
                data: {
                    id: LEG,
                    boarding_pass_path: null,
                    boarding_pass_url: `${SUPABASE_URL}/storage/v1/object/public/trip-media/${legacyPath}`,
                },
            });
            const { POST } = await loadRoute();
            await POST(uploadRequest('image/jpeg'), params);
            expect(mockDeleteFile).toHaveBeenCalledWith('trip-media', legacyPath);
        });

        it('never deletes files outside the trip prefix', async () => {
            mockLegSingle.mockResolvedValue({
                data: {
                    id: LEG,
                    boarding_pass_path: `trips/${OTHER_TRIP}/boarding-passes/x.pdf`,
                    boarding_pass_url: `${SUPABASE_URL}/storage/v1/object/public/trip-media/trips/${OTHER_TRIP}/original/y.jpg`,
                },
            });
            const { POST } = await loadRoute();
            await POST(uploadRequest('application/pdf'), params);
            expect(mockDeleteFile).not.toHaveBeenCalled();
        });

        it('rejects unsupported file types with 400', async () => {
            mockLegSingle.mockResolvedValue({ data: { id: LEG, boarding_pass_path: null, boarding_pass_url: null } });
            const { POST } = await loadRoute();
            const res = await POST(uploadRequest('text/html'), params);
            expect(res.status).toBe(400);
            expect(mockUploadPrivateFile).not.toHaveBeenCalled();
        });

        it('rejects files over the bucket limit with 400', async () => {
            mockLegSingle.mockResolvedValue({ data: { id: LEG, boarding_pass_path: null, boarding_pass_url: null } });
            const { POST } = await loadRoute();
            const res = await POST(uploadRequest('application/pdf', 'x'.repeat(20 * 1024 * 1024 + 1)), params);
            expect(res.status).toBe(400);
            expect(mockUploadPrivateFile).not.toHaveBeenCalled();
        });

        it('removes the new file if the DB update fails', async () => {
            mockLegSingle.mockResolvedValue({ data: { id: LEG, boarding_pass_path: null, boarding_pass_url: null } });
            mockUpdateSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
            const { POST } = await loadRoute();
            const res = await POST(uploadRequest('application/pdf'), params);
            expect(res.status).toBe(500);
            const [, uploadedPath] = mockUploadPrivateFile.mock.calls[0];
            expect(mockDeleteFile).toHaveBeenCalledWith('trip-documents', uploadedPath);
        });
    });

    describe('DELETE', () => {
        it('clears both columns and deletes the stored file', async () => {
            mockLegSingle.mockResolvedValue({ data: { id: LEG, boarding_pass_path: OWN_PATH, boarding_pass_url: null } });
            mockUpdateEq.mockImplementation(() => ({ eq: mockUpdateEq, then: (r: (v: unknown) => void) => r({ error: null }) }));
            const { DELETE } = await loadRoute();

            const res = await DELETE(new Request(URL_BASE, { method: 'DELETE' }), params);

            expect(res.status).toBe(200);
            expect(mockUpdate).toHaveBeenCalledWith({ boarding_pass_path: null, boarding_pass_url: null });
            expect(mockDeleteFile).toHaveBeenCalledWith('trip-documents', OWN_PATH);
        });
    });
});
