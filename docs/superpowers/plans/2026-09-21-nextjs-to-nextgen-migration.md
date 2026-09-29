# Next.js → Nextgen (Vite SPA + Hono API) Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note on task shape:** Phases 1–3 below are already shipped (documented here for continuity). Phases 4–6 are a *port*, not greenfield development — the source behavior already exists and is verified in `src/`. Tasks therefore follow the same pattern the shipped phases used: read the Next.js source at the given path, port it verbatim except for the listed framework touchpoints, verify with type-check/tests/manual smoke, commit. This is intentionally not red/green TDD — there is no new behavior to specify, only a runtime to swap out from under existing, working behavior.

**Goal:** Finish moving motonui off Next.js onto the `nextgen/` monorepo (Vite + React SPA in `apps/web`, Hono on `@hono/node-server` in `apps/api`) without ever breaking the production app, then decommission the Next.js app.

**Architecture:** `nextgen/` already lives side by side with the current Next.js app at the repo root and is fully decoupled — it is not built, deployed, or referenced by production until Phase 6. Backend (Phase 1–3, done) ported all ~50 Next.js API routes to Hono route modules under `apps/api/src/routes/`, reusing `apps/api/src/lib/*` business logic ported near-verbatim from `src/lib/*`. Remaining work is: port the Next.js UI (`src/app/`, `src/components/`) into the Vite SPA (`apps/web/src/`) behind a client-side router and auth guard that replaces `middleware.ts`, decide the fate of the currently-empty `apps/blog-ssg` stub, then cut production over and remove the old app.

**Tech Stack:**
| Layer | Old (`src/`) | New (`nextgen/apps/*`) |
|---|---|---|
| Frontend framework | Next.js 15 App Router | Vite 6 + React 19 |
| Routing | Next.js file-based routing + `middleware.ts` | `react-router-dom` v7 + a client `RequireAuth`/`RequireAdmin` guard |
| Data fetching | Server Components + route handlers | TanStack Query v5 against the Hono API |
| Forms | `react-hook-form` + Zod | same (already a dependency of `apps/web`) |
| API server | Next.js route handlers (`src/app/api/**/route.ts`) | Hono (`apps/api/src/routes/**`) — **done** |
| Auth | Supabase Auth, cookie session via `@supabase/ssr`, `middleware.ts` | Supabase Auth, Bearer token from `@supabase/supabase-js` browser client, verified per-request in Hono middleware — **API side done** (`apps/api/src/middleware/auth.ts`) |
| Types | `src/lib/types.ts` | `packages/shared-types` — **done**, verify it covers all UI-facing shapes before porting pages |
| Public blog SSG | N/A (SSR via Next.js) | `apps/blog-ssg` — currently an empty stub, scope not yet decided (see Task 15) |

**Spec:** No separate spec document exists; the "spec" is the working Next.js app at `src/` plus `docs/ARCHITECTURE.md` and `docs/CLAUDE.md` (still describe the old stack — Task 20 updates them). This plan is the first written artifact for the migration; before it, the only record was the phrase "Next.js removal plan" in commit messages `8d3e1f0`, `ac3a475`, `e713e22`.

## Global Constraints

These carry over from `docs/CLAUDE.md` and apply to every task below:
- UI copy and user-facing messages: Italian. Code, comments, identifiers: English.
- Error responses/messages follow the existing shape (`{ error, code, status }`) — already implemented in `apps/api/src/lib/errors.ts`, reuse it, don't reinvent.
- No `any`, no `// @ts-ignore` — `apps/web` and `apps/api` both run `tsc --noEmit` in `type-check`; it must stay clean.
- Every new/changed file gets co-located tests where the source repo had them (`X.ts` → `X.test.ts`).
- Anthropic API keys, Supabase service-role key, and other secrets never reach `apps/web` — only `apps/api`.
- Sharp/image processing stays server-side only (`apps/api`), never in the browser bundle.
- Production (`src/`, the live Vercel deployment) must keep working, unmodified, through Phases 4 and 5. Nothing in this plan touches `src/`, `middleware.ts`, or `vercel.json` until Task 20.
- Commit format: `feat(nextgen): <description>` for port work, matching the three shipped commits.

---

## Phase 1–3 — DONE (documented for continuity, no action needed)

| Phase | Commit | What shipped |
|---|---|---|
| 1 | `8d3e1f0` | Scaffolded `nextgen/` monorepo: `apps/web` (Vite+React+TanStack Query), `apps/api` (Hono), `packages/shared-types`. Ported auth/profile/admin/impersonation middleware and the `trips` GET/POST route as the reference pattern. |
| 2 | `ac3a475` | Ported `authz.ts`, profile GET/PATCH, `trips/:id` GET/PUT/DELETE. Added Hono `app.request()` test coverage (14 tests). |
| 3 | `e713e22` | Ported the remaining ~45 routes: all trip nested resources, admin routes, AI routes, Instagram export, profile avatar/stats, public `posts/:slug`. Wired the cron scheduler to real handlers. Fixed one real regression (`getTripStats` RLS enforcement) and one pre-existing privilege-escalation risk (public posts route using the wrong Supabase client) surfaced during the port. |

**Current state of `apps/api`:** all 28 route modules exist, type-checks clean, 14+ tests pass. `apps/web` is a placeholder (`App.tsx` is a health-check screen proving the Vite dev proxy reaches Hono — see its own comment: "Replaced by the real router (AuthProvider + route tree) in phase 4/5"). `apps/blog-ssg` is an empty stub with no files. Nothing in `nextgen/` is deployed or wired into CI/Vercel yet.

---

## Phase 4 — Web SPA: Foundations

### Task 4.1: API client + TanStack Query setup

**Files:**
- Create: `nextgen/apps/web/src/lib/api-client.ts`
- Create: `nextgen/apps/web/src/lib/api-client.test.ts`
- Modify: `nextgen/apps/web/src/main.tsx` (add `QueryClientProvider`)

**Interfaces:**
- Produces: `apiFetch<T>(path: string, init?: RequestInit): Promise<T>` — throws a typed `ApiError { message, code, status }` matching `apps/api/src/lib/errors.ts`'s response shape on non-2xx.
- Produces: `queryClient` singleton exported for use in `main.tsx` and tests.

- [ ] **Step 1: Write the failing test for error-shape parsing**

```typescript
// nextgen/apps/web/src/lib/api-client.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, ApiError } from './api-client';

describe('apiFetch', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns parsed JSON on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    ));
    const result = await apiFetch<{ ok: boolean }>('/api/health');
    expect(result).toEqual({ ok: true });
  });

  it('throws ApiError with code/status from the standard error shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Non trovato', code: 'TRIP_NOT_FOUND', status: 404 }), { status: 404 })
    ));
    await expect(apiFetch('/api/trips/x')).rejects.toMatchObject({
      message: 'Non trovato',
      code: 'TRIP_NOT_FOUND',
      status: 404,
    });
  });

  it('attaches the Supabase access token as a Bearer header when present', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/api/trips', { headers: {} }, 'test-token');
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd nextgen/apps/web && npm test -- api-client`
Expected: FAIL — `api-client.ts` does not exist.

- [ ] **Step 3: Implement**

```typescript
// nextgen/apps/web/src/lib/api-client.ts
export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string
): Promise<T> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(path, { ...init, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      body.error ?? 'Errore imprevisto 🏝️',
      body.code ?? 'UNKNOWN_ERROR',
      res.status
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
```

```typescript
// nextgen/apps/web/src/main.tsx — add near the existing render call
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});
// wrap <App /> in <QueryClientProvider client={queryClient}>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd nextgen/apps/web && npm test -- api-client`
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
git add nextgen/apps/web/src/lib/api-client.ts nextgen/apps/web/src/lib/api-client.test.ts nextgen/apps/web/src/main.tsx
git commit -m "feat(nextgen): add typed API client and TanStack Query provider"
```

### Task 4.2: Supabase browser client + AuthProvider

**Files:**
- Create: `nextgen/apps/web/src/lib/supabase-client.ts`
- Create: `nextgen/apps/web/src/lib/auth-context.tsx`
- Create: `nextgen/apps/web/src/lib/auth-context.test.tsx`
- Reference: `src/lib/supabase/client.ts` (old browser client, to confirm the Supabase project config/env var names) and `src/app/auth/login/page.tsx` (confirms email+password is the primary auth flow to preserve)

**Interfaces:**
- Consumes: `apiFetch` from Task 4.1 (not directly, but `AuthProvider` is what supplies `accessToken` to callers of `apiFetch`).
- Produces: `useAuth(): { user: User | null, session: Session | null, profile: Profile | null, isLoading: boolean, signOut: () => Promise<void> }`, consumed by every protected page and by the router guard in Task 4.3.
- Produces: `<AuthProvider>` wrapping the app in `main.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx
// nextgen/apps/web/src/lib/auth-context.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './auth-context';

vi.mock('./supabase-client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' }, access_token: 't' } } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

function Probe() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <span>loading</span>;
  return <span>{user ? `user:${user.id}` : 'anon'}</span>;
}

it('resolves the initial session on mount', async () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('user:u1')).toBeInTheDocument());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd nextgen/apps/web && npm test -- auth-context`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```typescript
// nextgen/apps/web/src/lib/supabase-client.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

```tsx
// nextgen/apps/web/src/lib/auth-context.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase-client';
import { apiFetch } from './api-client';
import type { Profile } from '@motonui/shared-types';

interface AuthValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    apiFetch<Profile>('/api/profile', {}, session.access_token)
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [session]);

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, profile, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd nextgen/apps/web && npm test -- auth-context`
Expected: PASS.

- [ ] **Step 5: Add `.env.example` entries and commit**

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `nextgen/apps/web/.env.example` (create the file), same values as the old `NEXT_PUBLIC_SUPABASE_*` vars.

```bash
git add nextgen/apps/web/src/lib/supabase-client.ts nextgen/apps/web/src/lib/auth-context.tsx nextgen/apps/web/src/lib/auth-context.test.tsx nextgen/apps/web/.env.example
git commit -m "feat(nextgen): add Supabase browser client and AuthProvider"
```

### Task 4.3: Router shell + route guards (replaces `middleware.ts`)

**Files:**
- Create: `nextgen/apps/web/src/router.tsx`
- Create: `nextgen/apps/web/src/components/RequireAuth.tsx`
- Create: `nextgen/apps/web/src/components/RequireAuth.test.tsx`
- Modify: `nextgen/apps/web/src/main.tsx` (mount `RouterProvider`)
- Reference: `middleware.ts` (full logic already reviewed — this task reimplements its route-protection rules client-side, since a Vite SPA has no server middleware)

**Interfaces:**
- Consumes: `useAuth()` from Task 4.2.
- Produces: `<RequireAuth>` (redirects to `/auth/login?redirect=<path>` if unauthenticated, mirrors `middleware.ts:66-70`), `<RequireAdmin>` (redirects to `/dashboard` if `profile.role !== 'admin'`, mirrors `middleware.ts:80-82`), `<RequireNotSuspended>` (redirects to `/suspended` if `profile.suspended_at` set, mirrors `middleware.ts:75-77`).

**Behavior to preserve from `middleware.ts` (do not reinterpret — port exactly):**
1. Public, no-auth-required paths: `/`, `/suspended`, `/auth/*`, `/blog*` (public blog stays reachable without login).
2. Authenticated users hitting `/auth/*` get redirected to `/dashboard` (`middleware.ts:94-96`).
3. Suspended users are blocked from every route except `/suspended` and `/auth/*` (`middleware.ts:75-77`).
4. `/admin/*` requires `profile.role === 'admin'`, else redirect to `/dashboard` (`middleware.ts:80-82`).
5. Impersonation read-only enforcement (`middleware.ts:32-63`) is **already implemented API-side** in `apps/api/src/middleware/impersonation.ts` — do not duplicate it in the SPA; the API will 403 write requests during impersonation regardless of what the UI allows, so the UI only needs to *display* the impersonation banner (Task 4.4/5.x), not re-enforce it.

- [ ] **Step 1: Write the failing test**

```tsx
// nextgen/apps/web/src/components/RequireAuth.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';

const mockUseAuth = vi.fn();
vi.mock('../lib/auth-context', () => ({ useAuth: () => mockUseAuth() }));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth/login" element={<span>login page</span>} />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<span>dashboard</span>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

it('redirects to /auth/login when there is no user', () => {
  mockUseAuth.mockReturnValue({ user: null, isLoading: false });
  renderAt('/dashboard');
  expect(screen.getByText('login page')).toBeInTheDocument();
});

it('renders the protected route when authenticated', () => {
  mockUseAuth.mockReturnValue({ user: { id: 'u1' }, isLoading: false });
  renderAt('/dashboard');
  expect(screen.getByText('dashboard')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd nextgen/apps/web && npm test -- RequireAuth`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```tsx
// nextgen/apps/web/src/components/RequireAuth.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

export function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return null;
  if (!user) {
    return <Navigate to={`/auth/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <Outlet />;
}

export function RequireAdmin() {
  const { profile, isLoading } = useAuth();
  if (isLoading) return null;
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export function RequireNotSuspended() {
  const { profile, isLoading } = useAuth();
  if (isLoading) return null;
  if (profile?.suspended_at) return <Navigate to="/suspended" replace />;
  return <Outlet />;
}
```

```tsx
// nextgen/apps/web/src/router.tsx — skeleton, pages filled in by Phase 4 page-port tasks
import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth, RequireAdmin, RequireNotSuspended } from './components/RequireAuth';

export const router = createBrowserRouter([
  { path: '/', /* Task 4.5 */ Component: undefined },
  { path: '/blog', /* Task 4.9 */ Component: undefined },
  { path: '/blog/:slug', Component: undefined },
  { path: '/auth/login', /* Task 4.6 */ Component: undefined },
  { path: '/auth/forgot-password', Component: undefined },
  { path: '/auth/reset-password', Component: undefined },
  { path: '/suspended', /* Task 4.11 */ Component: undefined },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireNotSuspended />,
        children: [
          { path: '/dashboard', /* Task 4.7 */ Component: undefined },
          { path: '/trips', /* Task 4.8 */ Component: undefined },
          { path: '/trips/new', Component: undefined },
          { path: '/trips/:id', Component: undefined },
          { path: '/trips/:id/posts/:postId/edit', /* Task 4.10 */ Component: undefined },
          { path: '/profile', /* Task 4.12 */ Component: undefined },
          {
            path: '/admin',
            element: <RequireAdmin />,
            children: [
              { index: true, /* Task 4.13 */ Component: undefined },
              { path: 'users', Component: undefined },
              { path: 'audit-log', Component: undefined },
            ],
          },
        ],
      },
    ],
  },
]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd nextgen/apps/web && npm test -- RequireAuth`
Expected: PASS.

- [ ] **Step 5: Wire into `main.tsx` and commit**

```tsx
// nextgen/apps/web/src/main.tsx
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
// render <AuthProvider><QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider></AuthProvider>
```

```bash
git add nextgen/apps/web/src/router.tsx nextgen/apps/web/src/components/RequireAuth.tsx nextgen/apps/web/src/components/RequireAuth.test.tsx nextgen/apps/web/src/main.tsx
git commit -m "feat(nextgen): add router shell and auth/admin/suspended route guards"
```

### Task 4.4: App shell layout (nav)

**Files:**
- Create: `nextgen/apps/web/src/components/AppShell.tsx`
- Reference: `src/app/(app)/layout.tsx` (source of the nav structure — bottom tabs on mobile ≤768px, sidebar on desktop, per `docs/ARCHITECTURE.md`'s "Mobile Strategy" section)

**Steps:**
- [ ] **Step 1:** Read `src/app/(app)/layout.tsx` in full and list every nav item and every piece of chrome it renders (avatar, sign-out, impersonation banner if active).
- [ ] **Step 2:** Port it to `AppShell.tsx` as a plain React component (no Server Component data fetching — pull `user`/`profile` from `useAuth()`), using `<Outlet />` from `react-router-dom` for the child route content instead of Next's `children` prop.
- [ ] **Step 3:** Wire `AppShell` as a layout route wrapping the authenticated routes in `router.tsx` (the block under `RequireAuth` from Task 4.3).
- [ ] **Step 4:** `cd nextgen/apps/web && npm run type-check` — must be clean.
- [ ] **Step 5:** Manual smoke test: `npm run dev:web` (from `nextgen/`) + `npm run dev:api` in a second terminal, log in, confirm nav renders and links navigate without a full page reload.
- [ ] **Step 6: Commit**

```bash
git add nextgen/apps/web/src/components/AppShell.tsx nextgen/apps/web/src/router.tsx
git commit -m "feat(nextgen): port authenticated app shell nav"
```

---

## Phase 4 — Web SPA: Page ports

Each task below follows the same shape: read the listed Next.js source files, port markup/logic to a Vite page component, replace the listed framework touchpoints, wire the route in `router.tsx`, verify, commit. **Before starting each task, `grep -rn` the source page file(s) for their component imports to get the exact, current list of child components used — the lists below are a best-effort inventory from directory structure, not a guarantee of what's imported where.**

**Standard framework-touchpoint checklist** (apply to every page/component in this phase):
- `'use server'` / Server Component data fetching (`await supabase...` at module scope) → a TanStack Query `useQuery`/`useMutation` hook calling `apiFetch()` against the already-ported Hono route.
- `next/navigation`'s `useRouter()`/`redirect()` → `useNavigate()`/`<Navigate>` from `react-router-dom`.
- `next/link`'s `<Link href>` → `react-router-dom`'s `<Link to>`.
- `next/image` → plain `<img>` (Vite has no built-in image optimizer; note any component relying on `next/image` sizing props for a follow-up if needed, but don't block the port on it).
- Route params via `params: { id: string }` prop → `useParams()`.
- Server Actions (`'use server'` functions passed to forms) → `react-hook-form` `onSubmit` calling `apiFetch()` directly (mutations already exist as Hono routes from Phase 1–3).
- `revalidatePath`/`router.refresh()` → `queryClient.invalidateQueries()`.
- Any `cookies()`/`headers()` read for auth → already handled globally by `AuthProvider` (Task 4.2); should not appear in ported page logic at all.

### Task 4.5: Auth pages

**Files:**
- Create: `nextgen/apps/web/src/pages/auth/LoginPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`
- Port from: `src/app/auth/login/page.tsx`, `src/app/auth/forgot-password/page.tsx`, `src/app/auth/reset-password/page.tsx`
- Wire routes: `/auth/login`, `/auth/forgot-password`, `/auth/reset-password` in `router.tsx`

- [ ] Port each page applying the standard touchpoint checklist. Login calls `supabase.auth.signInWithPassword` directly (client-side Supabase call, not an API route — confirm this matches `src/app/auth/login/page.tsx`'s actual flow before assuming).
- [ ] `npm run type-check` clean.
- [ ] Manual smoke test: log in with a real dev-environment account, confirm redirect to `/dashboard` and that the `redirect` query param round-trips (part of `RequireAuth`'s contract from Task 4.3).
- [ ] Commit: `git commit -m "feat(nextgen): port auth pages (login, forgot/reset password)"`

### Task 4.6: Landing page

**Files:**
- Create: `nextgen/apps/web/src/pages/LandingPage.tsx`
- Port from: `src/app/page.tsx` and `src/app/(app)/landing-client.tsx`
- Wire route: `/` in `router.tsx`

- [ ] Port, apply touchpoint checklist, type-check, smoke test (unauthenticated view), commit.

### Task 4.7: Dashboard

**Files:**
- Create: `nextgen/apps/web/src/pages/DashboardPage.tsx`
- Port from: `src/app/(app)/dashboard/page.tsx`
- Likely consumes: `apps/api/src/routes/trips.ts` (list), `apps/api/src/routes/profile.ts` (stats) — confirm against actual imports
- Wire route: `/dashboard`

- [ ] Port, apply touchpoint checklist, type-check, smoke test with a real trip in the DB, commit.

### Task 4.8: Trips list + new trip

**Files:**
- Create: `nextgen/apps/web/src/pages/TripsListPage.tsx`, `NewTripPage.tsx`
- Port from: `src/app/(app)/trips/page.tsx`, `src/app/(app)/trips/new/page.tsx`
- Wire routes: `/trips`, `/trips/new`

- [ ] Port, apply touchpoint checklist (new-trip form: `react-hook-form` + Zod resolver, submit via `apiFetch` POST to `/api/trips`, `navigate()` to the created trip on success), type-check, smoke test (create a trip end-to-end), commit.

### Task 4.9: Trip detail (largest task — split further if it exceeds ~300 lines per `docs/CLAUDE.md`'s file-size rule)

**Files:**
- Create: `nextgen/apps/web/src/pages/TripDetailPage.tsx` plus one file per tab under `nextgen/apps/web/src/components/trip/` (mirror the tab structure found in the source)
- Port from: `src/app/(app)/trips/[id]/page.tsx` and, per current inventory, the 11 files under `src/components/trip/`, plus whichever of `src/components/booking/` (3 files), `src/components/calendar/` (1), `src/components/expense/` (2), `src/components/map/` (2), `src/components/media/` (1), `src/components/wallet/` (1) that page actually imports (confirm via grep before starting — this is the largest single unknown in the plan)
- Wire route: `/trips/:id`

- [ ] **Step 1:** `grep -rn "from '@/components" src/app/\(app\)/trips/\[id\]/page.tsx src/components/trip/*.tsx` to get the exact, complete component dependency graph for this page.
- [ ] **Step 2:** Port `TripDetailPage.tsx` (tab shell, uses `useParams()` for `:id`) and each dependency component one at a time, applying the standard touchpoint checklist to each. Map view (`src/components/map/`) needs a Mapbox token — confirm `VITE_MAPBOX_TOKEN` is in `apps/web/.env.example` before porting it.
- [ ] **Step 3:** `npm run type-check` clean after every 2–3 components ported (don't let type errors accumulate across the whole task).
- [ ] **Step 4:** Manual smoke test covering the acceptance criteria in `docs/CLAUDE.md`: add a day/leg/accommodation, add an expense and see the split, upload a photo and see it in the media grid, generate an Instagram export.
- [ ] **Step 5:** Commit — split into multiple commits per tab (itinerary, expenses, media, etc.) rather than one giant commit, matching this repo's existing granularity.

### Task 4.10: Blog post editor (Tiptap)

**Files:**
- Create: `nextgen/apps/web/src/pages/BlogPostEditPage.tsx`, plus `src/components/blog/`'s 2 files ported under `nextgen/apps/web/src/components/blog/`
- Port from: `src/app/(app)/trips/[id]/posts/[postId]/edit/page.tsx`, `src/app/(app)/blog/_components/*`
- Wire route: `/trips/:id/posts/:postId/edit`
- Reference: `apps/api/src/lib/ai/blog-assistant.ts` (already ported — the SSE streaming AI assist endpoint) — confirm the ported Hono route streams the same way the old `ai/blog` route did before wiring the "AI assist" button.

- [ ] Port, wire Tiptap editor + AI-assist SSE consumption (use the browser `EventSource` or a `fetch` + `ReadableStream` reader — check what `apps/api/src/routes/ai.ts` actually emits before choosing), type-check, smoke test (write and save a post, verify it round-trips through Tiptap JSON as documented in `docs/ARCHITECTURE.md`'s "Blog Content Format"), commit.

### Task 4.11: Public blog (index + post)

**Files:**
- Create: `nextgen/apps/web/src/pages/BlogIndexPage.tsx`, `BlogPostPage.tsx`
- Port from: `src/app/(app)/blog/page.tsx`, `src/app/(app)/blog/[slug]/page.tsx`
- Wire routes: `/blog`, `/blog/:slug` (outside `RequireAuth`, per `middleware.ts`'s public-route list)

**Open question flagged for Task 15:** the old app server-renders these for SEO. A Vite SPA client-renders by default, which is a real SEO regression for the public blog specifically (not for authenticated pages, which don't need indexing). Port the SPA version here to unblock the rest of the migration; Task 15 decides whether `apps/blog-ssg` should replace this route in production or whether client rendering is an accepted tradeoff.

- [ ] Port both pages, apply touchpoint checklist, type-check, smoke test against a published post, commit.

### Task 4.12: Suspended page

**Files:**
- Create: `nextgen/apps/web/src/pages/SuspendedPage.tsx`
- Port from: `src/app/(public)/suspended/page.tsx` (includes `SignOutButton.tsx`)
- Wire route: `/suspended`

- [ ] Port, type-check, smoke test (suspend a test user via admin, confirm redirect via `RequireNotSuspended` from Task 4.3), commit.

### Task 4.13: Profile page

**Files:**
- Create: `nextgen/apps/web/src/pages/ProfilePage.tsx`
- Port from: `src/app/(app)/profile/page.tsx`
- Wire route: `/profile`

- [ ] Port (includes avatar upload — calls the already-ported `POST /api/profile/avatar`), type-check, smoke test, commit.

### Task 4.14: Admin pages

**Files:**
- Create: `nextgen/apps/web/src/pages/admin/AdminDashboardPage.tsx`, `AdminUsersPage.tsx`, `AdminAuditLogPage.tsx`, plus `src/components/admin/`'s 7 files ported under `nextgen/apps/web/src/components/admin/`
- Port from: `src/app/(admin)/admin/page.tsx`, `src/app/(admin)/admin/users/page.tsx`, `src/app/(admin)/admin/audit-log/page.tsx`, `src/app/(admin)/admin/_components/*`
- Wire routes: `/admin`, `/admin/users`, `/admin/audit-log` (under `RequireAdmin` from Task 4.3)

- [ ] Port each page and its components, including the impersonate/suspend/unsuspend action buttons (call the already-ported `apps/api/src/routes/admin/*` routes). Port the impersonation-active banner referenced in Task 4.4 here if it lives in an admin component rather than the app shell — confirm by reading the source before assuming its location.
- [ ] Type-check, smoke test as an admin user (suspend/unsuspend a test account, impersonate and confirm write-blocking from the already-shipped API middleware, view audit log), commit.

---

## Phase 5 — Pre-cutover validation

### Task 5.1: Full `apps/web` + `apps/api` verification pass

- [ ] Run, from `nextgen/`: `npm run type-check` (both workspaces), `npm run lint` (both), `npm test` (both), `npm run build` (both) — all must be clean. This is the `nextgen/` equivalent of `docs/CLAUDE.md`'s pre-PR checklist; add it to `nextgen/package.json`'s root scripts if not already covered by the workspace-delegating scripts there.
- [ ] Run the full manual checklist from `DEPLOY.md`'s "Test finali prima di andare live" section against a local `nextgen/` instance (both dev servers running): registration, login/logout, password reset, create trip, add expense + currency conversion, avatar upload, trip photo upload, map loads, AI generation, admin dashboard visibility and access control, email on registration, cron config note (defer — Vercel cron config is Task 5.3).
- [ ] Document any behavioral difference found against the old app as a follow-up task in this plan (append to this file under a new "Known gaps" section) rather than silently accepting drift.

### Task 5.2: Mobile app impact check

**Context:** `mobile/` (Expo/React Native) talks to Supabase directly via `mobile/lib/supabase.ts` using `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` — it does **not** call the Next.js `/api/*` routes today (confirmed: no `/api/` or `fetch(` calls against the web app found in `mobile/` outside its own Supabase client). This means the API-side migration (Phase 1–3) is low-risk for mobile.

- [ ] Re-confirm this with a fresh grep before cutover (`grep -rn "fetch(\|/api/" mobile --include=*.ts*`), since mobile code may have changed since this plan was written.
- [ ] If any direct `/api/*` dependency is found, add a task here to point it at the deployed `apps/api` URL before Task 6's cutover, or port that one remaining call to a direct Supabase call.

### Task 5.3: Deployment configuration

**Files:**
- Create: `nextgen/vercel.json` (or equivalent for the chosen host — see decision below)
- Reference: `vercel.json` (current Next.js config — cron schedule `0 8 * * *` for `/api/admin/send-reminders` must be preserved, security headers must be preserved)

**Decision needed (flag to the user before implementing — not answerable from the repo alone):** `apps/web` is a static SPA (deployable to Vercel's static hosting or any CDN) but `apps/api` is a long-running Node/Hono server, not a Next.js serverless function — it needs either (a) Vercel's Node.js serverless functions with `@hono/node-server`'s Vercel adapter, (b) a separate always-on host for `apps/api` (Railway/Fly/Render), or (c) a rewrite to Vercel Edge Functions. `apps/api/src/lib/media/process.ts` uses `sharp`, which needs a Node runtime, not Edge — that constrains option (c) out unless media processing is isolated further.

- [ ] Get the hosting decision above confirmed before writing `nextgen/vercel.json` (or its replacement).
- [ ] Port the cron schedule and the security headers block from `vercel.json` verbatim.
- [ ] Update `DEPLOY.md` once the target hosting is confirmed (Task 6.1 does the full rewrite; this task can stop at "config file exists and matches the decision").

### Task 5.4: Environment variable parity

**Files:**
- Create/update: `nextgen/apps/web/.env.example`, `nextgen/apps/api/.env.example`

- [ ] Cross-reference every variable in the root `.env.example` (per `docs/CLAUDE.md`'s "Variabili d'ambiente" section: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `ANTHROPIC_API_KEY`, `EXCHANGE_RATE_API_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, plus `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ADMIN_IMPERSONATION_SECRET`, `ADMIN_EMAIL` from `DEPLOY.md`) and confirm each has a home: browser-exposed ones (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN`) become `VITE_*` in `apps/web/.env.example`; everything else (service role key, Anthropic key, Resend key, admin secret) stays server-only in `apps/api/.env.example`.
- [ ] Verify `apps/api/src/lib/env.ts` (already exists) reads every server-side variable this list requires — add any missing ones.
- [ ] Commit.

---

## Phase 6 — Cutover & decommission

### Task 6.1: Cutover

- [ ] Deploy `nextgen/apps/web` and `nextgen/apps/api` to the hosting decided in Task 5.3, to a **staging URL first**, not production.
- [ ] Run the Task 5.1 manual checklist again against the staging deployment (not just localhost — catches env/CORS/CDN issues localhost can't).
- [ ] Get explicit user go-ahead before repointing the production domain — this is the irreversible-in-spirit step (real users, real data) even though rollback is technically possible; confirm before acting, per this session's standing instruction to check before actions with real-world blast radius.
- [ ] Repoint the production domain from the Next.js Vercel project to the new deployment. Keep the old Next.js deployment alive and reachable at a fallback URL for a rollback window (suggest at least 7 days given this is a personal project with no on-call).
- [ ] Update `docs/ARCHITECTURE.md` and `docs/CLAUDE.md` to describe the new stack (Vite/Hono, not Next.js) — both currently describe the old stack exclusively and will actively mislead anyone (human or agent) reading them after cutover.
- [ ] Update `DEPLOY.md` to describe deploying `nextgen/`, replacing the Next.js/Vercel-specific instructions.

### Task 6.2: Decommission

**Only after the rollback window from Task 6.1 closes with no issues found.**

- [ ] Remove `src/app`, `middleware.ts`, `next.config.ts`, the root `vercel.json`, and any other Next.js-only files (`next-env.d.ts`, etc.) from the repo.
- [ ] Move `nextgen/apps/web`, `nextgen/apps/api`, `nextgen/packages/shared-types` to the repo root (or update root `package.json`/CI to point into `nextgen/` permanently — pick whichever this plan's execution reveals is less disruptive to existing CI config, which wasn't inventoried as part of this plan).
- [ ] Remove the old Next.js dependencies from the root `package.json`.
- [ ] Final commit removing the old app, referencing this plan document.

---

## Open decisions requiring user input before the corresponding task starts

1. **Task 5.3 / hosting for `apps/api`:** Vercel serverless functions vs. a separate Node host vs. Edge (constrained by `sharp`). Not answerable from repo inspection alone.
2. **Task 4.11 / Task 6.1, public blog SEO:** accept client-rendered blog as a regression, or build out `apps/blog-ssg` (currently empty) before cutover. This affects whether Task 4.11 is the final state of the public blog or an interim one.
3. **Task 6.2, monorepo layout:** collapse `nextgen/*` into the repo root, or keep the `nextgen/` prefix permanently. Affects every CI/deploy config touched in Task 6.

---

## Self-review notes

- **Coverage:** every phase referenced in the shipped commit messages (1–3) is documented; every remaining piece of the app found during investigation (16 pages, 9 component directories, the `blog-ssg` stub, mobile, deployment config, env vars, docs) has a task or an explicit open decision.
- **No fabricated code for unread UI logic:** Tasks 4.5–4.14 deliberately do not include invented component code, since the actual behavior lives in unread `src/` files — inventing it would misrepresent what those pages do. Each task instead pins the exact source files, the exact framework-touchpoint transformations, and concrete verification steps (type-check, specific smoke-test scenarios tied to `docs/CLAUDE.md`'s acceptance criteria).
- **Task 4.9 (trip detail) is intentionally the least precisely scoped task** — it's the largest page and its full component dependency graph wasn't traced line-by-line during planning. Its first step is exactly that trace, so the executor isn't guessing either.
