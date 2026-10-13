# Nextgen Migration — Realignment Roadmap

> **Status:** proposal, written 2026-10-10 after the migration was resumed. It replaces the task order of `2026-09-21-nextjs-to-nextgen-migration.md` from Task 4.9.3 onward. It is a roadmap, not an executable plan: each sub-plan below gets its own plan file (superpowers:writing-plans) before it is executed.

**Goal:** Bring `nextgen/` (Vite SPA + Hono API) back to parity with the Next.js app as it is on `main` today, then finish the port and cut production over.

**Why the original plan cannot simply continue:** its premise was "port verbatim from `src/`; the API is done". The API in `nextgen/apps/api` is a copy of `src/` as of commit `e713e22` (2026-09-17). Since then `main` changed 328 files under `src/` and `supabase/` (+18,660 / −6,584 lines): 74 API route files, 125 files in `src/lib`, 9 new migrations. Porting more pages on top of the old API would build on behaviour that no longer exists.

**State of the branch (`worktree-nextgen-migration`):** `main` merged in on 2026-10-10 (`ef9162d`); `apps/api` 25/25 tests and `apps/web` 74/74 tests pass, both type-check clean. Tasks 4.1–4.9.2 are done and reviewed; Task 4.9.3 (Bookings tab) is committed (`4bbf8d3`, `f1f5b16`) but was never reviewed.

---

## 1. Measured gap

### 1.1 API routes that exist in Next.js and not in Hono

| Next.js route | What it does |
|---|---|
| `invites/accept`, `trips/[id]/invites`, `trips/[id]/invites/[inviteId]` | Partner invite (token hash, RPC `accept_trip_invite`, migration `0021`) |
| `trips/[id]/media/uploads`, `trips/[id]/media/confirm` | Upload pipeline: signed upload URL → direct upload → confirm (`src/lib/media/pipeline.ts`) |
| `trips/[id]/documents/[documentId]/file` | Authenticated proxy for private documents |
| `trips/[id]/instagram/exports`, `…/exports/[exportId]` | Asynchronous Instagram export (202 + polling); Hono still has the old synchronous `/api/instagram` |
| `account/delete` | Self-service account deletion with storage deletion queue |
| `admin/sentry-test` | Monitoring check |

To verify one by one in sub-plan B: `boarding-pass`, `admin/users/[id]/suspend|unsuspend|impersonate`, `admin/trips/[id]` (mounted under routers whose inner paths were not compared).

### 1.2 Cross-cutting modules missing from `nextgen/apps/api/src/lib`

| Area | Modules in `src/lib` | Requirement it carries |
|---|---|---|
| Route wrapper | `api/with-route.ts`, `api/params.ts` | Auth, `tripMember`, Zod on params/query/body, `Cache-Control: private, no-store` |
| Abuse limits | `rate-limit.ts` | 429 + `Retry-After` on uploads, exports, AI, public routes |
| Outbound calls | `safe-fetch.ts`, `url.ts`, `redirect.ts` | Host allowlist, safe redirects |
| Observability | `log.ts`, `redact.ts`, `request-context.ts`, `monitoring.ts`, `sentry.ts` | Structured logs with `request_id`, no trip content or emails in logs |
| Cron and admin | `auth/cron.ts`, `auth/admin-bypass.ts`, `auth/require-admin.ts`, `admin/impersonation-token.ts` | Cron secret, bypass refused in production |
| Storage | `trip-files.ts`, `trip-storage.ts`, `storage-deletion.ts`, `instagram-cleanup.ts` | Private buckets, server-built paths, signed URLs, deletion queue |
| AI | `ai/untrusted.ts`, `ai/models.ts`, `ai/seo.ts`, `ai/sse.ts` | Untrusted-data blocks in prompts, model ids in one place, quota via RPC |
| Domain | `invites.ts`, `currency.ts`, `reminder-emails.ts`, `wall-clock.ts`, `json.ts`, `validation.ts`, `auth/password.ts`, `blog/content-schema.ts`, `blog/render.ts`, `blog/public-posts.ts` | Invites, `amount_eur` null without a rate, reminder emails, typed-time formatting, post sanitizing |

Browser-only modules (`csp.ts`, `supabase/middleware.ts`, `fetcher.ts`, `hooks/*`, `media/upload-client.ts`, `supabase/client.ts`, `blog/editor-config.ts`, `auth/auth-error-message.ts`) belong to `apps/web` or to the hosting layer, not to the API.

### 1.3 Shared modules that drifted (lines changed in `src/lib` since the port)

`expenses.ts` 273 · `premium/access.ts` 218 · `media/instagram-export.ts` 177 · `email.ts` 135 (already re-ported in PR #150) · `trips.ts` 118 · `ai/blog-assistant.ts` 107 · `storage.ts` 80 · `ai/packing.ts` 60 · `errors.ts` 54 · `ai/trip-summary.ts` 48 · `sanitize.ts` 35 · `ai/destination.ts` 35 · `html.ts` 24 · `weather.ts` 23 · `media/process.ts` 22 · `reminders.ts` 21 · `media/captions.ts` 15 · `supabase/server.ts` 12 · `auth/get-user.ts` 11 · `authz.ts` 6

### 1.4 Web pages already ported from sources that have since changed

40 page and component files are ported (auth, landing, dashboard, trips list, new trip, trip detail shell, overview, itinerary, bookings). Their Next.js sources changed after the port: `src/components` 57 files (+3,708 / −2,436), pages 30 files (+533 / −567). Known behaviour changes to carry over: brand-voice copy, Italian auth errors, typed-time formatting (`wall-clock.ts`), dialog accessibility (`useDialogA11y`, axe checks), invites UI, signed media URLs.

### 1.5 Conflict with the documented architecture

`docs/architecture.md` (target architecture, ADR-05) and `CLAUDE.md` describe Next.js with Server Components and SWR. This migration replaces that with a Vite SPA and TanStack Query. Resuming the migration means a new ADR that supersedes ADR-05, and `CLAUDE.md` rules that name Next.js mechanisms (`withRoute`, `src/middleware.ts`, CSP nonce, `after()`) need Hono equivalents written down.

---

## 2. Sub-plans, in order

Each one ends with working, tested software on the branch. None touches `src/`, `supabase/` or production until E.

### A. API foundations (cross-cutting parity)

> **A1 done (2026-10-10)**, plan `2026-10-10-nextgen-a1-api-foundations.md`: request id and structured logs, CORS allowlist and cross-site write rejection, central trip guard, rate limits, cron secret, outbound host allowlist, route-parity test (13 known gaps, 5 known extras). 
>
> **A2 done (2026-10-10)**, plan `2026-10-10-nextgen-a2-input-contract.md`: UUID check on every path id, standard 400 for malformed and non-object bodies, no database message in error responses, membership checks on the trip routes outside `/api/trips/:id`, and a contract test read from the route table. Measured scope was much smaller than estimated here: 40 of 42 write routes already validated with Zod. **Sub-plan B is next.**

Port the route wrapper and the security plumbing to Hono, then put every existing Hono route behind them.

- Hono equivalents of `withRoute` (auth, `tripMember`, Zod, `no-store`), request id + structured log + redaction, error capture, rate limiting, `safeFetch`, cron secret, cross-site write rejection, admin bypass guard.
- A route-parity test: lists `src/app/api/**/route.ts` and the Hono route table and fails on any route missing from Hono that is not in an explicit, shrinking allowlist. It keeps the two APIs from drifting again while the migration runs.
- Ports of `route-authz.test.ts` and `route-contract.test.ts` for the Hono routers.

**Done when:** every Hono route goes through the wrapper; the authz and contract tests pass for all routers; the parity test passes with only the section 1.1 routes in the allowlist.

### B. API feature parity

> **Split into B1–B4 (2026-10-10).** **B1 done**, plan `2026-10-10-nextgen-b1-shared-code-parity.md`: library modules are now copied from `src/lib` by `nextgen/scripts/port-lib.mjs` and compared with their source on every test run (`lib-parity.test.ts`); 50 modules and the shared types are ported, 11 are pending with their plan in `nextgen/scripts/port-manifest.mjs` (B2 storage and uploads: 6, B3 invites and impersonation tokens: 2, B4 Instagram export: 3), 16 are excluded with a reason. After a change in `src/lib`: `npm run port:lib` in `nextgen/`.
>
> **Finding to plan for:** the route handlers themselves are hand copies of the September handlers, and library parity does not cover them. The three AI handlers were re-ported in B1 (one summed unconverted expense amounts); the others still need a route-by-route comparison with `src/app/api`. This is a fifth piece of B, to size before B2.
>
> **Handler comparison done (2026-10-13).** `nextgen/scripts/handler-drift.mjs` compares, resource by resource, what the Next.js and the Hono handlers mention (tables, RPCs, schema fields with their rules, library functions, user-facing messages); `routes/handler-drift.test.ts` runs it on every test run and fails on a difference that is not listed with its reason. It found and fixed: trips created with the service role instead of `create_trip()`, post content not sanitized on update (the defect fixed in the Next.js app by PR #152), admin-created users accepted with a 6-character password, AI calls counted from the retired `ai_usage` table. It is evidence, not proof: two handlers can mention the same things and use them differently.
>
> **B2 done (2026-10-12)**, plan `2026-10-12-nextgen-b2-private-storage.md`: private buckets, signed upload and confirm, signed URLs, authenticated proxy for documents and boarding passes, files removed with their row, storage deletion queue.
>
> **B3 done (2026-10-12)**, plan `2026-10-12-nextgen-b3-invites-account.md`: partner invites, account deletion, impersonation tokens stored hashed and revocable, admin deletion through `purge_user_data`. Found on the way: the Hono API stored the impersonation JWT itself and honoured `ADMIN_AUTH_BYPASS` in production.
>
> **B4 done (2026-10-13)**, plan `2026-10-12-nextgen-b4-async-export-monitoring.md`: Instagram export as a job (202 + polling), Sentry through `@sentry/node`. It assumes a long-running Node process, like the in-process scheduler; `lib/background.ts` is the one file to change otherwise.
>
> **Sub-plan B is complete:** every route of the Next.js API has a Hono counterpart (`KNOWN_GAPS` is empty), every module of `src/lib` is ported or excluded with a reason (`PENDING` is empty). `apps/web` still calls the routes that were replaced (upload in the request body, synchronous export, `boarding_pass_url`): that is sub-plan C.

Port what section 1.1–1.3 lists, in dependency order: storage (private buckets, paths, signed URLs, deletion queue) → upload pipeline → documents proxy → invites → account deletion → Instagram async export → AI (untrusted blocks, quota RPC, models) → expenses and currency → reminders cron (`reminder-emails.ts`, real deadlines) → post sanitizing.

**Done when:** the parity allowlist is empty; every drifted module in 1.3 is re-ported with its tests; `apps/api` test count covers the same cases as the `src/` tests for those modules.

### C. Web re-sync (pages already ported)

Review Task 4.9.3 (pending), then re-port the changed behaviour into the 40 existing web files: copy, auth errors, time formatting, accessibility helpers and axe checks, invite UI on the trip page, signed media URLs.

**Done when:** each ported page matches its current Next.js source for copy and behaviour, and its tests include the axe check the source has.

> **C done (2026-10-13)**, plan `2026-10-13-nextgen-c-web-resync.md`. The Next.js components changed too much to be diffed file by file, so the plan carried over behaviour: typed times through `wall-clock`, Italian auth errors and the password policy, brand-voice copy, drawers as accessible dialogs with axe checks, boarding passes read through the API, the partner invite card and the `/invite/:token` page. Browser-safe helpers are copied from `src/` by the port tool (`WEB_COPIES`) and checked like the API copies. `routes/web-client-contract.test.ts` checks every `/api` path and method written in `apps/web` against the route table.
>
> **Found in the web app:** a call to a route that never existed (`POST /api/trips/invite`); the password reset could not work (the email pointed to a server callback the SPA does not have, and the reset page bounced signed-in users); Google sign-in pointed to the same missing callback; the trip page read `members` while the API returns `trip_members`.
>
> **Found in the Next.js app:** the trip page read `trip.members`, which `GET /api/trips/[id]` never returned (fixed on `main` by PR #156). Still there, and fixed only in `apps/web`: editing a leg or an accommodation from the bookings tab calls `…/days/undefined/…` and gets a 404; a restaurant or activity saved without a time, or an accommodation without a deadline, sends `''` and is refused; calendar dates are read with `new Date('YYYY-MM-DD')` and show the day before in a browser west of UTC.
>
> **Final review (2026-10-13):** no critical finding. Fixed after it, each with a test that failed first: the three defects above in `apps/web`, a stricter route contract test (a call whose options name no method is a GET), and the old public `boarding_pass_url` is no longer rendered. The contract test still does not check request bodies or URLs held in variables.
>
> **Open for sub-plan D:** private files are fetched with the bearer token and shown from an object URL (`lib/use-private-file.ts`), because an `<img>` cannot send the token; the same choice has to be made for trip photos and documents. Google sign-in and password reset need one manual test against a real Supabase project.

### D. Remaining web port

The old plan's Tasks 4.9.4–4.14 (wallet, calendar, packing, expenses, media, blog tab, post editor on Tiptap 3, public blog, suspended, profile, admin), re-read against today's sources.

**Done when:** every route of the Next.js app has a working page in `apps/web`.

> **Split into D1–D5 (2026-10-14).** D1 base and trip tabs without files, D2 tabs with files (wallet, media, Instagram), D3 blog, D4 profile, D5 admin.
>
> **D1 done (2026-10-14)**, plan `2026-10-14-nextgen-d1-copied-components.md`. The components still to port import little more than React, the domain types, SWR and two Next.js modules, so they are copied by the port tool (`WEB_COPIES`) and checked against their source, instead of rewritten: the SPA adds the session token to same-origin `/api` requests made with plain `fetch` (`lib/api-auth.ts`), and `lib/next/{link,navigation}` stand in for the Next.js modules. Packing, calendar and expenses are mounted; the suspended page exists.
>
> **Found in the web app:** the profile was read from `GET /api/profile`, which returns neither role nor suspension (and other field names): the user name, the avatar, the admin guard and the suspended guard never worked. `GET /api/session` (Hono only) now answers what the Next.js app reads on the server.
>
> **Inherited by the copies, to fix in `src/` and re-port:** calendar dates read with `new Date('YYYY-MM-DD')` in `TripCalendar`, `calendar-events` and `packing-cards`; icon buttons without a name in `ExpensesTab`; the three tabs ignore a failed load. They are listed in `web-client-contract.test.ts` and `trip-tabs.test.tsx`.

### E. Validation, deployment, cutover

The old plan's Phases 5 and 6: full verification, mobile impact, deployment configuration, environment parity, CI for `nextgen/`, cutover, decommission, documentation (`CLAUDE.md`, `docs/architecture.md`, security docs).

**Done when:** production runs on `nextgen/` and the Next.js app is removed.

---

## 3. Decisions needed from the owner

| # | Decision | Blocks | Options |
|---|---|---|---|
| 1 | Supersede ADR-05 (Next.js + Server Components + SWR) with a Vite SPA + Hono + TanStack Query target | Everything; record before A | Yes, write the ADR / No, stop the migration |
| 2 | Hosting for `apps/api` | E (and how A implements rate limiting and cron) | Vercel functions / separate Node host / Edge (excluded by `sharp`) |
| 3 | Public blog SEO | D (Task 4.11) | Accept client rendering / build static generation (`apps/blog-ssg`) before cutover |
| 4 | Repository layout after cutover | E | Move `nextgen/*` to the root / keep the prefix |
| 5 | Feature freeze on `src/` during the migration | A–D | Freeze new features in `src/` / keep developing and re-port continuously (the parity test in A makes drift visible, not free) |

## 4. Size

A and B together re-do most of what the original Phases 1–3 covered, against a larger and stricter API. C touches 40 files, D ports the 11 remaining page groups. This is several weeks of work in total, not one execution session; A is the next concrete step and can start as soon as decisions 1 and 2 are made.
