# Nextgen A1 — API Foundations Implementation Plan

> **Status (2026-10-10): tasks 1–9 done** on `worktree-nextgen-migration`. Findings fixed along the way: production CORS reflected any origin with credentials; 14 of the 54 routes under `/api/trips/:id` did not refuse a signed-in non-member; cron routes compared their secret with `!==`; the Instagram export downloaded any URL stored in `media.url`.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Hono API in `nextgen/apps/api` the cross-cutting protections the Next.js API has today, applied centrally, plus a test that keeps the two route tables from drifting.

**Architecture:** First half of sub-plan A of `2026-10-10-nextgen-realignment-roadmap.md`. Everything here is app-level middleware or a ported pure module, so no route handler is rewritten: request id and structured logs, strict CORS and cross-site write rejection, a central guard for `/api/trips/:id/**`, rate limiting, cron secret, outbound host allowlist. Per-route Zod schemas and the contract test (the rest of sub-plan A) come in A2, because they touch every handler.

**Tech Stack:** Hono 4, `@hono/node-server`, Zod, Vitest (node), `@supabase/supabase-js`. Sources to port live in `src/lib/` of the same repository.

**Spec:** `docs/security/03-SECURITY-ARCHITECTURE.md` and the "Regole per le API route" section of `CLAUDE.md`; the roadmap for scope.

## Global Constraints

- Nothing under `src/`, `supabase/` or the root config changes. Only `nextgen/` and `docs/`.
- TypeScript strict in `apps/api` and `apps/web`: `npm run type-check` (in `nextgen/`) stays clean. No new `any`, no `// @ts-ignore`.
- Error responses keep the shape `{ error, code, status }`; user-facing messages in Italian.
- Logs: structured JSON through `log.*`, never trip content or emails; every response carries `x-request-id`.
- A ported module keeps the behaviour and the tests of its `src/lib` original; differences are only imports and framework glue.
- Hosting is undecided: nothing may depend on Vercel-only or long-lived-process-only features. Rate limits stay in Postgres (`check_rate_limit`), cron endpoints accept the same `Authorization: Bearer ${CRON_SECRET}` Vercel Cron sends.
- Commit format: `feat(nextgen): …` / `fix(nextgen): …`, one commit per task.

## Review Focus

- A request with `Origin: https://evil.example` and a valid session must not be able to write, and must not receive `Access-Control-Allow-Origin` for that origin.
- `/api/trips/not-a-uuid/days` must answer 400, not reach the database.
- A signed-in user who is not a member of a trip must get 403 on every route under `/api/trips/:id/**`, including ones whose handler never checked membership.
- An unexpected error must not leak its message to the client, and its log line must not contain an email or a token.
- When the rate-limit counter is unavailable the request must still go through (fail open), and over the limit the response must carry `Retry-After`.

---

### Task 1: Shared database types match `main`

`packages/shared-types/src/database.types.ts` predates 9 migrations; later tasks call the RPC `check_rate_limit`.

**Files:** Modify `nextgen/packages/shared-types/src/database.types.ts` (copy of `src/lib/supabase/database.types.ts`); fix any type error the newer types surface in `apps/api` or `apps/web`.

- [x] Copy the file. Run `npm run type-check` in `nextgen/`. Expected: clean, or errors that are real schema drift to fix one by one (a renamed or newly nullable column), never silenced with casts.
- [x] Run `npm test` in `nextgen/`. Expected: api 25, web 74 passing.
- [x] Commit.

### Task 2: Request id, structured logs, error boundary

**Files:**
- Create: `apps/api/src/lib/redact.ts`, `log.ts`, `request-context.ts` (ports) with `redact.test.ts`, `log.test.ts` (ports)
- Create: `apps/api/src/middleware/request-context.ts`, `request-context.test.ts`
- Modify: `apps/api/src/lib/errors.ts` (`AppError.headers`), `apps/api/src/lib/http.ts` (`withErrorHandler` logs through `log`, honours `error.headers`), `apps/api/src/app.ts` (`app.use('*', requestContext)`, `app.onError`, `app.notFound`)

**Interfaces — Produces:** `requestContext` middleware; `log.info|warn|error`; `AppError.headers?: Record<string, string>`.

Tests to write first (`request-context.test.ts`, against `createApp()`):
- every response, including 404 and 401, has an `x-request-id` header;
- a well-formed incoming `x-request-id` is reused, a malformed one (`"a b<script>"`) is replaced;
- a handler that throws `new Error('boom user@example.com eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl')` yields 500 with the standard body and the generic Italian message; the single `console.error` line is JSON, has the same `request_id` as the header, and contains neither the email nor the token;
- an unknown path answers 404 `{ error, code: 'NOT_FOUND', status: 404 }`.

### Task 3: CORS allowlist, cross-site write rejection, no-store

**Files:** Create `apps/api/src/middleware/origin.ts`, `origin.test.ts`; modify `apps/api/src/lib/env.ts` (`WEB_ORIGIN`, comma-separated), `apps/api/src/app.ts`.

Today production CORS reflects any origin with `credentials: true`.

Tests first:
- `OPTIONS` / `GET` with `Origin: https://evil.example` → no `Access-Control-Allow-Origin`;
- with an allowed origin → that origin echoed, `Access-Control-Allow-Credentials: true`;
- `POST|PUT|PATCH|DELETE /api/*` with a foreign `Origin` → 403 `{ code: 'FORBIDDEN' }` before any handler; without `Origin` (server-to-server, mobile) → passes; cron paths exempt;
- every `/api/*` response has `Cache-Control: private, no-store`, except `GET /api/posts/:slug` (public, cacheable).

### Task 4: Central guard for `/api/trips/:id/**`

**Files:** Create `apps/api/src/middleware/trip-guard.ts`, `apps/api/src/routes/route-authz.test.ts`; modify `apps/api/src/middleware/auth.ts` (skip when the user is already on the context), `apps/api/src/app.ts`.

`tripGuard`: `id` must be a UUID (400 `VALIDATION_ERROR`), then `requireUser` (401), then `requireTripMember` (403). Mounted on `/api/trips/:id` and `/api/trips/:id/*` before the routers.

Tests first (`route-authz.test.ts`): enumerate `createApp().routes`, keep every method+path under `/api/trips/:id`, and for each one assert 400 for a non-UUID id, 401 without a token, 403 for a signed-in non-member. The list must not be empty and must include the days routes, whose handlers never checked membership.

### Task 5: Rate limiting

**Files:** Create `apps/api/src/lib/rate-limit.ts`, `rate-limit.test.ts` (ports), `apps/api/src/middleware/rate-limit.ts`, `rate-limit.test.ts`; modify the routers for AI, public posts, Instagram, media upload, document upload, boarding pass, avatar.

**Interfaces — Consumes:** `AppError.headers` (Task 2), `check_rate_limit` types (Task 1). **Produces:** `rateLimit(bucket)` (per user, after `requireUser`) and `rateLimitByIp(bucket)`.

Tests first: over the limit → 429 `TOO_MANY_REQUESTS` with `Retry-After`; counter error → request passes and one error is logged; the key is `user:<id>:<bucket>` or `ip:<sha256 prefix>:<bucket>`, never the raw IP; a table-driven test asserts each listed route has its bucket.

### Task 6: Cron secret

**Files:** Create `apps/api/src/lib/auth/cron.ts`, `cron.test.ts` (ports); modify `apps/api/src/routes/admin/cleanup.ts`, `send-reminders.ts`, `apps/api/src/lib/env.ts` (drop `ADMIN_CLEANUP_SECRET`).

The routes compare a static header with `!==`. Replace with `isAuthorizedCronRequest` (constant time, `Authorization: Bearer ${CRON_SECRET}`, fails closed under 32 characters) and accept `GET` as well as `POST`.

Tests first: wrong, missing or short secret → 401 and the job does not run; right secret → job runs, on both methods.

### Task 7: Outbound host allowlist

**Files:** Create `apps/api/src/lib/safe-fetch.ts`, `safe-fetch.test.ts` (ports, with whatever `url.ts` helper it needs); modify `apps/api/src/lib/expenses.ts`, `weather.ts`, `media/instagram-export.ts` to call it with the hosts their `src/lib` originals allow.

Tests first: ported `safe-fetch.test.ts`; a test per caller that a URL outside its allowlist is refused without a network call.

### Task 8: Route parity test

**Files:** Create `apps/api/src/routes/route-parity.test.ts`.

Lists `src/app/api/**/route.ts` (path → `/api/...` with `[x]` → `:x`) and the exported HTTP methods of each, and compares with `createApp().routes`. Fails on any Next.js method+path missing from Hono unless it is in `KNOWN_GAPS`, and fails on a `KNOWN_GAPS` entry that is no longer a gap (so the list can only shrink). `KNOWN_GAPS` starts as the measured gap and is the to-do list of sub-plan B.

### Task 9: Record the decisions

**Files:** Modify `docs/architecture.md` (ADR-09, status "proposed": Vite SPA + Hono API replaces ADR-05 once cutover happens; until then `src/` stays the production app and its rules stay in force), `docs/superpowers/plans/2026-10-10-nextgen-realignment-roadmap.md` (A1 done, A2 next), `nextgen/README.md` if present (env vars added here).
