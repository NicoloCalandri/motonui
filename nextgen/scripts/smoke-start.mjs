#!/usr/bin/env node
/**
 * Starts the built API (apps/api/dist/index.js) with the built web app and
 * checks that the process really serves both. Unit tests run the sources:
 * only this proves that the build output loads under plain Node.
 *
 *   npm run build && node scripts/smoke-start.mjs
 *
 * No Supabase is contacted: the probes are the liveness route, the app shell,
 * an unknown API path and a route that needs a session.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const NEXTGEN = join(dirname(fileURLToPath(import.meta.url)), '..');
const entry = join(NEXTGEN, 'apps', 'api', 'dist', 'index.js');
const webDist = join(NEXTGEN, 'apps', 'web', 'dist');
const port = Number(process.env.SMOKE_PORT ?? 3987);
const base = `http://127.0.0.1:${port}`;

for (const path of [entry, join(webDist, 'index.html')]) {
    if (!existsSync(path)) {
        console.error(`missing ${path}: run "npm run build" in nextgen/ first`);
        process.exit(1);
    }
}

const server = spawn(process.execPath, [entry], {
    env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(port),
        WEB_DIST: webDist,
        SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_ANON_KEY: 'smoke-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'smoke-service-role-key',
        WEB_ORIGIN: base,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', (chunk) => { output += chunk; });
server.stderr.on('data', (chunk) => { output += chunk; });

async function waitUntilUp() {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        if (server.exitCode !== null) throw new Error(`the server exited with code ${server.exitCode}`);
        try {
            const res = await fetch(`${base}/api/health`);
            if (res.ok) return;
        } catch {
            // not listening yet
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('the server did not answer within 15 seconds');
}

const checks = [
    ['GET /api/health is 200', async () => (await fetch(`${base}/api/health`)).status === 200],
    ['a client route is the app shell, with a content security policy', async () => {
        const res = await fetch(`${base}/trips/some-id`);
        return res.status === 200 && (res.headers.get('content-type') ?? '').includes('text/html')
            && (res.headers.get('content-security-policy') ?? '').includes("default-src 'self'") && (await res.text()).includes('id="root"');
    }],
    ['an unknown API path is a JSON 404', async () => {
        const res = await fetch(`${base}/api/does-not-exist`);
        return res.status === 404 && (res.headers.get('content-type') ?? '').includes('json');
    }],
    ['a missing asset is a 404, not the shell', async () => (await fetch(`${base}/assets/missing.js`)).status === 404],
    ['GET /api/session without a token is 401', async () => (await fetch(`${base}/api/session`)).status === 401],
    ['a write from another site is refused', async () => {
        const res = await fetch(`${base}/api/trips`, { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' });
        return res.status === 403;
    }],
];

let failed = 0;
try {
    await waitUntilUp();
    for (const [name, check] of checks) {
        let passed = false;
        try {
            passed = await check();
        } catch {
            passed = false;
        }
        console.log(`${passed ? 'ok  ' : 'FAIL'} ${name}`);
        if (!passed) failed += 1;
    }
} catch (error) {
    failed += 1;
    console.error(`FAIL ${error instanceof Error ? error.message : error}`);
    console.error(output.trim());
} finally {
    // Wait for the child to be gone, and let Node end on its own: exiting while
    // the handle is closing trips an assertion in libuv on Windows.
    const gone = new Promise((resolve) => server.once('exit', resolve));
    server.kill();
    await gone;
}
process.exitCode = failed === 0 ? 0 : 1;
