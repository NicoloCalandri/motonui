# Setup Admin

Come aggiungere il ruolo admin al primo utente del sistema.

## Prerequisiti

- L'utente deve già essere registrato nell'app
- Devi avere accesso a Supabase Studio (progetto locale o cloud)

## Procedura

1. Registra l'account con l'email desiderata dall'app  
   → Vai su `/auth/login` e crea l'account normalmente

2. Apri **Supabase Studio > SQL Editor**

3. Modifica `supabase/seed_admin.sql` con la tua email reale:
   ```sql
   update public.profiles
   set role = 'admin'
   where id = (
     select id from auth.users where email = 'LA-TUA-EMAIL@example.com'
   );
   ```

4. Esegui lo script

5. Rieffettua il login nell'app — il ruolo admin sarà attivo

## Verifica

Dopo il login, naviga su `/admin` per verificare l'accesso alla dashboard admin.  
Gli utenti non-admin vengono reindirizzati automaticamente a `/dashboard`.

## Sicurezza

- Solo il service role key può promuovere utenti ad admin (mai via client)
- Gli utenti non possono auto-promuoversi (policy RLS `admin_role_immutable_by_user`)
- Tutte le azioni admin sono tracciate nell'audit log (`public.admin_audit_log`)

## Variabili d'ambiente necessarie

Assicurati che `.env.local` contenga:

```bash
ADMIN_IMPERSONATION_SECRET=   # min 32 caratteri — genera con: openssl rand -base64 32
ADMIN_EMAIL=                  # email dell'admin iniziale (opzionale, per riferimento)
```
