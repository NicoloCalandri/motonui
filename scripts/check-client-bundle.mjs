#!/usr/bin/env node
/**
 * Fails if the browser bundle mentions a server-only secret (audit A1).
 *
 * Next.js inlines only NEXT_PUBLIC_* values in client code, so a secret value
 * cannot reach the browser by accident; what can happen is a client component
 * importing a server module, which drags the variable name (and the code that
 * uses it) into `.next/static`. This scan catches both the names and the
 * shapes of real keys, in case one was ever hard-coded.
 *
 *   npm run build && node scripts/check-client-bundle.mjs [.next]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Server-only variables (docs/ENV_VARS.md): their names never belong in client code. */
export const SERVER_ONLY_VARS = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'ANTHROPIC_API_KEY',
    'EXCHANGE_RATE_API_KEY',
    'RESEND_API_KEY',
    'CRON_SECRET',
    'ADMIN_IMPERSONATION_SECRET',
    'SENTRY_AUTH_TOKEN',
];

/** Shapes of real secret values. */
export const SECRET_PATTERNS = [
    { name: 'Anthropic API key', pattern: /sk-ant-[A-Za-z0-9_-]{20,}/ },
    { name: 'Supabase secret key', pattern: /sb_secret_[A-Za-z0-9_-]{20,}/ },
    // base64url of `"role":"service_role"` as it appears inside a JWT payload.
    { name: 'Supabase service_role JWT', pattern: /InJvbGUiOiJzZXJ2aWNlX3JvbGUi|cm9sZSI6InNlcnZpY2Vfcm9sZS/ },
    { name: 'Mapbox secret token', pattern: /\bsk\.eyJ[A-Za-z0-9_-]{20,}/ },
    { name: 'Resend API key', pattern: /\bre_[A-Za-z0-9]{8}_[A-Za-z0-9]{16,}/ },
];

/** Returns the findings for one file's content. */
export function scanSource(source) {
    const findings = [];
    for (const name of SERVER_ONLY_VARS) {
        if (source.includes(name)) findings.push(`variable ${name}`);
    }
    for (const { name, pattern } of SECRET_PATTERNS) {
        if (pattern.test(source)) findings.push(name);
    }
    return findings;
}

function* walk(dir) {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) yield* walk(path);
        else if (/\.(js|mjs|css|html|json|map)$/.test(entry)) yield path;
    }
}

function main() {
    const root = process.argv[2] ?? '.next';
    const staticDir = join(root, 'static');
    try {
        statSync(staticDir);
    } catch {
        console.error(`[check-client-bundle] ${staticDir} not found: run \`npm run build\` first.`);
        process.exit(2);
    }

    let files = 0;
    const problems = [];
    for (const file of walk(staticDir)) {
        files += 1;
        for (const finding of scanSource(readFileSync(file, 'utf8'))) {
            problems.push(`${relative(root, file)}: ${finding}`);
        }
    }

    if (problems.length > 0) {
        console.error('[check-client-bundle] server-only secrets found in the browser bundle:');
        for (const problem of problems) console.error(`  - ${problem}`);
        process.exit(1);
    }
    console.log(`[check-client-bundle] ok: ${files} files in ${staticDir}, no server-only secret.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
