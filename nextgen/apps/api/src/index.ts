import { serve } from '@hono/node-server';
import { createApp } from './app';
import { startScheduler } from './scheduler';
import { env } from './lib/env';

const app = createApp();

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    console.log(`[motonui][api] listening on http://localhost:${info.port}`);
});

startScheduler();
