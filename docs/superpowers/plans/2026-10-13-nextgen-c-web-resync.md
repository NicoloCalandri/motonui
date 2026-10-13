# Nextgen C — Web Re-sync Implementation Plan

> **Status (2026-10-13): tasks 1–9 done** on `worktree-nextgen-migration`.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** The pages already ported to `nextgen/apps/web` (auth, landing, dashboard, trips list, new trip, trip detail with overview, itinerary and bookings) behave like their current Next.js sources and call only routes the Hono API serves.

**Architecture:** The Next.js components changed too much since the port to be diffed file by file (77 files, +3,828 / −3,027, mostly splits the web app already did its own way). So this plan carries over behaviour, not files: each task takes one behaviour that changed, pins it with a test, and applies it to every ported page that has it. Browser-safe helpers come from `src/` through the port tool, with the same parity check the API uses.

**Tech Stack:** React 18, react-router, TanStack Query, Vitest + Testing Library, axe-core.

**Spec:** `2026-10-10-nextgen-realignment-roadmap.md` §1.4 and sub-plan C; `docs/brand-voice.md`; the current sources under `src/app` and `src/components`.

## Global Constraints

- Nothing under `src/`, `supabase/` or the root config changes.
- A helper copied from `src/` is never edited in `apps/web`: it is ported by the tool and checked by the parity test.
- UI copy is Italian and follows `docs/brand-voice.md`; errors of Supabase Auth are never shown raw.
- No storage URL of a trip file reaches the page: private files are read through the API with the session token.
- `npm run type-check` and both suites stay green; no new `any`.
- Commit format `feat(nextgen): …` / `fix(nextgen): …`, one commit per task.

## Review Focus

- A web call to a route, or with a method, that the API does not serve: it must fail a test, not a user.
- A time typed by the user (a 14:30 departure) must be shown as typed, whatever the browser time zone.
- A raw Supabase Auth error (English, or carrying an email) must never reach the screen.
- A drawer must trap focus, close on Escape and give the focus back; no serious axe violation on the ported pages.
- A boarding pass must be readable only through the API with the caller's token, and its object URL must be released.

---

### Task 1: The web app calls only routes that exist

**Files:** Create `nextgen/apps/api/src/routes/web-client-contract.test.ts`; fix the callers it finds.

**Interfaces — Produces:** a test that reads every `apiFetch(...)`/`fetch(...)` call in `apps/web/src` (non-test files), normalises the path (`${…}` → `:param`) and the method (default `GET`), and checks the pair against `createApp().routes`.

Known to fail first: `POST /api/trips/invite` in `NewTripPage` (the route is `POST /api/trips/:id/invites`, body `{ email }`).

### Task 2: Browser-safe helpers come from `src/`

**Files:** `nextgen/scripts/port-manifest.mjs` (`WEB_PORTED`, `WEB_COPIES`), `nextgen/scripts/port-lib.mjs` (web target), `nextgen/apps/api/src/lib/lib-parity.test.ts`; generated files under `nextgen/apps/web/src/lib` and `src/components/ui`.

**Interfaces — Produces:** in `apps/web/src`: `lib/wall-clock.ts`, `lib/auth/auth-error-message.ts`, `lib/auth/password.ts`, `lib/boarding-pass.ts`, `lib/trip-files.ts`, `components/ui/use-dialog-a11y.ts`, `test/axe.ts`, each with its test when the source has one.

### Task 3: Times are shown as typed

Every time of day rendered by the ported pages (`ItineraryLegCard`, `BookingCards`, `BoardingPassViewer`) goes through `wallClockTime` / `wallClockDay` / `wallClockDayTime`. Test first: with `TZ` far from UTC, a leg stored as `2026-11-01T14:30:00+00:00` shows `14:30`.

### Task 4: Auth pages

`LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage`: errors through `authErrorMessage`, password policy from `lib/auth/password`, copy from the current sources. Tests first: an English Supabase error is shown as its Italian message; a weak new password is refused before the request.

### Task 5: Brand-voice copy

Landing, dashboard, trips list, new trip, trip detail, app shell, drawers: the copy of the current sources (PR #150). Test first: no ported page renders `Motonui` capitalised or a generic `Errore` message where the source has an `Ops! … 🏝️` one.

### Task 6: Drawers are accessible dialogs

`DayDrawer`, `LegDrawer`, `AccommodationDrawer`, `RestaurantDrawer`, `ActivityDrawer`, `BoardingPassViewer`: `role="dialog"`, `aria-modal`, `aria-labelledby`, `useDialogA11y`; labels bound to their controls. Tests first: Escape closes, focus returns, `seriousA11yViolations` is empty for each drawer and for the ported pages.

### Task 7: Boarding pass through the API

`BoardingPassField`, `BoardingPassViewer`, `ItineraryLegCard`, `useLegDrawerForm`: presence from `hasBoardingPass(leg)`, file fetched from `GET …/boarding-pass` with the session token and shown from an object URL that is revoked on close; upload reads `boarding_pass_path`. Tests first.

### Task 8: Invite the partner

`InvitePartnerCard` on the trip overview (list, invite, copy link, revoke) and the `/invite/:token` page that accepts an invite, ported from `src/components/trip/InvitePartnerCard.tsx` and `src/app/(app)/invite/[token]`. `NewTripPage` invites through the same route.

### Task 9: Docs

Roadmap: C done, with what was found.
