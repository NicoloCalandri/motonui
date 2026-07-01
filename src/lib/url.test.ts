import { describe, expect, it } from 'vitest';
import { getAppBaseUrl } from '@/lib/url';

describe('getAppBaseUrl', () => {
    it('uses NEXT_PUBLIC_APP_URL when it is a valid absolute URL', () => {
        expect(getAppBaseUrl('https://motonui.app')).toEqual(new URL('https://motonui.app'));
    });

    it('falls back when NEXT_PUBLIC_APP_URL is empty', () => {
        expect(getAppBaseUrl('   ')).toEqual(new URL('http://localhost:3000'));
    });

    it('falls back when NEXT_PUBLIC_APP_URL is invalid', () => {
        expect(getAppBaseUrl('motonui.app')).toEqual(new URL('http://localhost:3000'));
    });
});
