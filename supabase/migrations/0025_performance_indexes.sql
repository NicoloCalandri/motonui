-- 0025 — Indexes on the foreign keys that had none, plus the blog ordering
-- (audit B4.52). Every RLS check, ON DELETE CASCADE and account purge on
-- these columns was a sequential scan of the child table.
--
-- Found with:
--   select conrelid::regclass, conkey from pg_constraint c
--   where contype = 'f' and connamespace = 'public'::regnamespace
--     and not exists (select 1 from pg_index i
--                     where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]);
--
-- Plain CREATE INDEX (not CONCURRENTLY): migrations run in a transaction and
-- these tables are small. No new table, so no RLS fixture is needed.

-- Reminders: read per trip (RLS is_trip_member) and per user (cron, account purge).
create index if not exists idx_reminders_trip_id on public.reminders(trip_id);
create index if not exists idx_reminders_user_id on public.reminders(user_id);

-- Uploader / creator columns: account deletion (purge_user_data) filters on them.
create index if not exists idx_documents_uploaded_by on public.documents(uploaded_by);
create index if not exists idx_instagram_exports_created_by on public.instagram_exports(created_by);
create index if not exists idx_trip_invites_invited_by on public.trip_invites(invited_by);
create index if not exists idx_trip_invites_accepted_by on public.trip_invites(accepted_by)
    where accepted_by is not null;

-- Admin tables: user detail pages and account deletion (target_id set null).
create index if not exists idx_admin_audit_log_target_id on public.admin_audit_log(target_id)
    where target_id is not null;
create index if not exists idx_impersonation_tokens_admin_id on public.impersonation_tokens(admin_id);
create index if not exists idx_impersonation_tokens_target_id on public.impersonation_tokens(target_id);

-- Public blog: `status = 'published' order by published_at desc` (list,
-- sitemap). The slug lookup already uses the UNIQUE constraint of 0001.
create index if not exists idx_posts_published_at on public.posts(published_at desc)
    where status = 'published';
