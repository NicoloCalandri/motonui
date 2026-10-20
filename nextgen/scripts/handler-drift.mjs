/**
 * Compares what the Next.js route handlers and their Hono counterparts do,
 * resource by resource: tables, RPCs, schema fields, library functions and
 * user-facing messages. The handlers cannot be diffed line by line (withRoute
 * versus Hono), so this lists what one side mentions and the other does not.
 * It is a pointer for a human comparison, not a proof of equivalence.
 *
 *   node scripts/handler-drift.mjs            every resource
 *   node scripts/handler-drift.mjs legs       resources whose name contains "legs"
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const NEXTGEN = join(dirname(fileURLToPath(import.meta.url)), '..');
const NEXT_API = join(NEXTGEN, '..', 'src', 'app', 'api');
const HONO_ROUTES = join(NEXTGEN, 'apps', 'api', 'src', 'routes');

/** Hono route file → the Next.js folders it ports (relative to src/app/api; `!` excludes a subfolder). */
export const RESOURCES = {
    'trips.ts': ['trips/route.ts', 'trips/[id]/route.ts'],
    'trips-days.ts': ['trips/[id]/days', '!trips/[id]/days/[dayId]/legs', '!trips/[id]/days/[dayId]/accommodations'],
    'trips-legs.ts': ['trips/[id]/legs', 'trips/[id]/days/[dayId]/legs', '!trips/[id]/days/[dayId]/legs/[legId]/boarding-pass'],
    'trips-boarding-pass.ts': ['trips/[id]/days/[dayId]/legs/[legId]/boarding-pass'],
    'trips-accommodations.ts': ['trips/[id]/accommodations', 'trips/[id]/days/[dayId]/accommodations'],
    'trips-restaurants.ts': ['trips/[id]/restaurants'],
    'trips-activities.ts': ['trips/[id]/activities'],
    'trips-documents.ts': ['trips/[id]/documents'],
    'trips-expenses.ts': ['trips/[id]/expenses'],
    'trips-media.ts': ['trips/[id]/media'],
    'trips-posts.ts': ['trips/[id]/posts'],
    'trips-baggage.ts': ['trips/[id]/baggage'],
    'trips-packing.ts': ['trips/[id]/packing'],
    'trips-stats.ts': ['trips/[id]/stats'],
    'trips-invites.ts': ['trips/[id]/invites'],
    'trips-instagram.ts': ['trips/[id]/instagram'],
    'invites.ts': ['invites'],
    'account.ts': ['account'],
    'expenses.ts': ['expenses'],
    'profile.ts': ['profile'],
    'posts.ts': ['posts'],
    'ai.ts': ['ai'],
    'admin/stats.ts': ['admin/stats'],
    'admin/audit-log.ts': ['admin/audit-log'],
    'admin/features.ts': ['admin/features'],
    'admin/users.ts': ['admin/users'],
    'admin/trips.ts': ['admin/trips'],
    'admin/impersonate.ts': ['admin/impersonate'],
    'admin/sentry-test.ts': ['admin/sentry-test'],
    'admin/cleanup.ts': ['admin/cleanup'],
    'admin/send-reminders.ts': ['admin/send-reminders'],
};

/** Hono files whose handler body lives in a library module: it is read with them. */
const EXTRA_HONO_SOURCES = {
    'admin/cleanup.ts': ['../lib/cron/cleanup.ts'],
    'admin/send-reminders.ts': ['../lib/cron/send-reminders.ts'],
};

function walk(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return walk(path);
        return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
    });
}

const posix = (path) => path.split(sep).join('/');

export function nextFilesFor(patterns) {
    const all = walk(NEXT_API).map((path) => posix(relative(NEXT_API, path)));
    const include = patterns.filter((pattern) => !pattern.startsWith('!'));
    const exclude = patterns.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1));
    const under = (file, folder) => file === folder || file.startsWith(`${folder}/`);
    return all.filter((file) => include.some((folder) => under(file, folder)) && !exclude.some((folder) => under(file, folder)));
}

// Names that differ by design between the two frameworks.
const INFRA = new Set([
    'withRoute', 'tripParams', 'withErrorHandler', 'ok', 'created', 'requireParam', 'readJsonObject', 'readFormData', 'issueSummary',
    'formatZodError', 'getAuthUser', 'requireTripMember', 'requireUser', 'loadProfile', 'requireAdmin', 'createClient',
    'createAdminClient', 'createUserClient', 'Errors', 'AppError', 'log', 'NextResponse', 'NextRequest', 'after', 'runInBackground',
    'isAuthorizedCronRequest', 'requireCronSecret', 'env', 'checkRateLimit', 'enforceRateLimit', 'ipSubject', 'captureError',
    'getCookie', 'setCookie', 'deleteCookie', 'writeAuditLog', 'requireDayInTrip',
    // Typing helpers, per-framework parameter and limit helpers, and the two cron bodies moved to lib/cron.
    'fromJson', 'toJson', 'idParams', 'userSubject', 'createAnonClient', 'runCleanup', 'runSendReminders',
]);

export function fingerprint(source) {
    const all = (regex, group = 1) => new Set([...source.matchAll(regex)].map((match) => match[group]));
    const imported = new Set();
    for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"](?:@\/lib\/|\.{1,2}\/)[^'"]+['"]/g)) {
        for (const name of match[1].split(',')) {
            const clean = name.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0];
            if (clean && !INFRA.has(clean) && /^[a-z]/.test(clean)) imported.add(clean);
        }
    }
    return {
        tables: all(/\.from\(\s*['"]([a-z_]+)['"]/g),
        rpcs: all(/\.rpc\(\s*['"]([a-z_]+)['"]/g),
        // A schema field with its rule, so that a changed constraint shows up too.
        fields: new Set(
            [...source.matchAll(/^\s*([a-zA-Z_]+:\s*(?:z\.|httpsUrl|[A-Z][A-Za-z]*Schema).*?),?\s*$/gm)].map((match) => match[1].replace(/\s+/g, ' ')),
        ),
        functions: imported,
        messages: all(/(?:Errors\.\w+|new AppError)\(\s*(['"`])((?:(?!\1).)+)\1/g, 2),
    };
}

function merge(prints) {
    const out = { tables: new Set(), rpcs: new Set(), fields: new Set(), functions: new Set(), messages: new Set() };
    for (const print of prints) for (const key of Object.keys(out)) for (const value of print[key]) out[key].add(value);
    return out;
}

export function compare(resource) {
    const nextFiles = nextFilesFor(RESOURCES[resource]);
    const honoFiles = [resource, ...(EXTRA_HONO_SOURCES[resource] ?? [])].map((file) => join(HONO_ROUTES, file));
    const next = merge(nextFiles.map((file) => fingerprint(readFileSync(join(NEXT_API, file), 'utf8'))));
    const hono = merge(honoFiles.map((file) => fingerprint(readFileSync(file, 'utf8'))));
    const diff = {};
    for (const key of Object.keys(next)) {
        const onlyNext = [...next[key]].filter((value) => !hono[key].has(value)).sort();
        const onlyHono = [...hono[key]].filter((value) => !next[key].has(value)).sort();
        if (onlyNext.length || onlyHono.length) diff[key] = { onlyNext, onlyHono };
    }
    return { nextFiles, diff };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const filter = process.argv[2] ?? '';
    let drifting = 0;
    for (const resource of Object.keys(RESOURCES).filter((name) => name.includes(filter))) {
        const { nextFiles, diff } = compare(resource);
        const keys = Object.keys(diff);
        if (keys.length === 0) {
            console.log(`same      ${resource}`);
            continue;
        }
        drifting += 1;
        console.log(`\nDIFFERENT ${resource}  (${nextFiles.length} Next.js file(s))`);
        for (const key of keys) {
            if (diff[key].onlyNext.length) console.log(`  ${key} only in Next.js: ${diff[key].onlyNext.join(' | ')}`);
            if (diff[key].onlyHono.length) console.log(`  ${key} only in Hono:    ${diff[key].onlyHono.join(' | ')}`);
        }
    }
    console.log(`\n${drifting} resource(s) differ`);
}
