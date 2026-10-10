/**
 * Classification of every module in src/lib (paths relative to it, no tests).
 * Checked by apps/api/src/lib/lib-parity.test.ts: a module must be in exactly
 * one list, and the PORTED ones must equal their source after the import
 * rewrite of port-lib.mjs.
 */

/** Copied by `node scripts/port-lib.mjs`. Never edit the copy: edit src/lib and re-run. */
export const PORTED = [
    'auth/cron.ts',
    'email.ts',
    'html.ts',
    'log.ts',
    'rate-limit.ts',
    'redact.ts',
    'request-context.ts',
    'safe-fetch.ts',
    'supabase/database.types.ts',
];

/** Not ported yet: the plan that will do it. The list only shrinks. */
export const PENDING = {
    // B1, later tasks of the same plan
    'admin/impersonation-token.ts': 'B1',
    'ai/blog-assistant.ts': 'B1',
    'ai/destination.ts': 'B1',
    'ai/models.ts': 'B1',
    'ai/packing.ts': 'B1',
    'ai/seo.ts': 'B1',
    'ai/sse.ts': 'B1',
    'ai/trip-summary.ts': 'B1',
    'ai/untrusted.ts': 'B1',
    'airports.ts': 'B1',
    'auth/admin-bypass.ts': 'B1',
    'auth/password.ts': 'B1',
    'authz.ts': 'B1',
    'blog/content-schema.ts': 'B1',
    'blog/public-posts.ts': 'B1',
    'blog/render-fixture.ts': 'B1',
    'blog/render.ts': 'B1',
    'currency.ts': 'B1',
    'expenses.ts': 'B1',
    'json.ts': 'B1',
    'media/captions.ts': 'B1',
    'media/process.ts': 'B1',
    'premium/access.ts': 'B1',
    'redirect.ts': 'B1',
    'reminder-emails.ts': 'B1',
    'reminders.ts': 'B1',
    'sanitize.ts': 'B1',
    'trips.ts': 'B1',
    'types/admin.ts': 'B1',
    'types/api.ts': 'B1',
    'types/content.ts': 'B1',
    'types/enums.ts': 'B1',
    'types/index.ts': 'B1',
    'types/media.ts': 'B1',
    'types/planning.ts': 'B1',
    'types/rows.ts': 'B1',
    'types/views.ts': 'B1',
    'url.ts': 'B1',
    'validation.ts': 'B1',
    'wall-clock.ts': 'B1',
    'weather.ts': 'B1',
    // B2: private storage, upload pipeline, document and boarding-pass downloads
    'boarding-pass.ts': 'B2',
    'media/pipeline.ts': 'B2',
    'storage-deletion.ts': 'B2',
    'storage.ts': 'B2',
    'trip-files.ts': 'B2',
    'trip-storage.ts': 'B2',
    // B3: partner invites
    'invites.ts': 'B3',
    // B4: asynchronous Instagram export, monitoring
    'instagram-cleanup.ts': 'B4',
    'media/instagram-export.ts': 'B4',
    'media/instagram-slides.ts': 'B4',
};

/** Not ported on purpose: where the Hono app has its own counterpart, or why it needs none. */
export const EXCLUDED = {
    'api/params.ts': 'Next.js route wrapper: Hono uses middleware/trip-guard.ts and requireParam in lib/http.ts',
    'api/with-route.ts': 'Next.js route wrapper: Hono uses app-level middleware (app.ts) and lib/http.ts',
    'auth/auth-error-message.ts': 'browser only: belongs to apps/web',
    'auth/get-user.ts': 'cookie session: Hono authenticates the bearer token in middleware/auth.ts and has its own lib/auth/get-user.ts',
    'auth/require-admin.ts': 'imports next/server: Hono uses middleware/admin.ts',
    'blog/editor-config.ts': 'editor options: belongs to apps/web with the post editor',
    'csp.ts': 'page headers: belongs to the hosting layer of apps/web',
    'errors.ts': 'imports next/server: Hono has lib/errors.ts (same AppError and Errors) and lib/http.ts',
    'fetcher.ts': 'browser only: apps/web uses its own api-client',
    'hooks/use-profile.ts': 'React hook: belongs to apps/web',
    'media/upload-client.ts': 'browser only: belongs to apps/web',
    'monitoring.ts': 'imports @sentry/nextjs: error capture for Hono comes with B4',
    'sentry.ts': 'imports @sentry/nextjs: comes with B4',
    'supabase/client.ts': 'browser client: belongs to apps/web',
    'supabase/middleware.ts': 'Next.js middleware session refresh: no counterpart with bearer tokens',
    'supabase/public.ts': 'anon client: Hono has createAnonClient in lib/supabase/server.ts',
    'supabase/server.ts': 'cookie-based clients: Hono has its own lib/supabase/server.ts',
};
