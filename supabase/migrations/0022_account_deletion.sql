-- =============================================================================
-- motonui — Complete account deletion
-- Migration: 0022_account_deletion.sql
--
-- T-2.9 (docs/tasks.md) — SR-PRIV-04.
-- Before: deleting auth.users cascaded to every owned trip, so the partner lost
-- the whole shared trip; photos and documents stayed in storage.
-- Now purge_user_data(user):
--   - a trip shared with a partner is transferred to the partner (owner);
--   - a trip where the user is the only member is deleted;
--   - the user's own rows in shared trips are deleted (as before);
--   - every storage object that belonged to deleted data is queued in
--     storage_deletion_queue. SQL cannot delete the stored file (deleting
--     storage.objects only drops metadata), so the server drains the queue
--     through the Storage API: right away for web/admin deletions, daily in
--     the cleanup cron for deletions made from the mobile app.
-- delete_my_account() (self-service, 0014) and the admin route both use it.
-- =============================================================================

create table if not exists public.storage_deletion_queue (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  bucket_id   text not null,
  name        text not null,
  unique (bucket_id, name)
);

comment on table public.storage_deletion_queue is
  'Storage objects of deleted accounts/trips, removed by the server with the Storage API (src/lib/storage-deletion.ts). Service role only.';

alter table public.storage_deletion_queue enable row level security;
revoke all on public.storage_deletion_queue from anon, authenticated;

-- Admin audit entries about a deleted user are kept (the email stays in
-- metadata): the target reference is cleared instead of deleting the row,
-- which used to erase the audit record of the deletion itself.
alter table public.admin_audit_log
  drop constraint if exists admin_audit_log_target_id_fkey,
  add constraint admin_audit_log_target_id_fkey
    foreign key (target_id) references public.profiles(id) on delete set null;

-- -----------------------------------------------------------------------------
-- Ownership transfer needs to rewrite trips.owner_id, a structural column.
-- The bypass is a transaction-local setting that only SECURITY DEFINER code
-- sets; PostgREST cannot set custom GUCs outside the request.* namespace.
-- -----------------------------------------------------------------------------

create or replace function public.prevent_structural_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  col      text;
  old_row  jsonb := to_jsonb(old);
  new_row  jsonb := to_jsonb(new);
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated')
     or current_setting('motonui.allow_structural_update', true) = 'on' then
    return new;
  end if;

  foreach col in array tg_argv loop
    if (new_row -> col) is distinct from (old_row -> col) then
      raise exception 'Column %.% cannot be modified', tg_table_name, col
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- purge_user_data: everything but the auth.users row
-- -----------------------------------------------------------------------------

create or replace function public.purge_user_data(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trip      record;
  v_partner   uuid;
  v_deleted   uuid[] := '{}';
  v_moved     int := 0;
begin
  if p_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  perform set_config('motonui.allow_structural_update', 'on', true);

  -- 1. Owned trips: transfer to the partner, or delete when alone.
  for v_trip in select id from public.trips where owner_id = p_user for update loop
    select user_id into v_partner
      from public.trip_members
     where trip_id = v_trip.id and user_id <> p_user
     limit 1;

    if v_partner is not null then
      update public.trips set owner_id = v_partner where id = v_trip.id;
      update public.trip_members set role = 'owner' where trip_id = v_trip.id and user_id = v_partner;
      v_moved := v_moved + 1;
    else
      v_deleted := v_deleted || v_trip.id;
    end if;
  end loop;

  -- 2. Queue files: whole folders of deleted trips, the user's own files in
  --    shared trips, the avatar.
  insert into public.storage_deletion_queue (bucket_id, name)
  select o.bucket_id, o.name
    from storage.objects o
   where (o.bucket_id in ('trip-media', 'trip-documents')
          and split_part(o.name, '/', 1) = 'trips'
          and split_part(o.name, '/', 2) = any (select t::text from unnest(v_deleted) t))
      or (o.bucket_id = 'instagram-exports'
          and split_part(o.name, '/', 1) = any (select t::text from unnest(v_deleted) t))
      or (o.bucket_id = 'avatars' and split_part(o.name, '/', 1) = p_user::text)
      or (o.bucket_id = 'trip-media' and o.name in (
            select unnest(array[m.storage_path, m.thumb_path]) from public.media m where m.uploaded_by = p_user))
      or (o.bucket_id = 'trip-documents' and o.name in (
            select d.file_path from public.documents d where d.uploaded_by = p_user and d.file_path is not null))
      or (o.bucket_id = 'instagram-exports' and o.name in (
            select e.trip_id::text || '/' || e.id::text || '.zip' from public.instagram_exports e where e.created_by = p_user))
  on conflict (bucket_id, name) do nothing;

  -- 3. Rows. Deleted trips cascade to their content.
  delete from public.trips where id = any (v_deleted);

  update public.profiles set premium_enabled_by = null where premium_enabled_by = p_user;
  update public.feature_controls set updated_by = null where updated_by = p_user;
  -- Entries written by this user as admin (admin_id is NOT NULL); entries
  -- about this user survive with target_id set to null by the FK.
  delete from public.admin_audit_log where admin_id = p_user;
  delete from public.documents where uploaded_by = p_user;
  delete from public.media where uploaded_by = p_user;
  delete from public.expenses where paid_by = p_user;
  delete from public.posts where author_id = p_user;
  delete from public.instagram_exports where created_by = p_user;
  delete from public.ai_usage where user_id = p_user;
  delete from public.trip_members where user_id = p_user;

  perform set_config('motonui.allow_structural_update', 'off', true);

  return jsonb_build_object('transferred_trips', v_moved, 'deleted_trips', coalesce(array_length(v_deleted, 1), 0));
end;
$$;

revoke all on function public.purge_user_data(uuid) from public, anon, authenticated;
grant execute on function public.purge_user_data(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- delete_my_account: same signature as 0014, now built on purge_user_data
-- -----------------------------------------------------------------------------

create or replace function public.delete_my_account(confirm_text text) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  v_result jsonb;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if coalesce(confirm_text, '') <> 'DELETE' then
    raise exception 'INVALID_CONFIRMATION';
  end if;

  v_result := public.purge_user_data(uid);

  -- Cascades to profiles, reminders, invites and the remaining memberships.
  delete from auth.users where id = uid;

  return v_result || jsonb_build_object('deleted', true);
end;
$$;

revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;
