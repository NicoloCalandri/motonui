-- =============================================================================
-- motonui — Bagagli e checklist di viaggio (packing list)
-- Migration: 0015_packing.sql
-- Adds: baggage_items, packing_checklists, weather_cache; extends premium
--       feature_key check constraints with 'packing_checklist'.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- baggage_items: a piece of luggage registered for a trip, optionally tied to
-- a flight leg. Category presets (dimensions/weight) are editable by the user
-- rather than looked up per-airline, since airline baggage policies change
-- often and vary by fare class.
-- -----------------------------------------------------------------------------
create table public.baggage_items (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  leg_id       uuid references public.legs(id) on delete set null,
  category     text not null check (category in ('cabin_bag', 'cabin_trolley', 'checked', 'other')),
  label        text,
  length_cm    integer,
  width_cm     integer,
  height_cm    integer,
  weight_kg    numeric(5, 2),
  notes        text
);

create index idx_baggage_items_trip_id on public.baggage_items(trip_id);
create index idx_baggage_items_leg_id on public.baggage_items(leg_id);

-- -----------------------------------------------------------------------------
-- packing_checklists: AI-generated clothing checklist for a trip (one row per
-- trip, replaced on regenerate). input_hash lets the UI detect that trip
-- dates/activities/baggage changed since the last generation without
-- automatically spending a new AI call.
-- -----------------------------------------------------------------------------
create table public.packing_checklists (
  trip_id           uuid primary key references public.trips(id) on delete cascade,
  items             jsonb not null default '[]',
  weather_snapshot  jsonb,
  input_hash        text,
  generated_at      timestamptz,
  checked_item_ids  text[] not null default '{}',
  updated_at        timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- weather_cache: shared cache of Open-Meteo responses keyed by rounded
-- coordinates + date range + mode (forecast/historical), same idea as
-- currency_rates. Not trip-scoped — any authenticated user may read/refresh.
-- -----------------------------------------------------------------------------
create table public.weather_cache (
  id         uuid primary key default gen_random_uuid(),
  cache_key  text not null unique,
  payload    jsonb not null,
  fetched_at timestamptz not null default now()
);

create index idx_weather_cache_fetched_at on public.weather_cache(fetched_at);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.baggage_items enable row level security;
alter table public.packing_checklists enable row level security;
alter table public.weather_cache enable row level security;

create policy "baggage_items_select" on public.baggage_items for select using (is_trip_member(trip_id));
create policy "baggage_items_insert" on public.baggage_items for insert with check (is_trip_member(trip_id));
create policy "baggage_items_update" on public.baggage_items for update using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy "baggage_items_delete" on public.baggage_items for delete using (is_trip_member(trip_id));

create policy "packing_checklists_select" on public.packing_checklists for select using (is_trip_member(trip_id));
create policy "packing_checklists_insert" on public.packing_checklists for insert with check (is_trip_member(trip_id));
create policy "packing_checklists_update" on public.packing_checklists for update using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy "packing_checklists_delete" on public.packing_checklists for delete using (is_trip_member(trip_id));

create policy "weather_cache_select" on public.weather_cache for select using (auth.role() = 'authenticated');
create policy "weather_cache_insert" on public.weather_cache for insert with check (auth.role() = 'authenticated');
create policy "weather_cache_update" on public.weather_cache for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- -----------------------------------------------------------------------------
-- Premium feature gating: add 'packing_checklist' to the allowed feature keys
-- -----------------------------------------------------------------------------
alter table public.feature_entitlements drop constraint if exists feature_entitlements_feature_key_check;
alter table public.feature_entitlements add constraint feature_entitlements_feature_key_check
  check (feature_key in ('ai_blog', 'ai_generate_post', 'ai_destination', 'instagram_caption', 'advanced_reminders', 'packing_checklist'));

alter table public.feature_controls drop constraint if exists feature_controls_feature_key_check;
alter table public.feature_controls add constraint feature_controls_feature_key_check
  check (feature_key in ('ai_blog', 'ai_generate_post', 'ai_destination', 'instagram_caption', 'advanced_reminders', 'packing_checklist'));

insert into public.feature_controls (feature_key, enabled, hard_daily_cap)
values ('packing_checklist', true, 3000)
on conflict (feature_key) do nothing;
