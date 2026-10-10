# Nextgen A2 — Input Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every route of the Hono API rejects bad input with a standard 400 before touching the database, and a contract test read from the app's own route table proves it.

**Architecture:** Second half of sub-plan A of `2026-10-10-nextgen-realignment-roadmap.md`. Measured before writing: of 42 write routes, 36 read JSON and 40 call `safeParse`, so validation mostly exists; what is missing is uniformity (9 handlers answer with a hand-made body, JSON parse errors are not handled the same way everywhere) and proof. The contract test enumerates `createApp().routes`, like `route-authz.test.ts`, and drives the fixes: only handlers that fail it are touched. Path parameters are validated centrally, like the trip guard.

**Tech Stack:** Hono 4, Zod, Vitest (node).

**Spec:** "Regole per le API route" in `CLAUDE.md` (Zod on every input, standard error shape); `src/app/api/trips/route-contract.test.ts` as the reference contract.

## Global Constraints

- Only `nextgen/apps/api/src/**` and `docs/` change.
- `npm run type-check` in `nextgen/` stays clean; no new `any`, no `// @ts-ignore`.
- Error responses: `{ error, code, status }`, Italian message, never a database or provider message.
- A handler is edited only when a test fails for it; no drive-by refactors.
- Commit format `fix(nextgen): …` / `test(nextgen): …`, one commit per task.

## Review Focus

- A body that is valid JSON but not an object (`[]`, `"x"`, `null`, `42`) must give 400 on every write route, never 500 and never a write.
- Malformed JSON, and an empty body on a route that needs one, must give 400.
- A non-UUID nested id (`/api/trips/<uuid>/days/abc`) must give 400 without a query.
- No 4xx or 5xx body may contain a database error message.
- A signed-in user must not act on a trip they do not belong to through routes outside `/api/trips/:id` that take a trip id (`/api/expenses/:id`, `/api/ai/generate-post`).

---

### Task 1: Path parameters are UUIDs

**Files:** Create `middleware/params.ts`; modify `app.ts`; create `routes/route-contract.test.ts` (first section).

`uuidParams`: on `/api/*`, every path parameter named `id` or ending in `Id` must be a UUID, else 400 `VALIDATION_ERROR`. `slug` and other names are left to their handlers.

Test first: for every route in `createApp().routes` with at least one such parameter, replacing each one in turn with `abc` gives 400 with the standard body and no table is queried.

### Task 2: Bodies

**Files:** Modify `lib/http.ts` (`readJsonObject(c)`), the handlers the test flags; extend `routes/route-contract.test.ts`.

Test first, for every `POST|PUT|PATCH` route, as a signed-in member: malformed JSON, `[]`, `"x"`, `null` and `42` each give 400 with the standard body, and no `insert`/`update`/`upsert`/`delete`/`rpc` is called. Multipart routes are included: JSON sent to them must also give 400.

Fix: `readJsonObject(c)` returns the parsed body or throws `Errors.validation` when the body is not JSON or not a plain object; flagged handlers call it instead of `c.req.json()`.

### Task 3: One error shape, no leaked messages

**Files:** Modify the handlers that `return c.json(...)` their own error body (9 after `safeParse`, `routes/ai.ts`, `routes/admin/trips.ts`, `routes/admin/users.ts`); extend `routes/route-contract.test.ts`.

Test first: every 4xx/5xx collected in Tasks 1–2 has exactly the keys `error`, `code`, `status`, with `status` equal to the HTTP status; with the stub returning `{ error: { message: 'relation "secret_table" does not exist' } }` no response body contains `secret_table`.

### Task 4: Membership outside `/api/trips/:id`

**Files:** Modify `routes/expenses.ts`, `routes/ai.ts`; create `routes/trip-membership.test.ts`.

Test first: a signed-in non-member gets 403 or 404, and no write, on `PUT|DELETE /api/expenses/:id` and on `POST /api/ai/generate-post` with another trip's id in the body.

### Task 5: Docs

Roadmap: A2 done, B next. This plan: tasks ticked.
