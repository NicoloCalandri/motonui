-- Promuovi un utente ad admin
-- ⚠️  Da eseguire MANUALMENTE in Supabase Studio > SQL Editor.
--     Non includere mai in CI/CD.
--
-- Istruzioni:
--   1. Sostituisci 'nicolo@example.com' con l'email dell'utente reale
--   2. Apri Supabase Studio > SQL Editor
--   3. Esegui questo script
--   4. L'utente deve rieffettuare il login perché il ruolo abbia effetto

update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'nicolo@example.com'
);
