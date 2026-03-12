# Environment Variables Reference — motonui

## Required for all environments

| Variable | Description | Where to get it |
|----------|-------------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (public) | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (**NEVER expose client-side**) | Supabase Dashboard → Settings → API |

## Optional (app functionality degraded without these)

| Variable | Description | Where to get it |
|----------|-------------|----------------|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox GL token for trip maps | [mapbox.com](https://mapbox.com) → Account → Access tokens |
| `ANTHROPIC_API_KEY` | Claude API key for AI features | [console.anthropic.com](https://console.anthropic.com) |
| `EXCHANGE_RATE_API_KEY` | Currency conversion API key | [exchangerate-api.com](https://exchangerate-api.com) |
| `SENTRY_DSN` | Sentry error tracker DSN | [sentry.io](https://sentry.io) → Project → Client Keys |

## Admin / Cron

| Variable | Description |
|----------|-------------|
| `ADMIN_CLEANUP_SECRET` | Static secret for `/api/admin/cleanup` cron endpoint |

## App URL

| Variable | Example | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_APP_URL` | `https://motonui.vercel.app` | Used for auth redirects and metadata |

## Setting up for local development

```bash
cp .env.example .env.local
# Fill in .env.local with your values
```

> [!IMPORTANT]
> Never commit `.env.local` or any file containing `SUPABASE_SERVICE_ROLE_KEY` or `ANTHROPIC_API_KEY` to version control.

## Vercel deployment

Set all variables in **Vercel Dashboard → Project → Settings → Environment Variables**.
Use separate values for `Production`, `Preview`, and `Development` environments where applicable.
