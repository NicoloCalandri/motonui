import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Files of a trip live in private buckets: nothing is uploaded through a
 * public URL, downloads go through the API after the membership check, and a
 * deleted row takes its file with it (counterpart of the Next.js routes under
 * src/app/api/trips/[id]/{media,documents} and …/legs/[legId]/boarding-pass).
 */

const TRIP = '10000000-0000-4000-8000-00000000000a';
const OTHER_TRIP = '20000000-0000-4000-8000-00000000000b';
const DAY = '30000000-0000-4000-8000-00000000000d';
const LEG = '40000000-0000-4000-8000-00000000000e';
const ITEM = '50000000-0000-4000-8000-00000000000f';
const USER = { id: '00000000-0000-4000-8000-00000000000c', email: 'user@example.com' };
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

type Write = { table: string; op: string; payload?: Record<string, unknown> };

const state = vi.hoisted(() => ({
    writes: [] as Array<{ table: string; op: string; payload?: Record<string, unknown> }>,
    rows: {} as Record<string, Record<string, unknown> | null>,
    writeError: {} as Record<string, { message: string } | undefined>,
}));

const files = vi.hoisted(() => ({
    withSignedUrls: vi.fn(),
    removeMediaFiles: vi.fn(),
    removeDocumentFile: vi.fn(),
    removeLegFiles: vi.fn(),
    uploadPrivateFile: vi.fn(),
    uploadFile: vi.fn(),
    downloadFile: vi.fn(),
    deleteFile: vi.fn(),
    createUploadTarget: vi.fn(),
    ingestUpload: vi.fn(),
}));

function stubClient() {
    const builder = (table: string) => {
        let op = 'select';
        const chain: Record<string, unknown> = {};
        for (const method of ['select', 'eq', 'neq', 'in', 'order', 'limit', 'like']) chain[method] = () => chain;
        for (const method of ['insert', 'update', 'upsert', 'delete']) {
            chain[method] = (payload?: Record<string, unknown>) => {
                op = method;
                state.writes.push({ table, op, payload });
                return chain;
            };
        }
        const guard = { id: ITEM, trip_id: TRIP, user_id: USER.id, owner_id: USER.id, role: 'user', suspended_at: null };
        const result = () => {
            const error = op === 'select' ? undefined : state.writeError[table];
            if (error) return { data: null, error };
            return { data: table in state.rows ? state.rows[table] : guard, error: null };
        };
        chain.single = async () => result();
        chain.maybeSingle = async () => result();
        chain.then = (resolve: (value: unknown) => unknown) => {
            const { data, error } = result();
            return Promise.resolve({ data: data ? [data] : [], error }).then(resolve);
        };
        return chain;
    };
    return {
        auth: { getUser: async () => ({ data: { user: USER } }) },
        from: builder,
        rpc: async () => ({ data: [{ allowed: true, hits: 1, reset_at: new Date(Date.now() + 1000).toISOString() }], error: null }),
    };
}

vi.mock('../lib/supabase/server', () => ({
    createUserClient: () => stubClient(),
    createAnonClient: () => stubClient(),
    createAdminClient: () => stubClient(),
}));
vi.mock('../lib/trip-storage', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../lib/trip-storage')>()),
    withSignedUrls: files.withSignedUrls,
    removeMediaFiles: files.removeMediaFiles,
    removeDocumentFile: files.removeDocumentFile,
    removeLegFiles: files.removeLegFiles,
}));
vi.mock('../lib/storage', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../lib/storage')>()),
    uploadPrivateFile: files.uploadPrivateFile,
    uploadFile: files.uploadFile,
    downloadFile: files.downloadFile,
    deleteFile: files.deleteFile,
}));
vi.mock('../lib/media/pipeline', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../lib/media/pipeline')>()),
    createUploadTarget: files.createUploadTarget,
    ingestUpload: files.ingestUpload,
}));

import { createApp } from '../app';

function call(method: string, path: string, body?: Record<string, unknown> | FormData) {
    const headers: Record<string, string> = { authorization: 'Bearer test-token' };
    const init: RequestInit = { method, headers };
    if (body instanceof FormData) init.body = body;
    else if (body) {
        headers['content-type'] = 'application/json';
        init.body = JSON.stringify(body);
    }
    return createApp().request(`/api/trips/${TRIP}${path}`, init);
}

function upload(fields: Record<string, string> = {}, type = 'application/pdf', bytes: Uint8Array<ArrayBuffer> = PDF): FormData {
    const form = new FormData();
    form.set('file', new File([bytes], 'whatever.exe', { type }));
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    return form;
}

const written = (table: string, op: string): Write[] => state.writes.filter((write) => write.table === table && write.op === op);

beforeEach(() => {
    vi.clearAllMocks();
    state.writes = [];
    state.rows = {};
    state.writeError = {};
    files.withSignedUrls.mockImplementation(async (_client: unknown, _trip: string, media: Array<Record<string, unknown>>) =>
        media.map((item) => ({ ...item, signed_url: 'https://signed.example/original' })));
    files.downloadFile.mockResolvedValue(new Blob([PDF]));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('media', () => {
    it('lists media with signed URLs for this trip', async () => {
        state.rows.media = { id: ITEM, trip_id: TRIP, storage_path: `trips/${TRIP}/original/a.webp` };

        const res = await call('GET', '/media');

        expect(res.status).toBe(200);
        expect(files.withSignedUrls.mock.calls[0][1]).toBe(TRIP);
        expect(await res.json()).toEqual([expect.objectContaining({ id: ITEM, signed_url: 'https://signed.example/original' })]);
    });

    it('refuses a day filter that is not a UUID', async () => {
        const res = await call('GET', '/media?day_id=abc');

        expect(res.status).toBe(400);
    });

    it('no longer accepts a file in the request body', async () => {
        const res = await call('POST', '/media', upload());

        expect(res.status).toBe(404);
        expect(files.uploadFile).not.toHaveBeenCalled();
        expect(written('media', 'insert')).toEqual([]);
    });

    it('signs an upload for a supported type and size', async () => {
        files.createUploadTarget.mockResolvedValue({ path: `trips/${TRIP}/incoming/x.jpg`, token: 't', signedUrl: 'https://upload.example' });

        const res = await call('POST', '/media/uploads', { mime_type: 'image/jpeg', size: 1024 });

        expect(res.status).toBe(201);
        expect(files.createUploadTarget.mock.calls[0].slice(1)).toEqual([TRIP, { mimeType: 'image/jpeg', size: 1024 }]);
        expect(await res.json()).toMatchObject({ token: 't' });
    });

    it.each([
        ['an unsupported type', { mime_type: 'application/x-msdownload', size: 1024 }],
        ['a file over 50 MB', { mime_type: 'image/jpeg', size: 50 * 1024 * 1024 + 1 }],
        ['a missing size', { mime_type: 'image/jpeg' }],
    ])('does not sign an upload for %s', async (_label, body) => {
        const res = await call('POST', '/media/uploads', body);

        expect(res.status).toBe(400);
        expect(files.createUploadTarget).not.toHaveBeenCalled();
    });

    it('confirms an upload with the paths built by the server', async () => {
        files.ingestUpload.mockResolvedValue({
            storage_path: `trips/${TRIP}/original/a.webp`, thumb_path: `trips/${TRIP}/thumbs/a.webp`, mime_type: 'image/webp',
            size: 10, width: 4, height: 3, metadata: { orientation: 1 },
        });

        const res = await call('POST', '/media/confirm', { path: `trips/${TRIP}/incoming/x.jpg`, caption: '  Tramonto  ' });

        expect(res.status).toBe(201);
        expect(files.ingestUpload.mock.calls[0].slice(1)).toEqual([TRIP, `trips/${TRIP}/incoming/x.jpg`]);
        expect(written('media', 'insert')[0].payload).toMatchObject({
            trip_id: TRIP, uploaded_by: USER.id, storage_path: `trips/${TRIP}/original/a.webp`,
            thumb_path: `trips/${TRIP}/thumbs/a.webp`, mime_type: 'image/webp', caption: 'Tramonto',
        });
        expect(written('media', 'insert')[0].payload).not.toHaveProperty('url');
    });

    it('removes the stored files when the media row cannot be created', async () => {
        const ingested = { storage_path: `trips/${TRIP}/original/a.webp`, thumb_path: null, mime_type: 'image/webp', size: 10, width: 4, height: 3, metadata: { orientation: 1 } };
        files.ingestUpload.mockResolvedValue(ingested);
        state.writeError.media = { message: 'insert refused' };

        const res = await call('POST', '/media/confirm', { path: `trips/${TRIP}/incoming/x.jpg` });

        expect(res.status).toBe(500);
        expect(files.removeMediaFiles).toHaveBeenCalledWith(TRIP, ingested);
    });

    it('deletes the files of a deleted media row', async () => {
        state.rows.media = { storage_path: `trips/${TRIP}/original/a.webp`, thumb_path: `trips/${TRIP}/thumbs/a.webp` };

        const res = await call('DELETE', `/media/${ITEM}`);

        expect(res.status).toBe(200);
        expect(files.removeMediaFiles).toHaveBeenCalledWith(TRIP, state.rows.media);
    });

    it('answers 404 and touches no file when the media row is not in this trip', async () => {
        state.rows.media = null;

        const res = await call('DELETE', `/media/${ITEM}`);

        expect(res.status).toBe(404);
        expect(files.removeMediaFiles).not.toHaveBeenCalled();
    });
});

describe('documents', () => {
    const link = { type: 'ticket', title: 'Biglietto', file_url: 'https://example.com/ticket.pdf' };

    it('creates a link document without a stored file', async () => {
        const res = await call('POST', '/documents', link);

        expect(res.status).toBe(201);
        expect(written('documents', 'insert')[0].payload).toMatchObject({ file_url: link.file_url, file_path: null, trip_id: TRIP, uploaded_by: USER.id });
    });

    it.each(['http://example.com/a.pdf', 'javascript:alert(1)', 'data:text/html,x'])('refuses the link %s', async (file_url) => {
        const res = await call('POST', '/documents', { ...link, file_url });

        expect(res.status).toBe(400);
        expect(written('documents', 'insert')).toEqual([]);
    });

    it('stores an uploaded document in the private bucket under a server-built path', async () => {
        const res = await call('POST', '/documents', upload({ type: 'ticket', title: 'Biglietto' }));

        expect(res.status).toBe(201);
        const [bucket, path, , mime] = files.uploadPrivateFile.mock.calls[0] as [string, string, unknown, string];
        expect(bucket).toBe('trip-documents');
        expect(path).toMatch(new RegExp(`^trips/${TRIP}/documents/[0-9a-f-]{36}\\.pdf$`));
        expect(path).not.toContain('whatever');
        expect(mime).toBe('application/pdf');
        expect(written('documents', 'insert')[0].payload).toMatchObject({ file_path: path, file_url: null, file_type: 'pdf' });
        expect(files.uploadFile).not.toHaveBeenCalled();
    });

    it('refuses an uploaded file whose content is not what it declares', async () => {
        const res = await call('POST', '/documents', upload({ type: 'ticket', title: 'Biglietto' }, 'application/pdf', new Uint8Array([0x4d, 0x5a, 0x90, 0x00])));

        expect(res.status).toBe(400);
        expect(files.uploadPrivateFile).not.toHaveBeenCalled();
    });

    it('removes the uploaded file when the document row cannot be created', async () => {
        state.writeError.documents = { message: 'insert refused' };

        const res = await call('POST', '/documents', upload({ type: 'ticket', title: 'Biglietto' }));

        expect(res.status).toBe(500);
        const path = (files.uploadPrivateFile.mock.calls[0] as [string, string])[1];
        expect(files.removeDocumentFile).toHaveBeenCalledWith(TRIP, path);
    });

    it('serves the file through the API with safe headers', async () => {
        state.rows.documents = { file_path: `trips/${TRIP}/documents/${ITEM}.pdf` };

        const res = await call('GET', `/documents/${ITEM}/file`);

        expect(res.status).toBe(200);
        expect(files.downloadFile).toHaveBeenCalledWith('trip-documents', `trips/${TRIP}/documents/${ITEM}.pdf`);
        expect(res.headers.get('content-type')).toBe('application/pdf');
        expect(res.headers.get('content-disposition')).toBe('inline; filename="documento.pdf"');
        expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        expect(res.headers.get('cache-control')).toBe('private, no-store');
        expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF);
    });

    it('serves the file as an attachment with ?download=1', async () => {
        state.rows.documents = { file_path: `trips/${TRIP}/documents/${ITEM}.pdf` };

        const res = await call('GET', `/documents/${ITEM}/file?download=1`);

        expect(res.headers.get('content-disposition')).toBe('attachment; filename="documento.pdf"');
    });

    it.each([
        ['another trip', `trips/${OTHER_TRIP}/documents/${ITEM}.pdf`],
        ['another folder of the trip', `trips/${TRIP}/original/${ITEM}.pdf`],
        ['a path with dot segments', `trips/${TRIP}/documents/../../${OTHER_TRIP}/documents/${ITEM}.pdf`],
        ['no file', null],
    ])('answers 404 and downloads nothing when the stored path points to %s', async (_label, file_path) => {
        state.rows.documents = { file_path };

        const res = await call('GET', `/documents/${ITEM}/file`);

        expect(res.status).toBe(404);
        expect(files.downloadFile).not.toHaveBeenCalled();
    });

    it('deletes the file of a deleted document', async () => {
        state.rows.documents = { file_path: `trips/${TRIP}/documents/${ITEM}.pdf` };

        const res = await call('DELETE', `/documents/${ITEM}`);

        expect(res.status).toBe(200);
        expect(files.removeDocumentFile).toHaveBeenCalledWith(TRIP, `trips/${TRIP}/documents/${ITEM}.pdf`);
    });

    it('does not let an update repoint the document to another stored file', async () => {
        const res = await call('PUT', `/documents/${ITEM}`, { title: 'Nuovo', file_path: `trips/${OTHER_TRIP}/documents/x.pdf`, file_type: 'pdf' });

        expect(res.status).toBe(200);
        expect(written('documents', 'update')[0].payload).toEqual({ title: 'Nuovo' });
    });
});

describe('boarding pass', () => {
    const base = `/days/${DAY}/legs/${LEG}/boarding-pass`;

    it('stores the file privately and drops the previous one', async () => {
        const previous = { id: LEG, boarding_pass_path: `trips/${TRIP}/boarding-passes/${LEG}-old.pdf`, boarding_pass_url: null };
        state.rows.legs = previous;

        const res = await call('POST', base, upload());

        expect(res.status).toBe(200);
        const [bucket, path] = files.uploadPrivateFile.mock.calls[0] as [string, string];
        expect(bucket).toBe('trip-documents');
        expect(path.startsWith(`trips/${TRIP}/`)).toBe(true);
        expect(path.endsWith('.pdf')).toBe(true);
        expect(written('legs', 'update')[0].payload).toEqual({ boarding_pass_path: path, boarding_pass_url: null });
        expect(files.removeLegFiles).toHaveBeenCalledWith(TRIP, previous);
        expect(files.uploadFile).not.toHaveBeenCalled();
    });

    it('removes the new file when the leg cannot be updated', async () => {
        state.rows.legs = { id: LEG, boarding_pass_path: null, boarding_pass_url: null };
        state.writeError.legs = { message: 'update refused' };

        const res = await call('POST', base, upload());

        expect(res.status).toBe(500);
        const path = (files.uploadPrivateFile.mock.calls[0] as [string, string])[1];
        expect(files.deleteFile).toHaveBeenCalledWith('trip-documents', path);
        expect(files.removeLegFiles).not.toHaveBeenCalled();
    });

    it('refuses a file type that is not an image or a PDF', async () => {
        state.rows.legs = { id: LEG, boarding_pass_path: null, boarding_pass_url: null };

        const res = await call('POST', base, upload({}, 'video/mp4', new Uint8Array([0, 0, 0, 0x18])));

        expect(res.status).toBe(400);
        expect(files.uploadPrivateFile).not.toHaveBeenCalled();
    });

    it('serves the boarding pass through the API', async () => {
        const path = `trips/${TRIP}/boarding-passes/${LEG}-abc.pdf`;
        state.rows.legs = { id: LEG, boarding_pass_path: path, boarding_pass_url: null };

        const res = await call('GET', base);

        expect(res.status).toBe(200);
        expect(files.downloadFile).toHaveBeenCalledWith('trip-documents', path);
        expect(res.headers.get('content-disposition')).toBe('inline; filename="carta-imbarco.pdf"');
        expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    });

    it('answers 404 when the stored path belongs to another trip', async () => {
        state.rows.legs = { id: LEG, boarding_pass_path: `trips/${OTHER_TRIP}/boarding-passes/${LEG}-abc.pdf`, boarding_pass_url: null };

        const res = await call('GET', base);

        expect(res.status).toBe(404);
        expect(files.downloadFile).not.toHaveBeenCalled();
    });

    it('answers 404 when the leg is not in this trip and day', async () => {
        state.rows.legs = null;

        expect((await call('GET', base)).status).toBe(404);
        expect((await call('DELETE', base)).status).toBe(404);
        expect(written('legs', 'update')).toEqual([]);
    });

    it('clears the leg and deletes the file', async () => {
        const leg = { id: LEG, boarding_pass_path: `trips/${TRIP}/boarding-passes/${LEG}-abc.pdf`, boarding_pass_url: null };
        state.rows.legs = leg;

        const res = await call('DELETE', base);

        expect(res.status).toBe(200);
        expect(written('legs', 'update')[0].payload).toEqual({ boarding_pass_path: null, boarding_pass_url: null });
        expect(files.removeLegFiles).toHaveBeenCalledWith(TRIP, leg);
    });
});

describe('deleting a leg', () => {
    const leg = { boarding_pass_path: `trips/${TRIP}/boarding-passes/${LEG}-abc.pdf`, boarding_pass_url: null };

    it.each([`/legs/${LEG}`, `/days/${DAY}/legs/${LEG}`])('DELETE %s deletes its boarding pass too', async (path) => {
        state.rows.legs = leg;

        const res = await call('DELETE', path);

        expect(res.status).toBe(200);
        expect(files.removeLegFiles).toHaveBeenCalledWith(TRIP, leg);
    });
});
