-- =============================================================================
-- motonui — Single, atomic AI quota
-- Migration: 0018_atomic_ai_quota.sql
--
-- T-1.5 (SR-INT-02, SR-INT-03; ADR-04, SADR-05). Replaces the two read-then-
-- write limiters (the user-writable ai_usage counter and the usage_counters
-- upserts in lib/premium/access.ts) with one function that increments every
-- counter of a request and the feature's global daily cap atomically, or
-- nothing at all.
-- =============================================================================

-- consume_feature_quota(user, feature, counters, amount)
--   counters: [{"feature_key": "...", "period_type": "day"|"month",
--               "period_start": "YYYY-MM-DD", "limit": N}, ...]
-- Each counter is incremented by `amount` only if it stays within `limit`
-- (INSERT ... ON CONFLICT DO UPDATE ... WHERE is atomic under concurrency:
-- the unique index serializes writers on the same row). Then the global
-- daily usage in feature_controls is incremented within hard_daily_cap.
-- Any limit hit raises, rolling back every increment of the call:
--   P0001 'QUOTA_EXCEEDED'           detail '<feature_key>:<period_type>'
--   P0001 'GLOBAL_DAILY_CAP_REACHED'
-- Returns the feature's global daily usage after the call (null if the
-- feature has no feature_controls row).
create or replace function public.consume_feature_quota(
  p_user_id  uuid,
  p_feature  text,
  p_counters jsonb,
  p_amount   int default 1
)
returns int
language plpgsql
set search_path = public, pg_temp
as $$
declare
  counter     jsonb;
  new_count   int;
  global_used int;
begin
  if p_amount is null or p_amount < 1 then
    raise exception 'amount must be >= 1';
  end if;

  for counter in select value from jsonb_array_elements(coalesce(p_counters, '[]'::jsonb)) loop
    new_count := null;

    insert into public.usage_counters as uc (user_id, feature_key, period_type, period_start, usage_count)
    select p_user_id, counter ->> 'feature_key', counter ->> 'period_type', (counter ->> 'period_start')::date, p_amount
    where p_amount <= (counter ->> 'limit')::int
    on conflict (user_id, feature_key, period_type, period_start)
    do update set usage_count = uc.usage_count + excluded.usage_count,
                  updated_at  = now()
       where uc.usage_count + excluded.usage_count <= (counter ->> 'limit')::int
    returning uc.usage_count into new_count;

    if new_count is null then
      raise exception using
        errcode = 'P0001',
        message = 'QUOTA_EXCEEDED',
        detail  = (counter ->> 'feature_key') || ':' || (counter ->> 'period_type');
    end if;
  end loop;

  update public.feature_controls fc
     set daily_usage = (case when fc.usage_date = current_date then fc.daily_usage else 0 end) + p_amount,
         usage_date  = current_date,
         updated_at  = now()
   where fc.feature_key = p_feature
     and (fc.hard_daily_cap is null
          or (case when fc.usage_date = current_date then fc.daily_usage else 0 end) + p_amount <= fc.hard_daily_cap)
  returning fc.daily_usage into global_used;

  if global_used is null and exists (select 1 from public.feature_controls where feature_key = p_feature) then
    raise exception using errcode = 'P0001', message = 'GLOBAL_DAILY_CAP_REACHED';
  end if;

  return global_used;
end;
$$;

-- Callers pass their own limits: only the server (service role) may call it.
revoke all on function public.consume_feature_quota(uuid, text, jsonb, int) from public, anon, authenticated;
grant execute on function public.consume_feature_quota(uuid, text, jsonb, int) to service_role;

-- The old per-user limiter was writable by the user it limited (S-07): keep
-- the table for history/retention, readable by its owner, written only by
-- the service role.
drop policy if exists "ai_usage_insert" on public.ai_usage;
drop policy if exists "ai_usage_update" on public.ai_usage;
