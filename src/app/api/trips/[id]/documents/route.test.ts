// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryChain, type QueryChain } from '@/test/supabase-mock';

const TRIP = '10000000-0000-0000-0000-00000000000a';
const OTHER = '10000000-0000-0000-0000-00000000000c';
const DOC = '30000000-0000-0000-0000-00000000000d';
const USER = { id: '00000000-0000-0000-0000-00000000000a' };

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    documents: vi.fn(),
    requireTripMember: vi.fn(),
    uploadPrivateFile: vi.fn(),
    downloadFile: vi.fn(),
    removeDocumentFile: vi.fn(),
}));

// Rate limiting has its own tests (src/lib/rate-limit.test.ts).
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
    enforceRateLimit: vi.fn(async () => undefined),
}));
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mocks.getUser },
        from: vi.fn(() => mocks.documents()),
    })),
}));
vi.mock('@/lib/authz', () => ({ requireTripMember: mocks.requireTripMember, requireDayInTrip: vi.fn() }));
vi.mock('@/lib/storage', () => ({
    Buckets: { tripMedia: 'trip-media', tripDocuments: 'trip-documents' },
    validateFile: vi.fn(),
    uploadPrivateFile: mocks.uploadPrivateFile,
    downloadFile: mocks.downloadFile,
}));
vi.mock('@/lib/trip-storage', () => ({ removeDocumentFile: mocks.removeDocumentFile }));

import { POST } from './route';
import { DELETE } from './[documentId]/route';
import { GET as GET_FILE } from './[documentId]/file/route';

const tripCtx = { params: Promise.resolve({ id: TRIP }) };
const docCtx = { params: Promise.resolve({ id: TRIP, documentId: DOC }) };
const BASE = `http://localhost/api/trips/${TRIP}/documents`;

function jsonPost(body: unknown) {
    return new Request(BASE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

let insert: QueryChain;

describe('documents routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.getUser.mockResolvedValue({ data: { user: USER } });
        mocks.requireTripMember.mockResolvedValue(undefined);
        insert = queryChain({ data: { id: DOC }, error: null });
        mocks.documents.mockReturnValue(insert);
    });

    it.each(['javascript:alert(1)', 'data:text/html,<script>1</script>', 'http://example.com/t.pdf'])(
        'rejects the link %s',
        async (fileUrl) => {
            const res = await POST(jsonPost({ title: 'x', type: 'ticket', file_url: fileUrl }), tripCtx);
            expect(res.status).toBe(400);
            expect(insert.insert).not.toHaveBeenCalled();
        },
    );

    it('stores an https link without a file path', async () => {
        const res = await POST(jsonPost({ title: 'x', type: 'ticket', file_url: 'https://example.com/t.pdf' }), tripCtx);
        expect(res.status).toBe(201);
        expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({
            file_url: 'https://example.com/t.pdf', file_path: null, trip_id: TRIP, uploaded_by: USER.id,
        }));
    });

    it('uploads a file under a server-built path of the trip', async () => {
        const form = new FormData();
        form.append('file', new File(['%PDF-1.4'], '../../evil.pdf', { type: 'application/pdf' }));
        form.append('title', 'Assicurazione');
        form.append('type', 'insurance');
        form.append('file_path', `trips/${OTHER}/documents/x.pdf`);

        const res = await POST(new Request(BASE, { method: 'POST', body: form }), tripCtx);

        expect(res.status).toBe(201);
        const [bucket, path] = mocks.uploadPrivateFile.mock.calls[0];
        expect(bucket).toBe('trip-documents');
        expect(path).toMatch(new RegExp(`^trips/${TRIP}/documents/[0-9a-f-]{36}\\.pdf$`));
        expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ file_path: path, file_url: null, file_type: 'pdf' }));
    });

    it('serves only files inside the trip folder', async () => {
        mocks.documents.mockReturnValue(queryChain({ data: { file_path: `trips/${OTHER}/documents/x.pdf` }, error: null }));
        const res = await GET_FILE(new Request(`${BASE}/${DOC}/file`), docCtx);
        expect(res.status).toBe(404);
        expect(mocks.downloadFile).not.toHaveBeenCalled();
    });

    it('streams an uploaded file with no-store', async () => {
        const path = `trips/${TRIP}/documents/0f8e1c2a-aaaa-bbbb-cccc-000000000001.pdf`;
        mocks.documents.mockReturnValue(queryChain({ data: { file_path: path }, error: null }));
        mocks.downloadFile.mockResolvedValue(new Blob(['%PDF-1.4']));

        const res = await GET_FILE(new Request(`${BASE}/${DOC}/file?download=1`), docCtx);

        expect(res.status).toBe(200);
        expect(mocks.downloadFile).toHaveBeenCalledWith('trip-documents', path);
        expect(res.headers.get('Content-Type')).toBe('application/pdf');
        expect(res.headers.get('Content-Disposition')).toContain('attachment');
        expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    });

    it('deletes the uploaded file together with the row', async () => {
        const path = `trips/${TRIP}/documents/x.pdf`;
        mocks.documents.mockReturnValue(queryChain({ data: { file_path: path }, error: null }));

        const res = await DELETE(new Request(`${BASE}/${DOC}`, { method: 'DELETE' }), docCtx);

        expect(res.status).toBe(200);
        expect(mocks.removeDocumentFile).toHaveBeenCalledWith(TRIP, path);
    });

    it('requires membership before touching anything', async () => {
        const { AppError } = await import('@/lib/errors');
        mocks.requireTripMember.mockRejectedValue(new AppError('no', 'FORBIDDEN', 403));

        const res = await DELETE(new Request(`${BASE}/${DOC}`, { method: 'DELETE' }), docCtx);

        expect(res.status).toBe(403);
        expect(mocks.documents).not.toHaveBeenCalled();
        expect(mocks.removeDocumentFile).not.toHaveBeenCalled();
    });
});
