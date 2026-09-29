-- =============================================================================
-- Regression test for migration 0017 (T-0.9): trip-documents bucket is
-- private and no storage policy exposes it to anon/authenticated.
-- Run like 0016_phase0_rls.test.sql; rolled back at the end.
-- =============================================================================

begin;

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'trip-documents' and public = false) then
    raise exception 'FAIL trip-documents bucket missing or public';
  end if;
  raise notice 'ok   trip-documents bucket is private';

  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%trip-documents%'
  ) then
    raise exception 'FAIL a storage.objects policy references trip-documents';
  end if;
  raise notice 'ok   no client policy on trip-documents objects';

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'legs' and column_name = 'boarding_pass_path'
  ) then
    raise exception 'FAIL legs.boarding_pass_path missing';
  end if;
  raise notice 'ok   legs.boarding_pass_path exists';
end;
$$;

rollback;
