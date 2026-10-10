# 05 — Runbook operativo: Auth, backup e segreti

Procedure manuali per le parti di sicurezza che vivono fuori dal repo (progetto Supabase cloud, Vercel, GitHub, provider esterni). Copre SR-AUTH-06, SR-AUTH-07 (§1), SR-OPS-04 (§2) e SR-OPS-05 (§3). Ogni esecuzione si annota nel registro delle verifiche (`04-SECURITY-CHECKLIST.md` §D) con data, commit e esito; gli screenshot o gli export restano fuori dal repo (nel registro basta dove si trovano).

---

## 1. Configurazione di Supabase Auth (T-4.8)

`supabase/config.toml` è la fonte della verità per l'ambiente locale; il progetto cloud si configura a mano dal dashboard e deve restare allineato. Dopo ogni modifica a `[auth]` in `config.toml` si ripete questa tabella sul cloud.

| Impostazione | `config.toml` | Dashboard cloud | SR |
|---|---|---|---|
| Conferma email obbligatoria | `[auth.email] enable_confirmations = true` | Authentication → Providers → Email → *Confirm email* attivo | AUTH-06 |
| Conferma doppia del cambio email | `double_confirm_changes = true` | Providers → Email → *Secure email change* attivo | AUTH-06 |
| Riautenticazione per cambiare password | `secure_password_change = true` | Providers → Email → *Secure password change* attivo | AUTH-07 |
| Durata access token 1 h | `jwt_expiry = 3600` | Authentication → Sessions / JWT → *JWT expiry* 3600 | AUTH-06 |
| Rotazione refresh token | `enable_refresh_token_rotation = true`, `refresh_token_reuse_interval = 10` | Sessions → *Detect and revoke compromised refresh tokens* attivo, intervallo 10 s | AUTH-06 |
| Lunghezza minima password 10 | `minimum_password_length = 10` | Authentication → Policies (o Providers → Email) → *Minimum password length* 10 | AUTH-07 |
| Lettere e numeri obbligatori | `password_requirements = "letters_digits"` | *Password requirements* → "Letters and digits" | AUTH-07 |
| Leaked password protection | — (solo cloud) | *Prevent use of leaked passwords* attivo (HaveIBeenPwned; richiede il piano Pro) | AUTH-07 |
| Magic link disattivato | nessun flusso OTP nell'app (ADR-06) | Providers → Email: nessun template OTP usato dall'app | — |
| Redirect consentiti | `site_url`, `additional_redirect_urls` locali | Authentication → URL Configuration: solo il dominio di produzione e i preview Vercel del progetto, niente `*` generici | AUTH-04 |

Nell'app la stessa policy sta in `src/lib/auth/password.ts` (`PASSWORD_MIN_LENGTH`, `passwordSchema`), usata dal reset password e dalla creazione utente admin: serve solo a dare un messaggio chiaro, il controllo vero resta in Supabase Auth.

**Verifica (B10):** con un account di test, un cambio password a `abc12345` deve fallire con *password too short*, `password1234` (in HaveIBeenPwned) deve fallire con *weak password* se la leaked password protection è attiva. In alternativa: Security Advisor senza l'avviso `auth_leaked_password_protection`. Annota l'esito nel registro.

Se il piano non include la leaked password protection, la si registra come eccezione in `04-SECURITY-CHECKLIST.md` (tabella delle eccezioni) e SR-AUTH-07 resta 🟡.

---

## 2. Backup e restore del database (T-4.6)

### 2.1 Cosa c'è

| Livello | Dove | Copre | Note |
|---|---|---|---|
| Backup giornalieri Supabase | Database → Backups | DB intero, conservazione secondo il piano (Pro: 7 giorni) | Il piano Free non offre backup scaricabili: serve almeno il livello 2.1.2 |
| PITR | Add-on *Point in Time Recovery* | Ripristino al secondo negli ultimi N giorni | Consigliato quando ci sono utenti reali oltre ai due fondatori |
| Dump logico | `supabase db dump` dal portatile di un admin | Schema e dati di `public` (e `auth` se richiesto) | Contiene dati personali: si cifra e non si salva mai nel repo, negli artifact di GitHub o in cartelle condivise |
| File (Storage) | Bucket `trip-media`, `trip-documents`, `avatars`, `instagram-exports` | **Non** inclusi nei backup del DB | Copia periodica con `supabase storage cp -r` o accettare il rischio (le foto originali restano sui telefoni) |

Le migration in `supabase/migrations/` ricostruiscono lo schema da zero; i backup servono per i dati.

### 2.2 Dump logico cifrato (piano Free o copia fuori da Supabase)

```bash
# Connection string dal dashboard (Database → Connect → Session pooler); non salvarla nella shell history
read -rs SUPABASE_DB_URL && export SUPABASE_DB_URL
supabase db dump --db-url "$SUPABASE_DB_URL" -f schema.sql
supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --use-copy -f data.sql
tar czf - schema.sql data.sql | gpg --symmetric --cipher-algo AES256 -o "motonui-$(date +%F).tar.gz.gpg"
rm schema.sql data.sql
```

La passphrase sta nel password manager condiviso di Nicolò e Giorgia. Si conservano gli ultimi 4 dump.

### 2.3 Prova di restore (trimestrale, B15)

La prova non tocca mai il progetto di produzione.

1. Crea un progetto Supabase temporaneo (o un branch) oppure avvia lo stack locale con `npm run db:start`.
2. Ripristina:
   - backup Supabase/PITR: Database → Backups → *Restore to new project* (se disponibile sul piano);
   - dump logico: `gpg -d motonui-AAAA-MM-GG.tar.gz.gpg | tar xzf -`, poi `psql "$TARGET_DB_URL" -f schema.sql` e `psql "$TARGET_DB_URL" -f data.sql`.
3. Controlla:
   - `select count(*) from public.trips`, `public.expenses`, `public.media`, `public.posts` confrontati con la produzione (stesso ordine di grandezza, data dell'ultima riga coerente col backup);
   - `npm run test:rls` contro il DB ripristinato (le policy sono arrivate con lo schema);
   - login con un account di test e apertura di un viaggio, puntando un `.env.local` temporaneo al progetto ripristinato.
4. Annota nel registro: data, sorgente (backup/PITR/dump e sua data), tempo impiegato (RTO), dati persi rispetto al momento del backup (RPO), esito.
5. Elimina il progetto temporaneo e i file in chiaro.

**Obiettivi:** RPO ≤ 24 h (backup giornaliero) o ≤ 5 min con PITR; RTO ≤ 4 h.

### 2.4 Incidente: dati persi o corrotti in produzione

1. Metti l'app in manutenzione (Vercel → disattiva il deploy o reindirizza) per non scrivere sopra lo stato da recuperare.
2. Individua il momento prima dell'incidente (log Supabase, `admin_audit_log`, Sentry).
3. Ripristina su un **nuovo** progetto, verifica come in §2.3, poi: o sposti i dati mancanti con un dump mirato, o punti l'app al nuovo progetto (aggiornando le variabili Vercel e ruotando le chiavi come in §3).
4. Svuota `storage_deletion_queue` solo dopo aver verificato che i file corrispondano alle righe ripristinate.

---

## 3. Rotazione e revoca dei segreti (SR-OPS-05)

**Quando:** subito dopo un'esposizione (segreto nel repo, in un log, in uno screenshot, su un portatile perso, collaboratore uscito), altrimenti una volta l'anno (checklist §C). Rimuovere un segreto dal repo non basta: va ruotato, perché resta nella storia git e nelle copie già scaricate.

**Regola generale:** genera il nuovo valore → aggiornalo ovunque è usato (Vercel Production e Preview separati, GitHub environment `production`, `.env.local` dei due sviluppatori) → ridistribuisci → verifica → revoca il vecchio. Per i segreti con due valori validi contemporaneamente (Supabase API keys nuove, Anthropic, Resend) non c'è disservizio; per gli altri si accetta un breve logout o errore.

Genera i segreti casuali con `openssl rand -base64 48`.

| Segreto | Dove si ruota | Dove si aggiorna | Effetto della rotazione | Verifica |
|---|---|---|---|---|
| Service role / `sb_secret_…` | Supabase → Project Settings → API Keys: crea una nuova secret key, poi revoca la vecchia (con le chiavi JWT legacy: *Roll JWT secret*, che invalida anche anon key e sessioni) | Vercel `SUPABASE_SERVICE_ROLE_KEY` | Nessuno con le nuove chiavi; con il roll del JWT secret tutti gli utenti fanno di nuovo login e va aggiornata anche l'anon key (web e mobile) | Cron `cleanup` verde, pannello admin carica |
| Anon / publishable key | Come sopra | `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Vercel), `EXPO_PUBLIC_SUPABASE_ANON_KEY` (build mobile) | La vecchia app mobile smette di funzionare: pubblica prima la build nuova | Login web e mobile |
| Password del database | Database → Settings → *Reset database password* | GitHub secret `SUPABASE_DB_URL` (environment `production`) | Le migration del deploy usano il nuovo valore | Prossimo deploy: job `apply-migrations` verde |
| `ADMIN_IMPERSONATION_SECRET` | Genera nuovo valore | Vercel (Production e Preview diversi) | Le impersonazioni in corso terminano | Avvia e chiudi un'impersonazione |
| `CRON_SECRET` | Genera nuovo valore | Vercel (Vercel Cron lo invia da solo) | Nessuno | Log del cron successivo: 200 |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys: crea, poi elimina la vecchia | Vercel | Nessuno | Una generazione AI dall'app |
| `RESEND_API_KEY` | Resend → API Keys | Vercel | Nessuno | Invio di un invito |
| `EXCHANGE_RATE_API_KEY` | Dashboard del provider | Vercel | Fino all'aggiornamento si usano i tassi di fallback | Nuova spesa in valuta estera convertita |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox → Tokens: nuovo token pubblico ristretto agli URL di produzione e preview, poi elimina il vecchio | Vercel, mobile | Mappe vuote fino al redeploy | Mappa del viaggio carica |
| `SENTRY_AUTH_TOKEN` (se configurato) | Sentry → Settings → Auth Tokens | Secret della build | Nessuno | Build con upload delle source map |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry → Client Keys: nuova chiave, disattiva la vecchia | Vercel, mobile | Eventi persi fino al redeploy | `GET /api/admin/sentry-test` arriva in Sentry |
| `VERCEL_TOKEN` | Vercel → Account → Tokens (scope limitato al team del progetto) | GitHub secret (environment `production`) | Nessuno | Prossimo deploy verde |
| `SLACK_WEBHOOK_URL` | Slack → app → Incoming Webhooks: rigenera | GitHub (variabile/secret del repo) | Nessuno | Notifica del deploy |
| Credenziali Google OAuth | Google Cloud → Credentials: nuovo client secret | Supabase → Providers → Google | Nessuno | Login con Google |

**Revoca delle sessioni di un utente** (account compromesso): sospendilo dal pannello admin (il middleware blocca le richieste web, ma le sessioni esistenti restano valide verso Supabase fino alla scadenza), poi revoca le sessioni dal dashboard (Authentication → Users → *Sign out user*, oppure `auth.admin.signOut`) e forza il reset della password.

**Dopo ogni rotazione:** riga nel registro delle verifiche (`04-SECURITY-CHECKLIST.md` §D) con i segreti ruotati, senza valori; se era un'esposizione, aggiorna lo stato di SR-DEV-01 e il check B4.
