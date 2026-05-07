-- =============================================================================
-- motonui — Premium access, feature entitlements and cost controls
-- Migration: 0012_premium_access_controls.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Profiles: plan fields (separate from role)
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists plan text not null default 'free'
    check (plan in ('free', 'premium')),
  add column if not exists premium_until timestamptz,
  add column if not exists premium_enabled_by uuid references public.profiles(id),
  add column if not exists premium_enabled_at timestamptz;

create index if not exists profiles_plan_idx on public.profiles(plan);
create index if not exists profiles_premium_until_idx on public.profiles(premium_until);

-- -----------------------------------------------------------------------------
-- Feature entitlements per user
-- -----------------------------------------------------------------------------
create table if not exists public.feature_entitlements (
  id              uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  feature_key      text not null check (feature_key in ('ai_blog', 'ai_generate_post', 'ai_destination', 'instagram_caption', 'advanced_reminders')),
  enabled          boolean not null default true,
  daily_limit      integer check (daily_limit is null or daily_limit >= 0),
  monthly_limit    integer check (monthly_limit is null or monthly_limit >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(user_id, feature_key)
);

create index if not exists feature_entitlements_user_idx on public.feature_entitlements(user_id);
create index if not exists feature_entitlements_feature_idx on public.feature_entitlements(feature_key);

-- -----------------------------------------------------------------------------
-- Usage counters per user/feature/period
-- -----------------------------------------------------------------------------
create table if not exists public.usage_counters (
  id              uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  feature_key      text not null,
  period_type      text not null check (period_type in ('day', 'month')),
  period_start     date not null,
  usage_count      integer not null default 0 check (usage_count >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(user_id, feature_key, period_type, period_start)
);

create index if not exists usage_counters_user_feature_idx on public.usage_counters(user_id, feature_key);
create index if not exists usage_counters_period_idx on public.usage_counters(period_type, period_start);

-- -----------------------------------------------------------------------------
-- Global feature controls (kill switch + hard caps + alert thresholds)
-- -----------------------------------------------------------------------------
create table if not exists public.feature_controls (
  feature_key        text primary key check (feature_key in ('ai_blog', 'ai_generate_post', 'ai_destination', 'instagram_caption', 'advanced_reminders')),
  enabled            boolean not null default true,
  hard_daily_cap     integer check (hard_daily_cap is null or hard_daily_cap >= 0),
  alert_thresholds   integer[] not null default '{70,85,100}',
  alerted_thresholds integer[] not null default '{}',
  daily_usage        integer not null default 0,
  usage_date         date not null default current_date,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references public.profiles(id)
);

insert into public.feature_controls (feature_key, enabled, hard_daily_cap)
values
  ('ai_blog', true, 5000),
  ('ai_generate_post', true, 2000),
  ('ai_destination', true, 3000),
  ('instagram_caption', true, 2000),
  ('advanced_reminders', true, 10000)
on conflict (feature_key) do nothing;

-- -----------------------------------------------------------------------------
-- Admin user view: expose premium fields
-- -----------------------------------------------------------------------------
create or replace view public.admin_user_view as
  select
    au.id,
    au.email,
    au.created_at,
    au.last_sign_in_at,
    p.display_name,
    p.avatar_url,
    p.role,
    p.plan,
    p.premium_until,
    p.premium_enabled_at,
    p.premium_enabled_by,
    p.suspended_at,
    p.suspended_reason
  from auth.users au
  join public.profiles p on p.id = au.id;

-- -----------------------------------------------------------------------------
-- Audit log: include update + premium action
-- -----------------------------------------------------------------------------
alter table public.admin_audit_log
  drop constraint if exists admin_audit_log_action_check;

alter table public.admin_audit_log
  add constraint admin_audit_log_action_check
  check (action in ('impersonate', 'suspend', 'unsuspend', 'delete', 'view_profile', 'update_user', 'premium_update'));

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.feature_entitlements enable row level security;
alter table public.usage_counters enable row level security;
alter table public.feature_controls enable row level security;

create policy "feature_entitlements_select_own"
  on public.feature_entitlements for select
  using (auth.uid() = user_id);

create policy "usage_counters_select_own"
  on public.usage_counters for select
  using (auth.uid() = user_id);

create policy "feature_controls_select_admin"
  on public.feature_controls for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
