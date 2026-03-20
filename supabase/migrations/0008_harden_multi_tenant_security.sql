-- =============================================================================
-- motonui — Multi-tenant security hardening
-- Migration: 0008_harden_multi_tenant_security.sql
-- Fixes: trip member self-enrollment, overly broad post insert/update rules, and
--        missing reminders RLS.
-- =============================================================================

alter table public.reminders enable row level security;

create policy "reminders_select"
  on public.reminders for select
  using (is_trip_member(trip_id) and user_id = auth.uid());

create policy "reminders_insert"
  on public.reminders for insert
  with check (
    user_id = auth.uid()
    and is_trip_member(trip_id)
  );

create policy "reminders_update"
  on public.reminders for update
  using (user_id = auth.uid() and is_trip_member(trip_id))
  with check (user_id = auth.uid() and is_trip_member(trip_id));

create policy "reminders_delete"
  on public.reminders for delete
  using (user_id = auth.uid() and is_trip_member(trip_id));

alter policy "trip_members_insert"
  on public.trip_members
  with check (
    exists (
      select 1
      from public.trips
      where trips.id = trip_id
        and trips.owner_id = auth.uid()
    )
  );

alter policy "posts_insert"
  on public.posts
  with check (
    author_id = auth.uid()
    and (
      trip_id is null
      or is_trip_member(trip_id)
    )
  );

drop policy if exists "posts_update" on public.posts;
create policy "posts_update"
  on public.posts for update
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and (
      trip_id is null
      or is_trip_member(trip_id)
    )
  );
