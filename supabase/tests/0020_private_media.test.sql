-- =============================================================================
-- Regression test for migration 0020 (T-2.1, T-2.3): private trip-media,
-- member-only object reads, trip-pinned and immutable storage paths,
-- https-only document links. Rolled back at the end.
-- =============================================================================

begin;

create schema pm_test;
grant usage on schema pm_test to anon, authenticated;

create function pm_test.act_as(p_role text, p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', p_role, true);
  perform set_config('request.jwt.claim.role', p_role, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  perform set_config('request.jwt.claims', json_build_object('role', p_role, 'sub', p_user)::text, true);
end;
$$;

-- Fails unless `stmt` raises with the given SQLSTATE.
create function pm_test.expect_error(label text, stmt text, state text) returns void
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

create function pm_test.expect_count(label text, query text, expected int) returns void
language plpgsql as $$
declare
  n int;
begin
  execute format('select count(*) from (%s) q', query) into n;
  if n <> expected then
    raise exception 'FAIL % — % rows, expected %', label, n, expected;
  end if;
  raise notice 'ok   %', label;
end;
$$;

grant execute on all functions in schema pm_test to anon, authenticated;

-- Fixtures: owner and partner share trip A; stranger owns trip B.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'partner@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'stranger@test.local');

insert into public.trips (id, title, destination, owner_id) values
  ('10000000-0000-0000-0000-00000000000a', 'A', 'Rapa Nui', '00000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-00000000000c', 'B', 'Tahiti', '00000000-0000-0000-0000-00000000000c');

insert into public.trip_members (trip_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'member'),
  ('10000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000c', 'owner')
on conflict do nothing;

insert into storage.objects (bucket_id, name) values
  ('trip-media', 'trips/10000000-0000-0000-0000-00000000000a/original/a.jpg'),
  ('trip-media', 'trips/10000000-0000-0000-0000-00000000000c/original/c.jpg'),
  ('trip-media', 'trips/not-a-uuid/original/x.jpg'),
  ('trip-media', 'loose.jpg');

insert into public.media (id, trip_id, uploaded_by, storage_path) values
  ('30000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-00000000000a', 'trips/10000000-0000-0000-0000-00000000000a/original/a.jpg');

grant select on all tables in schema pm_test to anon, authenticated;

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'trip-media' and public = false) then
    raise exception 'FAIL trip-media bucket missing or public';
  end if;
  raise notice 'ok   trip-media bucket is private';

  if (select array_agg(policyname::text || ':' || cmd order by policyname) from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and (coalesce(qual, '') || coalesce(with_check, '')) like '%trip-media%')
     is distinct from array['trip_media_member_select:SELECT'] then
    raise exception 'FAIL trip-media must have exactly one client policy (member SELECT)';
  end if;
  raise notice 'ok   only the member SELECT policy touches trip-media';
end;
$$;

-- Object reads ---------------------------------------------------------------

select pm_test.act_as('authenticated', '00000000-0000-0000-0000-00000000000b');
select pm_test.expect_count('partner reads own trip objects only (bad folder names ignored)',
  $q$select 1 from storage.objects where bucket_id = 'trip-media'$q$, 1);

select pm_test.act_as('authenticated', '00000000-0000-0000-0000-00000000000c');
select pm_test.expect_count('stranger does not see trip A objects',
  $q$select 1 from storage.objects where bucket_id = 'trip-media' and name like 'trips/10000000-0000-0000-0000-00000000000a/%'$q$, 0);

select pm_test.act_as('anon', null);
select pm_test.expect_count('anon sees no trip-media object',
  $q$select 1 from storage.objects where bucket_id = 'trip-media'$q$, 0);

-- Paths pinned to the row's trip, immutable for clients -------------------------

select pm_test.act_as('authenticated', '00000000-0000-0000-0000-00000000000a');

select pm_test.expect_error('media path of another trip rejected',
  $q$insert into public.media (trip_id, uploaded_by, storage_path) values
     ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a',
      'trips/10000000-0000-0000-0000-00000000000c/original/c.jpg')$q$, '23514');

select pm_test.expect_error('media path traversal rejected',
  $q$insert into public.media (trip_id, uploaded_by, storage_path) values
     ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a',
      'trips/10000000-0000-0000-0000-00000000000a/../10000000-0000-0000-0000-00000000000c/original/c.jpg')$q$, '23514');

select pm_test.expect_error('media thumb path of another trip rejected',
  $q$insert into public.media (trip_id, uploaded_by, storage_path, thumb_path) values
     ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a',
      'trips/10000000-0000-0000-0000-00000000000a/original/b.jpg',
      'trips/10000000-0000-0000-0000-00000000000c/thumbs/c.webp')$q$, '23514');

select pm_test.expect_error('media without file or link rejected',
  $q$insert into public.media (trip_id, uploaded_by) values
     ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a')$q$, '23514');

select pm_test.expect_error('media storage_path immutable for clients',
  $q$update public.media set storage_path = 'trips/10000000-0000-0000-0000-00000000000a/original/other.jpg'
     where id = '30000000-0000-0000-0000-00000000000a'$q$, '42501');

select pm_test.expect_error('document javascript: link rejected',
  $q$insert into public.documents (trip_id, uploaded_by, type, title, file_url) values
     ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'ticket', 'x', 'javascript:alert(1)')$q$, '23514');

select pm_test.expect_error('document file of another trip rejected',
  $q$insert into public.documents (trip_id, uploaded_by, type, title, file_path) values
     ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'ticket', 'x',
      'trips/10000000-0000-0000-0000-00000000000c/documents/abc.pdf')$q$, '23514');

do $$
begin
  insert into public.documents (trip_id, uploaded_by, type, title, file_path) values
    ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'ticket', 'ok',
     'trips/10000000-0000-0000-0000-00000000000a/documents/0f8e1c2a-aaaa-bbbb-cccc-000000000001.pdf');
  insert into public.media (trip_id, uploaded_by, url) values
    ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'https://example.com/x.jpg');
  raise notice 'ok   valid document file and external media link accepted';
end;
$$;

rollback;
