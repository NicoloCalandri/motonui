# Nextgen B3 — Invites, Account Deletion, Impersonation Tokens

> **Status (2026-10-12): done** on `worktree-nextgen-migration`.

**Goal:** The Hono API lets the owner invite the partner, lets a user delete their account, and handles admin impersonation and user deletion the way the Next.js API does today.

**Architecture:** `invites.ts` and `admin/impersonation-token.ts` are copied from `src/lib` by the port tool. Three routers are added (`trips-invites`, `invites`, `account`); the impersonation middleware and the two admin handlers move to the shared token module.

**Spec:** `2026-10-10-nextgen-realignment-roadmap.md` §1.2; migrations `0021` (invites) and `0022` (account deletion); `src/app/api/{trips/[id]/invites,invites/accept,account/delete,admin/users/[id],admin/impersonate}`.

## Global Constraints

Same as B1.

## Review Focus

- The invite token must never be stored or logged: only its hash reaches the database, the token leaves only in the link.
- An impersonation token revoked on exit must stop working, and the database must hold only the hash of its id.
- A user deleted by an admin must go through `purge_user_data` first, or a shared trip disappears for the partner.
- `ADMIN_AUTH_BYPASS` must have no effect in production.
- A database refusal (`TRIP_FULL`, `INVITE_INVALID`…) must reach the caller as its own error, any other database message must not.

## Tasks

- [x] **1. Modules.** `invites` and `admin/impersonation-token` moved to `PORTED`; `PENDING` holds only B4.
- [x] **2. Invites.** `GET`/`POST /api/trips/:id/invites`, `DELETE …/invites/:inviteId`, `POST /api/invites/accept`.
- [x] **3. Account deletion.** `POST /api/account/delete` (`delete_my_account`, then the file queue). No server-side sign-out: with bearer tokens there is no cookie to clear, the web app drops its session.
- [x] **4. Impersonation.** Token created by `createImpersonationToken` and stored as `SHA-256(jti)`; the middleware pins HS256, checks the token type and refuses a revoked token; exit deletes by hash.
- [x] **5. Admin user deletion.** `purge_user_data` before `auth.admin.deleteUser`, then the file queue.
- [x] **6. Admin bypass.** `middleware/admin.ts` uses `isAdminAuthBypassEnabled()`; `lib/env.ts` refuses to start in production with the variable set.

Tests: `routes/invites-account.test.ts` (30), `routes/admin/admin-security.test.ts` (8), `middleware/impersonation.test.ts` (two cases added), plus the ported module tests. `KNOWN_GAPS` 9 → 4.

## Found, not part of the Next.js behaviour

Before this plan the Hono API stored the impersonation JWT itself in `impersonation_tokens.token`, never checked revocation, and honoured `ADMIN_AUTH_BYPASS=true` in production.

## Left for later plans

- `impersonatedUserId` is set on the request but no handler reads it: the web app decides what an impersonating admin sees (sub-plan C).
- `apps/web` has no invite, accept or delete-account screens yet: sub-plan C.
