# Nextgen B2 — Private Storage Implementation Plan

> **Status (2026-10-12): done** on `worktree-nextgen-migration`.

**Goal:** The Hono API stores and serves trip files the way the Next.js API does today: private buckets, server-built paths, signed URLs or an authenticated proxy, and no file left behind by a deleted row.

**Architecture:** The six storage modules are copied from `src/lib` by the port tool (B1). The route files for media, documents and boarding passes are rewritten as ports of the current Next.js handlers; the upload through the request body is removed.

**Spec:** `2026-10-10-nextgen-realignment-roadmap.md` §1.2; CLAUDE.md "Regole per media e immagini"; the handlers under `src/app/api/trips/[id]/{media,documents}` and `…/legs/[legId]/boarding-pass`.

## Global Constraints

Same as B1: nothing under `src/`, `supabase/` or the root config changes; ported modules are never edited; type-check and both suites stay green.

## Review Focus

- A stored path that points to another trip (or uses dot segments) must never reach the service role: 404, no download, no delete.
- No route may return or store a public storage URL for a trip file.
- A failed insert after an upload must remove the uploaded file.
- A leg, document or media row deleted through the API must take its file with it.
- The upload limits must cover the two new upload routes, not only the old path.

## Tasks

- [x] **1. Modules.** `boarding-pass`, `media/pipeline`, `storage`, `storage-deletion`, `trip-files`, `trip-storage` moved from `PENDING` to `PORTED`. `lib/env.ts` aliases `NEXT_PUBLIC_SUPABASE_URL` to `SUPABASE_URL` so the copies stay identical.
- [x] **2. Media.** `GET` returns signed URLs; `POST …/media/uploads` and `POST …/media/confirm` added; `DELETE` removes the files; `POST …/media` (file in the body, public URL) removed.
- [x] **3. Documents.** Current schemas (https links only, dates checked); multipart upload to `trip-documents`; `GET …/documents/:documentId/file` proxy; `DELETE` removes the file.
- [x] **4. Boarding passes.** Own router (`routes/trips-boarding-pass.ts`): `GET` proxy, private upload that replaces the previous file, `DELETE`; both leg `DELETE` handlers remove the boarding pass.
- [x] **5. Cleanup cron.** Stale incoming uploads, storage deletion queue, rate limit windows; expired export rows of any status.
- [x] **6. Wiring.** Upload limits on `…/media/uploads` and `…/media/confirm`; `KNOWN_GAPS` 13 → 9, `KNOWN_EXTRAS` 5 → 4.

Tests: `routes/trip-files.test.ts` (35), `lib/cron/cleanup.test.ts` (4), `middleware/rate-limit.test.ts` (two routes added), plus the ported module tests.

## Left for later plans

- `apps/web` still calls the removed `POST …/media` and reads `boarding_pass_url`: sub-plan C.
- ZIP objects of expired Instagram exports: B4.
- `purge_user_data` in the admin user deletion: B3, with account deletion.
