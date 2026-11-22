-- =============================================================================
-- Regression test for migration 0025 (audit B4.52): every single-column
-- foreign key in `public` is the leading column of some index, so RLS checks,
-- cascades and the account purge do not scan the child table. A new FK
-- without an index fails here. Rolled back at the end.
-- =============================================================================

begin;

do $$
declare
  missing text;
begin
  select string_agg(format('%s.%s', c.conrelid::regclass, a.attname), ', ' order by 1)
    into missing
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  where c.contype = 'f'
    and c.connamespace = 'public'::regnamespace
    and array_length(c.conkey, 1) = 1
    -- Audit columns on single-row-per-user tables, never filtered on.
    and format('%s.%s', c.conrelid::regclass, a.attname) not in (
      'profiles.premium_enabled_by',
      'feature_controls.updated_by'
    )
    and not exists (
      select 1 from pg_index i
      where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]
    );

  if missing is not null then
    raise exception 'FAIL foreign keys without an index: %', missing;
  end if;
  raise notice 'ok   every foreign key in public has an index';
end;
$$;

do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_posts_published_at') then
    raise exception 'FAIL idx_posts_published_at missing';
  end if;
  raise notice 'ok   published posts are ordered by an index';
end;
$$;

rollback;
