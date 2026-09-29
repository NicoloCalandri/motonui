-- =============================================================================
-- RLS matrix (T-1.1, SR-SDLC-04, SR-AUTHZ-01/02).
--
-- For every table in `public` that has a trip_id column, checks SELECT,
-- INSERT, UPDATE and DELETE as four actors:
--   anon      no session
--   stranger  authenticated, member of another trip only
--   partner   member of the trip
--   owner     member and owner of the trip
-- plus meta checks (RLS enabled everywhere, WITH CHECK on every UPDATE policy)
-- and the non-trip tables that hold per-user or admin data.
--
-- A new trip table without a fixture below makes this test fail: add a row to
-- rls_matrix.fixture (and to rls_matrix.expectation if it differs from the
-- default) in the same PR that adds the table.
--
-- Runs in one transaction that is rolled back. Any failure raises and aborts.
-- =============================================================================

begin;

create schema rls_matrix;
grant usage on schema rls_matrix to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function rls_matrix.act_as(p_role text, p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', p_role, true);
  perform set_config('request.jwt.claim.role', p_role, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  perform set_config('request.jwt.claims', json_build_object('role', p_role, 'sub', p_user)::text, true);
end;
$$;

-- Runs a statement and returns the affected/selected row count, or -1 if it
-- raised insufficient_privilege / RLS violation (42501). Changes are always
-- undone, so every check starts from the same fixtures.
create function rls_matrix.try_count(stmt text) returns int
language plpgsql as $$
declare
  n int;
begin
  begin
    if stmt ilike 'select%' then
      execute format('select count(*) from (%s) q', stmt) into n;
    else
      execute stmt;
      get diagnostics n = row_count;
    end if;
    raise exception using errcode = 'RLSMX', message = n::text;
  exception
    when sqlstate 'RLSMX' then
      return sqlerrm::int;
    when insufficient_privilege then
      return -1;
  end;
end;
$$;

create function rls_matrix.check(label text, actual int, expected int) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL % — got %, expected % (-1 = denied)', label, actual, expected;
  end if;
end;
$$;

grant execute on all functions in schema rls_matrix to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Actors and trips (as postgres)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@rls.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'partner@rls.test'),
  ('00000000-0000-0000-0000-0000000000c3', 'stranger@rls.test');

insert into public.profiles (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000c3')
on conflict (id) do nothing;

insert into public.trips (id, title, destination, owner_id) values
  ('10000000-0000-0000-0000-0000000000a1', 'Shared trip', 'Rapa Nui', '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-0000000000c3', 'Stranger trip', 'Elsewhere', '00000000-0000-0000-0000-0000000000c3');

insert into public.trip_members (id, trip_id, user_id, role) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'member'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c3', 'owner');

-- ---------------------------------------------------------------------------
-- One fixture row per trip table, all in the shared trip, created by the owner
-- ---------------------------------------------------------------------------

create table rls_matrix.fixture (
  table_name text primary key,
  pk_column  text not null default 'id',
  pk_value   uuid not null,
  -- Overrides applied when copying the row for the INSERT check (unique columns).
  copy_overrides jsonb not null default '{}'
);

insert into public.days (id, trip_id, date) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a1', '2026-10-01');
insert into public.legs (id, trip_id, type, from_name, to_name) values
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000a1', 'flight', 'Roma', 'Santiago');
insert into public.accommodations (id, trip_id, name) values
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000a1', 'Hotel');
insert into public.expenses (id, trip_id, description, amount, category, paid_by) values
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-0000000000a1', 'Dinner', 42, 'food', '00000000-0000-0000-0000-0000000000a1');
insert into public.posts (id, trip_id, author_id, title, slug) values
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'Draft', 'rls-matrix-draft');
insert into public.media (id, trip_id, uploaded_by, url) values
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'https://example.test/a.jpg');
insert into public.instagram_exports (id, trip_id, created_by, type, media_ids) values
  ('30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'carousel', array['30000000-0000-0000-0000-000000000006']::uuid[]);
insert into public.reminders (id, trip_id, user_id, entity_type, entity_id, type, remind_at, title) values
  ('30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'leg', '30000000-0000-0000-0000-000000000002', 'flight_checkin', now() + interval '1 day', 'Check-in');
insert into public.restaurants (id, trip_id, name) values
  ('30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-0000000000a1', 'Trattoria');
insert into public.activities (id, trip_id, name) values
  ('30000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-0000000000a1', 'Museo');
insert into public.documents (id, trip_id, uploaded_by, type, title, file_url) values
  ('30000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'ticket', 'Biglietto', 'https://example.test/t.pdf');
insert into public.baggage_items (id, trip_id, category) values
  ('30000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-0000000000a1', 'cabin_bag');
insert into public.packing_checklists (trip_id) values
  ('10000000-0000-0000-0000-0000000000a1');
insert into public.trip_invites (id, trip_id, invited_by, email, token_hash) values
  ('30000000-0000-0000-0000-00000000000d', '10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1',
   'someone@test.local', repeat('ab', 32));

insert into rls_matrix.fixture (table_name, pk_column, pk_value, copy_overrides) values
  ('trip_members',       'id',      '20000000-0000-0000-0000-000000000001', '{}'),
  ('days',               'id',      '30000000-0000-0000-0000-000000000001', '{}'),
  ('legs',               'id',      '30000000-0000-0000-0000-000000000002', '{}'),
  ('accommodations',     'id',      '30000000-0000-0000-0000-000000000003', '{}'),
  ('expenses',           'id',      '30000000-0000-0000-0000-000000000004', '{}'),
  ('posts',              'id',      '30000000-0000-0000-0000-000000000005', '{"slug": "rls-matrix-copy"}'),
  ('media',              'id',      '30000000-0000-0000-0000-000000000006', '{}'),
  ('instagram_exports',  'id',      '30000000-0000-0000-0000-000000000007', '{}'),
  ('reminders',          'id',      '30000000-0000-0000-0000-000000000008', '{}'),
  ('restaurants',        'id',      '30000000-0000-0000-0000-000000000009', '{}'),
  ('activities',         'id',      '30000000-0000-0000-0000-00000000000a', '{}'),
  ('documents',          'id',      '30000000-0000-0000-0000-00000000000b', '{}'),
  ('baggage_items',      'id',      '30000000-0000-0000-0000-00000000000c', '{}'),
  ('packing_checklists', 'trip_id', '10000000-0000-0000-0000-0000000000a1', '{}'),
  ('trip_invites',       'id',      '30000000-0000-0000-0000-00000000000d', '{"token_hash": "cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd"}');

-- Expected results for members. Defaults: can select, insert, update, delete
-- (1 row each). -1 = denied, 0 = filtered out, null = not checked (the copy
-- would collide with a primary key rather than exercise RLS).
create table rls_matrix.expectation (
  table_name     text primary key,
  partner_select int default 1,
  partner_insert int default 1,
  partner_update int default 1,
  partner_delete int default 1,
  owner_insert   int default 1,
  owner_update   int default 1,
  owner_delete   int default 1
);

insert into rls_matrix.expectation (table_name) select table_name from rls_matrix.fixture;

-- Membership: only the trip owner adds members; nobody edits a membership;
-- a member removes only itself (the fixture row is the owner's).
update rls_matrix.expectation
   set partner_insert = -1, partner_update = 0, partner_delete = 0,
       owner_insert = null, owner_update = 0
 where table_name = 'trip_members';
-- Posts belong to their author.
update rls_matrix.expectation
   set partner_insert = -1, partner_update = 0, partner_delete = 0
 where table_name = 'posts';
-- Reminders are private to their user, even within the trip.
update rls_matrix.expectation
   set partner_select = 0, partner_insert = -1, partner_update = 0, partner_delete = 0
 where table_name = 'reminders';
-- Instagram exports have no DELETE policy (cleanup runs with the service role).
update rls_matrix.expectation
   set partner_delete = 0, owner_delete = 0
 where table_name = 'instagram_exports';
-- One checklist per trip: a copy would hit the primary key.
update rls_matrix.expectation
   set partner_insert = null, owner_insert = null
 where table_name = 'packing_checklists';

-- Invites: members read them, only the owner revokes; creation and
-- acceptance go through SECURITY DEFINER RPCs (no client INSERT/UPDATE grant).
update rls_matrix.expectation
   set partner_insert = -1, partner_update = -1, partner_delete = 0,
       owner_insert = -1, owner_update = -1
 where table_name = 'trip_invites';

grant select on rls_matrix.fixture, rls_matrix.expectation to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Meta checks
-- ---------------------------------------------------------------------------

do $$
declare
  missing text;
begin
  select string_agg(c.relname, ', ') into missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if missing is not null then
    raise exception 'FAIL tables without RLS: %', missing;
  end if;

  select string_agg(tablename || '.' || policyname, ', ') into missing
  from pg_policies
  where schemaname = 'public' and cmd = 'UPDATE' and with_check is null;
  if missing is not null then
    raise exception 'FAIL UPDATE policies without WITH CHECK: %', missing;
  end if;

  select string_agg(c.table_name, ', ') into missing
  from information_schema.columns c
  join information_schema.tables t using (table_schema, table_name)
  where c.table_schema = 'public' and c.column_name = 'trip_id' and t.table_type = 'BASE TABLE'
    and not exists (select 1 from rls_matrix.fixture f where f.table_name = c.table_name);
  if missing is not null then
    raise exception 'FAIL trip tables without an RLS matrix fixture: % (add one to supabase/tests/rls_matrix.test.sql)', missing;
  end if;

  raise notice 'ok   meta: RLS enabled everywhere, UPDATE policies have WITH CHECK, all trip tables covered';
end;
$$;

-- ---------------------------------------------------------------------------
-- Matrix
-- ---------------------------------------------------------------------------

-- Row copies for the INSERT check, built as postgres (new id, same trip).
create table rls_matrix.copy_source (table_name text primary key, source jsonb not null);

create function rls_matrix.run_actor(actor text, p_role text, p_user uuid) returns void
language plpgsql as $$
declare
  f record;
  e record;
  where_pk text;
  copy_row jsonb;
  insert_stmt text;
begin
  perform rls_matrix.act_as(p_role, p_user);

  for f in select * from rls_matrix.fixture order by table_name loop
    select * into e from rls_matrix.expectation where table_name = f.table_name;
    where_pk := format('%I = %L', f.pk_column, f.pk_value);

    -- The copy is prepared by the caller (postgres) in rls_matrix.copy_source,
    -- because outsiders cannot read the original row.
    select source into copy_row from rls_matrix.copy_source where table_name = f.table_name;
    insert_stmt := format(
      'insert into public.%I select * from jsonb_populate_record(null::public.%I, %L::jsonb)',
      f.table_name, f.table_name, copy_row
    );

    if actor in ('anon', 'stranger') then
      perform rls_matrix.check(actor || ' select ' || f.table_name,
        greatest(rls_matrix.try_count(format('select 1 from public.%I where %s', f.table_name, where_pk)), 0), 0);
      perform rls_matrix.check(actor || ' update ' || f.table_name,
        greatest(rls_matrix.try_count(format('update public.%I set %I = %I where %s', f.table_name, f.pk_column, f.pk_column, where_pk)), 0), 0);
      perform rls_matrix.check(actor || ' delete ' || f.table_name,
        greatest(rls_matrix.try_count(format('delete from public.%I where %s', f.table_name, where_pk)), 0), 0);
      if f.pk_column = 'id' then
        perform rls_matrix.check(actor || ' insert ' || f.table_name, rls_matrix.try_count(insert_stmt), -1);
      end if;
    else
      perform rls_matrix.check(actor || ' select ' || f.table_name,
        rls_matrix.try_count(format('select 1 from public.%I where %s', f.table_name, where_pk)),
        case when actor = 'partner' then e.partner_select else 1 end);
      perform rls_matrix.check(actor || ' update ' || f.table_name,
        rls_matrix.try_count(format('update public.%I set %I = %I where %s', f.table_name, f.pk_column, f.pk_column, where_pk)),
        case when actor = 'partner' then e.partner_update else e.owner_update end);
      perform rls_matrix.check(actor || ' delete ' || f.table_name,
        rls_matrix.try_count(format('delete from public.%I where %s', f.table_name, where_pk)),
        case when actor = 'partner' then e.partner_delete else e.owner_delete end);
      if (case when actor = 'partner' then e.partner_insert else e.owner_insert end) is not null then
        perform rls_matrix.check(actor || ' insert ' || f.table_name, rls_matrix.try_count(insert_stmt),
          case when actor = 'partner' then e.partner_insert else e.owner_insert end);
      end if;
    end if;
  end loop;

  raise notice 'ok   matrix as %', actor;
end;
$$;

do $$
declare
  f record;
  src jsonb;
begin
  for f in select * from rls_matrix.fixture loop
    execute format('select to_jsonb(t) from public.%I t where %I = %L', f.table_name, f.pk_column, f.pk_value) into src;
    if src is null then
      raise exception 'FAIL fixture row missing for %', f.table_name;
    end if;
    src := src || f.copy_overrides;
    if f.pk_column = 'id' then
      src := src || jsonb_build_object('id', gen_random_uuid());
    end if;
    insert into rls_matrix.copy_source (table_name, source) values (f.table_name, src);
  end loop;
end;
$$;

grant select on rls_matrix.copy_source to anon, authenticated;
grant execute on all functions in schema rls_matrix to anon, authenticated;

select rls_matrix.run_actor('anon',     'anon',          null);
reset role;
select rls_matrix.run_actor('stranger', 'authenticated', '00000000-0000-0000-0000-0000000000c3');
reset role;
select rls_matrix.run_actor('partner',  'authenticated', '00000000-0000-0000-0000-0000000000b2');
reset role;
select rls_matrix.run_actor('owner',    'authenticated', '00000000-0000-0000-0000-0000000000a1');
reset role;

-- ---------------------------------------------------------------------------
-- Per-user and admin tables
-- ---------------------------------------------------------------------------

insert into public.admin_audit_log (admin_id, action, target_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'view_profile', '00000000-0000-0000-0000-0000000000b2');
insert into public.impersonation_tokens (admin_id, target_id, token, expires_at) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'rls-matrix-token', now() + interval '30 minutes');
insert into public.usage_counters (user_id, feature_key, period_type, period_start) values
  ('00000000-0000-0000-0000-0000000000a1', 'ai_blog', 'day', current_date);
insert into public.ai_usage (user_id, call_type) values
  ('00000000-0000-0000-0000-0000000000a1', 'blog');

do $$
begin
  perform rls_matrix.act_as('authenticated', '00000000-0000-0000-0000-0000000000c3');
  perform rls_matrix.check('stranger reads another profile',
    greatest(rls_matrix.try_count($q$select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'$q$), 0), 0);
  perform rls_matrix.check('non-admin reads audit log',
    greatest(rls_matrix.try_count('select 1 from public.admin_audit_log'), 0), 0);
  perform rls_matrix.check('non-admin reads impersonation tokens',
    greatest(rls_matrix.try_count('select 1 from public.impersonation_tokens'), 0), 0);
  perform rls_matrix.check('non-admin reads feature controls',
    greatest(rls_matrix.try_count('select 1 from public.feature_controls'), 0), 0);
  perform rls_matrix.check('user reads another user''s usage counters',
    greatest(rls_matrix.try_count('select 1 from public.usage_counters'), 0), 0);
  perform rls_matrix.check('user reads another user''s ai_usage',
    greatest(rls_matrix.try_count('select 1 from public.ai_usage'), 0), 0);
  perform rls_matrix.check('user writes own usage counter',
    rls_matrix.try_count($q$insert into public.usage_counters (user_id, feature_key, period_type, period_start) values ('00000000-0000-0000-0000-0000000000c3', 'ai_blog', 'day', current_date)$q$), -1);
  perform rls_matrix.check('user grants itself an entitlement',
    rls_matrix.try_count($q$insert into public.feature_entitlements (user_id, feature_key) values ('00000000-0000-0000-0000-0000000000c3', 'ai_blog')$q$), -1);
  perform rls_matrix.check('user writes the audit log',
    rls_matrix.try_count($q$insert into public.admin_audit_log (admin_id, action) values ('00000000-0000-0000-0000-0000000000c3', 'view_profile')$q$), -1);
  perform set_config('role', 'postgres', true);

  perform rls_matrix.act_as('anon', null);
  perform rls_matrix.check('anon reads profiles',
    greatest(rls_matrix.try_count('select 1 from public.profiles'), 0), 0);
  perform rls_matrix.check('anon reads currency rates',
    greatest(rls_matrix.try_count('select 1 from public.currency_rates'), 0), 0);
  perform rls_matrix.check('anon reads a draft post',
    greatest(rls_matrix.try_count('select 1 from public.posts where status = ''draft'''), 0), 0);

  perform set_config('role', 'postgres', true);

  -- trips itself (not in the matrix: it has no trip_id column)
  perform rls_matrix.act_as('authenticated', '00000000-0000-0000-0000-0000000000c3');
  perform rls_matrix.check('stranger selects the trip',
    greatest(rls_matrix.try_count($q$select 1 from public.trips where id = '10000000-0000-0000-0000-0000000000a1'$q$), 0), 0);
  perform rls_matrix.check('stranger updates the trip',
    greatest(rls_matrix.try_count($q$update public.trips set title = 'x' where id = '10000000-0000-0000-0000-0000000000a1'$q$), 0), 0);
  perform rls_matrix.check('stranger deletes the trip',
    greatest(rls_matrix.try_count($q$delete from public.trips where id = '10000000-0000-0000-0000-0000000000a1'$q$), 0), 0);
  perform rls_matrix.check('stranger creates a trip owned by someone else',
    rls_matrix.try_count($q$insert into public.trips (title, destination, owner_id) values ('x', 'y', '00000000-0000-0000-0000-0000000000a1')$q$), -1);
  perform set_config('role', 'postgres', true);

  perform rls_matrix.act_as('authenticated', '00000000-0000-0000-0000-0000000000b2');
  perform rls_matrix.check('partner updates the trip',
    rls_matrix.try_count($q$update public.trips set title = 'x' where id = '10000000-0000-0000-0000-0000000000a1'$q$), 1);
  perform rls_matrix.check('partner deletes the trip',
    rls_matrix.try_count($q$delete from public.trips where id = '10000000-0000-0000-0000-0000000000a1'$q$), 0);
  perform set_config('role', 'postgres', true);

  perform rls_matrix.act_as('authenticated', '00000000-0000-0000-0000-0000000000a1');
  perform rls_matrix.check('owner deletes the trip',
    rls_matrix.try_count($q$delete from public.trips where id = '10000000-0000-0000-0000-0000000000a1'$q$), 1);
  perform set_config('role', 'postgres', true);

  raise notice 'ok   per-user, admin and trips tables';
end;
$$;

rollback;
