-- =============================================================================
-- Regression test for migration 0024 (T-4.5): atomic fixed-window rate limit,
-- service role only. Rolled back at the end.
-- =============================================================================

begin;

create schema rl_test;
grant usage on schema rl_test to anon, authenticated, service_role;

create function rl_test.act_as(p_role text) returns void
language plpgsql as $$
begin
  perform set_config('role', p_role, true);
  perform set_config('request.jwt.claim.role', p_role, true);
end;
$$;

create function rl_test.expect_error(label text, stmt text, state text) returns void
language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate <> state then
      raise exception 'FAIL % — raised % (%), expected %', label, sqlstate, sqlerrm, state;
    end if;
    raise notice 'ok   %', label;
    return;
  end;
  raise exception 'FAIL % — statement succeeded: %', label, stmt;
end;
$$;

create function rl_test.check(label text, ok boolean) returns void
language plpgsql as $$
begin
  if not ok then raise exception 'FAIL %', label; end if;
  raise notice 'ok   %', label;
end;
$$;

grant execute on all functions in schema rl_test to anon, authenticated, service_role;

-- ── Service role: counts and blocks over the limit ──────────────────────────
select rl_test.act_as('service_role');

select rl_test.check('first hit allowed',
  (select allowed and hits = 1 from public.check_rate_limit('user:test:ai', 2, 60)));
select rl_test.check('second hit allowed (= limit)',
  (select allowed and hits = 2 from public.check_rate_limit('user:test:ai', 2, 60)));
select rl_test.check('third hit refused',
  (select not allowed and hits = 3 from public.check_rate_limit('user:test:ai', 2, 60)));
select rl_test.check('other keys are independent',
  (select allowed and hits = 1 from public.check_rate_limit('user:other:ai', 2, 60)));
select rl_test.check('reset_at is the end of the window',
  (select reset_at > now() and reset_at <= now() + interval '60 seconds'
     from public.check_rate_limit('user:test:reset', 5, 60)));

-- An old window does not count toward the current one, and is pruned.
insert into public.rate_limits (key, window_start, hits) values ('user:test:old', now() - interval '2 days', 99);
select rl_test.check('old window ignored',
  (select allowed and hits = 1 from public.check_rate_limit('user:test:old', 1, 60)));
select rl_test.check('prune removes windows older than a day', public.prune_rate_limits() >= 1);
select rl_test.check('current windows survive pruning',
  exists (select 1 from public.rate_limits where key = 'user:test:ai'));

select rl_test.expect_error('invalid limit rejected',
  $$select * from public.check_rate_limit('user:x', 0, 60)$$, 'P0001');

reset role;

-- ── Clients cannot read the table or call the functions ─────────────────────
select rl_test.act_as('authenticated');
select rl_test.expect_error('authenticated cannot call check_rate_limit',
  $$select * from public.check_rate_limit('user:x:ai', 1000, 60)$$, '42501');
select rl_test.expect_error('authenticated cannot read rate_limits',
  $$select * from public.rate_limits$$, '42501');
reset role;

select rl_test.act_as('anon');
select rl_test.expect_error('anon cannot call check_rate_limit',
  $$select * from public.check_rate_limit('ip:x:posts', 1000, 60)$$, '42501');
select rl_test.expect_error('anon cannot prune',
  $$select public.prune_rate_limits()$$, '42501');
reset role;

rollback;
