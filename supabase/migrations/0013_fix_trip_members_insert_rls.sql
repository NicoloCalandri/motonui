-- =============================================================================
-- motonui — Fix trip_members INSERT RLS circular dependency
-- Migration: 0013_fix_trip_members_insert_rls.sql
--
-- Problem: the trip_members_insert policy (from 0008) checks ownership via
--   EXISTS (SELECT 1 FROM trips WHERE trips.owner_id = auth.uid())
-- but that SELECT is governed by trips_select RLS which requires
--   is_trip_member(id) = true.
-- When inserting the very first member (the trip creator) there are no rows
-- in trip_members yet, so is_trip_member returns false → trips_select hides
-- the row → the ownership EXISTS check returns false → INSERT is rejected.
--
-- Fix: introduce a SECURITY DEFINER helper is_trip_owner() that bypasses RLS
-- when checking ownership, and use it in the trip_members_insert policy.
-- =============================================================================

create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.trips
    where trips.id = p_trip_id
      and trips.owner_id = auth.uid()
  );
$$;

alter policy "trip_members_insert"
  on public.trip_members
  with check (
    is_trip_owner(trip_id)
  );
