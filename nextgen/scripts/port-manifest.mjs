/**
 * Classification of every module in src/lib (paths relative to it, no tests).
 * Checked by apps/api/src/lib/lib-parity.test.ts: a module must be in exactly
 * one list, and the PORTED ones must equal their source after the import
 * rewrite of port-lib.mjs.
 */

/** Copied by `node scripts/port-lib.mjs`. Never edit the copy: edit src/lib and re-run. */
export const PORTED = [
    'admin/impersonation-token.ts',
    'ai/blog-assistant.ts',
    'ai/destination.ts',
    'ai/models.ts',
    'ai/packing.ts',
    'ai/seo.ts',
    'ai/sse.ts',
    'ai/trip-summary.ts',
    'ai/untrusted.ts',
    'airports.ts',
    'auth/admin-bypass.ts',
    'auth/cron.ts',
    'auth/password.ts',
    'authz.ts',
    'blog/content-schema.ts',
    'blog/editor-config.ts',
    'blog/public-posts.ts',
    'blog/render-fixture.ts',
    'blog/render.ts',
    'boarding-pass.ts',
    'currency.ts',
    'email.ts',
    'expenses.ts',
    'html.ts',
    'instagram-cleanup.ts',
    'invites.ts',
    'json.ts',
    'log.ts',
    'media/captions.ts',
    'media/instagram-export.ts',
    'media/instagram-slides.ts',
    'media/pipeline.ts',
    'media/process.ts',
    'monitoring.ts',
    'premium/access.ts',
    'rate-limit.ts',
    'redact.ts',
    'redirect.ts',
    'reminder-emails.ts',
    'reminders.ts',
    'request-context.ts',
    'safe-fetch.ts',
    'sanitize.ts',
    'sentry.ts',
    'storage-deletion.ts',
    'storage.ts',
    'supabase/database.types.ts',
    'trip-files.ts',
    'trip-storage.ts',
    'trips.ts',
    'types/admin.ts',
    'types/api.ts',
    'types/content.ts',
    'types/enums.ts',
    'types/index.ts',
    'types/media.ts',
    'types/planning.ts',
    'types/rows.ts',
    'types/views.ts',
    'url.ts',
    'validation.ts',
    'wall-clock.ts',
    'weather.ts',
];

/** Ported modules whose test is not copied, with the reason. */
export const WITHOUT_TEST = {
    'blog/editor-config.ts': 'the test drives a Tiptap editor and needs a browser DOM: it runs in the root app',
};

/** Not ported yet: the plan that will do it. The list only shrinks. */
export const PENDING = {
};

/** Not ported on purpose: where the Hono app has its own counterpart, or why it needs none. */
export const EXCLUDED = {
    'api/params.ts': 'Next.js route wrapper: Hono uses middleware/trip-guard.ts and requireParam in lib/http.ts',
    'api/with-route.ts': 'Next.js route wrapper: Hono uses app-level middleware (app.ts) and lib/http.ts',
    'auth/auth-error-message.ts': 'browser only: belongs to apps/web',
    'auth/get-user.ts': 'cookie session: Hono authenticates the bearer token in middleware/auth.ts and has its own lib/auth/get-user.ts',
    'auth/require-admin.ts': 'imports next/server: Hono uses middleware/admin.ts',
    'csp.ts': 'page headers: belongs to the hosting layer of apps/web',
    'errors.ts': 'imports next/server: Hono has lib/errors.ts (same AppError and Errors) and lib/http.ts',
    'fetcher.ts': 'browser only: copied to apps/web (WEB_COPIES), not to the API',
    'hooks/use-profile.ts': 'React hook: belongs to apps/web',
    'media/upload-client.ts': 'browser only: belongs to apps/web',
    'supabase/client.ts': 'browser client: belongs to apps/web',
    'supabase/middleware.ts': 'Next.js middleware session refresh: no counterpart with bearer tokens',
    'supabase/public.ts': 'anon client: Hono has createAnonClient in lib/supabase/server.ts',
    'supabase/server.ts': 'cookie-based clients: Hono has its own lib/supabase/server.ts',
};

/**
 * Browser-safe files copied to apps/web/src, by their path under src/ (the
 * copy keeps the same path). They import only packages and each other.
 * A file whose source has a test lists the test too, or WEB_WITHOUT_TEST says why not.
 * Never edit the copy: edit the source and run `node scripts/port-lib.mjs`.
 */
export const WEB_COPIES = [
    'components/calendar/TripCalendar.tsx',
    'components/calendar/calendar-events.test.ts',
    'components/calendar/calendar-events.ts',
    'components/expense/ExpenseDrawer.tsx',
    'components/expense/ExpensesTab.tsx',
    'components/instagram/InstagramGenerator.test.tsx',
    'components/instagram/InstagramGenerator.tsx',
    'components/instagram/SlidePreview.tsx',
    'components/media/MediaTab.tsx',
    'components/trip/BaggageFormPanel.tsx',
    'components/trip/PackingTab.tsx',
    'components/trip/packing-cards.tsx',
    'components/trip/packing-form.test.ts',
    'components/trip/packing-form.ts',
    'components/ui/use-dialog-a11y.test.tsx',
    'components/ui/use-dialog-a11y.ts',
    'components/wallet/AddDocumentDrawer.tsx',
    'components/wallet/TravelWallet.tsx',
    'components/wallet/wallet-cards.tsx',
    'lib/auth/auth-error-message.test.ts',
    'lib/auth/auth-error-message.ts',
    'lib/auth/password.test.ts',
    'lib/auth/password.ts',
    'lib/boarding-pass.test.ts',
    'lib/boarding-pass.ts',
    'lib/fetcher.test.ts',
    'lib/fetcher.ts',
    'lib/media/instagram-slides.test.ts',
    'lib/media/instagram-slides.ts',
    'lib/media/upload-client.ts',
    'lib/redirect.test.ts',
    'lib/redirect.ts',
    'lib/trip-files.test.ts',
    'lib/trip-files.ts',
    'lib/wall-clock.ts',
    'test/axe.ts',
];

/** Tests of copied files that are not copied, with the reason. */
export const WEB_WITHOUT_TEST = {
    'lib/wall-clock.test.ts': 'sets process.env.TZ: the web app is type-checked without Node globals; it runs in the root app and in apps/api',
};
