-- =============================================================================
-- motonui — Private trip media and uploaded documents
-- Migration: 0020_private_trip_media.sql
--
-- T-2.1 / T-2.3 (docs/tasks.md) — SR-PRIV-02, SR-PRIV-03, SR-CRYPTO-05.
-- - `trip-media` becomes private: photos are served with signed URLs (1 h).
--   Old public URLs (/storage/v1/object/public/trip-media/...) stop working.
-- - media.storage_path / media.thumb_path replace the public URLs; existing
--   rows are backfilled from their URL. media.url stays only for external
--   links (mobile) and becomes nullable.
-- - documents can hold an uploaded file (documents.file_path in the private
--   `trip-documents` bucket); documents.file_url is restricted to https.
-- - Paths are pinned to the row's trip by CHECK constraints and immutable
--   for client roles (prevent_structural_update), so the server can trust
--   the prefix only after re-checking it anyway (SR-INPUT-07).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Bucket
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-media',
  'trip-media',
  false,
  52428800, -- 50 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Drop any policy created from the dashboard for the old public bucket; the
-- only client access left is the member SELECT policy below.
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%trip-media%'
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end;
$$;

-- Members can read (and so sign) objects under trips/{trip_id}/. Uploads,
-- updates and deletes go through the server. CASE keeps the uuid cast from
-- running on names that are not trip folders.
create policy "trip_media_member_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'trip-media'
    and case
      when split_part(name, '/', 1) = 'trips'
       and split_part(name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_trip_member(split_part(name, '/', 2)::uuid)
      else false
    end
  );

-- -----------------------------------------------------------------------------
-- media
-- -----------------------------------------------------------------------------

alter table public.media
  add column if not exists storage_path text,
  add column if not exists thumb_path text;

alter table public.media alter column url drop not null;

comment on column public.media.storage_path is
  'Original in the private trip-media bucket: trips/{trip_id}/original/{uuid}.{ext}. Served with signed URLs.';
comment on column public.media.thumb_path is
  'Thumbnail in the private trip-media bucket: trips/{trip_id}/thumbs/{uuid}.webp.';
comment on column public.media.url is
  'External link only (e.g. added from mobile). Files uploaded to motonui use storage_path.';

-- Backfill from the old public URLs, only for paths inside the row's trip.
update public.media m
   set storage_path = p.path
  from (
    select id, substring(url from '/storage/v1/object/public/trip-media/([^?#]+)') as path
    from public.media
  ) p
 where m.id = p.id
   and m.storage_path is null
   and p.path like 'trips/' || m.trip_id::text || '/%'
   and position('..' in p.path) = 0;

update public.media m
   set thumb_path = p.path
  from (
    select id, substring(thumbnail_url from '/storage/v1/object/public/trip-media/([^?#]+)') as path
    from public.media
  ) p
 where m.id = p.id
   and m.thumb_path is null
   and p.path like 'trips/' || m.trip_id::text || '/%'
   and position('..' in p.path) = 0;

-- The public URLs no longer work once the bucket is private.
update public.media set url = null where storage_path is not null and url like '%/storage/v1/object/public/trip-media/%';
update public.media set thumbnail_url = null where thumb_path is not null and thumbnail_url like '%/storage/v1/object/public/trip-media/%';

alter table public.media
  drop constraint if exists media_storage_path_in_trip,
  drop constraint if exists media_thumb_path_in_trip,
  drop constraint if exists media_has_source;

alter table public.media
  add constraint media_storage_path_in_trip check (
    storage_path is null
    or (storage_path ~ ('^trips/' || trip_id::text || '/[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*$')
        and position('..' in storage_path) = 0)
  ),
  add constraint media_thumb_path_in_trip check (
    thumb_path is null
    or (thumb_path ~ ('^trips/' || trip_id::text || '/[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*$')
        and position('..' in thumb_path) = 0)
  ),
  add constraint media_has_source check (storage_path is not null or url is not null);

-- -----------------------------------------------------------------------------
-- documents
-- -----------------------------------------------------------------------------

alter table public.documents add column if not exists file_path text;
alter table public.documents alter column file_url drop not null;

comment on column public.documents.file_path is
  'Uploaded file in the private trip-documents bucket: trips/{trip_id}/documents/{uuid}.{ext}. Served by /api/trips/[id]/documents/[documentId]/file.';
comment on column public.documents.file_url is
  'External https link, used only when no file was uploaded.';

alter table public.documents
  drop constraint if exists documents_file_path_in_trip,
  drop constraint if exists documents_file_url_https,
  drop constraint if exists documents_has_source;

alter table public.documents
  add constraint documents_file_path_in_trip check (
    file_path is null
    or file_path ~ ('^trips/' || trip_id::text || '/documents/[A-Za-z0-9_-]+\.[a-z0-9]+$')
  ),
  add constraint documents_has_source check (file_path is not null or file_url is not null);

-- NOT VALID: existing rows are not rechecked, every insert and update is.
-- Blocks javascript:/data: URLs that the wallet would put in an iframe.
alter table public.documents
  add constraint documents_file_url_https check (file_url is null or file_url ~* '^https://[^\s]+$') not valid;

-- -----------------------------------------------------------------------------
-- Immutable paths for client roles (extends 0016)
-- -----------------------------------------------------------------------------

drop trigger if exists prevent_structural_update on public.media;
create trigger prevent_structural_update before update on public.media
  for each row execute function public.prevent_structural_update(
    'id', 'trip_id', 'uploaded_by', 'url', 'storage_path', 'thumb_path', 'created_at'
  );

drop trigger if exists prevent_structural_update on public.documents;
create trigger prevent_structural_update before update on public.documents
  for each row execute function public.prevent_structural_update(
    'id', 'trip_id', 'uploaded_by', 'file_path', 'created_at'
  );
