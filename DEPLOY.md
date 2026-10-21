# Deploy in produzione

Piano per portare motonui in produzione su **`motonui.app`**: app web (Vercel + Supabase cloud) e app mobile (App Store e Google Play), pubblicate insieme. Si seguono le sezioni in ordine; ogni sezione dice cosa serve prima di cominciare.

Scelte fatte:

| Decisione | Valore |
|---|---|
| Dominio | `motonui.app` (registrar consigliato: Cloudflare, ~12–15 €/anno) |
| Piano Supabase | **Free** (limiti e compensazioni in §2.6) |
| Regione | Supabase: Frankfurt (`eu-central-1`); Vercel: `fra1` (già in `vercel.json`) |
| Deploy web | GitHub Actions (`deploy-production.yml`): il deploy automatico di Vercel da Git su `main` è disattivato in `vercel.json` |
| Mobile | Build e invio agli store con EAS (`mobile/eas.json`) |

Documenti collegati: `docs/ENV_VARS.md` (variabili una per una), `docs/security/04-SECURITY-CHECKLIST.md` §B (checklist di rilascio), `docs/security/05-OPS-RUNBOOK.md` (Auth, backup, rotazione segreti), `docs/ADMIN_SETUP.md`.

---

## 1. Account da creare

| Servizio | Serve per | Costo |
|---|---|---|
| Cloudflare (o altro registrar) | Dominio `motonui.app` e DNS | ~12–15 €/anno |
| Supabase | DB, Auth, Storage | Free |
| Vercel | Hosting web, cron | Free (Hobby) |
| GitHub | CI, deploy, secret | già presente |
| Mapbox | Mappe | Free fino a 50.000 caricamenti/mese |
| Google Cloud | Login con Google (OAuth) | Free |
| Resend | Email dell'app **e** SMTP di Supabase Auth | Free fino a 3.000 email/mese |
| Anthropic | Funzioni AI (opzionale) | a consumo: imposta un budget limit |
| ExchangeRate-API | Cambi valuta (opzionale) | Free |
| Sentry | Errori (opzionale, ma serve per il check B12) | Free |
| Expo (EAS) | Build mobile | Free con build limitate |
| Apple Developer Program | App Store e TestFlight | 99 $/anno |
| Google Play Console | Play Store | 25 $ una tantum |

Tutti i segreti vanno nel password manager condiviso, mai in chat, issue o file del repo.

---

## 2. Supabase (progetto di produzione)

### 2.1 Progetto

1. Supabase → **New project**, nome `motonui-production`, regione **Frankfurt**, password del DB generata e salvata.
2. Dal dashboard annota:
   - Project Settings → API: **Project URL**, **anon key**, **service role key**;
   - Database → Connect → **Session pooler**: la connection string (diventa `SUPABASE_DB_URL` su GitHub).

### 2.2 Schema

Le migration le applica la GitHub Action a ogni deploy (§4). Per il primo allineamento puoi farlo a mano:

```bash
supabase link --project-ref <PROJECT_REF>
supabase db push
```

Poi Storage: devono esistere `trip-media`, `trip-documents`, `instagram-exports` (privati) e `avatars` (pubblico). Li creano le migration: non crearli a mano.

### 2.3 Auth

Authentication → **URL Configuration**:

- Site URL: `https://motonui.app`
- Redirect URLs: `https://motonui.app/**`, `https://*-<team-vercel>.vercel.app/**` (solo i preview del progetto), `motonui://**` (app mobile). Niente `*` generici.

Poi replica la tabella di parità di `docs/security/05-OPS-RUNBOOK.md` §1: conferma email, cambio email con doppia conferma, riautenticazione per il cambio password, JWT 3600 s, rotazione refresh token, password ≥ 10 con lettere e numeri.

### 2.4 Login con Google

1. Google Cloud Console → nuovo progetto `motonui` → **OAuth consent screen**: tipo *External*, nome motonui, dominio `motonui.app`, link a privacy policy e termini (§7.3). Scope: solo `email`, `profile`, `openid`.
2. **Credentials → Create OAuth client ID** → *Web application*:
   - Authorized JavaScript origins: `https://motonui.app`
   - Authorized redirect URIs: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
3. Supabase → Authentication → Providers → **Google**: attiva, incolla Client ID e Client Secret.
4. Pubblica l'app OAuth (*Publish app*): finché è in *Testing* entrano solo gli utenti di test elencati.

L'app web manda già l'utente su `/auth/callback` dopo il login (`src/app/auth/login/page.tsx`). L'app mobile oggi ha solo email e password: Google sul mobile è un lavoro a parte (client OAuth iOS/Android e redirect `motonui://`).

### 2.5 SMTP (obbligatorio sul piano Free)

L'SMTP integrato di Supabase invia pochissime email l'ora: conferme e reset si bloccherebbero. Authentication → **SMTP Settings** → custom SMTP con Resend:

- Host `smtp.resend.com`, porta `465`, utente `resend`, password = una API key Resend dedicata
- Mittente: `motonui <noreply@motonui.app>` (dominio verificato in Resend, §3.3)

### 2.6 Cosa comporta il piano Free

| Limite | Compensazione |
|---|---|
| Il progetto va **in pausa dopo 7 giorni senza attività** | I cron giornalieri di Vercel (§4.2) interrogano il DB; nella prima settimana controlla che il progetto resti *Active* |
| Nessun backup scaricabile né PITR | Dump cifrato **settimanale** come in `05-OPS-RUNBOOK.md` §2.2; restore di prova trimestrale |
| Niente *leaked password protection* | Registrala come eccezione in `04-SECURITY-CHECKLIST.md` (tabella *Eccezioni accettate*): SR-AUTH-07 resta 🟡 |
| DB 500 MB, Storage 1 GB | Per due utenti basta; controlla l'uso mensilmente (video e ZIP Instagram sono i più pesanti, gli ZIP si cancellano dopo 24 h) |

Si passa a Pro quando ci sono utenti oltre a voi due.

---

## 3. Servizi esterni

### 3.1 Dominio

1. Compra `motonui.app` su Cloudflare Registrar.
2. Vercel → progetto → Settings → **Domains** → aggiungi `motonui.app` e `www.motonui.app` (redirect su `motonui.app`); copia i record DNS proposti in Cloudflare (proxy **disattivato**, nuvola grigia).

### 3.2 Mapbox

Nuovo token pubblico `motonui-production` con URL restriction `https://motonui.app` e gli URL dei preview. Se un vecchio token è finito nel repo, cancellalo.

### 3.3 Resend

1. Domains → aggiungi `motonui.app` → copia i record SPF/DKIM (e DMARC consigliato) in Cloudflare → attendi *Verified*.
2. Due API key separate: una per l'app (`RESEND_API_KEY` su Vercel), una per lo SMTP di Supabase (§2.5). Così si ruotano indipendentemente.

### 3.4 Anthropic, ExchangeRate-API, Sentry

- Anthropic: API key `motonui-production` e un **budget limit mensile** in console.
- ExchangeRate-API: chiave gratuita.
- Sentry: progetto Next.js, copia il DSN.

---

## 4. Vercel e GitHub

### 4.1 Progetto Vercel

1. Vercel → Add New → Project → importa il repo (framework Next.js, il resto dal `vercel.json`).
2. Settings → **Environment Variables**, ambiente **Production** (valori diversi in Preview):

```text
NEXT_PUBLIC_SUPABASE_URL        https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   anon key
SUPABASE_SERVICE_ROLE_KEY       service role key
NEXT_PUBLIC_MAPBOX_TOKEN        pk.…
NEXT_PUBLIC_APP_URL             https://motonui.app
NEXT_PUBLIC_APP_NAME            motonui
ADMIN_IMPERSONATION_SECRET      openssl rand -base64 48
CRON_SECRET                     openssl rand -base64 48
RESEND_API_KEY                  re_…
RESEND_FROM_EMAIL               motonui <noreply@motonui.app>
ANTHROPIC_API_KEY               sk-ant-…            (opzionale)
EXCHANGE_RATE_API_KEY           …                   (opzionale)
NEXT_PUBLIC_SENTRY_DSN          https://…@sentry.io/… (opzionale)
```

`ADMIN_AUTH_BYPASS` non si imposta mai fuori dal locale (la build la rifiuta).

3. Account → **Tokens**: crea un token con scope sul solo team del progetto. Da `.vercel/project.json` (dopo `npx vercel link`) prendi `orgId` e `projectId`.

### 4.2 Cron

`vercel.json` pianifica `send-reminders` (08:00 UTC) e `cleanup` (03:00 UTC); Vercel invia `Authorization: Bearer $CRON_SECRET` da solo. Il piano Hobby permette cron giornalieri: non aumentarne la frequenza.

### 4.3 GitHub

Settings → **Environments**:

| Environment | Secret |
|---|---|
| `production` | `SUPABASE_DB_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| `staging` | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (preview) |

Facoltativi: variabile `SLACK_WEBHOOK_URL` per le notifiche del deploy, `CODECOV_TOKEN`.

Su `production` attiva *Required reviewers* (uno di voi due) se volete approvare ogni deploy. Branch protection su `main` con i check della CI obbligatori (checklist B16).

### 4.4 Come avviene un deploy

Merge di una PR su `main` → CI verde → `deploy-production.yml`: applica le migration (`supabase db push`), poi build e deploy su Vercel dello stesso commit testato. Se le migration falliscono il codice non parte.

---

## 5. Primo avvio

1. **Primo admin.** L'app non ha registrazione libera con email: gli account si creano dal pannello admin o entrando con Google. Per il primo:
   - entra su `https://motonui.app/auth/login` con Google, **oppure** Supabase → Authentication → Users → *Add user* (con *Auto confirm*);
   - promuovilo con la query di `docs/ADMIN_SETUP.md` nello SQL Editor;
   - rientra e apri `/admin`.
2. **Dati vecchi**: solo se il progetto di produzione contiene dati precedenti, esegui `npm run storage:migrate-boarding-passes -- --apply` (T-0.9).
3. **Segreti esposti in passato** (T-0.1): ruotali tutti come in `05-OPS-RUNBOOK.md` §3 prima di aprire l'app.

---

## 6. App mobile

### 6.1 Preparazione

```bash
cd mobile
npm install -g eas-cli
eas login
eas init                  # collega il progetto Expo e scrive l'id in app.json
```

Il bundle id è `com.motonui.app` su iOS e Android (`mobile/app.json`): **non cambia più** dopo la prima pubblicazione.

### 6.2 Variabili

Su expo.dev → progetto → **Environment variables**, ambiente `production` (e `preview` puntato allo staging):

```text
EXPO_PUBLIC_SUPABASE_URL        https://<PROJECT_REF>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY   anon key
```

Sono pubbliche per natura (finiscono nel bundle): mai segreti lì. La sicurezza del mobile sta nella RLS.

### 6.3 Build e invio

```bash
eas build --profile preview --platform all      # build interne per provare sui vostri telefoni
eas build --profile production --platform all
eas submit --profile production --platform ios      # TestFlight / App Store Connect
eas submit --profile production --platform android  # Play Console (traccia interna)
```

Al primo invio EAS chiede le credenziali Apple e la chiave del service account di Google Play.

### 6.4 Store

- **App Store Connect**: scheda dell'app, screenshot, URL della privacy policy, *App Privacy* (dati raccolti: email, foto, posizione dei luoghi inseriti), **account di test** per la review.
- **Play Console**: scheda, *Data safety*, classificazione dei contenuti, test interno prima della produzione. Gli account personali nuovi devono fare un test chiuso (12 tester per 14 giorni) prima di pubblicare in produzione.
- Ordine con le chiavi: se ruoti la anon key, prima pubblichi la build mobile nuova, poi revochi la vecchia (la build vecchia smette di funzionare).

---

## 7. Prima di aprire

### 7.1 Checklist di rilascio

Passa `docs/security/04-SECURITY-CHECKLIST.md` §B (B1–B17) e annota l'esito nel registro (§D). I punti che si fanno solo sul cloud: Security Advisor senza errori (B7), prova REST con anon key (B8), bucket privati (B9), parità Auth (B10), cron verdi (B11), evento Sentry di prova (B12), header (B13), token Mapbox ristretto (B14).

### 7.2 Smoke test (B17)

Su web e su mobile, con un account di test:

- [ ] login con email e con Google (solo web); logout; reset password con email ricevuta
- [ ] creazione viaggio, invito al partner, accettazione dell'invito
- [ ] spesa in valuta estera convertita
- [ ] upload foto (thumbnail generato) e documento
- [ ] mappa caricata
- [ ] generazione AI
- [ ] post pubblicato e visibile da anonimo su `/blog`
- [ ] `/admin` accessibile all'admin, negato all'utente normale
- [ ] il giorno dopo: cron `send-reminders` e `cleanup` con 200 nei log Vercel

### 7.3 Pagine legali

Privacy policy e termini pubblicati su `motonui.app` prima di aprire: li chiedono Google OAuth (consent screen) e entrambi gli store, e il GDPR li richiede comunque.

---

## 8. Dopo il lancio

| Frequenza | Cosa |
|---|---|
| Giornaliera, la prima settimana | Sentry, log Vercel, progetto Supabase *Active* |
| Settimanale | Dump cifrato del DB (`05-OPS-RUNBOOK.md` §2.2); PR di Dependabot |
| Mensile | Costi Anthropic, uso di DB e Storage, `admin_audit_log` |
| Trimestrale | Restore di prova (§2.3 del runbook) |
| Annuale o dopo un'esposizione | Rotazione di tutti i segreti (§3 del runbook) |

## Problemi frequenti

| Sintomo | Causa probabile |
|---|---|
| Login Google torna con errore | Redirect URI su Google Cloud diverso da `https://<PROJECT_REF>.supabase.co/auth/v1/callback`, o app OAuth ancora in *Testing* |
| Dopo il login si finisce su un altro dominio | Site URL / Redirect URLs di Supabase |
| Email di conferma non arrivano | SMTP custom non configurato o dominio Resend non verificato |
| Mappa vuota | Token Mapbox assente o URL restriction senza il dominio |
| Deploy fermo a *Apply migrations* | `SUPABASE_DB_URL` mancante o password del DB cambiata |
| App irraggiungibile, API in errore | Progetto Supabase in pausa: *Restore* dal dashboard |
