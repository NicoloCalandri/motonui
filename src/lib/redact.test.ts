import { describe, expect, it } from 'vitest';
import { redactText } from './redact';

describe('redactText', () => {
    it('removes email addresses', () => {
        expect(redactText('duplicate key (email)=(giorgia@example.com)')).toBe('duplicate key (email)=([email])');
    });

    it('removes JWTs and bearer tokens', () => {
        // Built from parts so the secret scanner does not flag the fake token.
        const jwt = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlX3ZhbHVl'].join('.');
        expect(redactText(`token ${jwt} expired`)).toBe('token [token] expired');
        expect(redactText('Authorization: Bearer abc.def-ghi')).toBe('Authorization: Bearer [token]');
    });

    it('removes secret query parameters and long opaque strings', () => {
        expect(redactText('/auth/callback?code=4/0AbCd&next=/trips')).toBe('/auth/callback?code=[redacted]&next=/trips');
        expect(redactText(`/invite/${'a'.repeat(43)}`)).toBe('/invite/[token]');
    });

    it('keeps UUIDs and ordinary text', () => {
        const text = 'trip 10000000-0000-4000-8000-00000000000a not found';
        expect(redactText(text)).toBe(text);
    });
});
