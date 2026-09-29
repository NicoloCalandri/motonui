-- =============================================================================
-- Regression test for migration 0018 (T-1.5): atomic AI quota.
-- Rolled back at the end. Concurrency (50 parallel calls -> exactly 20
-- accepted) was verified with separate connections when the migration was
-- written; this file checks the same limits sequentially plus the access rules.
-- =============================================================================

begin;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d4', 'quota@test.local');
insert into public.profiles (id) values ('00000000-0000-0000-0000-0000000000d4') on conflict (id) do nothing;
update public.feature_controls set hard_daily_cap = 1000, daily_usage = 0, usage_date = current_date where feature_key = 'ai_blog';

do $$
declare
  counters jsonb := jsonb_build_array(
    jsonb_build_object('feature_key', 'ai_total', 'period_type', 'day', 'period_start', current_date, 'limit', 20),
    jsonb_build_object('feature_key', 'ai_blog',  'period_type', 'day', 'period_start', current_date, 'limit', 30)
  );
  accepted int := 0;
  rejected int := 0;
  i int;
begin
  for i in 1..25 loop
    begin
      perform public.consume_feature_quota('00000000-0000-0000-0000-0000000000d4', 'ai_blog', counters);
      accepted := accepted + 1;
    exception when sqlstate 'P0001' then
      rejected := rejected + 1;
    end;
  end loop;

  if accepted <> 20 or rejected <> 5 then
    raise exception 'FAIL expected 20 accepted / 5 rejected, got % / %', accepted, rejected;
  end if;
  raise notice 'ok   25 calls with a limit of 20 -> 20 accepted';

  -- Rejected calls must not have incremented the other counter.
  if (select usage_count from public.usage_counters
      where user_id = '00000000-0000-0000-0000-0000000000d4' and feature_key = 'ai_blog') <> 20 then
    raise exception 'FAIL a rejected call left a partial increment';
  end if;
  raise notice 'ok   rejected calls roll back every counter';

  if (select daily_usage from public.feature_controls where feature_key = 'ai_blog') <> 20 then
    raise exception 'FAIL global daily usage not incremented atomically';
  end if;
  raise notice 'ok   global daily usage follows accepted calls only';

  update public.feature_controls set hard_daily_cap = 20 where feature_key = 'ai_blog';
  begin
    perform public.consume_feature_quota('00000000-0000-0000-0000-0000000000d4', 'ai_blog', '[]'::jsonb);
    raise exception 'FAIL global cap not enforced';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'GLOBAL_DAILY_CAP_REACHED' then raise; end if;
  end;
  raise notice 'ok   global daily cap enforced';
end;
$$;

-- Users cannot call the RPC (they would pass their own limits) nor write the
-- old ai_usage counter.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d4', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  begin
    perform public.consume_feature_quota('00000000-0000-0000-0000-0000000000d4', 'ai_blog', '[]'::jsonb);
    raise exception 'FAIL authenticated can call consume_feature_quota';
  exception when insufficient_privilege then
    raise notice 'ok   authenticated cannot call consume_feature_quota';
  end;

  begin
    insert into public.ai_usage (user_id, call_type) values ('00000000-0000-0000-0000-0000000000d4', 'sonnet');
    raise exception 'FAIL authenticated can insert into ai_usage';
  exception when insufficient_privilege then
    raise notice 'ok   authenticated cannot write ai_usage';
  end;

  begin
    insert into public.usage_counters (user_id, feature_key, period_type, period_start)
    values ('00000000-0000-0000-0000-0000000000d4', 'ai_total', 'day', current_date);
    raise exception 'FAIL authenticated can insert into usage_counters';
  exception when insufficient_privilege then
    raise notice 'ok   authenticated cannot write usage_counters';
  end;
end;
$$;

rollback;
