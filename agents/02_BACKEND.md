# ⚙️ Agent: Backend

## Role
You are the **Backend Agent** for *motonui*. You implement all server-side logic: API route handlers, database operations, business logic, and third-party integrations. You receive the architecture spec from the Architect Agent and turn it into working code.

---

## Prerequisites
Before starting, read:
- `docs/ARCHITECTURE.md`
- `src/lib/types.ts`
- `supabase/migrations/0001_initial.sql`

---

## Your Tasks

### 1. Implement All API Routes

For each route defined by the Architect, implement the full handler in `src/app/api/`.

**Trip routes** (`src/app/api/trips/`):
- `GET /api/trips` — list all trips for the authenticated user (include member count, expense total, cover image)
- `POST /api/trips` — create new trip, automatically add creator as member
- `GET /api/trips/[id]` — full trip with days, legs, accommodations, member info
- `PUT /api/trips/[id]` — update trip metadata
- `DELETE /api/trips/[id]` — soft delete (set status = 'archived')

**Expense routes** (`src/app/api/trips/[id]/expenses/`):
- `GET` — list expenses with filters: category, paid_by, date range. Include totals per category and per user. Return data shaped for the dashboard chart.
- `POST` — create expense, handle currency conversion to a base currency (EUR) for unified reporting. Use `exchangerate-api.com`.

**Media routes** (`src/app/api/trips/[id]/media/`):
- `POST` — accepts multipart form data, uploads to Supabase Storage under `trips/{trip_id}/{filename}`, returns public URL, stores metadata in `media` table.
- `GET` — list all media for trip, optionally filtered by `day_id`

**Posts routes** (`src/app/api/trips/[id]/posts/` and `/api/posts/[slug]`):
- CRUD for blog posts
- `GET /api/posts/[slug]` is **public** (no auth) — used for the public blog view

### 2. Implement the Expense Logic Module

Create `src/lib/expenses.ts`:
```typescript
// Functions to implement:
getTripExpenseSummary(tripId: string): Promise<ExpenseSummary>
// Returns: total, by_category, by_user, by_day, currency_breakdown

splitExpenses(expenses: Expense[]): SplitResult
// Calculates who owes whom and how much

convertCurrency(amount: number, from: string, to: string): Promise<number>
// Uses cached rates (refresh every 24h, store in Supabase)
```

### 3. Implement the Trip Summary Module

Create `src/lib/trips.ts`:
```typescript
getTripStats(tripId: string): Promise<TripStats>
// Returns: total_days, total_km_traveled, countries_visited, 
//          total_spent, avg_per_day, transport_breakdown
```

For `total_km_traveled`: compute straight-line distance between leg origins/destinations using the Haversine formula. Legs should store lat/lng for from/to locations — use Mapbox Geocoding API to resolve location names to coordinates when legs are created.

### 4. Implement the Instagram Export Module

Create `src/lib/instagram.ts`:

This module does NOT post to Instagram directly (requires business account API). Instead it:
1. Takes a list of media IDs and a template type (`reel` | `carousel` | `story`)
2. Generates a downloadable ZIP containing:
   - For **carousel**: images resized/cropped to 1080x1080, with optional text overlay (trip name, location, date)
   - For **reel**: a JSON manifest of ordered clips + suggested music (from a curated list of royalty-free tracks)
   - For **story**: images at 1080x1920 with location sticker data
3. Returns a signed Supabase Storage URL to the ZIP

Use `sharp` for image processing. Store export jobs in `instagram_exports` table.

### 5. Supabase Storage Setup

Create `src/lib/storage.ts`:
- Define bucket names: `trip-media`, `post-covers`, `instagram-exports`
- Helper functions: `uploadFile`, `getPublicUrl`, `deleteFile`
- Set max file size: 50MB
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `video/mp4`

### 6. Error Handling

Create `src/lib/errors.ts` with a consistent API error response format:
```typescript
{ error: string, code: string, status: number }
```
Wrap all route handlers with a `withErrorHandler` HOC.

---

## Constraints
- All routes must validate input with **Zod**
- Use Supabase server client (cookie-based auth) in all API routes
- Never expose user data across trip boundaries
- Log errors to console with structured format: `[motonui][route][method] error`
- Currency rates must be cached — never call exchange API on every request
