-- =============================================================================
-- Regression test for migration 0022 (T-2.9): account deletion transfers
-- shared trips to the partner, deletes solo trips, and queues every storage
-- object of deleted data (and nothing of the partner's). Rolled back.
--
--   S  owned by A, A alone                → deleted
--   T  owned by A, B member               → transferred to B
--   U  owned by B, A member               → A leaves, trip stays
-- =============================================================================

begin;

create schema del_test;
grant usage on schema del_test to anon, authenticated;

create function del_test.act_as(p_role text, p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', p_role, true);
  perform set_config('request.jwt.claim.role', p_role, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  perform set_config('request.jwt.claims', json_build_object('role', p_role, 'sub', p_user)::text, true);
end;
$$;

create function del_test.expect_error(label text, stmt text, state text) returns void
language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate <> state then
      raise exception 'FAIL % — raised % (%), expected %', label, sqlstate, sqlerrm, state;
    end if;
    raise notice 'ok   %', label;
    return;
  end;
  raise exception 'FAIL % — statement succeeded: %', label, stmt;
end;
$$;

grant execute on all functions in schema del_test to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

insert into public.profiles (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b')
on conflict (id) do nothing;

-- B (as admin) viewed A: this audit entry must survive A's deletion.
insert into public.admin_audit_log (admin_id, action, target_id, metadata) values
  ('00000000-0000-0000-0000-00000000000b', 'view_profile', '00000000-0000-0000-0000-00000000000a', '{"email": "a@test.local"}');

insert into public.trips (id, title, destination, owner_id) values
  ('10000000-0000-0000-0000-0000000000a5', 'Solo', 'X', '00000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-0000000000a7', 'Shared by A', 'Y', '00000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-0000000000b0', 'Shared by B', 'Z', '00000000-0000-0000-0000-00000000000b');

insert into public.trip_members (trip_id, user_id, role) values
  ('10000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('10000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('10000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-00000000000b', 'member'),
  ('10000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-00000000000b', 'owner'),
  ('10000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-00000000000a', 'member')
on conflict do nothing;

insert into public.media (trip_id, uploaded_by, storage_path, thumb_path) values
  ('10000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-00000000000a',
   'trips/10000000-0000-0000-0000-0000000000a5/original/s.webp', null),
  ('10000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-00000000000a',
   'trips/10000000-0000-0000-0000-0000000000a7/original/a.webp', 'trips/10000000-0000-0000-0000-0000000000a7/thumbs/a.webp'),
  ('10000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-00000000000b',
   'trips/10000000-0000-0000-0000-0000000000a7/original/b.webp', null);

insert into public.documents (trip_id, uploaded_by, type, title, file_path) values
  ('10000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-00000000000a', 'ticket', 'A doc',
   'trips/10000000-0000-0000-0000-0000000000b0/documents/a.pdf');

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true), ('instagram-exports', 'instagram-exports', false)
on conflict (id) do nothing;

insert into storage.objects (bucket_id, name) values
  ('trip-media', 'trips/10000000-0000-0000-0000-0000000000a5/original/s.webp'),
  ('trip-documents', 'trips/10000000-0000-0000-0000-0000000000a5/boarding-passes/leg-x.pdf'),
  ('instagram-exports', '10000000-0000-0000-0000-0000000000a5/e.zip'),
  ('trip-media', 'trips/10000000-0000-0000-0000-0000000000a7/original/a.webp'),
  ('trip-media', 'trips/10000000-0000-0000-0000-0000000000a7/thumbs/a.webp'),
  ('trip-media', 'trips/10000000-0000-0000-0000-0000000000a7/original/b.webp'),
  ('trip-documents', 'trips/10000000-0000-0000-0000-0000000000b0/documents/a.pdf'),
  ('avatars', '00000000-0000-0000-0000-00000000000a/avatar.png'),
  ('avatars', '00000000-0000-0000-0000-00000000000b/avatar.png');

-- Clients cannot run the purge for someone else.
select del_test.act_as('authenticated', '00000000-0000-0000-0000-00000000000b');
select del_test.expect_error('authenticated cannot call purge_user_data',
  $q$select public.purge_user_data('00000000-0000-0000-0000-00000000000a')$q$, '42501');
select del_test.expect_error('clients cannot read the deletion queue',
  $q$select * from public.storage_deletion_queue$q$, '42501');

select del_test.act_as('authenticated', '00000000-0000-0000-0000-00000000000a');
select del_test.expect_error('confirmation required',
  $q$select public.delete_my_account('yes')$q$, 'P0001');

select public.delete_my_account('DELETE');

reset role;

do $$
declare
  v_queue text[];
begin
  if exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000a') then
    raise exception 'FAIL user A still exists';
  end if;
  if exists (select 1 from public.trips where id = '10000000-0000-0000-0000-0000000000a5') then
    raise exception 'FAIL solo trip S must be deleted';
  end if;
  if not exists (select 1 from public.trips where id = '10000000-0000-0000-0000-0000000000a7'
                 and owner_id = '00000000-0000-0000-0000-00000000000b') then
    raise exception 'FAIL shared trip T must be transferred to B';
  end if;
  if not exists (select 1 from public.trip_members where trip_id = '10000000-0000-0000-0000-0000000000a7'
                 and user_id = '00000000-0000-0000-0000-00000000000b' and role = 'owner') then
    raise exception 'FAIL B must become owner member of T';
  end if;
  if not exists (select 1 from public.trips where id = '10000000-0000-0000-0000-0000000000b0')
     or exists (select 1 from public.trip_members where user_id = '00000000-0000-0000-0000-00000000000a') then
    raise exception 'FAIL trip U must stay, without A';
  end if;
  if not exists (select 1 from public.media where uploaded_by = '00000000-0000-0000-0000-00000000000b') then
    raise exception 'FAIL the partner''s photos must stay';
  end if;
  raise notice 'ok   solo trip deleted, shared trip transferred, partner data kept';

  if not exists (select 1 from public.admin_audit_log
                 where admin_id = '00000000-0000-0000-0000-00000000000b' and target_id is null
                   and metadata ->> 'email' = 'a@test.local') then
    raise exception 'FAIL audit entries about the deleted user must be kept';
  end if;
  raise notice 'ok   audit history about the deleted user kept';

  select array_agg(bucket_id || ':' || name order by bucket_id, name) into v_queue from public.storage_deletion_queue;
  if v_queue is distinct from array[
    'avatars:00000000-0000-0000-0000-00000000000a/avatar.png',
    'instagram-exports:10000000-0000-0000-0000-0000000000a5/e.zip',
    'trip-documents:trips/10000000-0000-0000-0000-0000000000a5/boarding-passes/leg-x.pdf',
    'trip-documents:trips/10000000-0000-0000-0000-0000000000b0/documents/a.pdf',
    'trip-media:trips/10000000-0000-0000-0000-0000000000a5/original/s.webp',
    'trip-media:trips/10000000-0000-0000-0000-0000000000a7/original/a.webp',
    'trip-media:trips/10000000-0000-0000-0000-0000000000a7/thumbs/a.webp'
  ] then
    raise exception 'FAIL unexpected deletion queue: %', v_queue;
  end if;
  raise notice 'ok   queue holds every file of A and none of B';
end;
$$;

-- The structural bypass does not outlive the purge.
select del_test.act_as('authenticated', '00000000-0000-0000-0000-00000000000b');
select del_test.expect_error('owner_id still immutable for clients after a purge',
  $q$update public.trips set owner_id = '00000000-0000-0000-0000-00000000000a' where id = '10000000-0000-0000-0000-0000000000a7'$q$, '42501');

rollback;
