-- =============================================================================
-- Regression test for migration 0016 (Phase 0: T-0.4, T-0.5, T-0.6).
-- Covers REVIEW.md findings S-02, S-03, S-04.
--
-- Run against a disposable database with all migrations applied, e.g. local
-- Supabase:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/0016_phase0_rls.test.sql
-- Everything runs in a transaction that is rolled back at the end.
-- Any failed assertion raises an exception and aborts the script.
-- The full RLS suite in CI is T-1.1.
-- =============================================================================

begin;

create schema rls_test;
grant usage on schema rls_test to anon, authenticated;

-- Runs `stmt` and fails the test unless it raises.
create function rls_test.expect_error(label text, stmt text) returns void
language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok   % (%)', label, sqlerrm;
    return;
  end;
  raise exception 'FAIL % — statement succeeded: %', label, stmt;
end;
$$;

-- Runs `stmt` (an UPDATE/DELETE) and fails the test unless it affected `expected` rows.
create function rls_test.expect_rows(label text, stmt text, expected int) returns void
language plpgsql as $$
declare
  n int;
begin
  execute stmt;
  get diagnostics n = row_count;
  if n <> expected then
    raise exception 'FAIL % — % rows affected, expected %', label, n, expected;
  end if;
  raise notice 'ok   %', label;
end;
$$;

grant execute on all functions in schema rls_test to anon, authenticated;

-- Acts as a given user for the rest of the transaction (or until the next call).
create function rls_test.act_as(p_role text, p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.role', p_role, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  perform set_config('request.jwt.claims',
    json_build_object('role', p_role, 'sub', p_user)::text, true);
end;
$$;

grant execute on function rls_test.act_as(text, uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Fixtures (as postgres): owner, partner, stranger; one shared trip.
-- -----------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'partner@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'stranger@test.local');

-- handle_new_user() normally creates these; be explicit in case the trigger
-- is not installed on this instance.
insert into public.profiles (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c')
on conflict (id) do nothing;

insert into public.trips (id, title, destination, owner_id) values
  ('10000000-0000-0000-0000-000000000001', 'Trip', 'Rapa Nui', '00000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-000000000002', 'Other trip', 'Elsewhere', '00000000-0000-0000-0000-00000000000c');

insert into public.trip_members (trip_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'member'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'owner');

insert into public.media (id, trip_id, uploaded_by, url) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-00000000000a', 'https://x.supabase.co/storage/v1/object/public/trip-media/trips/1/a.jpg');

insert into public.expenses (id, trip_id, description, amount, category, paid_by) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'Dinner', 42, 'food', '00000000-0000-0000-0000-00000000000a');

-- -----------------------------------------------------------------------------
-- T-0.4 — profiles (S-02)
-- -----------------------------------------------------------------------------
set local role authenticated;
select rls_test.act_as('authenticated', '00000000-0000-0000-0000-00000000000c');

select rls_test.expect_error('user cannot set role=admin',
  $$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c'$$);
select rls_test.expect_error('user cannot set plan=premium',
  $$update public.profiles set plan = 'premium' where id = '00000000-0000-0000-0000-00000000000c'$$);
select rls_test.expect_error('user cannot set premium_until',
  $$update public.profiles set premium_until = now() + interval '1 year' where id = '00000000-0000-0000-0000-00000000000c'$$);
select rls_test.expect_error('user cannot clear suspended_at',
  $$update public.profiles set suspended_at = null where id = '00000000-0000-0000-0000-00000000000c'$$);
select rls_test.expect_rows('user can change own display_name',
  $$update public.profiles set display_name = 'Giorgia' where id = '00000000-0000-0000-0000-00000000000c'$$, 1);
select rls_test.expect_rows('user cannot change another profile',
  $$update public.profiles set display_name = 'x' where id = '00000000-0000-0000-0000-00000000000a'$$, 0);

-- -----------------------------------------------------------------------------
-- T-0.5 — admin_user_view (S-03)
-- -----------------------------------------------------------------------------
select rls_test.expect_error('authenticated cannot read admin_user_view',
  $$select * from public.admin_user_view$$);

reset role;
set local role anon;
select rls_test.act_as('anon', null);
select rls_test.expect_error('anon cannot read admin_user_view',
  $$select * from public.admin_user_view$$);

-- -----------------------------------------------------------------------------
-- T-0.6 — structural columns (S-04), as the partner
-- -----------------------------------------------------------------------------
reset role;
set local role authenticated;
select rls_test.act_as('authenticated', '00000000-0000-0000-0000-00000000000b');

select rls_test.expect_error('partner cannot take trip ownership',
  $$update public.trips set owner_id = '00000000-0000-0000-0000-00000000000b' where id = '10000000-0000-0000-0000-000000000001'$$);
select rls_test.expect_rows('partner can still edit the trip title',
  $$update public.trips set title = 'Renamed' where id = '10000000-0000-0000-0000-000000000001'$$, 1);
select rls_test.expect_error('member cannot rewrite media.url',
  $$update public.media set url = 'https://x.supabase.co/storage/v1/object/public/trip-media/trips/2/b.jpg' where id = '20000000-0000-0000-0000-000000000001'$$);
select rls_test.expect_error('member cannot move media to another trip',
  $$update public.media set trip_id = '10000000-0000-0000-0000-000000000002' where id = '20000000-0000-0000-0000-000000000001'$$);
select rls_test.expect_rows('member can edit media caption',
  $$update public.media set caption = 'Sunset' where id = '20000000-0000-0000-0000-000000000001'$$, 1);
select rls_test.expect_error('member cannot move an expense to another trip',
  $$update public.expenses set trip_id = '10000000-0000-0000-0000-000000000002' where id = '30000000-0000-0000-0000-000000000001'$$);
select rls_test.expect_error('payer must be a trip member (update)',
  $$update public.expenses set paid_by = '00000000-0000-0000-0000-00000000000c' where id = '30000000-0000-0000-0000-000000000001'$$);
select rls_test.expect_rows('payer can be changed to the other member',
  $$update public.expenses set paid_by = '00000000-0000-0000-0000-00000000000b' where id = '30000000-0000-0000-0000-000000000001'$$, 1);
select rls_test.expect_error('payer must be a trip member (insert)',
  $$insert into public.expenses (trip_id, description, amount, category, paid_by) values ('10000000-0000-0000-0000-000000000001', 'x', 1, 'food', '00000000-0000-0000-0000-00000000000c')$$);

-- The stranger still sees nothing of the trip.
select rls_test.act_as('authenticated', '00000000-0000-0000-0000-00000000000c');
select rls_test.expect_rows('stranger cannot update the trip',
  $$update public.trips set title = 'x' where id = '10000000-0000-0000-0000-000000000001'$$, 0);

-- -----------------------------------------------------------------------------
-- Service role and migrations are not restricted by the trigger.
-- -----------------------------------------------------------------------------
reset role;
select rls_test.act_as('service_role', null);
select rls_test.expect_rows('service role can transfer ownership',
  $$update public.trips set owner_id = '00000000-0000-0000-0000-00000000000b' where id = '10000000-0000-0000-0000-000000000001'$$, 1);
select rls_test.expect_rows('service role can set plan',
  $$update public.profiles set plan = 'premium' where id = '00000000-0000-0000-0000-00000000000c'$$, 1);

-- -----------------------------------------------------------------------------
-- Meta checks: every UPDATE policy in public has WITH CHECK, and every
-- SECURITY DEFINER function in public pins search_path.
-- -----------------------------------------------------------------------------
do $$
declare
  missing text;
begin
  select string_agg(tablename || '.' || policyname, ', ') into missing
  from pg_policies
  where schemaname = 'public' and cmd = 'UPDATE' and with_check is null;
  if missing is not null then
    raise exception 'FAIL UPDATE policies without WITH CHECK: %', missing;
  end if;
  raise notice 'ok   all UPDATE policies have WITH CHECK';

  select string_agg(p.proname, ', ') into missing
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  if missing is not null then
    raise exception 'FAIL SECURITY DEFINER functions without search_path: %', missing;
  end if;
  raise notice 'ok   all SECURITY DEFINER functions pin search_path';
end;
$$;

rollback;
