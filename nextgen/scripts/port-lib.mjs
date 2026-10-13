#!/usr/bin/env node
/**
 * Ports library modules from the Next.js app (src/lib) to nextgen.
 *
 *   node scripts/port-lib.mjs           copy every module in PORTED (and its test)
 *   node scripts/port-lib.mjs --check   report differences, change nothing (exit 1 if any)
 *
 * A ported file is its source with the imports rewritten, nothing else:
 *   '@/lib/types', '…/supabase/database.types'  →  '@motonui/shared-types'
 *   '@/lib/<module>'                              →  a relative path
 *   '@/test/<helper>'                             →  the relative path of apps/api/src/test/<helper>
 *   '@sentry/nextjs'                              →  '@sentry/node' (same API for what src/lib uses)
 * Browser-safe helpers listed in WEB_COPIES go to apps/web/src, at the path they
 * have under src/, with the '@/…' alias turned into a relative path.
 * Domain types (src/lib/types) and the database types go to
 * packages/shared-types; everything else to apps/api/src/lib.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORTED, WEB_COPIES, WITHOUT_TEST } from './port-manifest.mjs';

const NEXTGEN = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SRC_LIB = join(NEXTGEN, '..', 'src', 'lib');
const SRC = join(NEXTGEN, '..', 'src');
const API_LIB = join(NEXTGEN, 'apps', 'api', 'src', 'lib');
const WEB_SRC = join(NEXTGEN, 'apps', 'web', 'src');
const SHARED = join(NEXTGEN, 'packages', 'shared-types', 'src');
const SHARED_PACKAGE = '@motonui/shared-types';
const DATABASE_TYPES = 'supabase/database.types';

/** True for the modules that live in packages/shared-types instead of apps/api. */
function isSharedType(module) {
    return module.startsWith('types/') || module === `${DATABASE_TYPES}.ts`;
}

/** Absolute path of the nextgen copy of a src/lib module. */
export function targetPath(module) {
    if (module === `${DATABASE_TYPES}.ts`) return join(SHARED, 'database.types.ts');
    if (module.startsWith('types/')) return join(SHARED, module);
    return join(API_LIB, module);
}

function relative(fromDir, to) {
    const path = posix.relative(fromDir, to);
    return path.startsWith('.') ? path : `./${path}`;
}

/** Rewrites one module specifier found in the module `module` (a path relative to src/lib). */
function rewrite(specifier, module) {
    const dir = posix.dirname(module);
    const shared = isSharedType(module);

    // Where the specifier points, as a path relative to src/lib (null when it is a package).
    let target = null;
    if (specifier.startsWith('@/lib/')) target = specifier.slice('@/lib/'.length);
    else if (specifier.startsWith('.')) target = posix.normalize(posix.join(dir, specifier));

    if (specifier.startsWith('@/test/')) {
        return relative(posix.join('lib', dir), posix.join('test', specifier.slice('@/test/'.length)));
    }
    if (target === null) return specifier;

    if (target === DATABASE_TYPES) return shared ? relative(posix.join('types'), 'database.types') : SHARED_PACKAGE;
    if (target === 'types' || target.startsWith('types/')) {
        return shared ? relative(dir, target) : SHARED_PACKAGE;
    }
    return relative(dir, target);
}

/**
 * Source of a src/lib module as it must appear in nextgen. Every quoted string
 * that is a module specifier of the app ('@/lib/…', '@/test/…') or a relative
 * path is rewritten, wherever it appears: import/export, import(), vi.mock().
 */
export function transform(source, module) {
    const normalized = source.replace(/\r\n/g, '\n');
    return normalized
        .replace(/(['"])@sentry\/nextjs\1/g, (_match, quote) => `${quote}@sentry/node${quote}`)
        .replace(/(['"])(@\/(?:lib|test)\/[^'"\n]+)\1/g, (_match, quote, specifier) => `${quote}${rewrite(specifier, module)}${quote}`)
        .replace(
            /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\bvi\.(?:mock|doMock|importActual|importMock)\(\s*)(['"])(\.{1,2}\/[^'"\n]+)\2/g,
            (_match, lead, quote, specifier) => `${lead}${quote}${rewrite(specifier, module)}${quote}`,
        );
}

/** Every file the tool manages: the PORTED modules plus the tests that exist next to them in src/lib. */
export function portedFiles() {
    return PORTED.flatMap((module) => {
        const test = module.replace(/\.ts$/, '.test.ts');
        const wanted = existsSync(join(SRC_LIB, test)) && !isSharedType(module) && !(module in WITHOUT_TEST);
        return wanted ? [module, test] : [module];
    });
}

/** Expected and current content of one ported file (current is null when it does not exist). */
export function compare(module) {
    const expected = transform(readFileSync(join(SRC_LIB, module), 'utf8'), module);
    const path = targetPath(module);
    const current = existsSync(path) ? readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : null;
    return { path, expected, current, same: current === expected };
}

/**
 * Source of a file of the Next.js app (path relative to src/) as it must
 * appear at the same path in apps/web/src: the '@/…' alias becomes a path
 * relative to the file, nothing else changes. Only browser-safe files that
 * import packages and each other are copied this way (WEB_COPIES).
 */
export function transformWeb(source, file) {
    const dir = posix.dirname(file);
    return source
        .replace(/\r\n/g, '\n')
        // Domain types come from the shared package, as in apps/api.
        .replace(/(['"])@\/lib\/types\1/g, (_match, quote) => `${quote}${SHARED_PACKAGE}${quote}`)
        // The two Next.js modules client components use have adapters in apps/web/src/lib/next.
        .replace(/(['"])next\/(link|navigation)\1/g, (_match, quote, name) => `${quote}${relative(dir, `lib/next/${name}`)}${quote}`)
        .replace(/(['"])@\/([^'"\n]+)\1/g, (_match, quote, target) => `${quote}${relative(dir, target)}${quote}`);
}

/** Expected and current content of one file copied to apps/web/src. */
export function compareWeb(file) {
    const expected = transformWeb(readFileSync(join(SRC, file), 'utf8'), file);
    const path = join(WEB_SRC, file);
    const current = existsSync(path) ? readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : null;
    return { path, expected, current, same: current === expected };
}

function main() {
    const check = process.argv.includes('--check');
    let changed = 0;
    for (const file of WEB_COPIES) {
        const { path, expected, same } = compareWeb(file);
        if (same) continue;
        changed += 1;
        if (check) {
            console.log(`differs: web ${file}`);
        } else {
            mkdirSync(dirname(path), { recursive: true });
            writeFileSync(path, expected);
            console.log(`ported:  web ${file}`);
        }
    }
    for (const module of portedFiles()) {
        const { path, expected, same } = compare(module);
        if (same) continue;
        changed += 1;
        if (check) {
            console.log(`differs: ${module}`);
        } else {
            mkdirSync(dirname(path), { recursive: true });
            writeFileSync(path, expected);
            console.log(`ported:  ${module}`);
        }
    }
    console.log(check ? `${changed} file(s) differ from src/lib` : `${changed} file(s) written`);
    if (check && changed > 0) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
