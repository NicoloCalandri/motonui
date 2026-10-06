// @vitest-environment node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * With an `src/app` directory Next.js only loads `src/middleware.ts`: a root
 * `middleware.ts` is silently ignored. That is how auth redirects, the
 * cross-site write check and read-only impersonation never ran in
 * production until the file was moved.
 */
describe('middleware location', () => {
    const root = process.cwd();

    it('lives in src/, where Next.js loads it', () => {
        expect(existsSync(join(root, 'src/app'))).toBe(true);
        expect(existsSync(join(root, 'src/middleware.ts'))).toBe(true);
    });

    it('has no root copy that Next.js would ignore', () => {
        expect(existsSync(join(root, 'middleware.ts'))).toBe(false);
        expect(existsSync(join(root, 'middleware.js'))).toBe(false);
    });
});
