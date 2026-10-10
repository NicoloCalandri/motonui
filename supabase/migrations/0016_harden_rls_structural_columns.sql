-- =============================================================================
-- motonui — Phase 0 containment: profile privileges, admin view, structural
-- columns and SECURITY DEFINER search_path.
-- Migration: 0016_harden_rls_structural_columns.sql
--
-- Closes (see docs/security/01-SECURITY-REQUIREMENTS.md):
--   SR-AUTHZ-04  users could set their own role / plan / premium / suspension
--   SR-AUTHZ-05  admin_user_view exposed auth.users to anon / authenticated
--   SR-AUTHZ-06  UPDATE policies without WITH CHECK, structural columns writable
--   SR-AUTHZ-07  SECURITY DEFINER functions without a fixed search_path
-- Tasks: T-0.4, T-0.5, T-0.6 in docs/tasks.md.
-- =============================================================================

-- =============================================================================
-- T-0.4 — PROFILES
-- Permissive policies are OR-ed: "profiles_update_own" (no WITH CHECK) used to
-- cancel out "admin_role_immutable_by_user". Keep a single UPDATE policy and
-- restrict writable columns with column privileges.
-- =============================================================================

drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "admin_role_immutable_by_user" on public.profiles;

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- A column-level REVOKE has no effect while a table-level grant exists, so
-- drop the table-level UPDATE and grant back only the self-editable columns.
-- role, plan, premium_*, suspended_* are writable only by the service role.
revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url, updated_at) on public.profiles to authenticated;

-- =============================================================================
-- T-0.5 — ADMIN USER VIEW
-- The view joins auth.users and runs with its owner's privileges. Only the
-- service role (admin API routes) may read it.
-- =============================================================================

revoke all on public.admin_user_view from public, anon, authenticated;
grant select on public.admin_user_view to service_role;

-- =============================================================================
-- T-0.6 — SECURITY DEFINER search_path
-- =============================================================================

alter function public.is_trip_member(uuid) set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;

-- Membership check for an arbitrary user (e.g. expenses.paid_by). SECURITY
-- DEFINER so it works regardless of the caller's trip_members visibility; it
-- only ever answers for trips the caller is also a member of.
create or replace function public.is_user_trip_member(p_trip_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.is_trip_member(p_trip_id)
     and exists (
       select 1 from public.trip_members
       where trip_members.trip_id = p_trip_id
         and trip_members.user_id = p_user_id
     );
$$;

revoke all on function public.is_user_trip_member(uuid, uuid) from public, anon;
grant execute on function public.is_user_trip_member(uuid, uuid) to authenticated, service_role;

-- =============================================================================
-- T-0.6 — WITH CHECK ON EVERY UPDATE POLICY
-- Without WITH CHECK the USING clause is reused on the new row, which is
-- weaker than intended for policies based on owner/author columns.
-- =============================================================================

alter policy "trips_update"          on public.trips             with check (is_trip_member(id));
alter policy "days_update"           on public.days              with check (is_trip_member(trip_id));
alter policy "legs_update"           on public.legs              with check (is_trip_member(trip_id));
alter policy "accom_update"          on public.accommodations    with check (is_trip_member(trip_id));
alter policy "media_update"          on public.media             with check (is_trip_member(trip_id));
alter policy "ig_exports_update"     on public.instagram_exports with check (is_trip_member(trip_id));
alter policy "restaurants_update"    on public.restaurants       with check (is_trip_member(trip_id));
alter policy "activities_update"     on public.activities        with check (is_trip_member(trip_id));
alter policy "documents_update"      on public.documents         with check (is_trip_member(trip_id));
-- ai_usage stays user-writable until the atomic quota of T-1.5 replaces it.
alter policy "ai_usage_update"       on public.ai_usage          with check (user_id = auth.uid());

-- The payer of an expense must be a member of the same trip.
alter policy "expenses_insert" on public.expenses
  with check (is_trip_member(trip_id) and is_user_trip_member(trip_id, paid_by));
alter policy "expenses_update" on public.expenses
  with check (is_trip_member(trip_id) and is_user_trip_member(trip_id, paid_by));

-- =============================================================================
-- T-0.6 — IMMUTABLE STRUCTURAL COLUMNS (SADR-02)
-- Policies cannot compare OLD and NEW; a BEFORE UPDATE trigger can. Only
-- client roles are restricted: the service role and migrations may still
-- rewrite these columns (e.g. ownership transfer on account deletion).
-- =============================================================================

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
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
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

do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('trips',              array['id', 'owner_id', 'created_at']),
      ('days',               array['id', 'trip_id', 'created_at']),
      ('legs',               array['id', 'trip_id', 'created_at']),
      ('accommodations',     array['id', 'trip_id', 'created_at']),
      ('expenses',           array['id', 'trip_id', 'created_at']),
      ('media',              array['id', 'trip_id', 'uploaded_by', 'url', 'created_at']),
      ('documents',          array['id', 'trip_id', 'uploaded_by', 'created_at']),
      ('posts',              array['id', 'author_id', 'created_at']),
      ('restaurants',        array['id', 'trip_id', 'created_at']),
      ('activities',         array['id', 'trip_id', 'created_at']),
      ('instagram_exports',  array['id', 'trip_id', 'created_by', 'created_at']),
      ('baggage_items',      array['id', 'trip_id', 'created_at']),
      ('packing_checklists', array['trip_id']),
      ('reminders',          array['id', 'trip_id', 'user_id', 'created_at'])
    ) as t(table_name, columns)
  loop
    execute format(
      'drop trigger if exists prevent_structural_update on public.%I',
      spec.table_name
    );
    execute format(
      'create trigger prevent_structural_update before update on public.%I '
      'for each row execute function public.prevent_structural_update(%s)',
      spec.table_name,
      (select string_agg(quote_literal(c), ', ') from unnest(spec.columns) as c)
    );
  end loop;
end;
$$;
