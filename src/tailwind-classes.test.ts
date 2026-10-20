// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Tailwind 3 cannot apply an opacity modifier to an arbitrary `var(...)` value:
 * `bg-[var(--color-sidebar)]/90` generates no CSS at all. That is how the mobile
 * tab bar lost its background and the active item went white on a light page.
 * Expose the color as RGB channels in tailwind.config.ts and use `bg-sidebar/90`.
 */
const OPACITY_ON_VAR = /-\[var\(--[^\]]+\)\]\/\d+/;

function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(path);
        return /\.(tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
    });
}

describe('tailwind classes', () => {
    it('never puts an opacity modifier on an arbitrary var() value', () => {
        const root = process.cwd();
        const offenders = sourceFiles(join(root, 'src')).flatMap((file) =>
            readFileSync(file, 'utf8')
                .split('\n')
                .flatMap((line, i) => (OPACITY_ON_VAR.test(line) ? [`${relative(root, file)}:${i + 1}`] : [])),
        );
        expect(offenders).toEqual([]);
    });
});
