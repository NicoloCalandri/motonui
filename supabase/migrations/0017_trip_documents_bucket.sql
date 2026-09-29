-- =============================================================================
-- motonui — Private bucket for boarding passes and travel documents
-- Migration: 0017_trip_documents_bucket.sql
--
-- T-0.9 (docs/tasks.md) — mitigates SR-PRIV-02 for documents, SR-PRIV-03.
-- Boarding passes move out of the public `trip-media` bucket. Files are served
-- only by the API (auth + trip membership check, service role download), so
-- no storage.objects policy grants anon/authenticated access to this bucket.
-- Existing files are moved by scripts/migrate-boarding-passes.ts.
-- Photos stay in `trip-media` until T-2.1.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-documents',
  'trip-documents',
  false,
  20971520, -- 20 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Object path inside `trip-documents`, always under trips/{trip_id}/boarding-passes/.
-- The server re-checks that prefix before any service-role read or delete.
-- boarding_pass_url is kept only for rows not yet migrated.
alter table public.legs
  add column if not exists boarding_pass_path text;

comment on column public.legs.boarding_pass_path is
  'Path in the private trip-documents bucket (trips/{trip_id}/boarding-passes/...). Served by /api/trips/[id]/days/[dayId]/legs/[legId]/boarding-pass.';
comment on column public.legs.boarding_pass_url is
  'Deprecated: legacy public URL in trip-media, cleared by scripts/migrate-boarding-passes.ts.';
