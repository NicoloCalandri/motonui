# Security & Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the critical/high/medium findings from the motonui code review (dead suspension check in middleware, unsafe admin dev-bypass, non-httpOnly impersonation cookie, inconsistent error handling / missing validation on `/api/profile`, dead migration file).

**Architecture:** Each task is an isolated, independently-testable fix. No new abstractions are introduced — each fix follows a pattern that already exists elsewhere in this codebase (e.g. `withErrorHandler` + Zod is the dominant pattern under `src/app/api/trips/**`; `vi.mock('next/server', ...)` + dynamic `import()` is the existing test pattern for route handlers).

**Tech Stack:** Next.js 15 (App Router) middleware, `@supabase/ssr`, `jose`, `zod`, Vitest + jsdom.

**Spec:** No separate spec doc — this plan implements the "Raccomandazioni prioritarie" (1–6) from the code review conducted earlier in this conversation (see conversation history). Findings, file:line references and rationale are inlined into each task below.

## Global Constraints

- TypeScript strict mode must keep compiling: run `npm run type-check` before considering any task done.
- `npm run lint` must stay clean for touched files.
- Every touched route/module keeps using the same helpers (`withErrorHandler`, `Errors`, `ok`) and mocking conventions (`vi.mock('next/server', ...)`, dynamic `await import(...)` inside `it()`) already used in this repo — do not introduce a new test-double style.
- Do not touch `mobile/`, `agents/`, or anything under `supabase/migrations/` other than the one dead file named in Task 5.
- Never commit real secrets. `.env.example` already contains what look like real keys checked into git — do not add to that problem; only append new documented (non-secret) variables.
- Follow this repo's commit convention: plain, imperative, one logical change per commit, ending with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.

---

## File Map

| File | Change |
|---|---|
| `middleware.test.ts` (new, project root) | Regression test for suspended/admin/auth redirects |
| `src/lib/supabase/middleware.ts` | `updateSession` now also returns the caller's own `profile` (role, suspended_at), fetched with the authenticated client instead of a hand-rolled anon-key REST call |
| `middleware.ts` | Consume `profile` from `updateSession` instead of the broken manual `fetch` |
| `src/lib/admin/permissions.test.ts` | Add regression tests for the new `ADMIN_AUTH_BYPASS` flag |
| `src/lib/auth/require-admin.ts` | Replace `NODE_ENV === 'development'` bypass with explicit `ADMIN_AUTH_BYPASS === 'true'` |
| `src/app/(admin)/admin/layout.tsx` | Same bypass-flag change in `checkAdminAccess()` |
| `.env.example` | Document the new opt-in `ADMIN_AUTH_BYPASS` variable (commented out / unset by default) |
| `src/lib/admin/impersonation.test.ts` | Update mocks/assertions for httpOnly cookie issuance, no token in JSON body |
| `src/app/api/admin/users/[id]/impersonate/route.ts` | Set `impersonation_token` (httpOnly) and `impersonation_display_name` (readable) via `response.cookies.set`, stop returning the raw token in the JSON body |
| `src/app/api/admin/impersonate/exit/route.ts` | Also clear `impersonation_display_name` on exit |
| `src/components/admin/impersonate-confirm-dialog.tsx` | Stop setting the cookie via `document.cookie` (server now sets it) |
| `src/components/admin/impersonation-banner.tsx` | Detect the session via the readable `impersonation_display_name` cookie instead of `impersonation_token`; drop the no-op client-side cookie clears |
| `src/app/api/profile/route.test.ts` (new) | TDD coverage for the rewritten profile route (Zod validation + httpOnly-consistent error shape) |
| `src/app/api/profile/route.ts` | Rewrite on `withErrorHandler` + Zod (`fullName` 1–100 chars, trimmed) |
| `src/app/api/profile/stats/route.ts` | Rewrite on `withErrorHandler` |
| `src/app/api/profile/avatar/route.ts` | Rewrite on `withErrorHandler` + `Errors.validation` |
| `supabase/migrations/007_admin_role.sql` | Delete (dead stub, superseded by `0007_admin_role.sql`) |

---

### Task 1: Fix the dead suspended/admin check in middleware

**Root cause (verified):** `middleware.ts:78-87` queries Supabase's REST API with `Authorization: Bearer ${anonKey}` — the static anon key, not the signed-in user's JWT. The RLS policy on `profiles` (`profiles_select_own`, `using (auth.uid() = id)`) requires `auth.uid()` to be set from the caller's JWT. With the anon key as bearer, `auth.uid()` is `null`, so the query always returns `[]`, `profile` is always `undefined`, and both the "block suspended users" (line 95) and the "protect /admin" (line 100, though `/admin` is separately guarded by `admin/layout.tsx`) checks never run. As a side effect the `user_role` UI-hint cookie (line 105) is also never set.

**Fix:** `updateSession()` already builds an authenticated Supabase client from the request's session cookies. Use that same client to fetch the caller's own profile (RLS then correctly scopes it to `auth.uid()`), and return it from `updateSession` instead of doing a second, broken, unauthenticated fetch inside `middleware.ts`.

**Files:**
- Test: `middleware.test.ts` (new, project root, next to `middleware.ts`)
- Modify: `src/lib/supabase/middleware.ts`
- Modify: `middleware.ts:71-118`

**Interfaces:**
- Produces: `updateSession(request: NextRequest): Promise<{ supabaseResponse: NextResponse; user: User | null; profile: { role: string; suspended_at: string | null } | null }>` — the new `profile` field is consumed directly by `middleware.ts`.

- [ ] **Step 1: Write the failing regression test**

Create `middleware.test.ts` at the project root (same folder as `middleware.ts`):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class MockNextResponse {
    cookies = { set: vi.fn(), delete: vi.fn() };
    status: number;
    body: unknown;
    redirectUrl?: string;
    constructor(body?: unknown, init?: { status?: number }) {
        this.body = body;
        this.status = init?.status ?? 200;
    }
    static json(body: unknown, init?: { status?: number }) {
        return new MockNextResponse(body, init);
    }
    static redirect(url: URL | string) {
        const res = new MockNextResponse(null, { status: 307 });
        res.redirectUrl = url.toString();
        return res;
    }
    static next() {
        return new MockNextResponse(null, { status: 200 });
    }
}

vi.mock('next/server', () => ({ NextResponse: MockNextResponse }));

const mockUpdateSession = vi.fn();
vi.mock('@/lib/supabase/middleware', () => ({
    updateSession: mockUpdateSession,
}));

function makeRequest(pathname: string) {
    const url = `http://localhost${pathname}`;
    return {
        nextUrl: new URL(url),
        url,
        method: 'GET',
        cookies: { get: () => undefined },
    } as any;
}

describe('middleware', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        fetchSpy = vi
            .spyOn(global, 'fetch')
            .mockRejectedValue(new Error('middleware must not make its own network calls'));
    });

    afterEach(() => {
        fetchSpy.mockRestore();
    });

    it('redirects a suspended user to /suspended', async () => {
        mockUpdateSession.mockResolvedValue({
            supabaseResponse: MockNextResponse.next(),
            user: { id: 'user-1' },
            profile: { role: 'user', suspended_at: '2024-01-01T00:00:00Z' },
        });

        const { middleware } = await import('./middleware');
        const result = (await middleware(makeRequest('/dashboard'))) as any;

        expect(result.redirectUrl).toBe('http://localhost/suspended');
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('does not redirect a suspended user already on /suspended', async () => {
        mockUpdateSession.mockResolvedValue({
            supabaseResponse: MockNextResponse.next(),
            user: { id: 'user-1' },
            profile: { role: 'user', suspended_at: '2024-01-01T00:00:00Z' },
        });

        const { middleware } = await import('./middleware');
        const result = (await middleware(makeRequest('/suspended'))) as any;

        expect(result.redirectUrl).toBeUndefined();
    });

    it('redirects a non-admin user away from /admin routes', async () => {
        mockUpdateSession.mockResolvedValue({
            supabaseResponse: MockNextResponse.next(),
            user: { id: 'user-1' },
            profile: { role: 'user', suspended_at: null },
        });

        const { middleware } = await import('./middleware');
        const result = (await middleware(makeRequest('/admin/users'))) as any;

        expect(result.redirectUrl).toBe('http://localhost/dashboard');
    });

    it('allows an admin user to access /admin routes', async () => {
        mockUpdateSession.mockResolvedValue({
            supabaseResponse: MockNextResponse.next(),
            user: { id: 'admin-1' },
            profile: { role: 'admin', suspended_at: null },
        });

        const { middleware } = await import('./middleware');
        const result = (await middleware(makeRequest('/admin/users'))) as any;

        expect(result.redirectUrl).toBeUndefined();
    });

    it('redirects unauthenticated users to /auth/login for protected routes', async () => {
        mockUpdateSession.mockResolvedValue({
            supabaseResponse: MockNextResponse.next(),
            user: null,
            profile: null,
        });

        const { middleware } = await import('./middleware');
        const result = (await middleware(makeRequest('/dashboard'))) as any;

        expect(result.redirectUrl).toBe('http://localhost/auth/login?redirect=%2Fdashboard');
    });

    it('lets unauthenticated users through on public routes', async () => {
        mockUpdateSession.mockResolvedValue({
            supabaseResponse: MockNextResponse.next(),
            user: null,
            profile: null,
        });

        const { middleware } = await import('./middleware');
        const result = (await middleware(makeRequest('/'))) as any;

        expect(result.redirectUrl).toBeUndefined();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run middleware.test.ts`
Expected: FAIL — `updateSession` mock doesn't return a `profile` field the current `middleware.ts` understands (current code ignores it and does its own broken `fetch`, which is now stubbed to reject), so the suspended-user and non-admin-on-`/admin` redirects don't happen. At least the first, third and fourth assertions fail.

- [ ] **Step 3: Fix `updateSession` to return the caller's own profile**

Edit `src/lib/supabase/middleware.ts` — replace the whole file with:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './database.types';

export interface MiddlewareProfile {
    role: string;
    suspended_at: string | null;
}

/**
 * Updates the Supabase session in middleware.
 * Must be called in middleware.ts to keep auth tokens fresh.
 * Returns (request, response) with refreshed session cookies applied, plus the
 * caller's own profile (role/suspension), fetched with the *authenticated*
 * client so RLS (`auth.uid() = id`) actually scopes the row to the caller.
 */
export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient<any>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet: any[]) {
                    cookiesToSet.forEach(({ name, value }: any) => request.cookies.set(name, value));
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }: any) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh session — IMPORTANT: do not remove this call.
    let {
        data: { user },
    } = await supabase.auth.getUser();

    let profile: MiddlewareProfile | null = null;
    if (user) {
        const { data } = await supabase
            .from('profiles')
            .select('role, suspended_at')
            .eq('id', user.id)
            .single();
        profile = data ?? null;
    }

    return { supabaseResponse, user, profile };
}
```

- [ ] **Step 4: Consume `profile` in `middleware.ts` instead of the manual fetch**

Edit `middleware.ts` — replace lines 71-118 (the `if (user) { ... }` block) with:

```ts
    if (user) {
        if (profile) {
            // Block suspended users everywhere except /suspended and /auth
            if (profile.suspended_at && !pathname.startsWith('/suspended') && !pathname.startsWith('/auth')) {
                return NextResponse.redirect(new URL('/suspended', request.url));
            }

            // Protect /admin routes — admin only
            if (pathname.startsWith('/admin') && profile.role !== 'admin') {
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }

            // Store role in a non-httpOnly cookie for client-side UI hints (not sensitive)
            response.cookies.set('user_role', profile.role ?? 'user', {
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
            });
        }

        // Redirect authenticated users away from auth pages
        if (pathname.startsWith('/auth')) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
    }
```

And update the destructuring above it (currently `const { supabaseResponse: response, user } = await updateSession(request);`) to also pull `profile`:

```ts
    const { supabaseResponse: response, user, profile } = await updateSession(request);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run middleware.test.ts`
Expected: PASS (all 6 cases)

- [ ] **Step 6: Type-check and full test suite**

Run: `npm run type-check && npm test`
Expected: no new errors, no new failures.

- [ ] **Step 7: Commit**

```bash
git add middleware.ts middleware.test.ts src/lib/supabase/middleware.ts
git commit -m "$(cat <<'EOF'
fix: enforce suspended-user and admin redirects in middleware

The suspended/role check queried Supabase's REST API with the anon key
as bearer token instead of the user's session, so auth.uid() was
always null under RLS and the profile lookup silently returned
nothing. Suspended users were never redirected to /suspended.
Fetch the profile with the already-authenticated client from
updateSession() instead.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Replace the `NODE_ENV === 'development'` admin bypass with an explicit opt-in flag

**Problem:** `src/lib/auth/require-admin.ts:19` and `src/app/(admin)/admin/layout.tsx:12` skip all admin authentication whenever `process.env.NODE_ENV !== 'production'`. Next.js sets `NODE_ENV=production` automatically for `next build`/`next start`, so the direct risk is contained — but any staging/preview/container environment that runs the app without that exact value (e.g. `next start` invoked with `NODE_ENV` unset or overridden) exposes the entire admin panel with zero authentication. An explicit, separately-named flag that must be turned on cannot be triggered by accident.

**Files:**
- Test: `src/lib/admin/permissions.test.ts`
- Modify: `src/lib/auth/require-admin.ts:17-21`
- Modify: `src/app/(admin)/admin/layout.tsx:11-12`
- Modify: `.env.example`

**Interfaces:**
- Consumes: none new.
- Produces: none new (same `requireAdmin(): Promise<AdminResult>` signature).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/admin/permissions.test.ts`, inside the existing `describe('requireAdmin', ...)` block (after the existing tests, before the closing `});`):

```ts
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('does NOT bypass the admin check when NODE_ENV is "development" without ADMIN_AUTH_BYPASS', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        mockGetUser.mockResolvedValue({ data: { user: null } });

        const result = await requireAdmin();

        expect(result).toMatchObject({ status: 401 });
        expect(mockGetUser).toHaveBeenCalled();
    });

    it('bypasses the admin check when ADMIN_AUTH_BYPASS is "true"', async () => {
        vi.stubEnv('ADMIN_AUTH_BYPASS', 'true');

        const result = await requireAdmin();

        expect(result).toEqual({ adminId: '00000000-0000-0000-0000-000000000001' });
        expect(mockGetUser).not.toHaveBeenCalled();
    });
```

Add `afterEach` to the existing `import { describe, it, expect, vi, beforeEach } from 'vitest';` line — change it to:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/admin/permissions.test.ts`
Expected: FAIL — with current code, stubbing `NODE_ENV=development` bypasses the check (first new test fails because `mockGetUser` is never called and status isn't 401), and stubbing `ADMIN_AUTH_BYPASS=true` alone does nothing (second new test fails because the real auth path runs and returns 401 instead of the bypass `adminId`).

- [ ] **Step 3: Implement the flag in `require-admin.ts`**

Edit `src/lib/auth/require-admin.ts:17-21`, replacing:

```ts
export async function requireAdmin(): Promise<AdminResult> {
    // Dev bypass: skip auth checks entirely in local development
    if (process.env.NODE_ENV === 'development') {
        return { adminId: DEV_ADMIN_ID };
    }
```

with:

```ts
export async function requireAdmin(): Promise<AdminResult> {
    // Explicit opt-in bypass for local development only.
    // Must never be set outside a developer's own machine.
    if (process.env.ADMIN_AUTH_BYPASS === 'true') {
        return { adminId: DEV_ADMIN_ID };
    }
```

- [ ] **Step 4: Implement the flag in `admin/layout.tsx`**

Edit `src/app/(admin)/admin/layout.tsx:11-12`, replacing:

```ts
async function checkAdminAccess() {
    if (process.env.NODE_ENV === 'development') return;
```

with:

```ts
async function checkAdminAccess() {
    // Explicit opt-in bypass for local development only.
    // Must never be set outside a developer's own machine.
    if (process.env.ADMIN_AUTH_BYPASS === 'true') return;
```

- [ ] **Step 5: Document the new variable in `.env.example`**

Edit `.env.example`, in the `# ── Admin ─────` section, after the `ADMIN_EMAIL` line, add:

```
# Bypasses ALL admin authentication checks — LOCAL DEVELOPMENT ONLY.
# Never set this in staging or production.
# ADMIN_AUTH_BYPASS=true
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/lib/admin/permissions.test.ts`
Expected: PASS (all cases, including the two new ones)

- [ ] **Step 7: Type-check and full test suite**

Run: `npm run type-check && npm test`
Expected: no new errors, no new failures.

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth/require-admin.ts src/app/\(admin\)/admin/layout.tsx src/lib/admin/permissions.test.ts .env.example
git commit -m "$(cat <<'EOF'
fix: require explicit opt-in flag to bypass admin auth in dev

NODE_ENV !== 'production' bypassed all admin checks, which is set by
more than just local dev (some staging/preview setups never set
NODE_ENV=production explicitly). Require a dedicated
ADMIN_AUTH_BYPASS=true flag instead, so the safe state is the
default (unset).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Make the impersonation cookie httpOnly end-to-end

**Problem:** `impersonate-confirm-dialog.tsx:33` sets the signed impersonation JWT via `document.cookie` on the client, so it cannot be `httpOnly`. For its full 30-minute lifetime, any XSS on the page can read `document.cookie` and steal a token that grants read access to another user's data. The token is also returned in the JSON body of `POST /api/admin/users/[id]/impersonate`, which the client-side JS already reads — so even making the *cookie* httpOnly only closes half the hole unless the token also stops being exposed in the response body the page's own JS can see.

**Fix:** Move cookie issuance server-side (`response.cookies.set` with `httpOnly: true`) and stop returning the raw token in the JSON body. Keep a second, non-sensitive `impersonation_display_name` cookie (readable by the client) so the banner can detect an active session and show a name without ever touching the token.

**Files:**
- Test: `src/lib/admin/impersonation.test.ts`
- Modify: `src/app/api/admin/users/[id]/impersonate/route.ts`
- Modify: `src/app/api/admin/impersonate/exit/route.ts`
- Modify: `src/components/admin/impersonate-confirm-dialog.tsx`
- Modify: `src/components/admin/impersonation-banner.tsx`

**Interfaces:**
- Produces: `POST /api/admin/users/[id]/impersonate` now responds `{ started: true }` (no `token` field) and sets two cookies: `impersonation_token` (httpOnly) and `impersonation_display_name` (readable).
- Consumes: `impersonation-banner.tsx` now keys its visibility off the `impersonation_display_name` cookie instead of `impersonation_token`.

- [ ] **Step 1: Update the test mocks and write the failing assertions**

In `src/lib/admin/impersonation.test.ts`, replace the `MockNextResponse` class (lines 6-16) with one that supports cookies:

```ts
class MockNextResponse {
    body: unknown;
    status: number;
    cookies = { set: vi.fn() };
    constructor(body: unknown, init?: { status?: number }) {
        this.body = body;
        this.status = init?.status ?? 200;
    }
    static json(body: unknown, init?: { status?: number }) {
        return new MockNextResponse(body, init);
    }
}
```

Remove the now-unused `vi.mock('@/lib/errors', ...)` block (lines 51-53) — the route will no longer import `ok` from `@/lib/errors`.

Replace the `'returns token when target user exists'` test (lines 122-133) with:

```ts
    it('starts impersonation and sets httpOnly cookies when target user exists', async () => {
        mockSelectSingle.mockResolvedValue({ data: { id: mockTargetId, display_name: 'Test User' }, error: null });
        mockSign.mockResolvedValue('signed.jwt.token');

        const { POST } = await import('@/app/api/admin/users/[id]/impersonate/route');
        const req = new Request(`http://localhost/api/admin/users/${mockTargetId}/impersonate`, {
            method: 'POST',
        });
        const result = (await POST(req, { params: Promise.resolve({ id: mockTargetId }) })) as any;

        expect(result.status).toBe(200);
        expect(result.body).toEqual({ started: true });
        expect(JSON.stringify(result.body)).not.toContain('signed.jwt.token');

        expect(result.cookies.set).toHaveBeenCalledWith(
            'impersonation_token',
            'signed.jwt.token',
            expect.objectContaining({ httpOnly: true })
        );
        expect(result.cookies.set).toHaveBeenCalledWith(
            'impersonation_display_name',
            'Test User',
            expect.objectContaining({ httpOnly: false })
        );
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/admin/impersonation.test.ts`
Expected: FAIL — current route returns `{ token: 'signed.jwt.token' }` in the body and never calls `response.cookies.set` (in fact the mocked response object from the removed `ok()` mock has no `.cookies` at all).

- [ ] **Step 3: Rewrite the impersonate route to set httpOnly cookies**

Replace `src/app/api/admin/users/[id]/impersonate/route.ts` in full with:

```ts
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

const IMPERSONATION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const IMPERSONATION_DURATION_SECONDS = IMPERSONATION_DURATION_MS / 1000;

/** POST /api/admin/users/[id]/impersonate */
export async function POST(_req: Request, { params }: Params) {
    const { id: targetId } = await params;
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;
    const { adminId } = result;

    const secret = process.env.ADMIN_IMPERSONATION_SECRET;
    if (!secret || secret.length < 32) {
        console.error('[admin/impersonate] ADMIN_IMPERSONATION_SECRET is missing or too short');
        return NextResponse.json(
            { error: 'Configurazione server non corretta.', code: 'INTERNAL_ERROR', status: 500 },
            { status: 500 }
        );
    }

    const supabase = await createAdminClient();

    // Ensure target user exists
    const { data: targetProfile } = await (supabase.from('profiles') as any)
        .select('id, display_name')
        .eq('id', targetId)
        .single();

    if (!targetProfile) {
        return NextResponse.json(
            { error: 'Utente non trovato.', code: 'NOT_FOUND', status: 404 },
            { status: 404 }
        );
    }

    const expiresAt = Date.now() + IMPERSONATION_DURATION_MS;

    // Sign the JWT
    const secretKey = new TextEncoder().encode(secret);
    const token = await new SignJWT({
        adminId,
        targetId,
        expiresAt,
        type: 'impersonation',
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('30m')
        .sign(secretKey);

    // Persist token in DB for revocation support
    const expiresAtDate = new Date(expiresAt).toISOString();
    await (supabase.from('impersonation_tokens') as any).insert({
        admin_id: adminId,
        target_id: targetId,
        token,
        expires_at: expiresAtDate,
    });

    await (supabase.from('admin_audit_log') as any).insert({
        admin_id: adminId,
        action: 'impersonate',
        target_id: targetId,
        metadata: { display_name: targetProfile.display_name },
    });

    // The token itself never reaches client-side JS: it's set as an httpOnly
    // cookie only. A separate, non-sensitive cookie carries the display name
    // so the UI can show a banner without ever touching the token.
    const response = NextResponse.json({ started: true });
    response.cookies.set('impersonation_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: IMPERSONATION_DURATION_SECONDS,
        path: '/',
    });
    response.cookies.set('impersonation_display_name', targetProfile.display_name ?? 'utente', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: IMPERSONATION_DURATION_SECONDS,
        path: '/',
    });

    return response;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/admin/impersonation.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Clear the display-name cookie on exit too**

Edit `src/app/api/admin/impersonate/exit/route.ts`, after the existing `response.cookies.set('impersonation_token', '', { ... })` block, add:

```ts
    response.cookies.set('impersonation_display_name', '', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
    });
```

- [ ] **Step 6: Stop setting the cookie from client JS in the confirm dialog**

Edit `src/components/admin/impersonate-confirm-dialog.tsx`, replace the `handleStart` body:

```ts
    const handleStart = async () => {
        if (!confirmed) return;
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/admin/users/${user.id}/impersonate`, { method: 'POST' });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error ?? 'Errore durante l\'impersonazione.');
                return;
            }

            // The server already set the impersonation cookies (httpOnly) on this response.
            router.push('/dashboard');
        } catch {
            setError('Errore di rete. Riprova.');
        } finally {
            setLoading(false);
        }
    };
```

- [ ] **Step 7: Update the banner to key off the readable display-name cookie**

Edit `src/components/admin/impersonation-banner.tsx`, replace the component body:

```tsx
export default function ImpersonationBanner() {
    const router = useRouter();
    const [visible, setVisible] = useState(false);
    const [targetName, setTargetName] = useState<string | null>(null);
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        const displayNameCookie = document.cookie
            .split('; ')
            .find(c => c.startsWith('impersonation_display_name='));

        if (displayNameCookie) {
            setVisible(true);
            setTargetName(decodeURIComponent(displayNameCookie.split('=')[1]));
        }
    }, []);

    const handleExit = async () => {
        setExiting(true);
        try {
            await fetch('/api/admin/impersonate/exit', { method: 'POST' });
            setVisible(false);
            router.push('/admin/users');
        } catch {
            setExiting(false);
        }
    };

    if (!visible) return null;

    return (
        <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between text-sm font-medium shadow">
            <span>
                ⚠️ Stai visualizzando l&apos;app come{' '}
                <strong>{targetName ?? 'questo utente'}</strong>
                {' '}— modalità sola lettura
            </span>
            <button
                onClick={handleExit}
                disabled={exiting}
                className="ml-4 px-3 py-1 rounded-lg bg-amber-950/20 hover:bg-amber-950/30 transition-colors disabled:opacity-60 text-xs font-semibold"
            >
                {exiting ? 'Uscita…' : 'Esci dall\'anteprima'}
            </button>
        </div>
    );
}
```

(The `interface ImpersonationInfo` at the top of the file becomes unused — remove it.)

- [ ] **Step 8: Type-check and full test suite**

Run: `npm run type-check && npm test`
Expected: no new errors, no new failures.

- [ ] **Step 9: Manual smoke check (no automated UI test exists for these components)**

Run: `npm run dev`, log in as an admin, start impersonation from `/admin/users`, confirm:
- The banner shows the target's display name.
- `document.cookie` in devtools does NOT contain `impersonation_token` (only `impersonation_display_name`).
- Exiting removes the banner and both cookies.

- [ ] **Step 10: Commit**

```bash
git add src/app/api/admin/users/\[id\]/impersonate/route.ts src/app/api/admin/impersonate/exit/route.ts src/components/admin/impersonate-confirm-dialog.tsx src/components/admin/impersonation-banner.tsx src/lib/admin/impersonation.test.ts
git commit -m "$(cat <<'EOF'
fix: make impersonation token cookie httpOnly

The impersonation JWT was set via document.cookie (so it couldn't be
httpOnly) and was also returned in the JSON body the page's own JS
reads, so an XSS could steal it for the full 30-minute window. Issue
the cookie server-side with httpOnly, and stop returning the raw
token to the client at all — the banner now keys off a separate,
non-sensitive display-name cookie instead.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Unify `/api/profile/*` on `withErrorHandler` and validate `fullName` with Zod

**Problem:** `src/app/api/profile/route.ts`, `stats/route.ts` and `avatar/route.ts` each hand-roll their own `try { ... } catch (e: any) { ... }`, duplicating (and drifting from) the `withErrorHandler` pattern used by all 34 routes under `src/app/api/trips/**`. `profile/route.ts:39` also validates `fullName` with only `typeof === 'string'` — no length limit — while the rest of the codebase (e.g. `CreateTripSchema` in `src/app/api/trips/route.ts`) validates every string field with Zod.

**Files:**
- Test: `src/app/api/profile/route.test.ts` (new)
- Modify: `src/app/api/profile/route.ts`
- Modify: `src/app/api/profile/stats/route.ts`
- Modify: `src/app/api/profile/avatar/route.ts`

**Interfaces:**
- Produces: `PATCH /api/profile` now rejects (400, `VALIDATION_ERROR`) any `fullName` that's missing, empty after trimming, or longer than 100 characters.

- [ ] **Step 1: Write the failing tests for `profile/route.ts`**

Create `src/app/api/profile/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/server', () => ({
    NextResponse: {
        json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
    },
}));

const USER_ID = 'user-123';

const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockUpdateEq = vi.fn();
const mockSelectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: mockSingle,
};
const mockFrom = vi.fn((table: string) => {
    if (table === 'profiles') {
        return {
            ...mockSelectChain,
            update: vi.fn(() => ({ eq: mockUpdateEq })),
        };
    }
    return {};
});

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => ({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    })),
}));

const emptyParams = { params: Promise.resolve({}) as Promise<Record<string, string>> };

function makePatchRequest(body: unknown) {
    return new Request('http://localhost/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('GET /api/profile', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID, email: 'a@b.com' } } });
    });

    it('returns 401 when not authenticated', async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } });

        const { GET } = await import('@/app/api/profile/route');
        const result = (await GET(new Request('http://localhost/api/profile'), emptyParams)) as any;

        expect(result.status).toBe(401);
    });

    it('returns profile data for the authenticated user', async () => {
        mockSingle.mockResolvedValue({ data: { display_name: 'Nico', avatar_url: 'http://x/y.png' } });

        const { GET } = await import('@/app/api/profile/route');
        const result = (await GET(new Request('http://localhost/api/profile'), emptyParams)) as any;

        expect(result.status).toBe(200);
        expect(result.body).toMatchObject({ id: USER_ID, fullName: 'Nico', avatarUrl: 'http://x/y.png' });
    });
});

describe('PATCH /api/profile', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID, email: 'a@b.com' } } });
        mockUpdateEq.mockResolvedValue({ error: null });
    });

    it('returns 401 when not authenticated', async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } });

        const { PATCH } = await import('@/app/api/profile/route');
        const result = (await PATCH(makePatchRequest({ fullName: 'Nico' }), emptyParams)) as any;

        expect(result.status).toBe(401);
    });

    it('returns 400 when fullName is missing', async () => {
        const { PATCH } = await import('@/app/api/profile/route');
        const result = (await PATCH(makePatchRequest({}), emptyParams)) as any;

        expect(result.status).toBe(400);
        expect(result.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when fullName is empty after trimming', async () => {
        const { PATCH } = await import('@/app/api/profile/route');
        const result = (await PATCH(makePatchRequest({ fullName: '   ' }), emptyParams)) as any;

        expect(result.status).toBe(400);
    });

    it('returns 400 when fullName exceeds 100 characters', async () => {
        const { PATCH } = await import('@/app/api/profile/route');
        const tooLong = 'a'.repeat(101);
        const result = (await PATCH(makePatchRequest({ fullName: tooLong }), emptyParams)) as any;

        expect(result.status).toBe(400);
        expect(result.body.code).toBe('VALIDATION_ERROR');
    });

    it('updates the display name and returns it when valid', async () => {
        const { PATCH } = await import('@/app/api/profile/route');
        const result = (await PATCH(makePatchRequest({ fullName: 'Nico Calandri' }), emptyParams)) as any;

        expect(result.status).toBe(200);
        expect(result.body).toEqual({ fullName: 'Nico Calandri' });
        expect(mockUpdateEq).toHaveBeenCalledWith('id', USER_ID);
    });

    it('returns 500 when the database update fails', async () => {
        mockUpdateEq.mockResolvedValue({ error: { message: 'db down' } });

        const { PATCH } = await import('@/app/api/profile/route');
        const result = (await PATCH(makePatchRequest({ fullName: 'Nico' }), emptyParams)) as any;

        expect(result.status).toBe(500);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/api/profile/route.test.ts`
Expected: FAIL — the current route has no length limit (the 101-char test fails) and the current error-body shape/status handling differs slightly from what `withErrorHandler` produces (some assertions may already pass by coincidence, but the 100-char-limit test must fail).

- [ ] **Step 3: Rewrite `profile/route.ts` on `withErrorHandler` + Zod**

Replace `src/app/api/profile/route.ts` in full with:

```ts
import { z } from 'zod';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';

const UpdateProfileSchema = z.object({
    fullName: z.string().trim().min(1).max(100),
});

/** GET /api/profile — returns current user's id, email, full_name, avatar_url */
export const GET = withErrorHandler(async () => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', user.id)
        .single();

    return ok({
        id: user.id,
        email: user.email ?? null,
        fullName: profile?.display_name ?? '',
        avatarUrl: profile?.avatar_url ?? null,
    });
}, 'profile GET');

/** PATCH /api/profile — updates display_name in the profiles table */
export const PATCH = withErrorHandler(async (request) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    const body: unknown = await request.json();
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const { error } = await supabase
        .from('profiles')
        .update({ display_name: parsed.data.fullName })
        .eq('id', user.id);

    if (error) throw new Error(`[motonui][profile PATCH] ${error.message}`);

    return ok({ fullName: parsed.data.fullName });
}, 'profile PATCH');
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/api/profile/route.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Rewrite `profile/stats/route.ts` on `withErrorHandler`**

Replace `src/app/api/profile/stats/route.ts` in full with:

```ts
import { withErrorHandler, ok } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';

/** GET /api/profile/stats — trip and post counts for the current user */
export const GET = withErrorHandler(async () => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    const [tripsRes, postsRes] = await Promise.all([
        supabase.from('trip_members').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', user.id),
    ]);

    return ok({ trips: tripsRes.count ?? 0, posts: postsRes.count ?? 0 });
}, 'profile/stats GET');
```

- [ ] **Step 6: Rewrite `profile/avatar/route.ts` on `withErrorHandler`**

Replace `src/app/api/profile/avatar/route.ts` in full with:

```ts
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
};

/** POST /api/profile/avatar — uploads a new profile picture */
export const POST = withErrorHandler(async (request) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    const formData = await request.formData();
    const file = formData.get('avatar');

    if (!(file instanceof File)) throw Errors.validation('Nessun file allegato.');
    if (!ALLOWED_TYPES.has(file.type)) throw Errors.validation('Formato non supportato. Usa JPEG, PNG, WebP o HEIC.');
    if (file.size > MAX_SIZE) throw Errors.validation('Immagine troppo grande. Massimo 5 MB.');

    const ext = MIME_TO_EXT[file.type] ?? 'jpg';
    const storagePath = `${user.id}/avatar.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const admin = await createAdminClient();
    const { error: uploadError } = await admin.storage
        .from('avatars')
        .upload(storagePath, buffer, { contentType: file.type, upsert: true });

    if (uploadError) throw new Error(`[motonui][profile/avatar POST] upload: ${uploadError.message}`);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    // Append a cache-busting timestamp so the browser reloads the image
    const avatarUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${storagePath}?t=${Date.now()}`;

    const { error: dbError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);

    if (dbError) throw new Error(`[motonui][profile/avatar POST] db: ${dbError.message}`);

    return ok({ avatarUrl });
}, 'profile/avatar POST');
```

- [ ] **Step 7: Type-check and full test suite**

Run: `npm run type-check && npm test`
Expected: no new errors, no new failures. `stats/route.ts` and `avatar/route.ts` had no prior tests and their behavior is unchanged (same checks, same success responses), so this is a mechanical refactor — verified by type-check + the absence of regressions in the full suite rather than new tests for those two files.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/profile/route.ts src/app/api/profile/route.test.ts src/app/api/profile/stats/route.ts src/app/api/profile/avatar/route.ts
git commit -m "$(cat <<'EOF'
refactor: unify /api/profile/* on withErrorHandler, validate fullName

profile/*, unlike the trips/** routes, hand-rolled try/catch with
inconsistent error bodies and no length limit on fullName. Bring them
in line with the withErrorHandler + Zod pattern used everywhere else.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Remove the dead duplicate migration file

**Problem:** `supabase/migrations/007_admin_role.sql` is a one-line stub (`-- This migration has been moved to 0007_admin_role.sql ...`) left behind after a rename. Two files claiming the same logical migration (`007` and `0007`) is confusing for anyone reading migration history or ordering, even though the stub itself is a no-op.

**Files:**
- Delete: `supabase/migrations/007_admin_role.sql`

- [ ] **Step 1: Confirm nothing else references the old filename**

Run: `git grep -n "007_admin_role.sql"`
Expected: only `supabase/migrations/007_admin_role.sql` itself, `supabase/migrations/0007_admin_role.sql`'s content, and `agents/07_ADMIN.md` (a historical build-agent prompt, not living docs — leave it untouched).

- [ ] **Step 2: Delete the file**

```bash
git rm supabase/migrations/007_admin_role.sql
```

- [ ] **Step 3: Confirm the app still builds/tests clean**

Run: `npm run type-check && npm test`
Expected: no change in outcome (this file was never executed as SQL by the app or by Vitest).

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore: remove dead duplicate migration stub

007_admin_role.sql was a one-line pointer left behind after the
migration was renamed to 0007_admin_role.sql. Two files claiming the
same migration is confusing; only the real one should remain.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 2: Full lint**

Run: `npm run lint`
Expected: no errors on touched files.

- [ ] **Step 3: Full test suite**

Run: `npm test`
Expected: all tests pass, including all new ones added in Tasks 1–4.

- [ ] **Step 4: Review the diff end-to-end**

Run: `git log --oneline -6` and `git diff main --stat` (or equivalent against the base branch) to confirm exactly the 5 commits from Tasks 1–5 are present and no unrelated files changed.

No commit for this task — it's verification only.
