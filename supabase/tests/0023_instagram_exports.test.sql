-- =============================================================================
-- Regression test for migration 0023 (T-2.7): private instagram-exports
-- bucket, zip_path pinned to its own export and immutable for clients.
-- Rolled back at the end.
-- =============================================================================

begin;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');
insert into public.trips (id, title, destination, owner_id) values
  ('10000000-0000-0000-0000-00000000000a', 'A', 'X', '00000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-00000000000c', 'C', 'Y', '00000000-0000-0000-0000-00000000000a');
insert into public.trip_members (trip_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'owner')
on conflict do nothing;
insert into public.instagram_exports (id, trip_id, created_by, type, media_ids, status) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-00000000000a', 'carousel', '{}', 'processing');

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'instagram-exports' and public = false) then
    raise exception 'FAIL instagram-exports bucket missing or public';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
             and (coalesce(qual, '') || coalesce(with_check, '')) like '%instagram-exports%') then
    raise exception 'FAIL a client policy still exposes instagram-exports';
  end if;
  raise notice 'ok   instagram-exports private, no client policy';

  begin
    update public.instagram_exports
       set zip_path = '10000000-0000-0000-0000-00000000000c/50000000-0000-0000-0000-000000000001.zip'
     where id = '50000000-0000-0000-0000-000000000001';
    raise exception 'FAIL zip_path of another trip accepted';
  exception when check_violation then
    raise notice 'ok   zip_path pinned to its own trip and export';
  end;

  update public.instagram_exports
     set zip_path = '10000000-0000-0000-0000-00000000000a/50000000-0000-0000-0000-000000000001.zip', status = 'ready'
   where id = '50000000-0000-0000-0000-000000000001';
  raise notice 'ok   server (no client role) writes the result';
end;
$$;

-- A member cannot point the job at another file or flip its status.
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a"}', true);

do $$
begin
  begin
    update public.instagram_exports set status = 'processing' where id = '50000000-0000-0000-0000-000000000001';
    raise exception 'FAIL client changed the export status';
  exception when insufficient_privilege then
    raise notice 'ok   status and zip_path immutable for clients';
  end;
end;
$$;

rollback;
