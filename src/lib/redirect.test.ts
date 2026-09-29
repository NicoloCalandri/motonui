import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from '@/lib/redirect';

describe('safeRedirectPath', () => {
    it.each([
        'https://evil.example',
        'http://evil.example/dashboard',
        '//evil.example',
        '/\\evil.example',
        '\\\\evil.example',
        'javascript:alert(1)',
        'JavaScript:alert(1)',
        'data:text/html,hi',
        'dashboard',
        '/\t/evil.example',
        '/\n/evil.example',
        '',
        '   ',
    ])('rejects %j', (value) => {
        expect(safeRedirectPath(value)).toBe('/dashboard');
    });

    it('rejects null and undefined', () => {
        expect(safeRedirectPath(null)).toBe('/dashboard');
        expect(safeRedirectPath(undefined)).toBe('/dashboard');
    });

    it.each([
        ['/trips/abc', '/trips/abc'],
        ['/dashboard', '/dashboard'],
        ['/trips/abc?tab=expenses#top', '/trips/abc?tab=expenses#top'],
        ['/', '/'],
    ])('keeps internal path %j', (value, expected) => {
        expect(safeRedirectPath(value)).toBe(expected);
    });

    it('uses a custom fallback', () => {
        expect(safeRedirectPath('https://evil.example', '/')).toBe('/');
    });
});
