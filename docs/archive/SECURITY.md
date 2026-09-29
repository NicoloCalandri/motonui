# Security Checklist & Practices — motonui

## Authentication & Authorization

- [x] **Supabase Auth** with Magic Link (no passwords stored) + Google OAuth
- [x] **Session cookies** managed server-side via `@supabase/ssr`
- [x] **Route protection** in `middleware.ts` — unauthenticated users redirected to login
- [x] **All API routes** verify user session before any DB operation

## Database (Row Level Security)

- [x] **RLS enabled** on every table in `0001_initial.sql`
- [x] **Users can only access their own data** (via `trip_members` membership joins)
- [x] **Service role key** only used server-side in `createAdminClient()` — never exposed to browser
- [x] **Admin cleanup route** protected by static `ADMIN_CLEANUP_SECRET` header

## File Uploads

- [x] **MIME type validation** in `src/lib/storage.ts` — only JPEG/PNG/WebP/HEIC/MP4 allowed
- [x] **Max file size**: 50 MB enforced server-side (not just client)
- [x] **Files stored in Supabase Storage** — not on the server disk
- [x] Storage paths namespaced by trip ID to prevent path traversal

## API Security

- [x] **Zod validation** on all API route inputs
- [x] **withErrorHandler HOC** catches all errors — no stack traces leaked to clients
- [x] **Security headers** set in `vercel.json`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`

## AI Rate Limiting

- [x] **Per-user daily limits** tracked in `ai_usage` table
  - Haiku: 200/day, Sonnet: 50/day, Opus: 10/day
- [x] AI API routes return 429 when limit exceeded

## Secrets Management

- [x] All secrets in environment variables — never hardcoded
- [x] `SUPABASE_SERVICE_ROLE_KEY` only accessible server-side
- [x] `ANTHROPIC_API_KEY` only accessible server-side
- [x] `.env.local` gitignored

## Content Security

- [x] Tiptap blog content stored as JSON (not raw HTML) — no XSS from stored content
- [x] Tiptap→HTML conversion done server-side with known-safe extensions
- [x] SVG text overlay in `process.ts` uses XML escaping

## Known Limitations

> [!WARNING]
> The following are out-of-scope for the initial release but should be addressed before public launch:

- [ ] CSRF protection (currently relying on SameSite cookies)
- [ ] Image CDN with signed URLs for private media
- [ ] Content moderation for public blog posts
- [ ] Supabase Storage bucket policies (currently public for trip-media)
