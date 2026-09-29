-- =============================================================================
-- Regression test for migration 0021 (T-2.5): create_trip, partner invites,
-- two-member limit. Nicolò (a) creates a trip and invites Giorgia (b); a third
-- person (c) cannot join. Rolled back at the end.
-- =============================================================================

begin;

create schema inv_test;
grant usage on schema inv_test to anon, authenticated;

create function inv_test.act_as(p_role text, p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', p_role, true);
  perform set_config('request.jwt.claim.role', p_role, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  perform set_config('request.jwt.claims', json_build_object('role', p_role, 'sub', p_user)::text, true);
end;
$$;

-- Fails unless `stmt` raises with SQLSTATE `state` and a message starting with `prefix`.
create function inv_test.expect_error(label text, stmt text, state text, prefix text default '') returns void
language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate <> state or sqlerrm not like prefix || '%' then
      raise exception 'FAIL % — raised % (%), expected % %', label, sqlstate, sqlerrm, state, prefix;
    end if;
    raise notice 'ok   %', label;
    return;
  end;
  raise exception 'FAIL % — statement succeeded: %', label, stmt;
end;
$$;

create function inv_test.hash(p_token text) returns text language sql as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
$$;

create table inv_test.state (key text primary key, value uuid);

grant execute on all functions in schema inv_test to anon, authenticated;
grant select, insert on inv_test.state to authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'nicolo@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'Giorgia@Test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'terzo@test.local');

-- 1. Nicolò creates the trip: trip and owner membership in one call.
select inv_test.act_as('authenticated', '00000000-0000-0000-0000-00000000000a');
insert into inv_test.state select 'trip', (public.create_trip('Rapa Nui', 'Isola di Pasqua')).id;

do $$
declare
  v_trip uuid := (select value from inv_test.state where key = 'trip');
begin
  if not exists (select 1 from public.trip_members
                 where trip_id = v_trip and user_id = '00000000-0000-0000-0000-00000000000a' and role = 'owner') then
    raise exception 'FAIL create_trip did not add the owner membership';
  end if;
  raise notice 'ok   create_trip adds the owner as member';
end;
$$;

select inv_test.expect_error('owner cannot add another user directly',
  format($q$insert into public.trip_members (trip_id, user_id, role) values (%L, '00000000-0000-0000-0000-00000000000c', 'member')$q$,
         (select value from inv_test.state where key = 'trip')), '42501');

select inv_test.expect_error('client cannot insert an invite directly',
  format($q$insert into public.trip_invites (trip_id, invited_by, email, token_hash) values (%L, auth.uid(), 'x@test.local', %L)$q$,
         (select value from inv_test.state where key = 'trip'), repeat('a', 64)), '42501');

-- 2. Only the owner invites.
select inv_test.act_as('authenticated', '00000000-0000-0000-0000-00000000000c');
select inv_test.expect_error('non-owner cannot invite',
  format($q$select public.create_trip_invite(%L, 'terzo@test.local', %L)$q$,
         (select value from inv_test.state where key = 'trip'), inv_test.hash('tok-c')), '42501', 'FORBIDDEN');

select inv_test.act_as('authenticated', '00000000-0000-0000-0000-00000000000a');
select public.create_trip_invite((select value from inv_test.state where key = 'trip'), ' GIORGIA@test.local ', inv_test.hash('tok-old'));
select public.create_trip_invite((select value from inv_test.state where key = 'trip'), 'giorgia@test.local', inv_test.hash('tok-b'));

do $$
begin
  if (select count(*) from public.trip_invites where accepted_at is null) <> 1 then
    raise exception 'FAIL a new invite must replace the pending one';
  end if;
  if exists (select 1 from public.trip_invites where token_hash !~ '^[0-9a-f]{64}$' or email <> 'giorgia@test.local') then
    raise exception 'FAIL invite must store only the hash and the normalized email';
  end if;
  raise notice 'ok   one pending invite, hashed token, normalized email';
end;
$$;

-- 3. Acceptance: right person, right token, once.
select inv_test.act_as('authenticated', '00000000-0000-0000-0000-00000000000c');
select inv_test.expect_error('invite bound to the invited email',
  $q$select public.accept_trip_invite('tok-b')$q$, 'P0001', 'INVITE_EMAIL_MISMATCH');

select inv_test.act_as('authenticated', '00000000-0000-0000-0000-00000000000b');
select inv_test.expect_error('replaced invite no longer valid',
  $q$select public.accept_trip_invite('tok-old')$q$, 'P0001', 'INVITE_INVALID');
select inv_test.expect_error('wrong token rejected',
  $q$select public.accept_trip_invite('tok-guess')$q$, 'P0001', 'INVITE_INVALID');

do $$
declare
  v_trip uuid := (select value from inv_test.state where key = 'trip');
begin
  if public.accept_trip_invite('tok-b') <> v_trip then
    raise exception 'FAIL accept_trip_invite must return the trip id';
  end if;
  if not exists (select 1 from public.trips where id = v_trip) then
    raise exception 'FAIL Giorgia must see the trip after accepting';
  end if;
  raise notice 'ok   Giorgia accepts and sees the trip';
end;
$$;

select inv_test.expect_error('invite is single use',
  $q$select public.accept_trip_invite('tok-b')$q$, 'P0001', 'INVITE_INVALID');

-- 4. Trip full: no third invite, no third member (even for the service role).
select inv_test.act_as('authenticated', '00000000-0000-0000-0000-00000000000a');
select inv_test.expect_error('third invite refused',
  format($q$select public.create_trip_invite(%L, 'terzo@test.local', %L)$q$,
         (select value from inv_test.state where key = 'trip'), inv_test.hash('tok-c')), 'P0001', 'TRIP_FULL');

reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
select inv_test.expect_error('third member refused by the trigger',
  format($q$insert into public.trip_members (trip_id, user_id, role) values (%L, '00000000-0000-0000-0000-00000000000c', 'member')$q$,
         (select value from inv_test.state where key = 'trip')), 'P0001', 'TRIP_FULL');

-- 5. Expired invites are refused.
insert into public.trips (id, title, destination, owner_id) values
  ('10000000-0000-0000-0000-0000000000e1', 'Tahiti', 'Tahiti', '00000000-0000-0000-0000-00000000000a');
insert into public.trip_invites (trip_id, invited_by, email, token_hash, expires_at) values
  ('10000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a', 'terzo@test.local',
   inv_test.hash('tok-expired'), now() - interval '1 minute');

select inv_test.act_as('authenticated', '00000000-0000-0000-0000-00000000000c');
select inv_test.expect_error('expired invite refused',
  $q$select public.accept_trip_invite('tok-expired')$q$, 'P0001', 'INVITE_INVALID');

select inv_test.act_as('anon', null);
select inv_test.expect_error('anon cannot call accept_trip_invite',
  $q$select public.accept_trip_invite('tok-expired')$q$, '42501');

rollback;
