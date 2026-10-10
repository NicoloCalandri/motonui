-- =============================================================================
-- motonui — Private Instagram exports
-- Migration: 0023_instagram_exports_private.sql
--
-- T-2.7 (docs/tasks.md) — FR-34/35, SR-PRIV-02, SR-PRIV-06.
-- ZIPs contain the trip photos: the bucket is private and a ZIP is downloaded
-- only through a signed URL (max 24 h) issued by
-- GET /api/trips/[id]/instagram/exports/[exportId] after a membership check.
-- instagram_exports.zip_path replaces the public zip_url; it is pinned to the
-- row's trip and immutable for clients, and the server re-checks it anyway.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('instagram-exports', 'instagram-exports', false, 104857600, array['application/zip'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%instagram-exports%'
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end;
$$;

alter table public.instagram_exports add column if not exists zip_path text;
alter table public.instagram_exports add column if not exists error text;

comment on column public.instagram_exports.zip_path is
  'ZIP in the private instagram-exports bucket: {trip_id}/{export_id}.zip. Downloaded only via signed URL.';
comment on column public.instagram_exports.zip_url is
  'Deprecated: public URL of the old synchronous export. Not written any more.';

-- Old public links stop working with the private bucket.
update public.instagram_exports set zip_url = null where zip_url is not null;

alter table public.instagram_exports drop constraint if exists instagram_exports_zip_path_in_trip;
alter table public.instagram_exports
  add constraint instagram_exports_zip_path_in_trip check (
    zip_path is null or zip_path = trip_id::text || '/' || id::text || '.zip'
  );

drop trigger if exists prevent_structural_update on public.instagram_exports;
create trigger prevent_structural_update before update on public.instagram_exports
  for each row execute function public.prevent_structural_update(
    'id', 'trip_id', 'created_by', 'created_at', 'zip_path', 'status', 'media_ids'
  );
