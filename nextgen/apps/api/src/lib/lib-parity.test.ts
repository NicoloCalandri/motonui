import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SRC_LIB, compare, compareWeb, portedFiles, transform, transformWeb } from '../../../../scripts/port-lib.mjs';
import { EXCLUDED, PENDING, PORTED, WEB_COPIES, WEB_WITHOUT_TEST } from '../../../../scripts/port-manifest.mjs';

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

    it('swaps the Next.js Sentry SDK for the Node one', () => {
        expect(transform("import * as Sentry from '@sentry/nextjs';", 'monitoring.ts')).toBe("import * as Sentry from '@sentry/node';");
        expect(transform("import type { ErrorEvent } from '@sentry/nextjs';", 'sentry.test.ts')).toBe("import type { ErrorEvent } from '@sentry/node';");
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

describe('files copied to the web app equal their source', () => {
    it('copies the browser-safe helpers the ported pages need', () => {
        expect(WEB_COPIES).toEqual(expect.arrayContaining([
            'lib/wall-clock.ts', 'lib/auth/auth-error-message.ts', 'lib/auth/password.ts', 'lib/boarding-pass.ts',
            'lib/trip-files.ts', 'components/ui/use-dialog-a11y.ts', 'test/axe.ts',
        ]));
    });

    it.each(WEB_COPIES)('%s', (file) => {
        const { current, expected } = compareWeb(file);
        expect(current, `apps/web/src/${file} differs from src/${file}: run "node scripts/port-lib.mjs" in nextgen/`).toBe(expected);
    });
});

describe('transformWeb', () => {
    it('turns the app alias into a path relative to the file', () => {
        expect(transformWeb("import { a } from '@/lib/boarding-pass';", 'lib/boarding-pass.test.ts')).toBe("import { a } from './boarding-pass';");
        expect(transformWeb("import { a } from '@/lib/wall-clock';", 'components/ui/x.tsx')).toBe("import { a } from '../../lib/wall-clock';");
        expect(transformWeb("vi.mock('@/test/axe')", 'lib/auth/x.test.ts')).toBe("vi.mock('../../test/axe')");
    });

    it('leaves packages and relative imports alone, and normalizes line endings', () => {
        expect(transformWeb("import { z } from 'zod';\r\nimport { b } from './b';\r\n", 'lib/a.ts')).toBe("import { z } from 'zod';\nimport { b } from './b';\n");
    });
});

describe('transformWeb for components', () => {
    it('points domain types to the shared package', () => {
        expect(transformWeb("import type { Trip } from '@/lib/types';", 'components/trip/PackingTab.tsx')).toBe("import type { Trip } from '@motonui/shared-types';");
    });

    it('points the Next.js modules to their adapters', () => {
        expect(transformWeb("import Link from 'next/link';", 'components/blog/BlogTab.tsx')).toBe("import Link from '../../lib/next/link';");
        expect(transformWeb("import { useRouter } from 'next/navigation';", 'components/admin/x.tsx')).toBe("import { useRouter } from '../../lib/next/navigation';");
        expect(transformWeb("vi.mock('next/navigation', () => ({}))", 'components/admin/x.test.tsx')).toBe("vi.mock('../../lib/next/navigation', () => ({}))");
    });

    it('leaves other packages alone', () => {
        expect(transformWeb("import useSWR from 'swr';\nimport { z } from 'zod';", 'components/a.tsx')).toBe("import useSWR from 'swr';\nimport { z } from 'zod';");
    });
});

describe('tests of the files copied to the web app', () => {
    it('come with their file, or the manifest says why not', () => {
        const SRC = join(SRC_LIB, '..');
        const missing = WEB_COPIES
            .filter((file) => !/\.test\.tsx?$/.test(file))
            .flatMap((file) => ['.test.ts', '.test.tsx'].map((suffix) => file.replace(/\.tsx?$/, suffix)))
            .filter((test) => existsSync(join(SRC, test)) && !WEB_COPIES.includes(test) && !(test in WEB_WITHOUT_TEST));

        expect(missing, 'add the test to WEB_COPIES, or to WEB_WITHOUT_TEST with a reason').toEqual([]);
    });

    it('gives a reason for every test left out', () => {
        expect(Object.values(WEB_WITHOUT_TEST).filter((reason) => reason.trim().length < 10)).toEqual([]);
    });
});
