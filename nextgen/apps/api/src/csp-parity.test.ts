import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from './web-app';

/**
 * The shell's policy is the counterpart of src/lib/csp.ts (Next.js app). The
 * source of truth is imported at run time, read only, from outside this
 * package (the type-check is limited to src/), and compared directive by
 * directive. The only allowed differences are the ones the build makes
 * unnecessary: no per-request nonce and no 'strict-dynamic' (the build has no
 * inline script, so scripts are 'self' alone).
 */

type BuildCsp = (options: { nonce: string; dev?: boolean }) => string;

async function nextCsp(dev: boolean): Promise<string> {
    const file = join(__dirname, '..', '..', '..', '..', 'src', 'lib', 'csp.ts');
    const module = (await import(/* @vite-ignore */ pathToFileURL(file).href)) as { buildCsp: BuildCsp };
    return module.buildCsp({ nonce: 'test-nonce', dev });
}

function parse(policy: string): Map<string, string[]> {
    return new Map(
        policy
            .split(';')
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => {
                const [name, ...values] = part.split(/\s+/);
                return [name, values] as const;
            }),
    );
}

describe('content security policy of the app shell', () => {
    it('has the directives of src/lib/csp.ts in production', async () => {
        const expected = parse(await nextCsp(false));
        const scripts = expected.get('script-src') ?? [];
        expected.set('script-src', scripts.filter((value) => !value.startsWith("'nonce-") && value !== "'strict-dynamic'"));

        const actual = parse(contentSecurityPolicy('', true));

        expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
        for (const [name, values] of expected) expect([...(actual.get(name) ?? [])].sort(), name).toEqual([...values].sort());
    });

    it('upgrades insecure requests in production only, like the Next.js app', async () => {
        expect(contentSecurityPolicy('', true)).toContain('upgrade-insecure-requests');
        expect(contentSecurityPolicy('', false)).not.toContain('upgrade-insecure-requests');
        expect(await nextCsp(true)).not.toContain('upgrade-insecure-requests');
    });

    it('adds the origin of the configured Supabase project and nothing else', () => {
        const base = parse(contentSecurityPolicy('', true));
        const own = parse(contentSecurityPolicy('http://127.0.0.1:54321', true));

        expect(own.get('connect-src')).toEqual(expect.arrayContaining(['http://127.0.0.1:54321', 'ws://127.0.0.1:54321']));
        expect(own.get('script-src')).toEqual(base.get('script-src'));
    });
});
