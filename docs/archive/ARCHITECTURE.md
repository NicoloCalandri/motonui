# Architecture — motonui

## Overview

motonui is a full-stack Next.js application. All pages are server-rendered by default, with selective client-side interactivity. The backend is entirely Supabase (Postgres + Auth + Storage).

---

## Directory Structure

```
src/
├── app/
│   ├── (auth)/               # Login, signup pages (no nav)
│   │   ├── login/
│   │   └── signup/
│   ├── (app)/                # Authenticated app shell (with nav)
│   │   ├── layout.tsx        # App shell with sidebar/bottom nav
│   │   ├── page.tsx          # Dashboard
│   │   ├── trips/
│   │   │   ├── new/
│   │   │   └── [id]/
│   │   │       ├── page.tsx            # Trip overview (tabs)
│   │   │       └── posts/[postId]/
│   │   │           └── edit/page.tsx   # Blog post editor
│   ├── (public)/             # Public pages (no auth)
│   │   └── blog/
│   │       ├── page.tsx      # Blog index
│   │       └── [slug]/       # Individual post
│   └── api/                  # API routes
├── components/
│   ├── ui/                   # Primitive components (Button, Input...)
│   ├── trip/                 # Trip-specific components
│   ├── expense/              # Expense components
│   ├── media/                # Photo/media components
│   ├── blog/                 # Blog editor components
│   ├── map/                  # Mapbox components
│   └── instagram/            # Instagram export components
├── lib/
│   ├── supabase/             # DB client setup
│   ├── ai/                   # Claude API integrations
│   ├── media/                # Image processing
│   ├── expenses.ts           # Expense business logic
│   ├── trips.ts              # Trip stats
│   ├── types.ts              # All TypeScript types
│   └── utils.ts              # Shared utilities
└── styles/
    └── globals.css           # Tailwind + CSS variables
```

---

## Key Decisions

### Why Supabase?
- Built-in auth with social providers (Google)
- Postgres with RLS for data isolation per user
- Built-in storage for photos
- Real-time subscriptions (future: live co-editing of itinerary)
- Generous free tier for personal use

### Auth Strategy
- Supabase Auth with magic link + Google OAuth
- Sessions stored in cookies (SSR-compatible)
- RLS ensures users can only see their own trips

### Blog Content Format
- Stored as Tiptap JSON in a Postgres JSONB column
- Rendered server-side to HTML for public posts (good SEO)
- Allows structured editing + AI insertion of content blocks

### Currency Strategy
- All expenses stored in their original currency + amount
- A `base_amount_eur` column is computed on insert via API
- Exchange rates cached in Supabase for 24h
- Dashboard always shows totals in EUR with original currency noted

### Media Storage
- Original files in `trips/{id}/original/`
- Thumbnails in `trips/{id}/thumbs/`
- Instagram exports (ZIPs) in `instagram-exports/` — auto-deleted after 24h
- Supabase Storage handles CDN automatically

### Mobile Strategy
- Mobile-first Tailwind CSS
- Bottom tab navigation on mobile (≤768px)
- Sidebar navigation on desktop
- All drawers/sheets instead of modals on mobile
