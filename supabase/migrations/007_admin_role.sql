-- =============================================================================
-- motonui — Admin Role & User Management
-- Migration: 007_admin_role.sql
-- Adds: profiles table, role field, suspended fields, audit log, impersonation
--       tokens, and admin view.
-- =============================================================================

-- =============================================================================
-- PROFILES TABLE (public mirror of auth.users with app-specific fields)
-- =============================================================================

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  display_name text,
  avatar_url   text
);

-- Trigger to create a profile row automatically when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================================================
-- ROLE FIELD
-- =============================================================================

alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

-- Users cannot promote themselves to admin
create policy "admin_role_immutable_by_user"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (role = 'user');

create index if not exists profiles_role_idx on public.profiles(role);

-- =============================================================================
-- SUSPENDED FIELDS
-- =============================================================================

alter table public.profiles
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_reason text;

-- =============================================================================
-- ROW LEVEL SECURITY ON PROFILES
-- =============================================================================

alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Users can update their own profile (role constraint enforced above)
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- =============================================================================
-- ADMIN AUDIT LOG
-- =============================================================================

create table if not exists public.admin_audit_log (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid not null references public.profiles(id),
  action     text not null check (action in ('impersonate', 'suspend', 'unsuspend', 'delete', 'view_profile')),
  target_id  uuid references public.profiles(id),
  metadata   jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

create policy "admin_can_read_audit_log"
  on public.admin_audit_log for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- No insert via client — only via service role in API routes
create index if not exists audit_log_admin_id_idx   on public.admin_audit_log(admin_id);
create index if not exists audit_log_created_at_idx on public.admin_audit_log(created_at desc);

-- =============================================================================
-- IMPERSONATION TOKENS
-- =============================================================================

create table if not exists public.impersonation_tokens (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid not null references public.profiles(id) on delete cascade,
  target_id  uuid not null references public.profiles(id) on delete cascade,
  token      text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.impersonation_tokens enable row level security;

-- No client access — managed exclusively via service role in API routes
create index if not exists impersonation_tokens_token_idx      on public.impersonation_tokens(token);
create index if not exists impersonation_tokens_expires_at_idx on public.impersonation_tokens(expires_at);

-- =============================================================================
-- ADMIN USER VIEW (requires service role to access auth.users)
-- =============================================================================

create or replace view public.admin_user_view as
  select
    au.id,
    au.email,
    au.created_at,
    au.last_sign_in_at,
    p.display_name,
    p.avatar_url,
    p.role,
    p.suspended_at,
    p.suspended_reason
  from auth.users au
  join public.profiles p on p.id = au.id;
