import { describe, it, expect, vi, beforeAll } from 'vitest';
import { validateFile, getPublicUrl, Buckets } from './storage';

// createAdminClient is only needed for async upload/sign/delete — not for validateFile or getPublicUrl
vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: vi.fn(),
}));

// =============================================================================
// validateFile
// =============================================================================

describe('validateFile', () => {
    it.each([
        ['image/jpeg'],
        ['image/png'],
        ['image/webp'],
        ['image/heic'],
        ['video/mp4'],
        ['application/pdf'],
    ])('accepts allowed MIME type: %s', (mime) => {
        expect(() => validateFile(mime, 1024)).not.toThrow();
    });

    it('throws for an unsupported MIME type', () => {
        expect(() => validateFile('application/octet-stream', 1024)).toThrow('Tipo di file non supportato');
    });

    it('rejects files whose magic bytes do not match the declared MIME type', () => {
        expect(() => validateFile('image/png', 8, Buffer.from('notapng!'))).toThrow(
            'Il contenuto del file non corrisponde al tipo dichiarato.'
        );
    });

    it('throws for GIF which is not in the allowlist', () => {
        expect(() => validateFile('image/gif', 1024)).toThrow('Tipo di file non supportato');
    });

    it('throws for plain text files', () => {
        expect(() => validateFile('text/plain', 100)).toThrow('Tipo di file non supportato');
    });

    it('includes the disallowed MIME type in the error message', () => {
        expect(() => validateFile('application/zip', 100)).toThrow('application/zip');
    });

    it('accepts a file exactly at the 50 MB size limit', () => {
        const MAX = 50 * 1024 * 1024;
        expect(() => validateFile('image/jpeg', MAX)).not.toThrow();
    });

    it('throws when the file exceeds 50 MB by 1 byte', () => {
        const tooLarge = 50 * 1024 * 1024 + 1;
        expect(() => validateFile('image/jpeg', tooLarge)).toThrow('File troppo grande');
    });

    it('includes the actual file size (in MB) in the oversized error message', () => {
        const size = 60 * 1024 * 1024; // exactly 60 MB
        expect(() => validateFile('image/jpeg', size)).toThrow('60.0 MB');
    });

    it('accepts tiny files (1 byte)', () => {
        expect(() => validateFile('image/png', 1)).not.toThrow();
    });

    it('throws for video/quicktime even though video/mp4 is allowed', () => {
        expect(() => validateFile('video/quicktime', 1024)).toThrow('Tipo di file non supportato');
    });
});

// =============================================================================
// getPublicUrl
// =============================================================================

describe('getPublicUrl', () => {
    beforeAll(() => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    });

    it('returns a correctly formed public URL for trip-media bucket', () => {
        const url = getPublicUrl(Buckets.tripMedia, 'trips/abc/photo.jpg');
        expect(url).toBe(
            'https://example.supabase.co/storage/v1/object/public/trip-media/trips/abc/photo.jpg'
        );
    });

    it('uses the post-covers bucket name correctly', () => {
        const url = getPublicUrl(Buckets.postCovers, 'cover.jpg');
        expect(url).toContain('/post-covers/');
        expect(url).toContain('cover.jpg');
    });

    it('uses the instagram-exports bucket name correctly', () => {
        const url = getPublicUrl(Buckets.instagramExports, 'export/pack.zip');
        expect(url).toContain('/instagram-exports/');
        expect(url).toContain('export/pack.zip');
    });

    it('includes the nested path in the URL', () => {
        const url = getPublicUrl(Buckets.tripMedia, 'user/123/image.webp');
        expect(url).toContain('user/123/image.webp');
    });

    it('starts with the Supabase project URL', () => {
        const url = getPublicUrl(Buckets.tripMedia, 'file.jpg');
        expect(url).toMatch(/^https:\/\/example\.supabase\.co\//);
    });
});

// =============================================================================
// Buckets constant
// =============================================================================

describe('Buckets constant', () => {
    it('has the correct trip-media bucket name', () => {
        expect(Buckets.tripMedia).toBe('trip-media');
    });

    it('has the correct post-covers bucket name', () => {
        expect(Buckets.postCovers).toBe('post-covers');
    });

    it('has the correct instagram-exports bucket name', () => {
        expect(Buckets.instagramExports).toBe('instagram-exports');
    });
});
