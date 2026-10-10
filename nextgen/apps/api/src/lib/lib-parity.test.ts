import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SRC_LIB, compare, portedFiles, transform } from '../../../../scripts/port-lib.mjs';
import { EXCLUDED, PENDING, PORTED } from '../../../../scripts/port-manifest.mjs';

/**
 * The library code of this app is a checked copy of src/lib (Next.js app).
 * If this fails after a change in src/lib, run in nextgen/:
 *
 *     node scripts/port-lib.mjs
 *
 * and, for a new module, classify it in scripts/port-manifest.mjs.
 */

function modules(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return modules(path);
        return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [relative(SRC_LIB, path).split(sep).join('/')] : [];
    });
}

const SOURCES = modules(SRC_LIB).filter((module) => !/\.test\.tsx?$/.test(module)).sort();

describe('port manifest', () => {
    it('classifies every module of src/lib exactly once', () => {
        const lists = [PORTED, Object.keys(PENDING), Object.keys(EXCLUDED)];
        const unclassified = SOURCES.filter((module) => lists.every((list) => !list.includes(module)));
        const twice = SOURCES.filter((module) => lists.filter((list) => list.includes(module)).length > 1);

        expect(unclassified, 'new modules in src/lib: add them to scripts/port-manifest.mjs').toEqual([]);
        expect(twice).toEqual([]);
    });

    it('lists only modules that exist', () => {
        const listed = [...PORTED, ...Object.keys(PENDING), ...Object.keys(EXCLUDED)];
        expect(listed.filter((module) => !SOURCES.includes(module))).toEqual([]);
    });

    it('gives a reason for every exclusion and a plan for everything pending', () => {
        expect(Object.values(EXCLUDED).filter((reason) => reason.trim().length < 10)).toEqual([]);
        expect(Object.values(PENDING).filter((plan) => !/^B[1-4]$/.test(plan))).toEqual([]);
    });
});

describe('ported modules equal their source', () => {
    it.each(portedFiles())('%s', (module) => {
        const { current, expected } = compare(module);
        expect(current, `${module} differs from src/lib/${module}: run "node scripts/port-lib.mjs" in nextgen/`).toBe(expected);
    });
});

describe('transform', () => {
    it('points domain and database types to the shared package', () => {
        const source = [
            "import type { Trip } from '@/lib/types';",
            "import type { Database } from '@/lib/supabase/database.types';",
            "import type { Json } from './supabase/database.types';",
        ].join('\n');

        expect(transform(source, 'trips.ts')).toBe([
            "import type { Trip } from '@motonui/shared-types';",
            "import type { Database } from '@motonui/shared-types';",
            "import type { Json } from '@motonui/shared-types';",
        ].join('\n'));
        expect(transform("import type { Database } from '../supabase/database.types';", 'ai/destination.ts'))
            .toBe("import type { Database } from '@motonui/shared-types';");
    });

    it('turns app aliases into relative paths, from any depth', () => {
        expect(transform("import { log } from '@/lib/log';", 'trips.ts')).toBe("import { log } from './log';");
        expect(transform("import { log } from '@/lib/log';", 'auth/cron.ts')).toBe("import { log } from '../log';");
        expect(transform("import { safeFetch } from '@/lib/safe-fetch';", 'ai/destination.ts')).toBe("import { safeFetch } from '../safe-fetch';");
        expect(transform("import { models } from '@/lib/ai/models';", 'ai/seo.ts')).toBe("import { models } from './models';");
    });

    it('rewrites specifiers in dynamic imports and test mocks, and test helpers', () => {
        const source = [
            "vi.mock('@/lib/supabase/server', () => ({}));",
            "const mod = await import('@/lib/email');",
            "import { queryChain } from '@/test/supabase-mock';",
        ].join('\n');

        expect(transform(source, 'media/pipeline.test.ts')).toBe([
            "vi.mock('../supabase/server', () => ({}));",
            "const mod = await import('../email');",
            "import { queryChain } from '../../test/supabase-mock';",
        ].join('\n'));
    });

    it('leaves packages and unrelated strings alone', () => {
        const source = "import { z } from 'zod';\nconst label = 'a ./relative looking string';\nconst alias = 'see @/lib docs';";
        expect(transform(source, 'validation.ts')).toBe(source);
    });

    it('keeps types relative inside the shared package', () => {
        expect(transform("export * from './rows';", 'types/index.ts')).toBe("export * from './rows';");
        expect(transform("import type { Database } from '@/lib/supabase/database.types';", 'types/rows.ts'))
            .toBe("import type { Database } from '../database.types';");
        expect(transform("import type { Database } from '../supabase/database.types';", 'types/rows.ts'))
            .toBe("import type { Database } from '../database.types';");
    });

    it('normalizes line endings', () => {
        expect(transform("a\r\nb\r\n", 'x.ts')).toBe('a\nb\n');
    });
});
