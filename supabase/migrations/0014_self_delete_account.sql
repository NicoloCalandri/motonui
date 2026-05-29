-- =============================================================================
-- motonui — Self-service account deletion
-- Migration: 0014_self_delete_account.sql
-- Adds: delete_my_account(confirm_text) RPC for authenticated users
-- =============================================================================

create or replace function public.delete_my_account(confirm_text text) returns jsonb
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if coalesce(confirm_text, '') <> 'DELETE' then
    raise exception 'INVALID_CONFIRMATION';
  end if;

  -- Break non-cascade references to profiles first.
  update public.profiles
  set premium_enabled_by = null
  where premium_enabled_by = uid;

  update public.feature_controls
  set updated_by = null
  where updated_by = uid;

  -- Remove rows that reference the user id without ON DELETE CASCADE.
  delete from public.admin_audit_log where admin_id = uid or target_id = uid;
  delete from public.documents where uploaded_by = uid;
  delete from public.media where uploaded_by = uid;
  delete from public.expenses where paid_by = uid;
  delete from public.posts where author_id = uid;
  delete from public.instagram_exports where created_by = uid;
  delete from public.ai_usage where user_id = uid;
  delete from public.trip_members where user_id = uid;

  -- Remove avatar objects in storage.
  delete from storage.objects
  where bucket_id = 'avatars'
    and (storage.foldername(name))[1] = uid::text;

  -- Final delete in auth.users cascades to profiles and owned trips.
  delete from auth.users where id = uid;

  return jsonb_build_object('deleted', true);
end;
$$;

revoke all on function public.delete_my_account(text) from public;
grant execute on function public.delete_my_account(text) to authenticated;
