# Nextgen D1 — Copied Components, Trip Tabs Without Files

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** The trip page of `nextgen/apps/web` has working packing, calendar and expenses tabs, and the suspended-account page exists, with the components copied from the Next.js app instead of rewritten.

**Architecture:** Sub-plan D of the roadmap is split in five, each ending with working software:

| Plan | Scope |
|---|---|
| **D1 (this plan)** | What lets a Next.js client component run unchanged in the SPA; packing, calendar, expenses; suspended page |
| D2 | Tabs with files: documents (wallet), photos and videos, Instagram generator |
| D3 | Blog tab, post editor (Tiptap 3), public blog |
| D4 | Profile, avatar, account deletion |
| D5 | Admin area |

Measured before writing: the client components still to port (about 4,000 lines) import React, icon and form packages, `@/lib/types`, `swr` with `@/lib/fetcher`, and in a few places `next/link` and `next/navigation`. They call the API with bare `fetch('/api/…')`, relying on the session cookie. So a component is ported by the tool (`WEB_COPIES`), which rewrites its imports, once the SPA provides three things: the bearer token on same-origin `/api` requests made with `fetch`, adapters for the two Next.js modules, and `swr`. The pages hand-ported in September (TanStack Query, explicit token) stay as they are.

**Tech Stack:** React, react-router, SWR, TanStack Query, Vitest + Testing Library, axe-core.

**Spec:** `2026-10-10-nextgen-realignment-roadmap.md` sub-plan D; the sources under `src/components/{trip,calendar,expense}` and `src/app/(public)/suspended`.

## Global Constraints

- Nothing under `src/`, `supabase/` or the root config changes.
- A copied component is never edited in `apps/web`: it is ported by the tool and checked by the parity test. What must differ lives in an adapter or in the page that mounts it.
- The token is attached only to requests to this origin whose path starts with `/api/`, and never replaces an `Authorization` header the caller set.
- `npm run type-check` and both suites stay green; no new `any`.
- Commit format `feat(nextgen): …` / `fix(nextgen): …`, one commit per task.

## Review Focus

- A request to another origin, or to a same-origin path outside `/api/`, must never carry the session token.
- A copied component must reach the API authenticated without knowing about tokens, including right after sign-in and after a token refresh.
- The adapters must behave like the Next.js modules for what the components use (`href`, `router.push/replace/back/refresh`, `useParams`, `useSearchParams`).
- A copy that differs from its source, or a source file with a test that is not copied, must fail a test.
- Each new tab renders its data, shows the API error instead of an empty list, and has no serious axe violation.

---

### Task 1: The session token on same-origin API requests

**Files:** Create `apps/web/src/lib/api-auth.ts`, `api-auth.test.ts`; modify `main.tsx`.

**Interfaces — Produces:** `withApiAuth(fetchImpl, getToken, origin): typeof fetch` (pure, tested) and `installApiAuth()` (wraps `window.fetch` with the Supabase session token).

### Task 2: Adapters and tool rules

**Files:** `nextgen/scripts/port-lib.mjs` (`transformWeb`), `lib-parity.test.ts`; create `apps/web/src/lib/next/link.tsx`, `navigation.ts` with tests; `swr` in `apps/web`.

**Interfaces — Produces:** in a copied file `'@/lib/types'` → `'@motonui/shared-types'`, `'next/link'` → the path of `lib/next/link`, `'next/navigation'` → the path of `lib/next/navigation`. A parity rule: a file in `WEB_COPIES` whose source has a test must list the test too, or name a reason in `WEB_WITHOUT_TEST`.

### Task 3: Packing, calendar, expenses

Copy `lib/fetcher`, `components/trip/{PackingTab,packing-cards,packing-form,BaggageFormPanel}`, `components/calendar/{TripCalendar,calendar-events}`, `components/expense/{ExpensesTab,ExpenseDrawer}` with their tests; mount the three tabs in `TripDetailPage`. Tests first: each tab renders API data, shows the API error, and passes axe; the drawer test list gains `ExpenseDrawer`.

### Task 4: Suspended page

`pages/SuspendedPage.tsx` from `src/app/(public)/suspended` (reason from the profile, sign out), on the `/suspended` route.

### Task 5: Docs

Roadmap: D split recorded, D1 done.
