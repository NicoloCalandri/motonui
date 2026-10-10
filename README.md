# 🏝️ motonui

> *Dal nome di Motu Nui, una delle tre terre più vicine al Point Nemo, il posto più remoto della Terra. Perché i viaggi migliori sono quelli che sembrano impossibili finché non li fai.*

**motonui** è una web app per coppie che viaggiano. Si pianificano gli itinerari insieme, si tracciano spese e spostamenti, si pubblica un travel blog e si generano contenuti pronti per Instagram.

---

## ✨ Funzionalità

| Funzionalità | Descrizione |
|---|---|
| 🗺️ **Pianificatore** | Itinerario con giorni, tappe, spostamenti e alloggi |
| 💸 **Spese** | Divisione dei costi, categorie, conversione di valuta (importi in centesimi) |
| 📸 **Foto e documenti** | Upload diretto su storage privato, thumbnail WebP, URL firmati |
| ✍️ **Travel blog** | Editor Tiptap, blog pubblico senza login, sitemap, robots e immagini Open Graph |
| 📷 **Generatore Instagram** | Export asincrono di caroselli in ZIP |
| 🤖 **Assistente AI** | Scrittura, SEO, briefing destinazione, valigia e riassunto del viaggio (Claude API) |
| 👫 **Coppia** | Un viaggio ha al massimo due membri; il partner entra con un invito |
| 📱 **App mobile** | Client Expo in [`mobile/`](./mobile/) che parla direttamente con Supabase |

---

## 🛠️ Stack

| Layer | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript strict |
| Database, Auth, Storage | Supabase (Postgres con RLS, email + password e Google) |
| Stile | Tailwind CSS + shadcn/ui |
| Mappe | Mapbox GL |
| Immagini | sharp (solo server-side) |
| AI | Anthropic Claude API |
| Monitoraggio | Sentry, log strutturati con `request_id` |
| Test | Vitest, Testing Library, axe, test SQL per le RLS |
| Deploy | Vercel + GitHub Actions |

## 🏗️ Struttura

```
motonui/
├── src/
│   ├── app/              # Pagine e route API (App Router)
│   │   ├── (auth)/       # Login e registrazione
│   │   ├── (app)/        # App autenticata
│   │   └── (public)/     # Blog pubblico
│   ├── components/       # Componenti UI
│   ├── lib/              # Logica di dominio, client Supabase, AI, media, tipi
│   └── middleware.ts     # Sessione, CSP con nonce, controllo Origin
├── supabase/             # Migration, seed e test SQL
├── mobile/               # App Expo
├── nextgen/              # Prototipo Vite + Hono (fuori dalla CI)
├── scripts/              # Strumenti operativi
├── agents/               # Prompt degli agenti di sviluppo
├── docs/                 # PRD, architettura, piano a fasi, sicurezza
└── .github/workflows/    # CI e deploy
```

## 🚀 Avvio in locale

Richiede Node.js 20+, la [Supabase CLI](https://supabase.com/docs/guides/local-development) e Docker.

```bash
git clone https://github.com/NicoloCalandri/motonui
cd motonui
npm run setup        # copia .env.example in .env.local e installa le dipendenze
npm run db:start     # stack Supabase locale
npm run dev
```

Variabili necessarie per far partire il server: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN`. `ANTHROPIC_API_KEY`, `EXCHANGE_RATE_API_KEY` e `NEXT_PUBLIC_SENTRY_DSN` sono opzionali: senza, AI, conversione live e tracciamento errori restano disattivati. L'elenco completo è in `.env.example`; non committare mai file `.env` con valori reali.

## ✅ Controlli prima di una PR

```bash
npm run type-check   # TypeScript
npm run lint         # ESLint, zero warning
npm run test         # test unitari
npm run build        # build di produzione
npm run test:rls     # test SQL sulle RLS (dopo npm run db:start)
```

Il progetto richiede almeno il 70% di copertura su `src/lib/` (`npm run test:coverage`). Dopo ogni migration si rigenerano i tipi con `npm run db:types`. `main` è protetto: ogni modifica passa da una PR.

## 🚢 Deploy

Il deploy di produzione parte da `main` solo dopo una CI verde: applica le migration e poi pubblica su Vercel. Servono i segreti `SUPABASE_DB_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` nell'ambiente `production` di GitHub. Dettagli in [`DEPLOY.md`](./DEPLOY.md).

## 📚 Documentazione

| File | Contenuto |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Regole di codice e convenzioni del progetto |
| [`docs/PRD.md`](./docs/PRD.md) | Requisiti funzionali e non funzionali |
| [`docs/architecture.md`](./docs/architecture.md) | Architettura attuale, obiettivo e ADR |
| [`docs/tasks.md`](./docs/tasks.md) | Piano a fasi e migrazioni di dipendenze |
| [`docs/security/`](./docs/security/) | Requisiti, threat model, checklist e runbook operativo |

---

## 📱 Debug dell'app mobile (VS Code)

### Prerequisiti

1. Installa l'estensione **[React Native Tools](https://marketplace.visualstudio.com/items?itemName=msjsdiag.vscode-react-native)** (`ms-vscode.vscode-react-native`) in VS Code.
2. Assicurati di avere **Node.js**, **Expo CLI** e un emulatore Android / simulatore iOS già configurati.

### Avviare il server Expo in modalità debug

```bash
cd mobile
npx expo start --dev-client   # oppure: npx expo start
```

Tieni il terminale aperto: il bundler Metro deve rimanere attivo durante il debug.

### Configurazione `launch.json`

Il file `.vscode/launch.json` nella root del progetto contiene già tre configurazioni pronte:

| Configurazione | Descrizione |
|---|---|
| `Debug Android (Expo)` | Avvia l'app su emulatore / dispositivo Android |
| `Debug iOS (Expo)` | Avvia l'app su simulatore / dispositivo iOS |
| `Attach to Expo packager` | Si aggancia a un packager già in esecuzione |

### Passi per il debug

1. Apri il progetto in VS Code dalla cartella radice `motonui/`.
2. Avvia il server Expo dal terminale (vedi sopra).
3. Apri il pannello **Run and Debug** (`Ctrl+Shift+D` / `⌘⇧D`).
4. Seleziona la configurazione desiderata dal menu a tendina (es. `Debug Android (Expo)`).
5. Premi **▶ Start Debugging** (o `F5`).
6. VS Code si connette al packager e i **breakpoint** nel codice TypeScript/TSX diventano attivi.

> **Tip – Attach**: se vuoi agganciarti a un'app già aperta su dispositivo fisico, usa `Attach to Expo packager` dopo aver avviato `npx expo start`.

> **Hermes DevTools**: l'app usa Hermes come motore JS. Puoi aprire i DevTools nativi premendo `j` nel terminale del packager oppure collegandoti a `chrome://inspect` nel browser.

---

## 📧 Email e autenticazione

Per il reset della password serve un provider SMTP configurato nel dashboard Supabase. In sviluppo si consiglia [Mailtrap](https://mailtrap.io/) (Sandbox):

1. In Supabase vai su `Settings > Auth > SMTP`.
2. Imposta host `sandbox.smtp.mailtrap.io`, porta `2525` e le credenziali del tuo inbox Mailtrap.
3. Imposta un indirizzo mittente (es. `noreply@motonui.app`).

La configurazione di Auth in produzione (conferma email, durata dei token, policy password) segue la tabella di parità in [`docs/security/05-OPS-RUNBOOK.md`](./docs/security/05-OPS-RUNBOOK.md).

---

*Coordinate del Point Nemo: 48°52,6′S 123°23,6′W, il luogo più solitario della Terra, a circa 2.688 km dalla terra più vicina.*
