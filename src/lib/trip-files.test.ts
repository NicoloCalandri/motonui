import { describe, expect, it } from 'vitest';
import { buildDocumentPath, buildMediaPath, documentHref, isTripFilePath, mediaFullSrc, mediaThumbSrc, safeExternalUrl } from './trip-files';

const TRIP = '10000000-0000-0000-0000-00000000000a';
const OTHER = '10000000-0000-0000-0000-00000000000c';

describe('isTripFilePath', () => {
    it('accepts paths the server builds', () => {
        expect(isTripFilePath(buildMediaPath(TRIP, 'original', 'jpg'), TRIP)).toBe(true);
        expect(isTripFilePath(buildMediaPath(TRIP, 'thumbs', 'webp'), TRIP, 'thumbs')).toBe(true);
        expect(isTripFilePath(buildDocumentPath(TRIP, 'pdf'), TRIP, 'documents')).toBe(true);
    });

    it.each([
        ['another trip', `trips/${OTHER}/original/a.jpg`],
        ['traversal', `trips/${TRIP}/../${OTHER}/original/a.jpg`],
        ['dotted segment', `trips/${TRIP}/original/..`],
        ['hidden file', `trips/${TRIP}/original/.env`],
        ['empty segment', `trips/${TRIP}//a.jpg`],
        ['prefix only', `trips/${TRIP}/`],
        ['sibling id with same prefix', `trips/${TRIP}0/original/a.jpg`],
        ['encoded characters', `trips/${TRIP}/original/a%2F..jpg`],
        ['null', null],
    ])('rejects %s', (_, path) => {
        expect(isTripFilePath(path, TRIP)).toBe(false);
    });

    it('rejects a path in another folder of the same trip', () => {
        expect(isTripFilePath(`trips/${TRIP}/boarding-passes/x.pdf`, TRIP, 'documents')).toBe(false);
    });
});

describe('document links', () => {
    it('keeps only https external links', () => {
        expect(safeExternalUrl('https://example.com/t.pdf')).toBe('https://example.com/t.pdf');
        expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
        expect(safeExternalUrl('data:text/html,<script>1</script>')).toBeNull();
        expect(safeExternalUrl('http://example.com/t.pdf')).toBeNull();
        expect(safeExternalUrl('/relative')).toBeNull();
    });

    it('serves uploaded files through the authenticated route', () => {
        const doc = { id: 'd1', trip_id: TRIP, file_path: `trips/${TRIP}/documents/x.pdf`, file_url: null };
        expect(documentHref(doc)).toBe(`/api/trips/${TRIP}/documents/d1/file`);
        expect(documentHref(doc, { download: true })).toBe(`/api/trips/${TRIP}/documents/d1/file?download=1`);
        expect(documentHref({ ...doc, file_path: null, file_url: 'javascript:alert(1)' })).toBeNull();
    });
});

describe('media sources', () => {
    const base = { url: null, thumbnail_url: null, signed_url: null, signed_thumb_url: null };

    it('prefers signed URLs and never returns an unsafe external link', () => {
        expect(mediaThumbSrc({ ...base, signed_url: 'https://s/o', signed_thumb_url: 'https://s/t' })).toBe('https://s/t');
        expect(mediaThumbSrc({ ...base, signed_url: 'https://s/o' })).toBe('https://s/o');
        expect(mediaFullSrc({ ...base, signed_url: 'https://s/o', url: 'https://ext/a.jpg' })).toBe('https://s/o');
        expect(mediaFullSrc({ ...base, url: 'https://ext/a.jpg' })).toBe('https://ext/a.jpg');
        expect(mediaThumbSrc({ ...base, url: 'javascript:alert(1)' })).toBeUndefined();
    });
});
