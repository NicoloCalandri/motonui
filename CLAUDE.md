# CLAUDE.md — motonui

Istruzioni per Claude Code. Leggi questo file integralmente prima di toccare qualsiasi file del progetto.

---

## Cos'è questo progetto

**motonui** è una web app per coppie che viaggiano. Permette di pianificare itinerari, tracciare spese, pubblicare un travel blog e generare contenuti pronti per Instagram. È un progetto personale di Nicolò e Giorgia.

Il nome viene da *Motu Nui*, l'isolotto più vicino al Point Nemo — il posto più remoto della Terra.

---

## Come lavorare su questo progetto

### Prima di iniziare qualsiasi task

1. Leggi `agents/00_ORCHESTRATOR.md` per capire la visione d'insieme
2. Leggi il file agente rilevante in `agents/` per la fase su cui stai lavorando
3. Leggi `docs/architecture.md` (architettura attuale, obiettivo e ADR) e `docs/tasks.md` (piano a fasi)
4. Se il task tocca sicurezza, DB, storage, API o CI, leggi `docs/security/` — in particolare `04-SECURITY-CHECKLIST.md`
5. Controlla `src/lib/types/` (importato come `@/lib/types`) prima di creare nuovi tipi — potrebbe già esistere quello che cerchi

Documenti di riferimento:

| File | Contenuto |
|---|---|
| `docs/PRD.md` | Requisiti funzionali (FR) e non funzionali (NFR) |
| `docs/architecture.md` | Architettura com'è, differenze con questo file, architettura obiettivo, ADR |
| `docs/REVIEW.md` | Analisi del codice: finding di sicurezza (S), qualità (Q), testabilità (T) |
| `docs/tasks.md` | Piano a fasi (T-0.x … T-5.x) |
| `docs/security/01-SECURITY-REQUIREMENTS.md` | Registro dei requisiti di sicurezza `SR-…` e loro stato |
| `docs/security/02-THREAT-MODEL.md` | Threat model STRIDE |
| `docs/security/03-SECURITY-ARCHITECTURE.md` | Confini di fiducia, token, livelli di autorizzazione, header, log |
| `docs/security/04-SECURITY-CHECKLIST.md` | Checklist per PR e rilasci, registro verifiche |
| `docs/security/05-OPS-RUNBOOK.md` | Parità Auth locale/cloud, backup e restore, rotazione dei segreti |

`docs/archive/` contiene documenti superati (vecchio `ARCHITECTURE.md` e `SECURITY.md`): non usarli come fonte.

### Ordine di lavoro

L'ordine degli agenti descrive la costruzione da zero:

```
01_ARCHITECT  →  02_BACKEND  →  03_FRONTEND  →  04_MEDIA  →  05_CONTENT  →  06_DEVOPS
```

Il codice copre già tutte le fasi, quindi oggi si procede **per rischio** seguendo `docs/tasks.md` (Fase 0 contenimento → Fase 5 SEO). Ogni task indica l'agente di riferimento, che dà lo scope del commit. Regola invariata: nessuna modifica di frontend che dipenda da uno schema non ancora migrato. Ogni PR che chiude un requisito aggiorna la riga corrispondente in `docs/security/01-SECURITY-REQUIREMENTS.md`.

---

## Stack tecnico

| Layer | Tecnologia |
|---|---|
| Framework | Next.js 15, App Router, TypeScript strict |
| Database | Supabase (Postgres + RLS) |
| Auth | Supabase Auth (email + password + Google OAuth; niente magic link, vedi ADR-06) |
| Storage | Supabase Storage |
| Styling | Tailwind CSS + shadcn/ui (config unica: `tailwind.config.ts`) |
| Mappe | Mapbox GL |
| Blog editor | Tiptap |
| Grafici | Recharts |
| Image processing | sharp (solo server-side) |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) |
| Test | Vitest + Testing Library |
| Deploy | Vercel + GitHub Actions |

---

## Regole di codice

### TypeScript
- Strict mode attivo — zero `any`, zero `// @ts-ignore`
- Tutti i tipi di dominio vivono in `src/lib/types/`, un file per dominio (`rows.ts`, `api.ts`, `planning.ts`…) riesportato da `index.ts`: si importano sempre da `@/lib/types`
- Usa i tipi generati da Supabase (`src/lib/supabase/database.types.ts`) come base, wrappali in tipi di dominio più leggibili. I client (`createClient`, `createAdminClient`, middleware) sono tipizzati `<Database>`: niente cast `as any` su `from()`/`rpc()`. Dopo ogni migration rigenera i tipi (`npm run db:types`)
- Le colonne `jsonb` si scrivono con `toJson()` e si leggono con `fromJson<T>()` (`src/lib/json.ts`)
- Una colonna polimorfica senza FK (es. `reminders.entity_id`) non si può embeddare in PostgREST: carica le entità con una query per tipo (`src/lib/reminder-emails.ts`)
- Preferisci `type` a `interface` per i tipi di dominio, `interface` per i props dei componenti React

### Naming
- File: `kebab-case` (es. `expense-summary.tsx`)
- Componenti e tipi: `PascalCase`
- Funzioni, variabili: `camelCase`
- Costanti: `UPPER_SNAKE_CASE`
- Route API: `/api/trips/[id]/expenses` — plurale, kebab-case

### Struttura file
- Massimo 300 righe per file — se superi, spezza in moduli
- Test co-locati con il file sorgente: `expenses.ts` → `expenses.test.ts`
- Componenti grandi: una cartella con `index.tsx`, `types.ts`, `utils.ts`

### Import
```typescript
// Ordine: external → internal → types → styles
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Trip } from '@/lib/types'
```

---

## Regole per il database

- **Non scrivere mai SQL diretto nelle API route** — usa sempre il client Supabase
- Tutte le query devono passare attraverso il client server (cookie-based), mai il client browser nelle API
- RLS è abilitato su tutte le tabelle — non bypassarlo mai con il service role key lato client
- Ogni nuova tabella richiede una migration in `supabase/migrations/`
- Testa sempre le RLS policy con un utente non autorizzato prima di fare PR
- **La RLS è il confine primario** (SADR-01): il mobile e i client component parlano direttamente con Supabase, quindi ogni invariante di sicurezza va espressa anche nel DB
- Ogni policy `UPDATE` ha `WITH CHECK`; non aggiungere policy permissive che ne allargano un'altra sulla stessa operazione (sono in OR)
- Le colonne strutturali (`id`, `trip_id`, `owner_id`, `uploaded_by`, `author_id`, `media.url`, `media.storage_path`, `media.thumb_path`, `documents.file_path`, `created_at`) sono protette dal trigger `prevent_structural_update()`: aggiungilo alle nuove tabelle di viaggio
- Un viaggio ha al massimo due membri (trigger `enforce_trip_member_limit`): i viaggi si creano con la RPC `create_trip()` e il partner entra solo con `accept_trip_invite()` (`src/lib/invites.ts`, migration `0021`), mai inserendo direttamente in `trip_members`
- Le colonne sensibili di `profiles` (`role`, `plan`, `premium_*`, `suspended_*`) si scrivono solo con il service role
- Funzioni `SECURITY DEFINER` sempre con `set search_path = public, pg_temp`; nessuna vista su `auth.users` leggibile da `anon`/`authenticated`
- Service role solo alle condizioni di `docs/security/03-SECURITY-ARCHITECTURE.md` §3.3
- Ogni modifica a `[auth]` in `supabase/config.toml` si replica sul progetto cloud (tabella di parità in `docs/security/05-OPS-RUNBOOK.md` §1); la policy password dell'app (`src/lib/auth/password.ts`) resta allineata a `minimum_password_length`/`password_requirements`

---

## Regole per le API route

- Ogni route valida l'input con **Zod** — niente `req.body` non validato
- Ogni route controlla l'autenticazione prima di qualsiasi operazione
- Formato errore standardizzato (vedi `src/lib/errors.ts`):
  ```json
  { "error": "Messaggio leggibile", "code": "TRIP_NOT_FOUND", "status": 404 }
  ```
- Log strutturato con `log.info|warn|error` (`src/lib/log.ts`), mai `console.*` lato server: `log.error('[motonui][trips][GET] errore descrittivo', error)` scrive una riga JSON con `request_id` e dettagli redatti. Si loggano id, conteggi, codici e messaggi di errore; mai contenuti di viaggio (titoli, luoghi, note, oggetti delle email) né email
- Gli errori inattesi passano da `withErrorHandler`/`withRoute` → `captureError` (`src/lib/monitoring.ts`): log + Sentry con tag `route` e `request_id`. La risposta porta l'header `x-request-id`
- Le route pubbliche (es. `/api/posts/[slug]`) sono l'unica eccezione al requisito di auth
- Il blog pubblico (`src/app/(public)/blog`, `sitemap.ts`, `robots.ts`) legge solo con `createPublicClient()` (`src/lib/supabase/public.ts`, anon key senza sessione) tramite `src/lib/blog/public-posts.ts`: niente client cookie-based né chiamate auth, colonne elencate esplicitamente
- Il middleware risponde 401 JSON alle API senza sessione e rifiuta le scritture su `/api/*` con `Origin` di un altro sito: per una nuova route chiamata server-to-server (cron, webhook) aggiungila a `CRON_ROUTES` in `src/middleware.ts` e verifica un segreto nella route (per i cron `isAuthorizedCronRequest`). Il middleware sta in `src/middleware.ts`: con `src/app` Next.js ignora un `middleware.ts` in radice (lo controlla `src/middleware-location.test.ts`)
- Le nuove route autenticate usano `withRoute` (`src/lib/api/with-route.ts`): auth, Zod su params/query/body, errori standard e `Cache-Control: private, no-store`
- Le route sotto `/api/trips/**` usano tutte `withRoute` e quelle sotto `/api/trips/[id]/**` dichiarano `tripMember: true`: lo verifica `src/app/api/trips/route-authz.test.ts`. `route-contract.test.ts` genera dagli schemi (`handler.route`) tre richieste per handler: valida, non valida (400), non membro (403). Se un input valido non si ricava dallo schema (`refine`, path costruiti dal server) aggiungi un esempio in `VALID_BODIES`
- Le route costose (upload, export, AI) dichiarano `rateLimit: '<bucket>'` in `withRoute`; le route pubbliche chiamano `enforceRateLimit(bucket, ipSubject(request))`. Bucket e soglie in `RATE_LIMITS` (`src/lib/rate-limit.ts`); oltre soglia 429 con `Retry-After`
- I redirect verso URL presi da query string o input passano da `safeRedirectPath()` (`src/lib/redirect.ts`)
- Header di sicurezza statici solo in `next.config.ts`; la CSP la costruisce `src/lib/csp.ts` con un nonce per richiesta nel middleware. Un nuovo host chiamato dal browser va aggiunto lì (`connect-src`, `img-src`…), mai `unsafe-eval` né `unsafe-inline` negli script; niente `<script>` inline senza nonce (`(await headers()).get('x-nonce')`)
- Ogni `fetch` lato server verso un servizio esterno passa da `safeFetch()` (`src/lib/safe-fetch.ts`) con un'allowlist di host in `EXTERNAL_HOSTS`

---

## Regole per i componenti React

- **Mai** `useEffect` per fetching dati — usa Server Components o SWR con `jsonFetcher` (`src/lib/fetcher.ts`, lancia `FetchError` con il messaggio dell'API). Dopo una scrittura si chiama `mutate()`; la stessa chiave in più componenti condivide la cache (es. `useProfile()` in `src/lib/hooks/use-profile.ts` per shell e pagina profilo). Nei form precompilati niente revalidate on focus (sovrascriverebbe le modifiche). Nei test si renderizza con `SWRTestProvider` (`src/test/swr.tsx`)
- Form sempre con `react-hook-form` + resolver Zod — niente `useState` per i form
- Componenti server per default, `'use client'` solo quando necessario (eventi, hooks, browser API)
- Drawer invece di Dialog su mobile (breakpoint `md`)
- Ogni componente interattivo deve funzionare con tastiera e avere `aria-label` appropriati. Drawer e dialog: `role="dialog"`, `aria-modal`, `aria-labelledby` sul titolo e `useDialogA11y` (`src/components/ui/use-dialog-a11y.ts`: focus dentro, Tab intrappolato, Escape chiude, focus restituito); ogni `<label>` ha `htmlFor` e il controllo il suo `id`
- I test delle pagine principali e dei drawer controllano axe con `seriousA11yViolations` (`src/test/axe.ts`): zero violazioni serie o critiche

---

## Regole per media e immagini

- **Tutto il processing delle immagini avviene server-side** — mai `sharp` o `canvas` nel browser
- Non esporre mai URL diretti di Supabase Storage al client — passa sempre per URL firmati o proxy
- I file dei viaggi stanno in bucket privati sotto `trips/{trip_id}/` (`trip-media`, `trip-documents`): path costruiti dal server (`buildMediaPath`, `buildDocumentPath` in `src/lib/trip-files.ts`) e ricontrollati con `isTripFilePath()` prima di usare il service role; foto servite con `withSignedUrls()` (1 h), documenti tramite proxy autenticato
- Chi cancella una riga con un file (media, documento, spostamento) cancella anche il file (`src/lib/trip-storage.ts`)
- Le cancellazioni fatte in SQL (account, viaggi) mettono i file in `storage_deletion_queue`; il server li rimuove con la Storage API (`drainStorageDeletionQueue`). Non cancellare mai da `storage.objects` in SQL: resta il file
- Upload di foto e video: `…/media/uploads` (URL di upload firmato verso `incoming/`) → upload diretto allo storage (`uploadTripMedia` in `src/lib/media/upload-client.ts`) → `…/media/confirm`, che passa da `src/lib/media/pipeline.ts`. Nessun file attraversa il corpo di una route (limite ~4,5 MB su Vercel)
- Thumbnail sempre generati al momento dell'upload (400×400, WebP); le foto salvate non hanno metadati EXIF
- Export Instagram: job asincrono (`POST …/instagram/exports` risponde 202, il lavoro gira in `after()`, il client fa polling con SWR); lo ZIP sta nel bucket privato `instagram-exports`, si scarica con URL firmato ≤ 24 h e il cron lo elimina dopo 24 h. Le opzioni che finiscono in un SVG (testo, colori) si validano con Zod e `safeHexColor`

---

## Regole per le chiamate AI (Claude API)

- **Le API key non devono mai arrivare al browser** — solo route server-side
- Model id solo da `src/lib/ai/models.ts`: `AI_MODELS.fast` (`claude-haiku-4-5`) per task brevi, `AI_MODELS.longForm` (`claude-sonnet-4-6`) per generazione long-form
- Fai sempre streaming per testo lungo — non far aspettare l'utente con una chiamata bloccante
- Ogni chiamata AI passa da `requireFeatureAccess` (`src/lib/premium/access.ts`), che consuma la quota in modo atomico con la RPC `consume_feature_quota` — limite 20 chiamate AI/giorno per utente (`AI_DAILY_LIMIT`). `ai_usage` non si scrive più
- Cache le risposte riusabili (es. briefing destinazione) per 30 giorni

---

## Lingua e tono

- **UI e messaggi all'utente**: italiano
- **Codice, commenti, nomi di variabili**: inglese
- **Messaggi di errore user-facing**: italiano, warm, con l'emoji 🏝️ quando appropriato
- **Testo utente**: `sanitizePlainText` normalizza (trim, caratteri di controllo, lunghezza) senza fare escape; l'escape si fa in output (React, `escapeHtml`/`escapeFields` di `src/lib/html.ts` negli HTML generati a mano come le email)
  - Esempio: `"Ops! Non riusciamo a caricare le foto. Riprova tra poco 🏝️"`
- **Commit message**: inglese, formato `feat(scope): description`

---

## Testing

Prima di ogni PR:

```bash
npm run type-check   # zero errori TypeScript
npm run lint         # zero warning ESLint (--max-warnings=0: un warning fa fallire la CI)
npm run test         # tutti i test passano
npm run build        # build di produzione completa
npm run test:rls     # test RLS su Supabase locale (npm run db:start prima); in CI il job rls-tests li esegue su Postgres + stub
```

Ogni migration che aggiunge una tabella di viaggio (con `trip_id`) aggiunge anche la sua fixture in `supabase/tests/rls_matrix.test.sql`: senza, il test RLS fallisce.

Copertura minima su `src/lib/`: **70%** (righe, istruzioni, funzioni; 60% branch), imposta da `vitest.config.ts`: `npm run test:coverage` fallisce sotto soglia, in CI e in locale

Le funzioni di dominio ricevono le dipendenze invece di crearle (T-3.4): client Supabase (`{ supabase }` o parametro) e orologio (`now`) iniettabili, così i test usano `queryChain` di `src/test/supabase-mock.ts` senza `vi.mock` del modulo

Priorità di test:
1. Logica spese (`src/lib/expenses.ts`, `src/lib/currency.ts`) — calcoli critici, sempre in centesimi interi; senza tasso di cambio `amount_eur` resta `null` (spesa "da convertire"), mai l'importo non convertito
2. Processing media (`src/lib/media/`) — pipeline complessa
3. API route handlers — integrazione DB
4. Componenti con logica complessa (ExpenseDrawer, InstagramGenerator)

---

## Git

```bash
# Un commit per fase agente
feat(architect): DB schema, types, project scaffold
feat(backend): API routes and expense business logic
feat(frontend): pages, components, design system
feat(media): photo pipeline and instagram export
feat(content): AI writing assistant and SEO
feat(devops): CI/CD, Vercel config, seed data

# Fix e iterazioni
fix(backend): handle missing currency in expense creation
refactor(frontend): extract TripCard into reusable component
```

Branch `main` è protetto — apri sempre una PR, non fare push diretti.

---

## Variabili d'ambiente

Tutte le variabili sono in `.env.example`. Per lo sviluppo locale copia in `.env.local`.

Variabili con prefisso `NEXT_PUBLIC_` (o `EXPO_PUBLIC_` nel mobile) sono esposte al browser — non mettere mai segreti lì.

**Mai committare file `.env` con valori reali.** Sono ignorati da git (tranne `.env.example` e `mobile/.env.example`, solo placeholder) e gitleaks gira in pre-commit (`.pre-commit-config.yaml`) e in CI (job `secrets-scan`). Se un segreto finisce nel repo va ruotato, non solo rimosso.

Variabili richieste per far partire il dev server:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_MAPBOX_TOKEN`

Variabili opzionali (alcune feature si disabilitano senza):
- `ANTHROPIC_API_KEY` — AI assistant disabilitato
- `EXCHANGE_RATE_API_KEY` — currency conversion usa rate fissi di fallback
- `NEXT_PUBLIC_SENTRY_DSN` — error tracking disabilitato

---

## Struttura cartelle (riferimento rapido)

```
src/
├── app/
│   ├── (auth)/          # Login, signup — senza nav
│   ├── (app)/           # App autenticata — con nav
│   │   ├── page.tsx     # Dashboard
│   │   └── trips/[id]/  # Trip detail con tabs
│   ├── (public)/        # Blog pubblico — senza auth
│   └── api/             # Route handler
├── components/
│   ├── ui/              # Primitivi (Button, Input, Card...)
│   ├── trip/            # Componenti specifici per trip
│   ├── expense/         # Tracker spese
│   ├── media/           # Griglia foto, upload
│   ├── blog/            # Editor Tiptap
│   ├── map/             # Componenti Mapbox
│   └── instagram/       # Generator export
├── lib/
│   ├── supabase/        # Client setup (client, server, middleware)
│   ├── ai/              # Integrazioni Claude API
│   ├── media/           # Image processing pipeline
│   ├── types/           # TUTTI i tipi di dominio, per dominio — fonte della verità
│   ├── expenses.ts      # Business logic spese
│   └── trips.ts         # Statistiche viaggio
supabase/
└── migrations/          # SQL migrations — fonte della verità per lo schema
agents/                  # Prompt sistema multi-agente
docs/                    # Decisioni architetturali
```

---

## Criteri di accettazione

Il progetto è completo quando:

- [ ] `npm run dev` parte senza errori
- [ ] Nicolò e Giorgia possono registrarsi e creare un viaggio insieme
- [ ] Si possono aggiungere giorni, tappe e alloggi all'itinerario
- [ ] Si possono registrare spese e vedere chi deve quanto a chi
- [ ] Si possono caricare foto e vederle nella griglia media
- [ ] Si può generare un carousel ZIP pronto per Instagram
- [ ] Si può scrivere e pubblicare un post del blog
- [ ] Il blog pubblico su `/blog` funziona senza login
- [ ] Tutti i check CI passano
- [ ] Il deploy su Vercel funziona

---

*"Il posto più lontano dalla terra non è nello spazio. È nel mezzo dell'oceano Pacifico, a 2.688 km da qualsiasi terra. Si chiama Point Nemo. L'isolotto più vicino si chiama Motu Nui. Questo progetto si chiama motonui — perché i viaggi migliori sono quelli che sembrano impossibili finché non li fai."*
