// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import exifr from 'exifr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/lib/errors';
import {
    createUploadTarget,
    ingestUpload,
    MAX_UPLOAD_BYTES,
    processImage,
    removeStaleIncomingUploads,
    THUMB_SIZE,
} from './pipeline';

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }));

const TRIP = '10000000-0000-0000-0000-00000000000a';
const OTHER = '10000000-0000-0000-0000-00000000000c';

/** A real JPEG carrying camera, date and GPS EXIF, like a phone photo. */
async function jpegWithGps(width = 640, height = 480): Promise<Buffer> {
    return sharp({ create: { width, height, channels: 3, background: '#e07a5f' } })
        .jpeg()
        .withExif({
            IFD0: { Make: 'TestCam', Model: 'X1' },
            IFD2: { DateTimeOriginal: '2026:07:14 10:30:00' },
            IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '27/1 7/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '109/1 21/1 0/1' },
        })
        .toBuffer();
}

type Bucket = {
    download: ReturnType<typeof vi.fn>;
    upload: ReturnType<typeof vi.fn>;
    move: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    createSignedUploadUrl: ReturnType<typeof vi.fn>;
};

function adminWith(bucket: Partial<Bucket>) {
    const full: Bucket = {
        download: vi.fn(async () => ({ data: null, error: { message: 'missing' } })),
        upload: vi.fn(async () => ({ data: {}, error: null })),
        move: vi.fn(async () => ({ data: {}, error: null })),
        remove: vi.fn(async () => ({ data: [], error: null })),
        list: vi.fn(async () => ({ data: [], error: null })),
        createSignedUploadUrl: vi.fn(async (path: string) => ({ data: { token: 't', signedUrl: `https://s/${path}` }, error: null })),
        ...bucket,
    };
    return { admin: { storage: { from: vi.fn(() => full) } } as unknown as SupabaseClient, bucket: full };
}

describe('processImage (SR-PRIV-01)', () => {
    it('removes every EXIF field, GPS included, from the stored original and thumbnail', async () => {
        const input = await jpegWithGps();
        const before = await exifr.parse(input, { gps: true });
        expect(before).toMatchObject({ Make: 'TestCam' });
        expect(before?.latitude).toBeCloseTo(-27.12, 1);

        const result = await processImage(input);

        for (const output of [result.original, result.thumbnail]) {
            expect((await sharp(output).metadata()).exif).toBeUndefined();
            expect(await exifr.parse(output, { gps: true }).catch(() => undefined)).toBeUndefined();
        }
        // Kept only as DB columns for trip members.
        expect(result.metadata.camera).toBe('TestCam X1');
        expect(result.metadata.gps?.lat).toBeCloseTo(-27.12, 1);
        expect(result.metadata.gps?.lng).toBeCloseTo(-109.35, 1);
        expect(result.metadata.dateTaken).toMatch(/^2026-07-14T/);
    });

    it('stores a WebP original and a 400×400 WebP thumbnail', async () => {
        const result = await processImage(await jpegWithGps(1200, 800));

        const original = await sharp(result.original).metadata();
        const thumb = await sharp(result.thumbnail).metadata();
        expect(original).toMatchObject({ format: 'webp', width: 1200, height: 800 });
        expect(thumb).toMatchObject({ format: 'webp', width: THUMB_SIZE, height: THUMB_SIZE });
        expect(result).toMatchObject({ width: 1200, height: 800 });
    });

    it('applies the EXIF orientation before dropping it', async () => {
        const rotated = await sharp({ create: { width: 300, height: 100, channels: 3, background: '#000' } })
            .jpeg()
            .withMetadata({ orientation: 6 })
            .toBuffer();

        const result = await processImage(rotated);

        expect(result).toMatchObject({ width: 100, height: 300 });
    });

    it('rejects bytes that are not a readable image with a 400', async () => {
        await expect(processImage(Buffer.from('not an image'))).rejects.toBeInstanceOf(AppError);
    });
});

describe('upload targets', () => {
    it('signs an upload in the trip incoming folder with a server-chosen name', async () => {
        const { admin, bucket } = adminWith({});

        const target = await createUploadTarget(admin, TRIP, { mimeType: 'image/jpeg', size: 1_000 });

        expect(target.path).toMatch(new RegExp(`^trips/${TRIP}/incoming/[0-9a-f-]{36}\\.jpg$`));
        expect(bucket.createSignedUploadUrl).toHaveBeenCalledWith(target.path);
    });

    it.each([
        ['an unsupported type', { mimeType: 'text/html', size: 10 }],
        ['a file over 50 MB', { mimeType: 'video/mp4', size: MAX_UPLOAD_BYTES + 1 }],
    ])('refuses %s', async (_, declared) => {
        const { admin, bucket } = adminWith({});
        await expect(createUploadTarget(admin, TRIP, declared)).rejects.toBeInstanceOf(AppError);
        expect(bucket.createSignedUploadUrl).not.toHaveBeenCalled();
    });
});

describe('ingestUpload', () => {
    beforeEach(() => vi.clearAllMocks());

    it('stores the processed original and thumbnail and removes the incoming object', async () => {
        const incoming = `trips/${TRIP}/incoming/0f8e1c2a-aaaa-bbbb-cccc-000000000001.jpg`;
        const { admin, bucket } = adminWith({
            download: vi.fn(async () => ({ data: new Blob([new Uint8Array(await jpegWithGps())]), error: null })),
        });

        const result = await ingestUpload(admin, TRIP, incoming);

        expect(result.storage_path).toMatch(new RegExp(`^trips/${TRIP}/original/[0-9a-f-]{36}\\.webp$`));
        expect(result.thumb_path).toMatch(new RegExp(`^trips/${TRIP}/thumbs/[0-9a-f-]{36}\\.webp$`));
        expect(result.mime_type).toBe('image/webp');
        const uploaded = bucket.upload.mock.calls.map(([path]) => path);
        expect(uploaded).toEqual([result.storage_path, result.thumb_path]);
        for (const [, body] of bucket.upload.mock.calls) {
            expect((await sharp(body as Buffer).metadata()).exif).toBeUndefined();
        }
        expect(bucket.remove).toHaveBeenCalledWith([incoming]);
    });

    it('moves a video without re-encoding it', async () => {
        const incoming = `trips/${TRIP}/incoming/0f8e1c2a-aaaa-bbbb-cccc-000000000002.mp4`;
        const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(32)]);
        const { admin, bucket } = adminWith({ download: vi.fn(async () => ({ data: new Blob([new Uint8Array(mp4)]), error: null })) });

        const result = await ingestUpload(admin, TRIP, incoming);

        expect(bucket.move).toHaveBeenCalledWith(incoming, result.storage_path);
        expect(result).toMatchObject({ thumb_path: null, mime_type: 'video/mp4' });
    });

    it('deletes a file whose bytes do not match its type', async () => {
        const incoming = `trips/${TRIP}/incoming/0f8e1c2a-aaaa-bbbb-cccc-000000000003.jpg`;
        const { admin, bucket } = adminWith({
            download: vi.fn(async () => ({ data: new Blob(['<html><script>alert(1)</script>']), error: null })),
        });

        await expect(ingestUpload(admin, TRIP, incoming)).rejects.toBeInstanceOf(AppError);
        expect(bucket.upload).not.toHaveBeenCalled();
        expect(bucket.remove).toHaveBeenCalledWith([incoming]);
    });

    it.each([
        ['another trip', `trips/${OTHER}/incoming/a.jpg`],
        ['an already stored original', `trips/${TRIP}/original/a.webp`],
        ['traversal', `trips/${TRIP}/incoming/../original/a.jpg`],
        ['an unknown extension', `trips/${TRIP}/incoming/a.svg`],
    ])('refuses a path in %s without touching storage', async (_, path) => {
        const { admin, bucket } = adminWith({});
        await expect(ingestUpload(admin, TRIP, path)).rejects.toBeInstanceOf(AppError);
        expect(bucket.download).not.toHaveBeenCalled();
    });
});

describe('removeStaleIncomingUploads', () => {
    it('removes only unconfirmed uploads older than a day', async () => {
        const now = Date.parse('2026-09-29T12:00:00Z');
        const old = new Date(now - 25 * 60 * 60 * 1000).toISOString();
        const fresh = new Date(now - 60 * 1000).toISOString();
        const tree: Record<string, object[]> = {
            trips: [{ id: null, name: TRIP }],
            [`trips/${TRIP}/incoming`]: [
                { id: '1', name: 'old.jpg', created_at: old },
                { id: '2', name: 'fresh.jpg', created_at: fresh },
            ],
        };
        const { admin, bucket } = adminWith({ list: vi.fn(async (prefix: string) => ({ data: tree[prefix] ?? [], error: null })) });

        expect(await removeStaleIncomingUploads(admin, now)).toBe(1);
        expect(bucket.remove).toHaveBeenCalledWith([`trips/${TRIP}/incoming/old.jpg`]);
    });
});
