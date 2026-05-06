# 🚀 Guida al Deploy in Produzione di Motonui

> **Per chi è questa guida?**  
> Questa guida è scritta per chi non è un esperto tecnico. Ogni passaggio è spiegato con parole semplici e include screenshot testuali di dove cliccare. Segui i passaggi nell'ordine indicato.

---

## 📋 Indice

1. [Prima di tutto: cosa ci serve](#1-prima-di-tutto-cosa-ci-serve)
2. [🔴 URGENTE: Sicurezza — cambia le chiavi esposte](#2--urgente-sicurezza--cambia-le-chiavi-esposte)
3. [Configura Supabase (il database)](#3-configura-supabase-il-database)
4. [Configura i servizi esterni](#4-configura-i-servizi-esterni)
5. [Pubblica il sito su Vercel](#5-pubblica-il-sito-su-vercel)
6. [Collega il tuo dominio](#6-collega-il-tuo-dominio)
7. [Test finali prima di andare live](#7-test-finali-prima-di-andare-live)
8. [Dopo il lancio: monitoraggio](#8-dopo-il-lancio-monitoraggio)

---

## 1. Prima di tutto: cosa ci serve

**Cos'è un "servizio"?** Ogni funzione del tuo sito usa un servizio esterno (come un fornitore). Devi creare un account gratuito per ciascuno.

| Servizio | A cosa serve | Costo |
|---|---|---|
| [Supabase](https://supabase.com) | Database e autenticazione utenti | Gratis fino a 50.000 utenti |
| [Vercel](https://vercel.com) | Ospita il sito web | Gratis per iniziare |
| [Mapbox](https://mapbox.com) | Mappe interattive | Gratis fino a 50.000 visite/mese |
| [Anthropic](https://console.anthropic.com) | Intelligenza Artificiale (Claude) | Pay-per-use ~$5/mese per iniziare |
| [Resend](https://resend.com) | Invio email (promemoria) | Gratis fino a 3.000 email/mese |
| [ExchangeRate-API](https://exchangerate-api.com) | Conversione valute | Gratis per 1.500 richieste/mese |
| [Sentry](https://sentry.io) | Monitoraggio errori (opzionale) | Gratis per iniziare |

> 💡 **Suggerimento:** Crea tutti gli account prima di iniziare. Ci vogliono circa 30 minuti in totale.

---

## 2. 🔴 URGENTE: Sicurezza — cambia le chiavi esposte

> ⚠️ **QUESTO È IL PASSAGGIO PIÙ IMPORTANTE.** Il file `.env.example` nel repository contiene delle chiavi reali che non dovrebbero essere pubbliche. Chi le ha può accedere al tuo database. Segui questi passaggi SUBITO.

### Cosa sono le "chiavi API"?
Immagina le chiavi API come delle password speciali che permettono al tuo sito di comunicare con i servizi esterni. Se qualcuno le ruba, può usare i tuoi servizi (e farli pagare a te, o leggere i dati degli utenti).

### Passaggio 2.1 — Rigenera le chiavi Supabase

1. Vai su [app.supabase.com](https://app.supabase.com) → accedi
2. Clicca sul tuo progetto
3. Nel menu a sinistra → **Project Settings** (l'icona dell'ingranaggio)
4. Clicca su **API**
5. Trova il campo **`service_role` key** → clicca **Reveal** per vederla
6. Cerca il pulsante **Regenerate** o contatta il supporto Supabase per revocarla
7. **Copia la nuova chiave** e salvala in un posto sicuro (es. un password manager)

> 🚨 La `service_role` key è la più pericolosa: bypassa tutte le protezioni del database.

### Passaggio 2.2 — Rigenera il token Mapbox

1. Vai su [account.mapbox.com/access-tokens](https://account.mapbox.com/access-tokens)
2. Trova il token che inizia con `pk.eyJ1IjoibmNhbGFuZHJpIi...`
3. Clicca su **Delete** (cancella il vecchio)
4. Clicca **+ Create a token**
5. Dai un nome: `motonui-production`
6. In **URL restrictions** aggiungi il tuo dominio (es. `https://motonui.app`)
7. Clicca **Create token** e copia la nuova chiave

### Passaggio 2.3 — Rigenera il segreto Admin

Questo segreto protegge la funzione di "impersonation" (quando un admin vede il profilo di un utente). Per generarne uno nuovo, apri il terminale sul tuo computer e scrivi:

```bash
openssl rand -base64 32
```

Copia il risultato. Lo userai dopo come `ADMIN_IMPERSONATION_SECRET`.

### Passaggio 2.4 — Aggiorna il file `.env.example`

Apri il file `.env.example` nel repository e sostituisci tutti i valori reali con dei placeholder:

```env
NEXT_PUBLIC_SUPABASE_URL=https://IL-TUO-PROGETTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=la-tua-anon-key
SUPABASE_SERVICE_ROLE_KEY=la-tua-service-role-key
NEXT_PUBLIC_MAPBOX_TOKEN=il-tuo-token-mapbox
ADMIN_IMPERSONATION_SECRET=il-tuo-segreto-generato
ADMIN_EMAIL=la-tua-email@esempio.com
```

---

## 3. Configura Supabase (il database)

### Cos'è Supabase?
Supabase è il "cervello" dell'app: salva tutti i dati (utenti, viaggi, spese, foto). È come un foglio Excel super potente e sicuro nel cloud.

### Passaggio 3.1 — Crea un progetto di produzione

1. Vai su [app.supabase.com](https://app.supabase.com) → **New Project**
2. Scegli la tua **organizzazione** (o creane una nuova)
3. Nome progetto: `motonui-production`
4. Password database: genera una password forte e salvala → clicca sull'icona 🔄 per generarla
5. Regione: **West EU (Frankfurt)** — siamo in Europa, i dati devono restare in EU per il GDPR
6. Clicca **Create new project** → aspetta 2-3 minuti

### Passaggio 3.2 — Esegui le migrazioni (crea le tabelle)

Le "migrazioni" sono dei file che creano la struttura del database. Devi eseguirle una volta sola.

**Opzione A — Da terminale (consigliata):**
```bash
# Prima installa Supabase CLI se non ce l'hai
npm install -g supabase

# Collega il tuo progetto (trova il Project ID su Supabase → Settings → General)
supabase link --project-ref IL-TUO-PROJECT-ID

# Esegui le migrazioni
supabase db push
```

**Opzione B — Manuale via browser:**
1. Vai su Supabase → il tuo progetto → **SQL Editor**
2. Apri ogni file nella cartella `supabase/migrations/` (in ordine numerico)
3. Copia il contenuto e incollalo nell'editor SQL → clicca **Run**

### Passaggio 3.3 — Configura l'autenticazione

1. Supabase → il tuo progetto → **Authentication** → **URL Configuration**
2. **Site URL**: inserisci `https://motonui.app` (o il tuo dominio)
3. **Redirect URLs**: aggiungi:
   - `https://motonui.app/auth/callback`
   - `https://motonui.app/**`
4. Clicca **Save**

### Passaggio 3.4 — Configura lo Storage (per le foto)

1. Supabase → **Storage**
2. Verifica che esistano i bucket: `avatars`, `trip-photos` (li crea automaticamente la migration)
3. Se non ci sono, clicca **New bucket** e creali con **Public** = false

### Passaggio 3.5 — Copia le tue chiavi API

1. Supabase → **Project Settings** → **API**
2. Copia e salva:
   - **Project URL** → sarà `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → sarà `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → sarà `SUPABASE_SERVICE_ROLE_KEY` (tienila segreta!)

---

## 4. Configura i servizi esterni

### 4.1 Mapbox (Mappe)

1. Vai su [account.mapbox.com](https://account.mapbox.com) → crea account
2. Dashboard → **Tokens** → **Create a token**
3. Nome: `motonui-production`
4. In **Allowed URLs**: aggiungi `https://motonui.app`
5. Copia il token → sarà `NEXT_PUBLIC_MAPBOX_TOKEN`

### 4.2 Anthropic (AI)

1. Vai su [console.anthropic.com](https://console.anthropic.com) → crea account
2. **API Keys** → **Create Key**
3. Nome: `motonui-production`
4. Copia la chiave (inizia con `sk-ant-`) → sarà `ANTHROPIC_API_KEY`
5. Aggiungi un metodo di pagamento (si paga solo per quello che si usa)

> 💡 Per iniziare, $10 di credito bastano per settimane di utilizzo normale.

### 4.3 Resend (Email)

1. Vai su [resend.com](https://resend.com) → crea account
2. **API Keys** → **Create API Key**
3. Nome: `motonui-production`
4. Copia la chiave → sarà `RESEND_API_KEY`
5. **Domains** → aggiungi il tuo dominio per inviare email dal tuo indirizzo

### 4.4 ExchangeRate-API (Valute)

1. Vai su [exchangerate-api.com](https://exchangerate-api.com) → **Get Free Key**
2. Crea account gratuito
3. Copia la chiave API → sarà `EXCHANGE_RATE_API_KEY`

### 4.5 Sentry (Monitoraggio errori — opzionale ma consigliato)

1. Vai su [sentry.io](https://sentry.io) → crea account gratuito
2. **New Project** → seleziona **Next.js**
3. Nome: `motonui`
4. Copia il **DSN** (sembra un URL) → sarà `NEXT_PUBLIC_SENTRY_DSN`
5. Vai su **Settings** → **Auth Tokens** → crea un token → sarà `SENTRY_AUTH_TOKEN`

---

## 5. Pubblica il sito su Vercel

### Cos'è Vercel?
Vercel è la piattaforma che "ospita" il tuo sito web, rendendolo accessibile a tutti su internet. È come affittare uno spazio su un server ultra-veloce, già configurato per Next.js.

### Passaggio 5.1 — Crea account Vercel

1. Vai su [vercel.com](https://vercel.com) → **Sign Up**
2. Scegli **Continue with GitHub** (accedi con il tuo account GitHub)

### Passaggio 5.2 — Importa il progetto

1. Vercel Dashboard → **Add New** → **Project**
2. Trova il repository `NicoloCalandri/motonui` → clicca **Import**
3. Nella pagina di configurazione:
   - **Framework Preset**: Next.js (rilevato automaticamente ✅)
   - **Root Directory**: `.` (lascia il default)
   - **Build Command**: `npm run build` (default ✅)
   - **Output Directory**: `.next` (default ✅)

### Passaggio 5.3 — Aggiungi le variabili d'ambiente

Questa è la parte più importante: devi inserire tutte le chiavi che hai raccolto nei passaggi precedenti.

1. Nella stessa pagina di configurazione, apri la sezione **Environment Variables**
2. Aggiungi una per una tutte queste variabili (nome = valore):

```
NEXT_PUBLIC_SUPABASE_URL          = https://IL-TUO-PROGETTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY     = la-tua-anon-key-supabase
SUPABASE_SERVICE_ROLE_KEY         = la-tua-service-role-key-supabase
NEXT_PUBLIC_MAPBOX_TOKEN          = il-tuo-token-mapbox
ANTHROPIC_API_KEY                 = sk-ant-la-tua-chiave
EXCHANGE_RATE_API_KEY             = la-tua-chiave-exchangerate
RESEND_API_KEY                    = la-tua-chiave-resend
NEXT_PUBLIC_SENTRY_DSN            = https://...@sentry.io/...
SENTRY_AUTH_TOKEN                 = il-tuo-token-sentry
NEXT_PUBLIC_APP_URL               = https://motonui.app
NEXT_PUBLIC_APP_NAME              = motonui
ADMIN_IMPERSONATION_SECRET        = il-segreto-generato-con-openssl
ADMIN_EMAIL                       = la-tua-email@esempio.com
```

> 💡 Per le variabili che non iniziano con `NEXT_PUBLIC_`, assicurati di selezionare **Production** come ambiente (non esporre al client).

3. Clicca **Deploy** → aspetta 2-3 minuti

Se tutto va bene, vedrai una schermata verde con **"Your project has been successfully deployed!"** 🎉

Il sito sarà raggiungibile su un URL del tipo: `motonui-abc123.vercel.app`

### Passaggio 5.4 — Promuovi il primo admin

Dopo il deploy, devi impostare te stesso come admin nel database:

1. Vai su Supabase → il tuo progetto → **SQL Editor**
2. Incolla ed esegui questa query (sostituisci con la tua email):

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'la-tua-email@esempio.com'
);
```

3. Prima però devi registrarti sull'app (vai su `motonui-abc123.vercel.app/auth/register`)

---

## 6. Collega il tuo dominio

> Se non hai ancora un dominio, puoi comprarne uno su [Namecheap](https://namecheap.com) (~€10/anno) o [Cloudflare](https://cloudflare.com/registrar) (~€8/anno).

### Passaggio 6.1 — Aggiungi il dominio su Vercel

1. Vercel → il tuo progetto → **Settings** → **Domains**
2. Inserisci il tuo dominio (es. `motonui.app`) → clicca **Add**
3. Vercel ti mostrerà dei record DNS da aggiungere

### Passaggio 6.2 — Configura i DNS

1. Vai sul sito dove hai comprato il dominio (Namecheap, GoDaddy, ecc.)
2. Trova la sezione **DNS Management** o **DNS Settings**
3. Aggiungi i record che ti ha dato Vercel:
   - Di solito un record **A** che punta a `76.76.21.21`
   - Oppure un record **CNAME** che punta a `cname.vercel-dns.com`
4. Aspetta 5-60 minuti per la propagazione DNS

### Passaggio 6.3 — Aggiorna le URL nei servizi

Ora che hai un dominio reale, aggiorna:

**Supabase:**
- Authentication → URL Configuration → Site URL = `https://motonui.app`
- Redirect URLs = `https://motonui.app/auth/callback`

**Vercel:**
- Settings → Environment Variables → aggiorna `NEXT_PUBLIC_APP_URL` = `https://motonui.app`
- Poi rideploya: Deployments → clicca i tre puntini sull'ultimo deploy → **Redeploy**

**Mapbox:**
- Vai sul token → modifica Allowed URLs → aggiungi `https://motonui.app`

---

## 7. Test finali prima di andare live

Esegui questi test uno per uno e metti una spunta ✅ quando funzionano:

### Autenticazione
- [ ] Registrazione nuovo utente (`/auth/register`)
- [ ] Login con email e password (`/auth/login`)
- [ ] Logout
- [ ] Reset password via email

### Funzionalità core
- [ ] Crea un nuovo viaggio
- [ ] Aggiungi una spesa e verifica la conversione valuta
- [ ] Carica una foto profilo (avatar)
- [ ] Carica una foto nel diario di viaggio
- [ ] La mappa si carica correttamente
- [ ] La funzione AI genera un testo (costa ~$0.01 per test)

### Admin
- [ ] Accedi con l'account admin
- [ ] La dashboard `/admin` è visibile
- [ ] Un utente normale non vede `/admin` (test con un secondo account)

### Email
- [ ] Registrazione → arriva l'email di conferma
- [ ] Il cron job dei promemoria è configurato (si vede in Vercel → Cron Jobs)

---

## 8. Dopo il lancio: monitoraggio

### Cosa monitorare ogni giorno (5 minuti)

| Cosa | Dove guardare | Cosa fare se va male |
|---|---|---|
| Errori del sito | [sentry.io](https://sentry.io) | Leggi il messaggio di errore e cerca su Google |
| Utilizzo database | Supabase → Dashboard | Se supera i limiti, aggiorna il piano |
| Costi AI | [console.anthropic.com](https://console.anthropic.com) → Usage | Imposta un budget limit nelle impostazioni |
| Visitatori | Vercel → Analytics | Nessuna azione urgente |

### Limiti dei piani gratuiti

| Servizio | Limite gratuito | Costo se superi |
|---|---|---|
| Supabase Free | 50.000 utenti attivi/mese, 500MB DB | ~$25/mese (Pro plan) |
| Vercel Free | 100GB bandwidth/mese | ~$20/mese (Pro plan) |
| Mapbox Free | 50.000 map loads/mese | ~$0.50 per 1.000 extra |
| Anthropic | Nessun free tier | ~$0.003 per richiesta AI |
| Resend Free | 3.000 email/mese | ~$20/mese |

### Backup del database

Supabase fa i backup automaticamente ogni giorno (sul piano Pro). Sul piano gratuito, fai un backup manuale ogni settimana:

1. Supabase → **Database** → **Backups**
2. Clicca **Download** sull'ultimo backup

---

## 🆘 Problemi comuni e soluzioni

| Problema | Causa probabile | Soluzione |
|---|---|---|
| "Invalid API key" | Variabile d'ambiente mancante o sbagliata | Vercel → Settings → Env Variables → controlla le chiavi |
| Login non funziona | URL di redirect non configurato in Supabase | Supabase → Auth → URL Configuration |
| Mappa bianca | Token Mapbox non valido o URL restriction | Controlla il token su account.mapbox.com |
| Email non arrivano | Dominio Resend non verificato | Resend → Domains → verifica il dominio |
| Errore "500" su tutto | Build fallita | Vercel → il tuo progetto → Functions → controlla i log |
| Foto non si caricano | Bucket Supabase Storage non creato | Supabase → Storage → crea i bucket |

---

## 📞 Dove chiedere aiuto

- **Supabase:** [discord.supabase.com](https://discord.supabase.com) — comunità molto attiva
- **Vercel:** [vercel.com/help](https://vercel.com/help) — documentazione eccellente
- **Next.js:** [nextjs.org/docs](https://nextjs.org/docs)
- **Stack Overflow:** cerca il messaggio di errore su Google + "Next.js" o "Supabase"

---

*Ultima revisione: Maggio 2026 — Motonui v0.1.0*
