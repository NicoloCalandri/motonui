# motonui — nextgen

The migration of motonui from Next.js to a Vite single-page app and a Hono API. It is **not in production**: `src/` (Next.js) still is. What is decided and why is in `docs/architecture.md` (ADR-09); how to switch production over is in `docs/nextgen-cutover.md`.

```
nextgen/
├── apps/web/               # Vite + React SPA (react-router, TanStack Query, SWR)
├── apps/api/               # Hono API on Node; in production it also serves apps/web/dist
├── packages/shared-types/  # domain and database types, copied from src/lib
└── scripts/                # port tool, drift report, build smoke test
```

## Commands

Run them in `nextgen/`.

```bash
npm install
npm run dev:api        # API on :3001 (needs apps/api/.env, see .env.example)
npm run dev:web        # web app on :5173, /api proxied to :3001
npm run type-check
npm test               # API, then web
npm run build          # type-check, API bundle (esbuild), web build (Vite)
npm run smoke          # starts the build under plain Node and probes it

npm run port:lib       # re-copy the files that come from src/ (after a change there)
npm run port:check     # same, read-only: exits 1 if a copy differs
npm run handlers:check # what the Next.js and the Hono route handlers mention differently
```

One test: `npx vitest run src/routes/trips.test.ts` inside `apps/api` or `apps/web`.

## How it stays in step with `src/`

Most of this code is a checked copy of the Next.js app, not a rewrite.

- **Library modules** (`src/lib` → `apps/api/src/lib`) and **browser-safe files** (helpers, client components, some pages → `apps/web/src`, at the path they have under `src/`) are copied by `scripts/port-lib.mjs`, which rewrites their imports and nothing else. The lists are in `scripts/port-manifest.mjs` (`PORTED`, `WEB_COPIES`). **Never edit a copy**: change the source in `src/` and run `npm run port:lib`. `apps/api/src/lib/lib-parity.test.ts` fails when a copy differs, when a new module of `src/lib` is not classified, or when a copied file leaves its test behind.
- **Route handlers** are written by hand for Hono. Three tests compare them with the Next.js API: `route-parity.test.ts` (every route exists on both sides), `handler-drift.test.ts` (tables, RPCs, schema rules, library functions and messages they mention) and `route-contract.test.ts` (bad input is a standard 400, no database message leaks).
- **The web app** may call only routes the API serves: `web-client-contract.test.ts` reads every `/api` path in `apps/web/src`.

A defect found in a copied file is fixed in `src/`, then re-ported. The ones known today are listed in the tests that tolerate them (`INHERITED_*` in `web-client-contract.test.ts`, the axe exceptions in `apps/web/src/pages/trip-tabs.test.tsx`).

## What differs from the Next.js app, by design

| Next.js | nextgen |
|---|---|
| Session in cookies, refreshed by the middleware | Supabase session in the browser; the API receives it as a bearer token |
| `fetch('/api/…')` authenticated by the cookie | `lib/api-auth.ts` adds the token to same-origin `/api` requests made with plain `fetch` |
| `<img src="/api/…/file">` authenticated by the cookie | A read-only session cookie (`POST /api/session/cookie`): httpOnly, SameSite=Strict, Path=/api, accepted on GET and HEAD only |
| Role and suspension read on the server | `GET /api/session`, read once per user; the guards in `components/RequireAuth.tsx` are for navigation, every API route checks again |
| `next/link`, `next/navigation` | `apps/web/src/lib/next/*` on react-router |
| `after()` for work after the response | `apps/api/src/lib/background.ts` (needs a long-running process) |
| Vercel Cron | `node-cron` in the API process (`ENABLE_CRON=true`), or any scheduler calling the two cron routes with `CRON_SECRET` |
| Public blog rendered on the server | Rendered in the browser: no metadata in the first response (see ADR-09) |
| CSP with a nonce per request | Static CSP on the app shell (`apps/api/src/web-app.ts`): the build has no inline script |

## Production

One process serves the API and the built web app on one origin; the cookie and the token wrapper depend on that.

```bash
docker build -t motonui \
  --build-arg VITE_SUPABASE_URL=… --build-arg VITE_SUPABASE_ANON_KEY=… --build-arg VITE_MAPBOX_TOKEN=… \
  nextgen/
docker run -p 3001:3001 --env-file nextgen/apps/api/.env motonui
```

The `VITE_*` values are public (they are in the JavaScript every visitor downloads). Everything else is a runtime variable of the API: see `apps/api/.env.example`. `WEB_DIST` comes from the image: do not set it in the env file (a blank `WEB_DIST=` would override it and serve no pages; the API warns at startup). Set `ENABLE_CRON=true` on exactly one instance.

Outside the image, `npm start -w @motonui/api` loads `apps/api/.env` if it exists (`--env-file-if-exists`); to serve the web app from that process also set `WEB_DIST=../web/dist`.
