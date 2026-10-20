// @vitest-environment node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * With an `src/app` directory Next.js only loads `src/proxy.ts`: a root
 * `proxy.ts` is silently ignored. That is how auth redirects, the cross-site
 * write check and read-only impersonation never ran in production until the
 * file was moved. Next.js 16 renamed the `middleware` convention to `proxy`
 * and deprecates the old file name.
 */
describe('proxy location', () => {
    const root = process.cwd();

    it('lives in src/, where Next.js loads it', () => {
        expect(existsSync(join(root, 'src/app'))).toBe(true);
        expect(existsSync(join(root, 'src/proxy.ts'))).toBe(true);
    });

    it('has no root copy that Next.js would ignore', () => {
        expect(existsSync(join(root, 'proxy.ts'))).toBe(false);
        expect(existsSync(join(root, 'proxy.js'))).toBe(false);
    });

    it('uses the proxy convention, not the deprecated middleware one', () => {
        for (const file of ['middleware.ts', 'middleware.js', 'src/middleware.ts', 'src/middleware.js']) {
            expect(existsSync(join(root, file))).toBe(false);
        }
    });
});
