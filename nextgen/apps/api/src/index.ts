import './lib/instrument';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { startScheduler } from './scheduler';
import { env } from './lib/env';
import { log } from './lib/log';
import { webBuildProblem } from './lib/web-build-check';

// A production process that cannot serve the pages must say so, not look healthy.
const problem = webBuildProblem(process.env);
if (problem) log.warn(`[motonui][api][startup] ${problem}`);

const app = createApp();

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    console.log(`[motonui][api] listening on http://localhost:${info.port}`);
});

startScheduler();
