# tasks.md — Piano a fasi

> Riferimenti: `PRD.md` (FR/NFR), `architecture.md` (ADR), `REVIEW.md` (S/Q/T), `security/01-SECURITY-REQUIREMENTS.md` (SR).
> Dimensioni: **S** ≤ ½ giornata · **M** 1–2 giorni · **L** 3–5 giorni.
> Ogni task si chiude con una PR che aggiorna lo stato dei requisiti SR coinvolti.

## Come si incastra con gli agenti di `CLAUDE.md`

L'ordine `ARCHITECT → BACKEND → FRONTEND → MEDIA → CONTENT → DEVOPS` descrive la costruzione da zero. Il codice oggi copre già tutte le fasi, quindi il piano procede per **rischio** e non per strato. Ogni task indica l'agente di riferimento (scope del commit: `fix(backend): …`, `feat(media): …`). Una regola resta invariata: nessuna modifica di frontend che dipenda da uno schema non ancora migrato.

```
Fase 0  Contenimento        ██ 1–1,5 settimane     blocca tutto il resto
Fase 1  Fondamenta sicure   ████ 2 settimane   test RLS, withRoute, quote
Fase 2  Funzionalità mancanti ████ 2 settimane invito, media privati, cron, Instagram
Fase 3  Qualità e test      ███ 1,5 settimane  coverage, tipi, fetching
Fase 4  Operatività         ██ 1 settimana     Sentry, deploy, header
Fase 5  Contenuti e SEO     █ 0,5 settimane    sitemap, rifiniture
```

---

## Fase 0 — Contenimento (R0)

Obiettivo: chiudere quattro dei cinque requisiti P0 aperti e mitigare il quinto (SR-PRIV-02, storage pubblico), che richiede la migrazione completa della fase 2. Nessuna nuova funzionalità finché questa fase non è chiusa.

| ID | Task | Agente | Dim. | Dipende | SR | Criterio di accettazione |
|---|---|---|---|---|---|---|
| T-0.1 | **Ruotare i segreti esposti**: chiave Anthropic, token Mapbox (e restrizione per URL), `ADMIN_IMPERSONATION_SECRET`, eventuale password presente in `.env.local`, chiavi del progetto Supabase cloud se mai state in chiaro | devops | S | — | DEV-01, INT-04 | Vecchie chiavi revocate nei rispettivi pannelli; nuove solo in Vercel/GitHub secrets; voce nel registro verifiche |
| T-0.2 | Rimuovere `.env.local`, `.env.example` (ricrearlo con placeholder), `mobile/.env` dal repo; `.gitignore` con `.env*`, `!.env.example`, `coverage/`, `tmp/`, `*.tsbuildinfo`, `.expo/`, `supabase/.temp` | devops | S | T-0.1 | DEV-01, DEV-02 | `git ls-files | grep -E '\.env'` restituisce solo `.env.example` senza valori reali |
| T-0.3 | Gitleaks in pre-commit e in CI; pulizia artefatti (`chat.py`, `undefined/`, `tmp/`, `.replit`) | devops | S | T-0.2 | SDLC-05 | Job `secrets-scan` bloccante e verde |
| T-0.4 | Migration `0016`: su `profiles` eliminare `profiles_update_own`, unica policy UPDATE con `WITH CHECK (auth.uid() = id)`, `REVOKE UPDATE` sulle colonne `role, plan, premium_*, suspended_*` per `authenticated` | backend | S | — | AUTHZ-04, AUTH-04 | Test RLS: l'utente non riesce a impostare `role='admin'`, `plan='premium'`, `suspended_at=null`; il cambio `display_name` funziona |
| T-0.5 | `REVOKE ALL ON admin_user_view FROM anon, authenticated` (o spostarla in schema `private`); adeguare le route admin a usare il service role | backend | S | — | AUTHZ-05 | `GET /rest/v1/admin_user_view` con anon key → 401/404; Security Advisor Supabase senza avvisi su viste |
| T-0.6 | Migration `0016`: `WITH CHECK` su tutte le policy UPDATE; trigger `prevent_structural_update()` su `trips`, `media`, `expenses`, `legs`, `accommodations`, `documents`, `posts` per `id`, `trip_id`, `owner_id`, `uploaded_by`, `author_id`, `url`, `created_at`; `search_path` su `is_trip_member` e `handle_new_user` | backend | M | — | AUTHZ-06, AUTHZ-07 | Test RLS: il partner non cambia `owner_id`, nessun membro cambia `media.url` o `trip_id` |
| T-0.7 | `src/lib/redirect.ts` → `safeRedirectPath()`; usarlo in `auth/callback` e `auth/login`; `encodeURIComponent` sul parametro OAuth | backend | S | — | AUTH-03 | Test: `https://x`, `//x`, `/\x`, `javascript:` → `/dashboard`; `/trips/abc` passa |
| T-0.8 | Allineare la documentazione: spostare `docs/CLAUDE.md` in radice, correggere **Sara → Giorgia**, metodo di login, regole reali; archiviare `docs/ARCHITECTURE.md` e `docs/SECURITY.md` sostituiti dai nuovi documenti | architect | S | — | — | `CLAUDE.md` in radice, nessuna occorrenza di "Sara" in repo (`git grep -n Sara`) |
| T-0.9 | **Mitigazione storage**: carte d'imbarco e documenti spostati subito in un bucket privato `trip-documents` con URL firmati (TTL 1 h); script che sposta i file già caricati. Le foto restano pubbliche fino a T-2.1 | media | M | T-0.6 | PRIV-02 (parziale), PRIV-03 | Nessuna carta d'imbarco raggiungibile via URL pubblico |

**Uscita dalla fase 0:** SR-AUTHZ-04/05/06 e SR-DEV-01 chiusi, SR-PRIV-02 mitigato per i documenti; T-0.4, T-0.5, T-0.6 verificati anche sul progetto cloud con richieste REST manuali registrate in `04-SECURITY-CHECKLIST.md`.

---

## Fase 1 — Fondamenta sicure e testabili

| ID | Task | Agente | Dim. | Dipende | SR | Criterio di accettazione |
|---|---|---|---|---|---|---|
| T-1.1 | **Suite test RLS** in CI: `supabase start` nel job, helper che crea tre utenti (estraneo, partner, owner) + anonimo e ottiene i JWT; test per ogni tabella e per ogni operazione | backend | L | T-0.4–0.6 | SDLC-04, AUTHZ-01 | Job `rls-tests` bloccante; un test fallisce se una nuova tabella non ha RLS o policy senza `WITH CHECK` |
| T-1.2 | Test di regressione dei finding S-02, S-03, S-04 dentro la suite RLS | backend | S | T-1.1 | AUTHZ-04–06 | I test falliscono ripristinando le vecchie policy |
| T-1.3 | `withRoute({ auth, params, query, body, tripMember })`: unisce `withErrorHandler`, `getAuthUser`, Zod su tutti gli input, `requireTripMember`; migrare le 11 route che non verificano la membership e le route `ai/*` | backend | M | — | AUTHZ-03, INPUT-01, WEB-05 | Tutte le route `/api/trips/[id]/**` dichiarano `tripMember: true`; test unitari di `withRoute` |
| T-1.4 | Errori di validazione: `validateFile` lancia `Errors.validation`; formattare gli errori Zod in messaggi leggibili (`campo: motivo`) | backend | S | T-1.3 | INPUT-03 | Upload non valido → 400 con messaggio italiano |
| T-1.5 | **Quota AI unica**: RPC `consume_ai_quota(feature)` con `UPDATE … RETURNING` atomico, tabella scrivibile solo dal service role, default 20/giorno; rimuovere `checkRateLimit` e le policy INSERT/UPDATE su `ai_usage`; `lib/ai/models.ts` con `claude-haiku-4-5` e `claude-sonnet-4-6` | content | M | T-1.3 | INT-02, INT-03 | Test: 50 richieste parallele → esattamente 20 accettate; l'utente non può modificare il contatore via REST |
| T-1.6 | Sanificazione in rendering del blog (`sanitizeTiptapDocument` prima di `generateHTML`); `sanitizePlainText` diventa normalizzazione (trim, controlli, lunghezza) senza escape, escape affidato a React | content | S | — | INPUT-05 | Test: `content_json` con `javascript:` scritto via REST non produce link attivi |
| T-1.7 | Escape HTML nei template email (`escapeHtml` condiviso) | backend | S | — | INT-07 | Snapshot test con input `<a href=…>` |
| T-1.8 | Impersonazione secondo ADR-07: `jti` nel JWT, hash SHA-256 in `impersonation_tokens`, verifica revoca nel middleware (con cache breve), rimozione degli header inutilizzati | backend | M | T-0.1 | AUTHZ-10, CRYPTO-03, CRYPTO-04 | Dopo `exit`, lo stesso token viene rifiutato; test in `impersonation.test.ts` |
| T-1.9 | Middleware: per `/api/*` senza sessione → 401 JSON; controllo `Origin` sui metodi di scrittura; esclusione esplicita delle route cron | backend | S | — | AUTH-05, WEB-04 | `middleware.test.ts` copre i tre casi |
| T-1.10 | Blocco di avvio se `ADMIN_AUTH_BYPASS=true` con `NODE_ENV=production` o `VERCEL_ENV=production` | devops | S | — | DEV-03 | Test su `require-admin` e layout admin |

---

## Fase 2 — Funzionalità mancanti (R1)

| ID | Task | Agente | Dim. | Dipende | SR / FR | Criterio di accettazione |
|---|---|---|---|---|---|---|
| T-2.1 | **Storage privato**: migration `0018` con bucket `trip-media` e `trip-documents` privati, policy su `storage.objects` per prefisso `trips/{trip_id}/`; colonne `storage_path` e `thumb_path`; script di migrazione dati dagli URL pubblici | media | L | T-0.6 | PRIV-02, CRYPTO-05 | Richiesta anonima a un vecchio URL pubblico → 400/404; la UI mostra le foto tramite URL firmati (TTL 1 h) |
| T-2.2 | **Pipeline upload**: il client carica direttamente nello storage con `createSignedUploadUrl` (il limite di ~4,5 MB del corpo richiesta su Vercel rende impossibile passare dalla route), poi `POST /media/confirm` avvia `media/pipeline.ts` con `sharp().rotate()` e strip dei metadati, originale in `original/`, thumbnail 400×400 WebP in `thumbs/`; griglia che carica solo le thumbnail | media | M | T-2.1 | PRIV-01, FR-30–33 | Upload di un video da 40 MB riuscito su Preview Vercel; test: JPEG con GPS in ingresso → nessun EXIF in uscita; thumbnail 400×400 WebP |
| T-2.3 | Carte d'imbarco e documenti: cancellazione del file alla rimozione, path non prevedibili, allineamento alla pipeline di T-2.1 | media | S | T-0.9, T-2.1 | PRIV-03 | DELETE rimuove il file (verificato con `list`) |
| T-2.4 | Cancellazioni e download media basati su `storage_path` ricostruito dal server; `safe-fetch` con allowlist per ogni `fetch` lato server (Instagram, meteo, cambi) e timeout | media | S | T-2.1 | INPUT-07, INT-05 | Test: path fuori dal prefisso del viaggio → 403; host non in allowlist → errore |
| T-2.5 | **Invito del partner**: migration `0017` con `trip_invites` (token hash, email, scadenza 7 gg), RPC `create_trip()` e `accept_trip_invite(token)` transazionali con limite 2 membri; `POST /api/trips/[id]/invites`, pagina `/invite/[token]`, email via Resend | backend + frontend | L | T-0.6, T-1.1 | AUTHZ-09, FR-02 | Flusso completo testato: Nicolò crea il viaggio, invita Giorgia, lei accetta e vede il viaggio; un terzo invito viene rifiutato |
| T-2.6 | **Cron funzionanti**: `GET` con `Authorization: Bearer ${CRON_SECRET}` confrontato a tempo costante, `cleanup` schedulato in `vercel.json`, cancellazione degli oggetti ZIP oltre alle righe | devops | S | T-1.9 | INT-06, PRIV-06 | Log Vercel mostra esecuzioni giornaliere; ZIP > 24 h assenti dal bucket |
| T-2.7 | **UI Instagram**: `components/instagram/InstagramGenerator.tsx` (selezione foto, tipo, anteprima, caption); export come job asincrono (`status` in `instagram_exports`, polling via SWR), funzioni `buildSlides()` pure e testate | media + frontend | L | T-2.2 | FR-34–35 | Da 10 foto si ottiene uno ZIP scaricabile con URL firmato 24 h; test di `buildSlides` |
| T-2.8 | Saldo spese affidabile con un solo membro (stato "in attesa del partner") e messaggio chiaro | frontend | S | T-2.5 | FR-22 | Nessun saldo fuorviante con un solo membro |
| T-2.9 | Cancellazione account completa: file dei viaggi di cui l'utente è unico membro, trasferimento ownership al partner negli altri casi | backend | M | T-2.1 | PRIV-04 | Test su entrambi gli scenari |

---

## Fase 3 — Qualità e testabilità (R2)

| ID | Task | Agente | Dim. | Dipende | SR / NFR | Criterio di accettazione |
|---|---|---|---|---|---|---|
| T-3.1 | Soglia coverage `src/lib/**` 70% in `vitest.config.ts`; CI esegue `test:coverage` e carica il report reale | devops | S | — | SDLC-03 | CI fallisce sotto soglia |
| T-3.2 | Spese: importi in centesimi interi, `computeRate()` puro separato da `fetchRates()`, fallback esplicito (spesa marcata "da convertire" ed esclusa dal saldo con avviso) | backend | M | — | INT-05, FR-21–22 | `expenses.ts` ≥ 90% coverage; test con valute miste e tasso mancante |
| T-3.3 | Tipi: rigenerare `database.types.ts`, tipizzare `createClient<Database>()`, eliminare i cast `as any` | architect | M | T-0.6, T-2.1 | NFR-08 | `grep -c "any"` in `src/` (esclusi test) = 0; `tsc` verde |
| T-3.4 | Iniezione del client Supabase e di `now` nelle funzioni di dominio (`getTripExpenseSummary`, `storage`, `premium/access`, `reminders`) | backend | M | — | T-A, T-E | Test senza `vi.mock` di modulo per queste funzioni |
| T-3.5 | SWR e migrazione del fetching fuori da `useEffect`, partendo da `ItineraryTab`, `ExpensesTab`, `MediaTab`, `(app)/layout.tsx` | frontend | L | — | NFR-08 | Nessun fetch in `useEffect` nei componenti migrati; test aggiornati |
| T-3.6 | Refactoring dei file > 300 righe (`types.ts` per dominio, `LegDrawer`, `BookingsTab`, `ItineraryTab`, `PackingTab`, `TravelWallet`…); una sola config Tailwind e una sola ESLint | frontend | L | T-3.5 | NFR-08 | Nessun file > 300 righe fuori da `database.types.ts` |
| T-3.7 | Lint a zero warning e `--max-warnings=0` in CI | frontend | M | T-3.3 | SDLC-02 | `npm run lint` 0 warning |
| T-3.8 | Test route `trips/**` generati dagli schemi (valido, non valido, non membro) | backend | M | T-1.3 | SDLC-03 | Ogni route ha almeno 3 test |
| T-3.9 | Accessibilità: `aria-label` sui controlli, focus trap nei drawer, verifica con axe nei test delle pagine principali | frontend | M | — | NFR-05 | Zero violazioni axe serie nei test |

---

## Fase 4 — Operatività e rilascio

| ID | Task | Agente | Dim. | Dipende | SR | Criterio di accettazione |
|---|---|---|---|---|---|---|
| T-4.1 | `deploy-production.yml`: trigger su CI verde (`workflow_run` o required checks), migration prima del codice, Supabase CLI a versione fissa, azioni fissate per SHA, `permissions: contents: read` | devops | M | — | OPS-03, SDLC-07 | Un commit con test rossi non arriva in produzione |
| T-4.2 | Sentry: `instrumentation.ts`, config client/server/edge, variabili coerenti, scrubbing di email e token | devops | S | — | OPS-01 | Errore di prova visibile in Sentry senza dati personali |
| T-4.3 | Log strutturati con request id; rimozione di `console.log` con dati utente | backend | S | T-1.3 | PRIV-05 | Nessun log con contenuti di viaggio |
| T-4.4 | Header in un solo posto (`next.config.ts`), CSP con nonce e senza `unsafe-eval`, `connect-src` senza `api.anthropic.com` | frontend | M | — | WEB-01, WEB-02 | securityheaders.com grado A; app funzionante |
| T-4.5 | Rate limiting per IP/utente su `/api/posts/[slug]`, upload, export, AI (es. tabella contatori o Vercel KV) | backend | M | T-1.5 | WEB-06 | Test: oltre soglia → 429 |
| T-4.6 | Backup/PITR su Supabase, prova di restore; runbook di rotazione segreti in `docs/security/` | devops | S | — | OPS-04, OPS-05 | Registro verifiche compilato |
| T-4.7 | `npm audit --audit-level=high` bloccante, `dependabot.yml` versionato (npm root, npm `mobile/`, GitHub Actions) | devops | S | — | SDLC-06 | Job verde |
| T-4.8 | Supabase Auth: lunghezza minima password 10, leaked password protection, parità config locale/cloud | devops | S | — | AUTH-07, AUTH-06 | Screenshot/export config nel registro |

---

## Fase 5 — Contenuti e SEO (R3)

| ID | Task | Agente | Dim. | Dipende | FR | Criterio di accettazione |
|---|---|---|---|---|---|---|
| T-5.1 | Spostare il blog in `(public)/blog` con layout pubblico server-side (oggi eredita il layout client dell'app) | frontend | S | T-3.5 | FR-41 | Nessuna chiamata auth lato client sulle pagine del blog |
| T-5.2 | `app/sitemap.ts` e `app/robots.ts` nativi di Next.js; rimuovere la rewrite verso `/api/sitemap` | content | S | — | FR-42 | `/sitemap.xml` elenca i post pubblicati |
| T-5.3 | Delimitazione dei dati non fidati in tutti i prompt AI (`destination`, `packing`, `seo`, `trip-summary`, `captions`) | content | S | T-1.5 | FR-43–45 | Test con testo di viaggio contenente istruzioni: l'output non le segue |
| T-5.4 | Open Graph image generata per ogni post | content | S | T-2.1 | FR-42 | Anteprima corretta nei validatori social |

---

## Migrazioni di dipendenze (fuori fase)

Salti di versione maggiore che non sono semplici aggiornamenti: provati il 2026-10-08 su `main`, ognuno fallisce oggi. `dependabot.yml` li ignora finché non vengono pianificati.

| ID | Task | Perché non è un bump | Criterio di accettazione |
|---|---|---|---|
| D-1 | Zod 4 | `errorMap` rimosso, `src/test/zod-sample.ts` usa interni di Zod 3, 39 test e la build falliscono | type-check, lint, test e build verdi; `route-contract.test.ts` invariato |
| D-2 | **Fatto il 2026-10-09.** Tiptap 3 (tutti i pacchetti `@tiptap/*` insieme) | aggiornare due pacchetti su cinque rompe `npm ci`; l'editor e `lib/blog/render.ts` usano le estensioni | editor e rendering dei post invariati; test di `render.ts` verdi |
| D-3 | Tailwind 4 | configurazione spostata in CSS: la build fallisce su `globals.css` | build verde e controllo visivo delle pagine principali |
| D-4 | ESLint 10 | `eslint-config-next` 15 supporta solo ESLint ≤ 9: dopo Next 16 | `npm run lint` a zero warning |
| D-5 | Mobile: allineare a Expo SDK 57 | `main` ha `expo` 57 ma React Native 0.76 e React 18 (SDK 57 richiede 0.86 e 19.2): il type-check del mobile fallisce già oggi | `npx expo install --fix`, type-check verde e prova su dispositivo; in alternativa tornare a SDK 52 |
| D-6 | Next 16 (PR Dependabot #127) | type-check, lint, test e build passano; manca la prova a runtime (cache, middleware, immagini) | deploy di anteprima verificato a mano, poi merge |

---

## Tracciamento

| Fase | Task | P0 chiusi | Requisiti SR toccati |
|---|---|---|---|
| 0 | 9 | 4 su 5 (+ mitigazione PRIV-02) | AUTH-03/04, PRIV-02 (parziale), PRIV-03, AUTHZ-04/05/06/07, DEV-01/02, INT-04, SDLC-05 |
| 1 | 10 | — | AUTH-05, AUTHZ-01/03/10, INPUT-01/03/05, INT-02/03/07, CRYPTO-03/04, WEB-04/05, DEV-03, SDLC-04 |
| 2 | 9 | PRIV-02 | PRIV-01/02/03/04/06, CRYPTO-05, INPUT-07, INT-05/06, AUTHZ-09 |
| 3 | 9 | — | SDLC-02/03, INT-05 |
| 4 | 8 | — | OPS-01/03/04/05, WEB-01/02/06, PRIV-05, SDLC-06/07, AUTH-06/07 |
| 5 | 4 | — | INPUT-06 |
