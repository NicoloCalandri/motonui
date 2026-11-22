# Audit pre-lancio — sicurezza e velocità

> motonui · 21–22/11/2026 · branch `claude/new-session-7z18qn` · base `2befd3f`
> Legenda: ✅ ok (già a posto, verificato) · 🔧 corretto in questa PR · ⚠️ da decidere / azione fuori dal repo · ➖ non applicabile

## In cima: problemi critici

Nessun segreto esposto **nuovo**, nessuna tabella senza RLS, nessun XSS trovato. Restano due punti seri, entrambi fuori dal codice:

1. **Segreti nella storia git (SR-DEV-01, P0, già noto).** `git log -G` conferma chiave Anthropic e token Mapbox nei commit `8d3e1f0`, `188ff19`, `38e5131`. Vanno **ruotati** (runbook `security/05-OPS-RUNBOOK.md` §3): rimuoverli dal repo non basta.
2. ~~**`zod` 3 con advisory high**~~ (GHSA-mrhx-c7xc-m3w5). **Chiuso:** l'app è passata a Zod 4.6.7 (D-1, vedi A5.29); `npm audit --omit=dev` non riporta più vulnerabilità.

Corretti in questa PR i problemi reali trovati: iniezione di filtri PostgREST nella ricerca utenti admin, messaggi del database restituiti al client da due route admin, route admin senza gestione errori standard, cookie di sessione senza `Secure`, dipendenze con advisory (next, happy-dom, Tiptap, Sentry).

## Note sul prompt

Il prompt parte da alcune ipotesi superate; si è seguito `CLAUDE.md`:

- Next.js **16** (non 15), con `src/proxy.ts` al posto del middleware.
- Login con **email + password e Google** (ADR-06): il magic link non esiste, i punti relativi sono riletti sul flusso password.
- I tipi stanno in `src/lib/types/` (non `types.ts`); l'architettura in `docs/architecture.md`.
- La coppia è Nicolò e **Giorgia**.

## Parte A — Sicurezza

| # | Punto | Stato | File toccati | Note |
|---|---|---|---|---|
| A1.1 | Chiavi API solo lato server | ✅ 🔧 | `scripts/check-client-bundle.mjs`, `ci.yml`, `package.json` | Nessun segreto in `NEXT_PUBLIC_*` (usati solo URL/anon key Supabase, token Mapbox pubblico, DSN Sentry, URL app). Aggiunta una scansione di `.next/static` dopo la build (nomi delle variabili server e forme delle chiavi), nel job CI `build`. |
| A1.2 | Segreti fuori da Git | ✅ ⚠️ | — | `.gitignore` copre `.env*` (tranne gli `.example` con placeholder), gitleaks in pre-commit e CI. **Nella storia ci sono ancora chiave Anthropic e token Mapbox: da ruotare** (SR-DEV-01). |
| A1.3 | Service role mai nel client | ✅ | — | `createAdminClient` usato solo in route server e `src/lib` server; nessun componente `'use client'` lo importa; la scansione del bundle lo verifica a ogni build. |
| A1.4 | Token Mapbox ristretto | ⚠️ | — | Configurazione della dashboard Mapbox: restrizione URL ai domini motonui e scope pubblici (B14 della checklist). Il token attuale è anche nella storia git: va rigenerato. |
| A1.5 | Rotazione documentata | ✅ | — | Inventario e procedura in `security/05-OPS-RUNBOOK.md` §3: Supabase anon/service role, Anthropic, Exchange rate, Mapbox, Resend, `CRON_SECRET`, `ADMIN_IMPERSONATION_SECRET`, Sentry, token Vercel/Codecov. |
| A2.6 | RLS su tutte le tabelle | ✅ | — | Suite SQL eseguita su Postgres 16 locale con lo stub di Supabase: 10 file, 91 controlli verdi (matrice anonimo/estraneo/partner/owner su ogni tabella di viaggio, meta-controllo "ogni tabella ha RLS, ogni UPDATE ha `WITH CHECK`"). Query diretta su `pg_class`: zero tabelle `public` senza RLS. |
| A2.7 | Dati sensibili | 🔧 ⚠️ | `admin/users/[id]/route.ts` (+ Hono) | Sensibili: email (in `auth.users`), carte d'imbarco e documenti (bucket privati, proxy autenticato), foto (EXIF rimossi). In transito TLS + HSTS; a riposo cifratura del disco di Supabase. Corretto: la riga di audit della cancellazione utente conservava l'email dopo la purge. Cifratura applicativa dei documenti: ⚠️ non necessaria oggi, da rivalutare se si caricano documenti d'identità. |
| A2.8 | Accesso controllato sul server | ✅ | — | Route `/api/trips/**` tutte su `withRoute` (auth prima di tutto, `route-authz.test.ts`); il proxy risponde 401 JSON alle API senza sessione; pubbliche solo `/api/posts/[slug]`, blog, sitemap, robots, cron (con segreto). |
| A2.9 | IDOR | ✅ 🔧 | `with-admin-route.ts` | `tripMember: true` su ogni route `/api/trips/[id]/**` + RLS; id UUID validati. Ora anche le route admin validano gli id come UUID prima di ogni query. |
| A2.10 | Mass assignment | ✅ | — | Schemi Zod espliciti (nessun `.passthrough()`), trigger `prevent_structural_update()`, colonne sensibili di `profiles` solo service role, `ai_usage` non scrivibile (RPC `consume_feature_quota`). |
| A2.11 | Query parametrizzate | 🔧 | `src/lib/search-filter.ts`, `admin/users/route.ts` (+ Hono) | Nessun SQL nelle route, solo client Supabase e RPC. **Trovato:** la ricerca admin interpolava il testo in `.or('email.ilike.%…%')`: una virgola aggiungeva condizioni. Ora il termine è normalizzato e ogni colonna ha una sola condizione (test). |
| A2.12 | Backup | ⚠️ | — | Procedura in `05-OPS-RUNBOOK.md` §2; non verificabile da qui (progetto cloud): attivare backup/PITR e provare un restore (B15). |
| A3.13 | Cookie di sessione | 🔧 | `src/lib/supabase/cookie-options.ts`, `server.ts`, `middleware.ts`, `client.ts` | `@supabase/ssr` non imposta `Secure`: ora `SameSite=Lax` + `Secure` in HTTPS per server, proxy e browser. Non `HttpOnly` per scelta: il client browser legge la sessione (login, upload diretti); l'XSS è contenuto dalla CSP a nonce. Cookie di impersonazione già `HttpOnly`/`Secure`. |
| A3.14 | Password | ✅ | — | Hash gestito da Supabase Auth (bcrypt); policy ≥ 10 caratteri con lettere e numeri, allineata in `src/lib/auth/password.ts`. Leaked password protection solo sul cloud (piano Pro). |
| A3.15 | Limite tentativi di login | 🔧 ⚠️ | `supabase/config.toml`, `05-OPS-RUNBOOK.md` | Il login parla direttamente con Supabase Auth, che limita per IP: dichiarati `sign_in_sign_ups = 30` e `token_refresh = 150` ogni 5 min, con la riga di parità per il cloud (da applicare in dashboard). |
| A3.16 | CAPTCHA | ⚠️ | — | Non presente. Serve un account Turnstile (site key + secret in Supabase → Attack Protection) e il widget in login, registrazione e reset: decisione e chiavi del proprietario. |
| A3.17 | Redirect | ✅ | — | `safeRedirectPath()` su callback OAuth e login (test); allowlist dei redirect da tenere stretta sul cloud (runbook §1). |
| A4.18 | Validazione input | 🔧 | `src/lib/api/with-admin-route.ts`, route `/api/admin/*` | `withRoute` già valida params/query/body con Zod. Le route admin non avevano gestione errori: ora `withAdminRoute` (admin prima di tutto, id UUID, JSON malformato → 400, errori standard, `no-store`). `admin-routes.test.ts` fallisce su una nuova route admin senza wrapper. |
| A4.19 | XSS | ✅ | — | Tiptap sanificato in scrittura e in rendering (`sanitize.ts`, `blog/render.ts`, test); unico `dangerouslySetInnerHTML` sull'HTML già sanificato del blog; l'output AI entra nell'editor come nodo di testo, mai come HTML; email con `escapeFields`. |
| A4.20 | Upload | ✅ 🔧 | `src/lib/media/pipeline.ts` | MIME da magic bytes, 50 MB, path rigenerati dal server, sharp ricodifica e toglie EXIF/GPS, rate limit per utente. **Aggiunto** un tetto di 2000 foto/video per viaggio (409 con messaggio in italiano), nella pipeline condivisa con Hono. |
| A4.21 | Risposte ridotte | 🔧 ⚠️ | route admin | Colonne esplicite su `admin_user_view` e `admin_audit_log`; la creazione utente restituisce solo id ed email (prima l'intero oggetto Auth). Le route `/api/trips/**` restituiscono righe intere ai soli membri del viaggio (RLS): passare a DTO espliciti è un refactor dei tipi client, ⚠️ da pianificare. |
| A4.22 | Storage | ✅ ⚠️ | — | Bucket privati, URL firmati 1 h, documenti via proxy, ZIP Instagram ≤ 24 h e cron di pulizia. Che il cron giri davvero si vede solo nei log Vercel (B11). |
| A4.23 | Errori | 🔧 | `admin/trips/[id]`, `admin/users` | Due route admin restituivano `error.message` (database, Auth): ora messaggio generico e dettaglio nel log strutturato. Il test statico lo vieta. |
| A5.24 | Header | ✅ 🔧 | `next.config.ts`, `src/lib/csp.ts` (+ shell Hono) | CSP a nonce senza `unsafe-eval`, HSTS preload, nosniff, Referrer-Policy, Permissions-Policy, `frame-ancestors 'none'`/DENY, COOP. Aggiunto `poweredByHeader: false`; tolti dalla CSP gli host Google Fonts (i font sono self-hosted). |
| A5.25 | HTTPS | ✅ | — | HSTS 2 anni con preload, `upgrade-insecure-requests`, cookie `Secure` (A3.13). Vercel reindirizza HTTP → HTTPS. |
| A5.26 | CORS e CSRF | ✅ | — | Nessun header CORS: le API sono same-origin. Il proxy rifiuta le scritture con `Origin`/`Sec-Fetch-Site` esterni, oltre a `SameSite=Lax` (test). |
| A5.27 | Rate limiting e AI | ✅ ⚠️ | — | Quota atomica 20 chiamate/giorno per utente (`consume_feature_quota`, testata con 50 richieste parallele), 10/min per utente, cap giornaliero globale per funzionalità (`feature_controls`). Tetto di **spesa** mensile: ⚠️ impostarlo nella console Anthropic (limite di spesa dell'organizzazione). |
| A5.28 | Prompt injection | ✅ | — | Dati utente in `untrustedBlock()`, regola nel system prompt, output strutturati validati, `prompt-injection.test.ts`; la chiave non entra mai nel prompt. |
| A5.29 | Dipendenze | 🔧 ⚠️ | `package.json`, `package-lock.json`, `dependabot.yml` | Aggiornati next 16.4.6, Tiptap 3.35.0 (tutti insieme), happy-dom 21.0.4 (chiude D-9), @sentry/nextjs 11.16.0. Rimosse 12 dipendenze mai importate (B2.37). Lockfile committato, Dependabot attivo. **Zod 4.6.7** (D-1): `errorMap` → `message`, `formatZodError` legge i nomi delle issue di Zod 3 e 4 (la copia in `nextgen/` resta su Zod 3), `zod-sample.ts` usa `z.toJSONSchema` invece degli interni, id validati con `guid()` (`src/lib/ids.ts`: Zod 4 `uuid()` segue RFC 9562 e rifiuterebbe gli id del seed). `npm audit --omit=dev`: 0 vulnerabilità. Le dev-dependency hanno advisory moderate (non bloccanti). |

## Parte B — Velocità

| # | Punto | Stato | File toccati | Note |
|---|---|---|---|---|
| B1.30 | Skeleton | 🔧 | `src/components/ui/skeleton.tsx`, `loading.tsx` di dashboard, viaggi, viaggio, profilo | Il dettaglio viaggio mostra lo skeleton invece dello spinner; griglia foto e spese avevano già placeholder. Un solo `role="status"` per gli screen reader (axe nei test). |
| B1.31 | WebP/AVIF | ✅ ⚠️ | — | Thumbnail 400×400 WebP e originali ricodificati in WebP dalla pipeline. `next/image` non si usa sulle foto private (URL firmati che scadono: l'ottimizzatore li metterebbe in cache oltre la scadenza); le copertine pubbliche potrebbero passarci, da valutare con i `remotePatterns` giusti. |
| B1.32 | Lazy load | 🔧 | `TripMap.tsx`, `trips/[id]/page.tsx`, `blog/[slug]/page.tsx` | Mapbox GL parte solo quando la mappa si avvicina al viewport; thumbnail della griglia già `loading="lazy"`; hero con `fetchpriority="high"` (LCP), copertine correlate lazy. |
| B1.33 | Server/build | 🔧 ⚠️ | `src/app/(public)/blog/cached-posts.ts`, pagine blog, `sitemap.ts`, route dei post | Il layout legge `headers()` per il nonce CSP, quindi ogni pagina è dinamica e il vecchio `revalidate = 3600` non metteva in cache niente. Ora le letture del blog passano da `unstable_cache` (client anonimo, 5 min, tag `blog-posts`), invalidato a ogni scrittura di post. SSG vero del blog: ⚠️ richiede CSP con hash/SRI per le pagine statiche. Dashboard e liste sono Server Components con streaming (`loading.tsx`). |
| B1.34 | Script di terze parti | ✅ | — | Nessun analytics esterno; Sentry è nel bundle dell'app (`instrumentation-client.ts`); Speed Insights carica dal nostro dominio dopo l'idratazione. |
| B1.35 | Font | ✅ | — | `next/font` self-hosted (Figtree e Playfair, variabili: un file per famiglia, `display: swap` di default). |
| B2.36 | Code splitting | 🔧 | `MediaTab.tsx`, `posts/[postId]/edit/page.tsx` (+ adapter nextgen) | Tab del viaggio, Recharts (dentro `ExpensesTab`) e mapbox-gl erano già dinamici; ora anche `InstagramGenerator` e l'editor Tiptap. `@next/bundle-analyzer` non aggiunto (si può lanciare al bisogno). |
| B2.37 | Dipendenze inutili | 🔧 | `package.json` | Controllo a mano degli import (lo strumento `depcheck` non era eseguibile qui): rimossi Radix ×5, `class-variance-authority`, `clsx`, `tailwind-merge`, `jszip`, `react-map-gl`, `react-masonry-css`, `@vercel/analytics` (84 pacchetti in meno). Recharts già importato per nome. |
| B2.38 | Liste lunghe | ⚠️ | — | Griglia foto fino a 2000 elementi (nuovo tetto), thumbnail lazy. Virtualizzazione (es. `@tanstack/react-virtual`) o paginazione: da fare quando un viaggio supera qualche centinaio di foto. |
| B2.39 | Re-render | ✅ | — | Nessun problema misurato; nessuna memoizzazione aggiunta senza profiler. |
| B2.40 | Optimistic UI | ⚠️ | — | Il dettaglio viaggio aggiorna la cache SWR in locale (`patchTrip`), ma spese e tappe aspettano il server. Aggiungere `optimisticData` + `rollbackOnError` a `mutate()` per spese e tappe è il passo successivo. |
| B2.41 | Debounce | 🔧 | `LocationSearch.tsx` | Ricerca luoghi Mapbox: debounce 300 ms e ora annulla la richiesta precedente. Ricerca viaggi: form GET server-side (nessuna richiesta per tasto). |
| B3.42 | Chiamate duplicate | ✅ | — | Profilo letto dal layout server e passato come `fallback` SWR (stessa chiave in shell e pagina). |
| B3.43 | Richieste in parallelo | ✅ | — | `Promise.all` nella dashboard, nelle statistiche admin e nella pagina utente admin. |
| B3.44 | Paginazione | ✅ ⚠️ | — | Admin utenti e audit log paginati. Spese, media e post dei viaggi tornano interi (volumi di una coppia; media ora ≤ 2000): da paginare insieme a B2.38. |
| B3.45 | Timeout | 🔧 | `src/lib/ai/client.ts` e i 6 moduli AI | Claude: timeout 45 s (prima 10 minuti, default SDK) e 2 retry con backoff. Meteo e cambi già con `safeFetch` (8 s) e fallback (`amount_eur` null senza tasso). |
| B3.46 | Streaming AI | ✅ | — | Sonnet per il testo lungo in SSE (`ai/sse.ts`), Haiku per i task brevi (`ai/models.ts`). |
| B3.47 | Compressione e cache | ✅ | — | Brotli/gzip e `Cache-Control: immutable` sugli asset con hash li fa Vercel; API autenticate `private, no-store`. |
| B3.48 | CDN | ✅ | — | Asset statici sulla Edge di Vercel; foto da Supabase Storage con URL firmati. |
| B3.49 | Cache dati | ✅ 🔧 | `cached-posts.ts` | Briefing destinazione 30 giorni e meteo in tabella cache già presenti; aggiunta la cache del blog (B1.33). Nessun Redis: non serve. |
| B3.50 | Task in background | ✅ | — | Export Instagram asincrono (202 + `after()` + polling SWR), pulizia 24 h su Vercel Cron, upload diretto allo storage. |
| B4.51 | N+1 | ✅ | — | Select annidate PostgREST; l'unico ciclo per tipo (`reminder-emails.ts`) è voluto (colonna polimorfica senza FK). |
| B4.52 | Indici | 🔧 | `supabase/migrations/0025_performance_indexes.sql`, `supabase/tests/0025_fk_indexes.test.sql` | Indici sulle FK che non ne avevano (reminders, documents, export, inviti, audit, impersonazione) e indice parziale dei post pubblicati per data. `EXPLAIN` mostra index scan; il test SQL fallisce su una nuova FK senza indice. |
| B4.53 | Solo le colonne necessarie | 🔧 ⚠️ | route admin | Admin su colonne esplicite. Le route di viaggio usano ancora `select('*')`/`.select()` sui dati dei membri: vedi A4.21. |
| B4.54 | Connection pooling | ✅ | — | Le funzioni parlano con PostgREST via HTTP: nessuna connessione Postgres diretta da Vercel, il pooling lo fa Supabase. |
| B4.55 | Server vicino al DB | ⚠️ | — | `vercel.json` usa `fra1`; verificare che il progetto Supabase sia in `eu-central-1` (Francoforte). |
| B5.56 | Niente stato in memoria | ✅ | — | Rate limit e quote nel DB; l'unica cache in memoria è la revoca dell'impersonazione (30 s, accettata in ADR-07). |
| B5.57 | Tracing lento | ✅ ⚠️ | — | Sentry con `tracesSampleRate` 0,1 in produzione su route e fetch. L'allarme p95 > 1 s va creato in Sentry (Alerts → Performance). |
| B5.58 | Web Vitals reali | 🔧 ⚠️ | `src/app/layout.tsx`, `package.json` | Aggiunto Vercel Speed Insights (da attivare nel progetto Vercel). Lighthouse mobile ≥ 90 da misurare sul deploy di anteprima. |
| B5.59 | Reti lente / offline | 🔧 ⚠️ | `src/components/shell/OfflineBanner.tsx` | Banner in italiano quando il browser va offline (test). Prova su 3G/CPU 4× e su telefoni veri: ⚠️ da fare a mano sul deploy di anteprima. |

## Rischi residui, per gravità

1. **Alta — segreti nella storia git non ruotati** (chiave Anthropic, token Mapbox, `ADMIN_IMPERSONATION_SECRET`). Azione: rotazione secondo il runbook, poi riga nel registro verifiche.
2. ~~Alta — `zod` 3 con advisory high~~: chiuso con la migrazione a Zod 4 (D-1). Resta `nextgen/` su Zod 3, non in produzione e senza audit bloccante: da allineare al cutover.
3. **Media — nessun CAPTCHA** su login, registrazione e reset; restano i limiti per IP di Supabase. Azione: Turnstile.
4. **Media — configurazioni cloud non verificate da qui**: backup/PITR e prova di restore, parità Auth (rate limit, leaked password), restrizione del token Mapbox, regione Supabase, esecuzione dei cron, limite di spesa Anthropic.
5. **Bassa — risposte delle route di viaggio con righe intere** (ai soli membri, sotto RLS). Azione: DTO espliciti.
6. **Bassa — liste non paginate né virtualizzate** (media, spese). Azione insieme a B2.38/B3.44.
7. **Bassa — cookie di sessione non `HttpOnly`** per scelta architetturale (client browser di Supabase); mitigato dalla CSP a nonce.

## Comandi eseguiti

| Comando | Esito |
|---|---|
| `npm run type-check` | ✅ 0 errori |
| `npm run lint` | ✅ 0 warning |
| `npm run test` | ✅ 103 file, 1004 test (baseline: 958) |
| `npm run build` + `npm run check:bundle` | ✅ build completa; 55 file in `.next/static`, nessun segreto server |
| `sh scripts/run-sql-tests.sh` (Postgres 16 + stub, come il job `rls-tests`) | ✅ 10 file, 91 controlli |
| `npm audit --omit=dev` | ✅ 0 vulnerabilità (dopo Zod 4) |
| nextgen: `npm test`, `npm run type-check`, `npm run port:check`, `node scripts/handler-drift.mjs` | ✅ (il lint di `apps/web` fallisce già sulla base, non eseguito in CI) |
