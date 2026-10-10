import { describe, expect, it } from 'vitest';
import { buildCsp, createNonce } from './csp';

function directive(csp: string, name: string): string[] {
    const found = csp.split('; ').find((d) => d.startsWith(`${name} `));
    return found ? found.split(' ').slice(1) : [];
}

describe('buildCsp (T-4.4)', () => {
    it('allows scripts only through the nonce in production', () => {
        const csp = buildCsp({ nonce: 'abc123' });
        expect(directive(csp, 'script-src')).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
        expect(csp).not.toContain('unsafe-eval');
        expect(directive(csp, 'script-src')).not.toContain("'unsafe-inline'");
        expect(csp).toContain('upgrade-insecure-requests');
    });

    it('never lets the browser reach the Anthropic API', () => {
        expect(directive(buildCsp({ nonce: 'n' }), 'connect-src').join(' ')).not.toContain('anthropic');
    });

    it('blocks plugins and framing, and keeps local Supabase for dev only', () => {
        const prod = buildCsp({ nonce: 'n' });
        expect(directive(prod, 'object-src')).toEqual(["'none'"]);
        expect(directive(prod, 'frame-ancestors')).toEqual(["'none'"]);
        expect(prod).not.toContain('127.0.0.1');

        const dev = buildCsp({ nonce: 'n', dev: true });
        expect(directive(dev, 'script-src')).toContain("'unsafe-eval'");
        expect(directive(dev, 'connect-src')).toContain('http://127.0.0.1:54321');
    });

    it('creates a fresh base64 nonce of 128 bits each time', () => {
        const a = createNonce();
        expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
        expect(createNonce()).not.toBe(a);
    });
});
