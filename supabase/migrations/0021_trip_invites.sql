-- =============================================================================
-- motonui — Partner invites and a two-member limit
-- Migration: 0021_trip_invites.sql
--
-- T-2.5 (docs/tasks.md) — SR-AUTHZ-09, PRD FR-02.
-- - A trip has at most two members, enforced by a trigger (not only the UI).
-- - create_trip(): trip + owner membership in one transaction, no service role.
-- - trip_invites: one pending invite per trip, token stored only as SHA-256,
--   valid 7 days, bound to the invited email.
-- - create_trip_invite() / accept_trip_invite(): SECURITY DEFINER RPCs; the
--   invitee cannot see the trip before accepting, so acceptance cannot be a
--   plain RLS insert.
-- - Clients can no longer add arbitrary users to trip_members: an owner can
--   only insert its own membership (mobile create flow); partners join
--   through accept_trip_invite().
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Two members per trip
-- -----------------------------------------------------------------------------

create or replace function public.enforce_trip_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- AFTER INSERT: runs only for rows RLS already accepted (WITH CHECK is
  -- evaluated after BEFORE triggers). Locking the trip serializes concurrent
  -- joins; the count then sees rows committed by the other transaction.
  perform 1 from public.trips where id = new.trip_id for update;

  if (select count(*) from public.trip_members where trip_id = new.trip_id) > 2 then
    raise exception 'TRIP_FULL: a trip has at most two members' using errcode = 'P0001';
  end if;
  return null;
end;
$$;

drop trigger if exists enforce_trip_member_limit on public.trip_members;
create trigger enforce_trip_member_limit after insert on public.trip_members
  for each row execute function public.enforce_trip_member_limit();

alter policy "trip_members_insert"
  on public.trip_members
  with check (user_id = auth.uid() and is_trip_owner(trip_id));

-- -----------------------------------------------------------------------------
-- create_trip
-- -----------------------------------------------------------------------------

create or replace function public.create_trip(
  p_title text,
  p_destination text,
  p_start_date date default null,
  p_end_date date default null,
  p_description text default null,
  p_cover_image text default null
)
returns public.trips
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_trip public.trips;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  insert into public.trips (title, destination, start_date, end_date, description, cover_image, owner_id)
  values (p_title, p_destination, p_start_date, p_end_date, p_description, p_cover_image, v_user)
  returning * into v_trip;

  insert into public.trip_members (trip_id, user_id, role) values (v_trip.id, v_user, 'owner');

  return v_trip;
end;
$$;

revoke all on function public.create_trip(text, text, date, date, text, text) from public, anon;
grant execute on function public.create_trip(text, text, date, date, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- trip_invites
-- -----------------------------------------------------------------------------

create table if not exists public.trip_invites (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  invited_by   uuid not null references auth.users(id) on delete cascade,
  email        text not null check (email = lower(email) and position('@' in email) > 1),
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users(id) on delete set null
);

create index if not exists idx_trip_invites_trip_id on public.trip_invites(trip_id);

comment on table public.trip_invites is
  'Partner invites (T-2.5). token_hash = sha256 hex of the token sent by email; the token itself is never stored.';

alter table public.trip_invites enable row level security;

-- Members see the trip's invites (pending state in the UI) and the owner can
-- revoke one. Creation and acceptance go through the RPCs below.
create policy "trip_invites_select" on public.trip_invites
  for select to authenticated using (is_trip_member(trip_id));
create policy "trip_invites_delete" on public.trip_invites
  for delete to authenticated using (is_trip_owner(trip_id) and accepted_at is null);

revoke insert, update on public.trip_invites from anon, authenticated;

-- -----------------------------------------------------------------------------
-- create_trip_invite: owner only, trip not full, replaces a pending invite
-- -----------------------------------------------------------------------------

create or replace function public.create_trip_invite(p_trip_id uuid, p_email text, p_token_hash text)
returns public.trip_invites
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_invite public.trip_invites;
begin
  if v_user is null or not exists (select 1 from public.trips where id = p_trip_id and owner_id = v_user) then
    raise exception 'FORBIDDEN: only the trip owner can invite' using errcode = '42501';
  end if;

  perform 1 from public.trips where id = p_trip_id for update;
  if (select count(*) from public.trip_members where trip_id = p_trip_id) >= 2 then
    raise exception 'TRIP_FULL: a trip has at most two members' using errcode = 'P0001';
  end if;

  delete from public.trip_invites where trip_id = p_trip_id and accepted_at is null;

  insert into public.trip_invites (trip_id, invited_by, email, token_hash)
  values (p_trip_id, v_user, lower(trim(p_email)), p_token_hash)
  returning * into v_invite;

  return v_invite;
end;
$$;

revoke all on function public.create_trip_invite(uuid, text, text) from public, anon;
grant execute on function public.create_trip_invite(uuid, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- accept_trip_invite: token + invited email, joins as member, single use
-- -----------------------------------------------------------------------------

create or replace function public.accept_trip_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_invite public.trip_invites;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  select * into v_invite from public.trip_invites
   where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
   for update;

  if not found or v_invite.accepted_at is not null or v_invite.expires_at < now() then
    raise exception 'INVITE_INVALID: invite not found, used or expired' using errcode = 'P0001';
  end if;

  select lower(email) into v_email from auth.users where id = v_user;
  if v_email is distinct from v_invite.email then
    raise exception 'INVITE_EMAIL_MISMATCH: invite sent to another address' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.trip_members where trip_id = v_invite.trip_id and user_id = v_user) then
    -- enforce_trip_member_limit raises TRIP_FULL on a third member.
    insert into public.trip_members (trip_id, user_id, role) values (v_invite.trip_id, v_user, 'member');
  end if;

  update public.trip_invites
     set accepted_at = now(), accepted_by = v_user
   where id = v_invite.id;

  return v_invite.trip_id;
end;
$$;

revoke all on function public.accept_trip_invite(text) from public, anon;
grant execute on function public.accept_trip_invite(text) to authenticated;

-- Structural columns (0016 pattern). No client UPDATE path exists, but keep
-- the invariant explicit for future policies.
drop trigger if exists prevent_structural_update on public.trip_invites;
create trigger prevent_structural_update before update on public.trip_invites
  for each row execute function public.prevent_structural_update(
    'id', 'trip_id', 'invited_by', 'email', 'token_hash', 'created_at'
  );
