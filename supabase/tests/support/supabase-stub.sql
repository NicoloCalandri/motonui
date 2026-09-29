-- =============================================================================
-- Minimal stand-in for the parts of Supabase that the migrations and the RLS
-- tests rely on, so they can run on a plain Postgres (CI service container)
-- instead of pulling the full Supabase image set.
--
-- Mirrors Supabase defaults that matter for authorization:
--   - roles anon / authenticated / service_role (service_role bypasses RLS)
--   - default privileges: ALL on public tables/functions for those roles, so
--     RLS and explicit REVOKEs are what actually restrict access
--   - auth.uid() / auth.role() reading the PostgREST JWT claim settings
--   - auth.users and storage.buckets / storage.objects / storage.foldername
-- Used by scripts/run-sql-tests.sh when SQL_TESTS_BOOTSTRAP=1. Never apply it
-- to a real Supabase database.
-- =============================================================================

-- Roles are cluster-wide: create them only if missing.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$$;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id                 uuid primary key,
  email              text,
  created_at         timestamptz default now(),
  last_sign_in_at    timestamptz,
  raw_user_meta_data jsonb default '{}'
);

create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
  )::uuid
$$;

create function auth.role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    current_setting('request.jwt.claims', true)::jsonb ->> 'role'
  )
$$;

grant execute on all functions in schema auth to anon, authenticated, service_role;

create schema storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id                 text primary key,
  name               text,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name      text,
  owner     uuid
);
alter table storage.objects enable row level security;
-- As on Supabase: client roles hold table grants, RLS decides the rows.
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;

create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
