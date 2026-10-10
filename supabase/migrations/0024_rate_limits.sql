-- =============================================================================
-- motonui — Rate limiting
-- Migration: 0024_rate_limits.sql
--
-- T-4.5 (SR-WEB-06). Fixed-window counters for the public blog API and the
-- expensive routes (uploads, exports, AI). One row per key and window; the
-- key is built by the server ("user:<uuid>:<bucket>" or "ip:<sha256>:<bucket>",
-- never a raw IP). Only the service role reads or writes it.
-- =============================================================================

create table if not exists public.rate_limits (
  key          text        not null,
  window_start timestamptz not null,
  hits         int         not null default 0,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;
-- No policies: anon and authenticated see and write nothing.
revoke all on public.rate_limits from anon, authenticated;

-- check_rate_limit(key, limit, window): counts one hit in the current window
-- and says whether it is within the limit. The upsert is atomic: concurrent
-- calls on the same key serialize on the primary key, so a burst cannot
-- slip past the limit. Hits over the limit are still counted (a client that
-- keeps hammering stays blocked until the window ends).
create or replace function public.check_rate_limit(
  p_key            text,
  p_limit          int,
  p_window_seconds int
)
returns table (allowed boolean, hits int, reset_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window timestamptz;
  v_hits   int;
begin
  if p_key is null or length(p_key) = 0 or length(p_key) > 200 then
    raise exception 'invalid rate limit key';
  end if;
  if p_limit is null or p_limit < 1 or p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'invalid rate limit';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits as rl (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = rl.hits + 1
  returning rl.hits into v_hits;

  return query select v_hits <= p_limit, v_hits, v_window + make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;

-- prune_rate_limits(): drops windows that ended more than a day ago. Called by
-- the daily cleanup cron.
create or replace function public.prune_rate_limits()
returns int
language sql
security definer
set search_path = public, pg_temp
as $$
  with deleted as (
    delete from public.rate_limits where window_start < now() - interval '1 day' returning 1
  )
  select count(*)::int from deleted;
$$;

revoke all on function public.prune_rate_limits() from public, anon, authenticated;
grant execute on function public.prune_rate_limits() to service_role;
