# CLAUDE.md — motonui

Istruzioni per Claude Code. Leggi questo file integralmente prima di toccare qualsiasi file del progetto.

---

## Cos'è questo progetto

**motonui** è una web app per coppie che viaggiano. Permette di pianificare itinerari, tracciare spese, pubblicare un travel blog e generare contenuti pronti per Instagram. È un progetto personale di Nicolò e Sara.

Il nome viene da *Motu Nui*, l'isolotto più vicino al Point Nemo — il posto più remoto della Terra.

---

## Come lavorare su questo progetto

### Prima di iniziare qualsiasi task

1. Leggi `agents/00_ORCHESTRATOR.md` per capire la visione d'insieme
2. Leggi il file agente rilevante in `agents/` per la fase su cui stai lavorando
3. Se esiste già `docs/ARCHITECTURE.md`, leggilo — contiene decisioni architetturali importanti
4. Controlla `src/lib/types.ts` prima di creare nuovi tipi — potrebbe già esistere quello che cerchi

### Ordine obbligatorio degli agenti

Non saltare fasi. Ogni agente dipende dal precedente:

```
01_ARCHITECT  →  02_BACKEND  →  03_FRONTEND  →  04_MEDIA  →  05_CONTENT  →  06_DEVOPS
```

Se ricevi un task che appartiene a una fase successiva rispetto a dove siamo, segnalalo prima di procedere.

---

## Stack tecnico

| Layer | Tecnologia |
|---|---|
| Framework | Next.js 15, App Router, TypeScript strict |
| Database | Supabase (Postgres + RLS) |
| Auth | Supabase Auth (magic link + Google OAuth) |
| Storage | Supabase Storage |
| Styling | Tailwind CSS + shadcn/ui |
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
- Tutti i tipi di dominio vivono in `src/lib/types.ts`
- Usa i tipi generati da Supabase (`src/lib/supabase/database.types.ts`) come base, wrappali in tipi di dominio più leggibili
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

---

## Regole per le API route

- Ogni route valida l'input con **Zod** — niente `req.body` non validato
- Ogni route controlla l'autenticazione prima di qualsiasi operazione
- Formato errore standardizzato (vedi `src/lib/errors.ts`):
  ```json
  { "error": "Messaggio leggibile", "code": "TRIP_NOT_FOUND", "status": 404 }
  ```
- Log strutturato: `[motonui][/api/trips][GET] errore descrittivo`
- Le route pubbliche (es. `/api/posts/[slug]`) sono l'unica eccezione al requisito di auth

---

## Regole per i componenti React

- **Mai** `useEffect` per fetching dati — usa Server Components o SWR/React Query
- Form sempre con `react-hook-form` + resolver Zod — niente `useState` per i form
- Componenti server per default, `'use client'` solo quando necessario (eventi, hooks, browser API)
- Drawer invece di Dialog su mobile (breakpoint `md`)
- Ogni componente interattivo deve funzionare con tastiera e avere `aria-label` appropriati

---

## Regole per media e immagini

- **Tutto il processing delle immagini avviene server-side** — mai `sharp` o `canvas` nel browser
- Non esporre mai URL diretti di Supabase Storage al client — passa sempre per URL firmati o proxy
- Thumbnail sempre generati al momento dell'upload (400×400, WebP)
- ZIP degli export Instagram eliminati automaticamente dopo 24h

---

## Regole per le chiamate AI (Claude API)

- **Le API key non devono mai arrivare al browser** — solo route server-side
- Usa `claude-haiku-4-5` per task brevi (categorizzazione, suggerimenti rapidi)
- Usa `claude-sonnet-4-6` per generazione long-form (post completi, caption elaborate)
- Fai sempre streaming per testo lungo — non far aspettare l'utente con una chiamata bloccante
- Traccia l'utilizzo in `ai_usage` table — limite 20 chiamate AI/giorno per utente
- Cache le risposte riusabili (es. briefing destinazione) per 30 giorni

---

## Lingua e tono

- **UI e messaggi all'utente**: italiano
- **Codice, commenti, nomi di variabili**: inglese
- **Messaggi di errore user-facing**: italiano, warm, con l'emoji 🏝️ quando appropriato
  - Esempio: `"Ops! Non riusciamo a caricare le foto. Riprova tra poco 🏝️"`
- **Commit message**: inglese, formato `feat(scope): description`

---

## Testing

Prima di ogni PR:

```bash
npm run type-check   # zero errori TypeScript
npm run lint         # zero warning ESLint
npm run test         # tutti i test passano
npm run build        # build di produzione completa
```

Copertura minima su `src/lib/`: **70%**

Priorità di test:
1. Logica spese (`src/lib/expenses.ts`) — calcoli critici
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

Variabili con prefisso `NEXT_PUBLIC_` sono esposte al browser — non mettere mai segreti lì.

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
│   ├── types.ts         # TUTTI i tipi di dominio — fonte della verità
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
- [ ] Nicolò e Sara possono registrarsi e creare un viaggio insieme
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
