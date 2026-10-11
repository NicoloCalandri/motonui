# Nextgen B1 — Shared Code Parity Implementation Plan

> **Status (2026-10-11): tasks 1–7 done** on `worktree-nextgen-migration`.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the domain code of the Hono API (`nextgen/apps/api/src/lib`) and the shared types a mechanical, checked copy of `src/lib`, so the two apps cannot drift again and the remaining route work (B2–B4) builds on current behaviour.

**Architecture:** Sub-plan B of the roadmap is split in four, each ending with working software:

| Plan | Scope | Unblocks |
|---|---|---|
| **B1 (this plan)** | Port tool, parity test, shared types, every library module that has no route still to be written | everything below |
| B2 | Private storage: paths, signed URLs, upload pipeline (`media/uploads`, `media/confirm`), document proxy, boarding pass download, deletion queue | 5 of the 13 known gaps |
| B3 | Partner invites and account deletion | 5 known gaps |
| B4 | Asynchronous Instagram export and cleanup, `admin/sentry-test` | 4 known gaps; needs the hosting decision |

Measured before writing: of the 61 non-test modules in `src/lib`, only four depend on Next.js (`errors.ts`, `supabase/server.ts`, `auth/require-admin.ts`, `monitoring.ts`/`sentry.ts`); the rest import npm packages and each other. So a library module is ported by a script that rewrites three kinds of import, and a test compares every ported module with its source on each run. Modules whose routes belong to B2–B4 are listed as pending in the same manifest, and that list can only shrink.

**Tech Stack:** Node script (ESM), Vitest, TypeScript; npm workspaces in `nextgen/`.

**Spec:** `2026-10-10-nextgen-realignment-roadmap.md` §1.2–1.3; the modules and tests in `src/lib` are the reference behaviour.

## Global Constraints

- Nothing under `src/`, `supabase/` or the root config changes.
- A ported module is byte-identical to its source after the import rewrite. Behaviour that must differ in Hono lives in a module of its own, never in an edited copy.
- Ported tests come with their module; a module without a test in `src/lib` is ported without one.
- `npm run type-check` in `nextgen/` stays clean; no new `any`, no `// @ts-ignore`. Existing `as any` casts in route files are removed only where a task touches the line.
- `apps/api` and `apps/web` test suites stay green after every task.
- Commit format `feat(nextgen): …` / `fix(nextgen): …`, one commit per task.

## Review Focus

- A module edited in `src/lib` after this plan: the parity test must fail until it is re-ported, and the message must say which file and how to fix it.
- A new module added to `src/lib`: the parity test must fail until it is classified (ported, pending, or excluded with a reason).
- An expense in a currency without a rate must keep `amount_eur` null in Hono too, never the unconverted amount.
- An AI call must consume exactly one unit of quota, through the RPC, and none when the request is refused before it.
- User text reaching a prompt must sit inside the untrusted block in Hono as in Next.js.

---

### Task 1: Dependencies of `apps/api` match the root app

**Files:** `nextgen/apps/api/package.json`, `nextgen/package-lock.json`.

`@anthropic-ai/sdk` is at `^0.27.0` (root `^0.131.0`), `@supabase/supabase-js` at `^2.45.0` (root `^2.117.2`), Tiptap is absent or at 2.x, Vitest is 4 (root 5). Align every package both apps use to the root's range; add `@tiptap/core`, `@tiptap/pm`, `@tiptap/html`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/extension-link`, `happy-dom`.

- [x] Update, `npm install` in `nextgen/`, type-check, both suites. Fix what the newer versions break.

### Task 2: Port tool and parity test

**Files:** Create `nextgen/scripts/port-lib.mjs`, `nextgen/scripts/port-manifest.mjs`, `nextgen/apps/api/src/lib/lib-parity.test.ts`.

**Interfaces — Produces:**
- `transform(source: string, fromFile: string): string` — rewrites `'@/lib/types'` and any path ending in `supabase/database.types` to `'@motonui/shared-types'`, `'@/lib/<x>'` to a relative path, `'@/test/<x>'` to the relative path of `apps/api/src/test/<x>`; applies to `import`/`export … from`, `import()`, `vi.mock()` and `vi.importActual()`.
- `PORTED: string[]`, `PENDING: Record<string, 'B2' | 'B3' | 'B4'>`, `EXCLUDED: Record<string, string>` (path → reason), all relative to `src/lib`.
- CLI: `node scripts/port-lib.mjs` rewrites every `PORTED` module (and its `.test.ts`, when the source has one) into `apps/api/src/lib`; `--check` only reports differences.

Tests first (`lib-parity.test.ts`):
- every non-test file under `src/lib` is in exactly one of the three lists;
- every `PORTED` module, and its test, equals `transform(source)`; the failure names the file and says `run: node scripts/port-lib.mjs`;
- `transform` unit cases for each rewrite, including a relative `../supabase/database.types` and a `vi.mock('@/lib/x', …)`.

Start with `PORTED` = the modules already ported by hand in A1 (`redact`, `log`, `request-context`, `rate-limit`, `safe-fetch`, `auth/cron`, `html`, `email`), and make them pass by running the tool. Port `src/test/supabase-mock.ts` and `mock-response.ts` to `apps/api/src/test/`.

### Task 3: Shared types from `src/lib/types`

**Files:** `nextgen/packages/shared-types/src/types/*` (ported), `index.ts`; remove `domain.ts`; fix `apps/api` and `apps/web` where types changed.

The manifest gets a second target for `types/*`. Type errors surfaced in `apps/web` are fixed in the component that has them, by using the current type, never by widening it.

### Task 4: Modules with no caller changes

Add to `PORTED` and run the tool: `wall-clock`, `json`, `url`, `redirect`, `airports`, `validation`, `auth/password`, `auth/admin-bypass`, `ai/models`, `ai/untrusted`, `ai/sse`, `sanitize`, `blog/content-schema`, `blog/render`, `blog/render-fixture`, `blog/public-posts`, `admin/impersonation-token`, `weather`, `media/process`, `media/captions`, `authz`, `currency`, `reminder-emails`.

- [x] One commit per group that type-checks; a module that turns out to need caller changes moves to Task 5 or 6.

### Task 5: Expenses, quota and AI

Add `expenses`, `premium/access`, `ai/blog-assistant`, `ai/destination`, `ai/packing`, `ai/seo`, `ai/trip-summary`, `trips` to `PORTED`; update the callers in `routes/` to the current signatures.

- The old per-model limiter (`checkRateLimit`, `ai_usage`) disappears with `ai/blog-assistant`: every AI route consumes quota only through `requireFeatureAccess` → `consume_feature_quota`.
- Tests first for the callers, in `routes/ai.test.ts` and `routes/expenses.test.ts`: a refused request consumes no quota; one accepted AI call makes exactly one `consume_feature_quota` call; an expense in a currency with no rate is saved with `amount_eur: null`.

### Task 6: Reminders

Add `reminders` to `PORTED`; rewrite `lib/cron/send-reminders.ts` on top of `reminder-emails.ts` (`loadReminderEntities`, `buildReminderEmail`), dropping the embed query on the polymorphic `entity_id` and the old subjects.

Test first (`lib/cron/send-reminders.test.ts`): a due payment reminder sends the deadline of the accommodation, not `remind_at`; a reminder whose entity is gone is skipped; sent reminders are marked.

### Task 7: Docs

Roadmap: B split recorded, B1 done. `PENDING` in the manifest is the to-do list for B2–B4.
