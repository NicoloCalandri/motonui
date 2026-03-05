# 🚀 Agent: DevOps & Deployment

## Role
You are the **DevOps Agent** for *motonui*. You configure CI/CD, deployment, monitoring, and all infrastructure-as-code. The goal is a zero-friction deployment pipeline from `git push` to live production.

---

## Stack
- **Hosting**: Vercel (frontend + API routes)
- **Database**: Supabase (managed Postgres)
- **Storage**: Supabase Storage
- **Domain**: Custom domain via Vercel
- **Monitoring**: Vercel Analytics + Sentry

---

## Your Tasks

### 1. GitHub Actions Workflows

**`.github/workflows/ci.yml`** — runs on every PR:
```yaml
# Steps:
# 1. Install dependencies
# 2. Type check (tsc --noEmit)
# 3. Lint (eslint)
# 4. Run unit tests (vitest)
# 5. Run Supabase migrations against a local test DB
# 6. Build check (next build)
# Post a summary comment on the PR with results
```

**`.github/workflows/deploy-preview.yml`** — runs on PR:
```yaml
# 1. Deploy to Vercel preview URL
# 2. Comment the preview URL on the PR
# 3. Run Supabase migrations against preview Supabase project
```

**`.github/workflows/deploy-production.yml`** — runs on push to `main`:
```yaml
# 1. Run full CI
# 2. Deploy to Vercel production
# 3. Run Supabase migrations on production
# 4. Notify via email (or Discord webhook) on success/failure
```

**`.github/workflows/cleanup.yml`** — daily cron at 3am UTC:
```yaml
# 1. Call /api/admin/cleanup endpoint
# This triggers: delete instagram exports older than 24h, 
#               clean expired currency cache,
#               log daily usage stats
```

### 2. Supabase Configuration

**`supabase/config.toml`** — local development config:
```toml
project_id = "motonui"
[api]
port = 54321
[db]
port = 5432
[studio]
port = 54323
[storage]
enabled = true
```

**`supabase/seed.sql`** — development seed data:
- 2 test users (Nicolò + Sara)
- 3 sample trips (Japan 2023, Portogallo 2024, Marocco 2024)
- 20 sample expenses per trip across all categories
- 5 published blog posts
- Sample media entries

### 3. Environment Variables

Create `.env.example` with all required vars:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=

# Anthropic
ANTHROPIC_API_KEY=

# Exchange Rate API
EXCHANGE_RATE_API_KEY=

# Sentry
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=motonui
```

Document each variable in `docs/ENV_VARS.md` with: where to get it, whether it's required or optional, and which features it enables.

### 4. Vercel Configuration

**`vercel.json`**:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "rewrites": [
    { "source": "/blog/:slug", "destination": "/blog/[slug]" }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    },
    {
      "source": "/blog/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "s-maxage=3600, stale-while-revalidate=86400" }
      ]
    }
  ]
}
```

### 5. Local Development Setup

**`scripts/setup.sh`** — one-command dev environment setup:
```bash
#!/bin/bash
# 1. Check node version (>=20)
# 2. Install dependencies
# 3. Copy .env.example to .env.local (if not exists)
# 4. Start Supabase local
# 5. Run migrations
# 6. Run seed
# 7. Start Next.js dev server
# Print: "🏝️ motonui is running at http://localhost:3000"
```

**`Makefile`** shortcuts:
```
make setup     → run scripts/setup.sh
make dev       → supabase start + next dev
make db-reset  → supabase db reset
make db-push   → supabase db push
make test      → vitest run
make build     → next build
```

### 6. Monitoring

**Sentry integration** (`src/lib/monitoring.ts`):
- Capture all API route errors
- Track AI API calls (count, latency, cost estimate)
- Alert on: error rate > 5%, response time > 3s, Instagram export failures

**Vercel Analytics**: enable via `@vercel/analytics` — track page views on public blog posts.

### 7. Security Checklist

Create `docs/SECURITY.md` checklist:
- [ ] RLS enabled on all Supabase tables
- [ ] Service role key never exposed to client
- [ ] All API routes validate auth
- [ ] File upload: MIME type validation + size limits enforced server-side
- [ ] Rate limiting on AI endpoints (use Upstash Redis if available, otherwise simple DB counter)
- [ ] CORS: only allow requests from `NEXT_PUBLIC_APP_URL`
- [ ] Content Security Policy headers set
- [ ] No sensitive data in client-side bundle (check with `@next/bundle-analyzer`)

---

## Constraints
- All secrets stored in GitHub Secrets + Vercel Environment Variables — never in code
- Preview deploys use a separate Supabase project (not production data)
- `main` branch is protected: require PR + passing CI before merge
- Auto-delete preview deployments after 7 days
