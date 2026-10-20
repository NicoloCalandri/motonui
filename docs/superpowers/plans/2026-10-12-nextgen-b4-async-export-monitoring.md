# Nextgen B4 — Asynchronous Instagram Export, Monitoring

> **Status (2026-10-13): done** on `worktree-nextgen-migration`.

**Goal:** The Hono API builds Instagram exports as a job (202, then polling) and reports unexpected errors to Sentry, like the Next.js API.

**Architecture:** The last five library modules are copied from `src/lib` (`instagram-cleanup`, `media/instagram-export`, `media/instagram-slides`, `monitoring`, `sentry`); the port tool swaps `@sentry/nextjs` for `@sentry/node`, whose API is the same for what those modules use. Work after the response runs through `lib/background.ts`.

**Spec:** `2026-10-10-nextgen-realignment-roadmap.md` §1.2; CLAUDE.md "Export Instagram"; `src/app/api/trips/[id]/instagram/exports/**`, `src/app/api/admin/sentry-test`, `src/lib/monitoring.ts`.

## Global Constraints

Same as B1.

## Hosting assumption

`runInBackground` assumes a long-running Node process, the same assumption the in-process scheduler (`src/scheduler.ts`) already makes. If the API is deployed on a platform that freezes the process after the response, `lib/background.ts` is the one file to rewrite (on that platform's `waitUntil`), and a job cut short is already reported as failed after five minutes.

## Review Focus

- The response must not wait for the ZIP; a failed job must end as `failed`, never stay `processing` with an unhandled rejection.
- A stored `zip_path` that is not the path of this trip and export must never be signed.
- A signed link must not outlive the ZIP, and never exceed 24 hours.
- Text and colours that end up in an SVG must be validated before the job is created.
- An expected error (`AppError`) must not be reported to Sentry; an unexpected one must carry the route and the request id, and no personal data.

## Tasks

- [x] **1. Port tool.** `@sentry/nextjs` → `@sentry/node` rewrite, with its unit test; `@sentry/node` added to `apps/api`.
- [x] **2. Modules.** The five modules moved to `PORTED`; `PENDING` is empty.
- [x] **3. Background work.** `lib/background.ts`: `runInBackground(name, task)`, `backgroundIdle()`.
- [x] **4. Export routes.** `GET`/`POST /api/trips/:id/instagram/exports`, `GET …/exports/:exportId`; the export limit moved to the new route; `POST /api/instagram/generate` and `lib/media/storage-url.ts` removed (photos are read from storage by path).
- [x] **5. Cleanup cron.** ZIP objects of expired exports removed before their rows.
- [x] **6. Monitoring.** Unexpected errors go through `captureError` (wrapped handlers, `app.onError`, cron jobs, background tasks); `lib/instrument.ts` starts Sentry when `SENTRY_DSN` is set; `GET /api/admin/sentry-test`.

Tests: `lib/background.test.ts` (4), `routes/trips-instagram.test.ts` (25), `middleware/error-reporting.test.ts` (6), `lib/cron/cleanup.test.ts` (one case added), plus the ported module tests. `KNOWN_GAPS` 4 → 0, `KNOWN_EXTRAS` 4 → 3 (health probe, `POST` on the two cron routes).

## Left for later plans

- `apps/web` still calls the removed synchronous export: sub-plan C.
- Source maps and release tagging for Sentry: sub-plan D, with the deploy.
