# 01 — Security Requirements

> motonui · baseline sul commit `483599c` (29/09/2026) · verifica statica del codice, `tsc`, `eslint` e `vitest --coverage` eseguiti in locale.

## Come leggere questo registro

Ogni requisito ha un codice `SR-<AREA>-<NN>`, una priorità e uno stato verificato sul codice. La colonna **Verifica** indica il file, la riga o il test che dimostra lo stato; quando lo stato dipende da una configurazione fuori dal repo (dashboard Supabase, Vercel, Mapbox) è indicato esplicitamente e va confermato a mano.

Priorità: **P0** blocca qualsiasi rilascio pubblico e va trattato subito · **P1** obbligatorio per la produzione · **P2** da chiudere entro la fase indicata in `docs/tasks.md` · **P3** miglioramento.

Stati: **Fatto** (implementato e verificabile) · **Parziale** (presente ma con lacune descritte nella nota) · **Da fare** (assente o non funzionante).

## Riepilogo

| Totale | Fatto | Parziale | Da fare |
|---|---|---|---|
| **66** | 52 | 7 | 7 |

| Area | Requisiti | Fatto | Parziale | Da fare | di cui P0 aperti |
|---|---|---|---|---|---|
| SR-AUTH · Autenticazione | 7 | 5 | 1 | 1 | 0 |
| SR-AUTHZ · Autorizzazione e isolamento dei dati | 10 | 10 | 0 | 0 | 0 |
| SR-INPUT · Validazione dell'input | 7 | 5 | 2 | 0 | 0 |
| SR-DEV · Ambiente di sviluppo e segreti nel repo | 5 | 3 | 1 | 1 | 1 |
| SR-CRYPTO · Crittografia e token | 5 | 5 | 0 | 0 | 0 |
| SR-INT · Integrazioni esterne | 7 | 6 | 0 | 1 | 0 |
| SR-PRIV · Privacy e dati personali | 7 | 6 | 1 | 0 | 0 |
| SR-OPS · Operatività | 5 | 2 | 0 | 3 | 0 |
| SR-WEB · Sicurezza web | 6 | 3 | 2 | 1 | 0 |
| SR-SDLC · Ciclo di sviluppo | 7 | 7 | 0 | 0 | 0 |

**Nota sui numeri.** La richiesta iniziale indicava una ripartizione 37 fatti / 7 parziali / 22 da fare. Verificando requisito per requisito sul codice attuale la ripartizione reale è quella sopra: diversi controlli che la documentazione esistente (`docs/SECURITY.md`) segna come fatti risultano parziali o aggirabili, per esempio la RLS sui profili, i bucket pubblici e il cron. Il registro riporta lo stato verificato, non quello dichiarato.

### Requisiti P0 aperti

- **SR-DEV-01** — Nessun segreto nel repository, né nella storia git. Presenti chiave Anthropic, token Mapbox, `ADMIN_IMPERSONATION_SECRET`, email admin e una stringa commentata che sembra una password. File `.env` rimossi dal tracking e `.env.example` con placeholder; resta da ruotare i segreti, già pubblici nella storia git (T-0.1).

Chiusi in codice con la migration `0016` (da verificare sul cloud dopo il deploy): SR-AUTHZ-04, SR-AUTHZ-05, SR-AUTHZ-06. Chiuso in codice con la migration `0020` (stessa verifica): SR-PRIV-02.

## SR-AUTH — Autenticazione

| Codice | Requisito | Priorità | Stato | Verifica | Note |
|---|---|---|---|---|---|
| SR-AUTH-01 | Autenticazione tramite Supabase Auth (email+password e Google OAuth), sessione in cookie SSR | P1 | ✅ Fatto | `src/lib/supabase/server.ts`, `src/app/auth/login/page.tsx`; test `src/app/auth/login/page.test.tsx` | Il magic link previsto da CLAUDE.md non è implementato: si usa la password (commit e25ed09). |
| SR-AUTH-02 | La sessione è rinnovata nel middleware con `getUser()` (validazione lato Auth server, non `getSession()`) | P1 | ✅ Fatto | `src/lib/supabase/middleware.ts`; test `middleware.test.ts` | — |
| SR-AUTH-03 | Dopo login/OAuth si reindirizza solo verso path interni relativi (nessun open redirect) | P1 | ✅ Fatto | `src/lib/redirect.ts` (`safeRedirectPath`) usato in `src/app/auth/callback/route.ts` e `src/app/auth/login/page.tsx`; test `src/lib/redirect.test.ts` | T-0.7. Parametro OAuth con `encodeURIComponent`. |
| SR-AUTH-04 | Un utente sospeso non può usare l'app né le API, su nessun canale | P1 | 🟡 Parziale | `middleware.ts:71-82`; test `middleware.test.ts` | Il middleware blocca il web, ma l'utente può azzerare `suspended_at` da solo via REST (vedi SR-AUTHZ-04) e l'app mobile parla direttamente con Supabase. |
| SR-AUTH-05 | Le API non autenticate rispondono 401 JSON, non con redirect HTML | P2 | ✅ Fatto | `middleware.ts`; test `middleware.test.ts` | T-1.9. Anche un utente sospeso riceve 403 JSON sulle API invece del redirect. |
| SR-AUTH-06 | Conferma email obbligatoria e JWT di breve durata | P2 | ✅ Fatto | `supabase/config.toml` (`enable_confirmations = true`, `jwt_expiry = 3600`) | Verificare che il progetto cloud abbia le stesse impostazioni (config esterna). |
| SR-AUTH-07 | Password policy minima e protezione da password compromesse attive | P2 | 🔴 Da fare | `supabase/config.toml` (assente `minimum_password_length`/`password_requirements`) | Configurare anche su Supabase cloud (Auth → Policies). |

## SR-AUTHZ — Autorizzazione e isolamento dei dati

| Codice | Requisito | Priorità | Stato | Verifica | Note |
|---|---|---|---|---|---|
| SR-AUTHZ-01 | RLS abilitata su tutte le tabelle dello schema `public` | P1 | ✅ Fatto | `supabase/migrations/*`; meta-controllo in `supabase/tests/rls_matrix.test.sql` (job `rls-tests`) | Il test fallisce se una tabella di `public` non ha RLS o una policy UPDATE non ha `WITH CHECK`. |
| SR-AUTHZ-02 | I dati di viaggio sono visibili e modificabili solo dai membri del viaggio | P1 | ✅ Fatto | `0001_initial.sql` (`is_trip_member`), `0015_packing.sql` | — |
| SR-AUTHZ-03 | Ogni route `/api/trips/[id]/**` verifica l'appartenenza (`requireTripMember`) oltre alla RLS | P2 | ✅ Fatto | `src/lib/api/with-route.ts` (`tripMember: true`, `dayInTrip: true`); test statico `src/app/api/trips/route-authz.test.ts` su ogni handler; `with-route.test.ts` | T-1.3. Migrate le 9 route senza controllo, `DELETE /api/trips/[id]`, `/api/expenses/[id]` (membership del viaggio della spesa) e `ai/generate-post` (viaggio nel body). Una nuova route senza controllo fa fallire il test. |
| SR-AUTHZ-04 | Un utente non può modificare `role`, `plan`, `premium_until`, `suspended_at` del proprio profilo | P0 | ✅ Fatto | `0016_harden_rls_structural_columns.sql`; test `supabase/tests/0016_phase0_rls.test.sql` | T-0.4. Unica policy UPDATE con `WITH CHECK`; UPDATE concesso solo su `display_name`, `avatar_url`, `updated_at`. Da verificare sul cloud dopo il deploy (checklist B8). |
| SR-AUTHZ-05 | Nessuna vista espone `auth.users` ai ruoli `anon`/`authenticated` | P0 | ✅ Fatto | `0016_harden_rls_structural_columns.sql` (`REVOKE` su `admin_user_view`); test `supabase/tests/0016_phase0_rls.test.sql` | T-0.5. Le route admin usano già il service role. Da verificare sul cloud dopo il deploy (B7, B8). |
| SR-AUTHZ-06 | Le colonne strutturali non sono modificabili dal client (`trips.owner_id`, `*.trip_id`, `media.url`, `media.uploaded_by`, `expenses.paid_by`…) | P0 | ✅ Fatto | `0016_harden_rls_structural_columns.sql` (trigger `prevent_structural_update`, `WITH CHECK` ovunque, `paid_by` membro del viaggio); test `supabase/tests/0016_phase0_rls.test.sql` | T-0.6. `paid_by` resta modificabile ma solo verso un membro del viaggio. Il mobile non invia più `url` nella modifica dei media. |
| SR-AUTHZ-07 | Tutte le funzioni `SECURITY DEFINER` hanno `search_path` fissato | P2 | ✅ Fatto | `0016_harden_rls_structural_columns.sql`; meta-controllo su `pg_proc` in `supabase/tests/0016_phase0_rls.test.sql` | T-0.6. |
| SR-AUTHZ-08 | Le route admin verificano il ruolo lato server; il bypass di sviluppo è opt-in esplicito | P1 | ✅ Fatto | `src/lib/auth/require-admin.ts`, `src/app/(admin)/admin/layout.tsx`; test `src/lib/admin/permissions.test.ts` | Il ruolo letto è affidabile solo dopo SR-AUTHZ-04. |
| SR-AUTHZ-09 | Un viaggio ha al massimo 2 membri (vincolo nel DB) | P2 | ✅ Fatto | `0021_trip_invites.sql` (trigger `AFTER INSERT` `enforce_trip_member_limit` con lock sul viaggio; `trip_members_insert` limitata all'owner che inserisce se stesso; `create_trip`, `create_trip_invite`, `accept_trip_invite` `SECURITY DEFINER`); test `supabase/tests/0021_trip_invites.test.sql`, `invites/route.test.ts` | T-2.5. Il trigger è `AFTER` perché la `WITH CHECK` della RLS viene valutata dopo i trigger `BEFORE`. Verificato con due inserimenti concorrenti: uno solo passa. Inviti: token da 256 bit salvato solo come SHA-256, 7 giorni, monouso, legato all'email invitata, un solo invito pendente per viaggio. |
| SR-AUTHZ-10 | L'impersonazione è in sola lettura, revocabile e limitata nel tempo | P1 | ✅ Fatto | `src/lib/admin/impersonation-token.ts`, `middleware.ts`; test `impersonation-token.test.ts`, `middleware.test.ts`, `impersonation.test.ts` | T-1.8 (ADR-07): scritture bloccate, scadenza 30 min, revoca verificata a ogni richiesta (cache 30 s). L'identità impersonata non viene applicata per scelta: rimossi gli header `x-impersonated-*` che nessuno leggeva. |

## SR-INPUT — Validazione dell'input

| Codice | Requisito | Priorità | Stato | Verifica | Note |
|---|---|---|---|---|---|
| SR-INPUT-01 | Tutti gli input delle API sono validati con Zod, compresi query string e `multipart` | P1 | 🟡 Parziale | `withRoute` valida params (UUID), query e body; `src/lib/validation.ts` | T-1.3; T-3.8: tutte le route `/api/trips/**` sono su `withRoute` (id UUID validati prima della membership, filtri spese come schema `query`) e `route-contract.test.ts` genera dagli schemi, per ogni handler, una richiesta valida, una non valida (400) e una da non membro (403). Restano le route admin; `multipart` ancora letto con cast in `media/route.ts`. |
| SR-INPUT-02 | Upload: whitelist MIME, controllo magic bytes, limite 50 MB lato server | P1 | ✅ Fatto | `src/lib/storage.ts`; test `src/lib/storage.test.ts` | — |
| SR-INPUT-03 | Gli errori di validazione restituiscono 400 con messaggio leggibile | P3 | ✅ Fatto | `formatZodError` in `src/lib/validation.ts` (test `validation.test.ts`), usato da `withRoute` e da tutte le route con `Errors.validation`; `validateFile` lancia un `AppError` 400 | T-1.4. Messaggi `campo: motivo` in italiano, senza valori in ingresso. |
| SR-INPUT-04 | Il contenuto Tiptap è sanificato in scrittura (whitelist di nodi, marks, protocolli URL, limiti di profondità) | P1 | ✅ Fatto | `src/lib/sanitize.ts`; test `src/lib/sanitize.test.ts` | — |
| SR-INPUT-05 | Il contenuto del blog è sanificato anche in rendering (difesa contro scritture dirette via REST) | P1 | ✅ Fatto | `src/lib/blog/render.ts` (`sanitizeTiptapDocument` prima di `generateHTML`), usato da `blog/[slug]/page.tsx`; test `render.test.ts` | T-1.6. Il test fallisce se si toglie la sanificazione (link `javascript:` scritto via REST). |
| SR-INPUT-06 | I dati utente nei prompt AI sono delimitati e trattati come non fidati | P2 | 🟡 Parziale | `src/lib/ai/blog-assistant.ts` (`buildPromptBoundary`) | Assente in `destination.ts`, `packing.ts`, `seo.ts`, `trip-summary.ts`, `media/captions.ts`. |
| SR-INPUT-07 | Le richieste HTTP lato server vanno solo verso host in allowlist (anti-SSRF) | P1 | ✅ Fatto | `src/lib/safe-fetch.ts` (HTTPS, allowlist, niente redirect, timeout) usato da `weather.ts` ed `expenses.ts`; `src/lib/media/instagram-export.ts` legge dal bucket privato con path ricontrollato (`isTripFilePath`), nessun `fetch` verso URL salvati nel DB; test `safe-fetch.test.ts`, `instagram-export.test.ts` | T-2.4. I media con solo un link esterno non sono esportabili (errore 400). |

## SR-DEV — Ambiente di sviluppo e segreti nel repo

| Codice | Requisito | Priorità | Stato | Verifica | Note |
|---|---|---|---|---|---|
| SR-DEV-01 | Nessun segreto nel repository, né nella storia git | P0 | 🔴 Da fare | `git ls-files` contiene solo i `.env.example` con placeholder; job `secrets-scan` verde | Rimossi dal tracking `.env.local` e `mobile/.env` (T-0.2). Resta aperto finché i valori esposti (chiave Anthropic, token Mapbox, `ADMIN_IMPERSONATION_SECRET`, stringa simile a password) non sono ruotati (T-0.1): restano nella storia git pubblica. |
| SR-DEV-02 | `.gitignore` copre `.env*`, `coverage/`, `tmp/`, `*.tsbuildinfo`, `.expo/` | P1 | ✅ Fatto | `.gitignore`; `git ls-files` senza `.env` reali, `.expo/`, `supabase/.temp`, `*.tsbuildinfo` | T-0.2. `tmp/`, `undefined/`, `chat.py`, `.replit` ancora tracciati (pulizia T-0.3). |
| SR-DEV-03 | I bypass di sviluppo non possono attivarsi in produzione | P1 | ✅ Fatto | `src/lib/auth/admin-bypass.ts` (ignorato a runtime in produzione, `next.config.ts` blocca build/start); test `admin-bypass.test.ts`, `permissions.test.ts` | T-1.10. Verificato: `next build` con `ADMIN_AUTH_BYPASS=true` esce con errore. |
| SR-DEV-04 | Lo sviluppo locale usa Supabase locale, senza chiavi di produzione | P2 | 🟡 Parziale | `.env.local` → `127.0.0.1:54321` | `mobile/.env` punta al progetto cloud. |
| SR-DEV-05 | Seed con credenziali note solo in locale, mai eseguito in produzione | P2 | ✅ Fatto | `supabase/seed.sql` (utente dev `password123`), `deploy-production.yml` esegue solo `db push` | — |

## SR-CRYPTO — Crittografia e token

| Codice | Requisito | Priorità | Stato | Verifica | Note |
|---|---|---|---|---|---|
| SR-CRYPTO-01 | TLS ovunque e HSTS con preload | P1 | ✅ Fatto | `next.config.ts` (`Strict-Transport-Security`) | — |
| SR-CRYPTO-02 | Token di impersonazione firmato HS256, segreto ≥ 32 caratteri, scadenza 30 min | P1 | ✅ Fatto | `src/app/api/admin/users/[id]/impersonate/route.ts`; test `impersonation.test.ts` | Il segreto attuale è compromesso (SR-DEV-01). |
| SR-CRYPTO-03 | I token persistiti nel DB sono salvati come hash, non in chiaro | P2 | ✅ Fatto | `impersonation_tokens.token` contiene SHA-256 del `jti` (`0019_impersonation_token_hash.sql`); test `impersonation.test.ts` | T-1.8. La migration elimina le righe in chiaro esistenti. Gli inviti (T-2.5) seguiranno lo stesso schema. |
| SR-CRYPTO-04 | Revoca del token di impersonazione verificata a ogni richiesta (`jti` + lista revoche) | P2 | ✅ Fatto | `isImpersonationTokenActive` in `middleware.ts`; test `impersonation-token.test.ts`, `middleware.test.ts` | T-1.8. Fail closed: un errore di rete o di configurazione equivale a token revocato. |
| SR-CRYPTO-05 | I media privati sono serviti con URL firmati a breve durata | P1 | ✅ Fatto | `src/lib/trip-storage.ts` (`withSignedUrls`, TTL 1 h, firmati con il client dell'utente), `GET /api/trips/[id]/media`; mobile `withSignedMediaUrls`; test `trip-storage.test.ts`, `media/route.test.ts` | T-2.1. Documenti e carte d'imbarco passano invece da un proxy autenticato (nessun URL di storage al browser). |

## SR-INT — Integrazioni esterne

| Codice | Requisito | Priorità | Stato | Verifica | Note |
|---|---|---|---|---|---|
| SR-INT-01 | La chiave Anthropic resta solo lato server | P0 | ✅ Fatto | uso solo in `src/lib/ai/*` e route server | Da ruotare comunque (SR-DEV-01). `connect-src` include `api.anthropic.com` senza motivo. |
| SR-INT-02 | Le quote AI sono imposte lato server in modo atomico | P1 | ✅ Fatto | `0018_atomic_ai_quota.sql` (`consume_feature_quota`: incremento condizionale `ON CONFLICT … WHERE`, tutto-o-niente, eseguibile solo dal service role); `src/lib/premium/access.ts`; test `access.test.ts`, `supabase/tests/0018_ai_quota.test.sql` | T-1.5. Verificato con 50 connessioni parallele: esattamente 20 accettate. `ai_usage` non è più scrivibile dall'utente. |
| SR-INT-03 | Un solo sistema di quota AI, allineato alla policy di progetto (20 chiamate/giorno per utente) | P2 | ✅ Fatto | contatore `ai_total` (20/giorno) consumato insieme ai limiti per funzionalità; `checkRateLimit` rimosso; model id in `src/lib/ai/models.ts` | T-1.5. Il premium resta configurabile per funzionalità tramite `feature_entitlements`. |
| SR-INT-04 | Token Mapbox pubblico ristretto per URL/dominio | P2 | 🔴 Da fare | configurazione esterna (dashboard Mapbox) | Il token attuale è anche nel repo. |
| SR-INT-05 | Degradazione controllata dei servizi esterni (timeout, fallback espliciti) | P2 | ✅ Fatto | `src/lib/safe-fetch.ts` (timeout 8 s) per meteo e cambi; `src/lib/currency.ts` (`convertCurrency` restituisce `null` senza tasso), `src/lib/expenses.ts` (`eurCents`), `src/lib/trips.ts`; test `currency.test.ts`, `expenses.test.ts`, `trips.test.ts` | T-3.2. Una spesa in valuta estera senza tasso resta "da convertire" (`amount_eur` null): esclusa da totali, saldo e statistiche e mostrata con un avviso, invece di contare 100 USD come 100 €. |
| SR-INT-06 | I job cron sono autenticati e vengono realmente eseguiti | P1 | ✅ Fatto | `vercel.json` (crons `send-reminders` 08:00 e `cleanup` 03:00 UTC), `src/lib/auth/cron.ts` (`Authorization: Bearer $CRON_SECRET`, `timingSafeEqual`); test `cron.test.ts`, `cleanup/route.test.ts` | T-2.6. Route in `GET`, escluse dal login nel middleware (`CRON_ROUTES`). Da verificare dopo il deploy: esecuzioni giornaliere nei log Vercel e `CRON_SECRET` impostato. `send-reminders` caricava le entità con un embed `legs:entity_id(...)` impossibile (nessuna FK): falliva a ogni esecuzione. Ora `src/lib/reminder-emails.ts` fa una query per tipo; test `reminder-emails.test.ts`. |
| SR-INT-07 | I template email fanno escape dei dati inseriti dall'utente | P2 | ✅ Fatto | `src/lib/email.ts` (tutti i campi passano da `escapeFields`, `src/lib/html.ts`); test `email.test.ts` | T-1.7. |

## SR-PRIV — Privacy e dati personali

| Codice | Requisito | Priorità | Stato | Verifica | Note |
|---|---|---|---|---|---|
| SR-PRIV-01 | EXIF (in particolare GPS) rimossi dalle foto prima di qualunque esposizione | P1 | ✅ Fatto | `src/lib/media/pipeline.ts` (`processImage`: `sharp().rotate()` e ricodifica WebP senza metadati; originale e thumbnail 400×400), route `…/media/uploads` e `…/media/confirm`; test `pipeline.test.ts` (JPEG con GPS in ingresso → nessun EXIF in uscita) | T-2.2. Il file grezzo resta solo in `incoming/` (bucket privato, leggibile solo dai membri) fino alla conferma; gli upload mai confermati sono rimossi dal cron dopo 24 h. Data, fotocamera e posizione restano come colonne del DB, visibili ai soli membri. I video MP4 non sono ricodificati: eventuali metadati di posizione nel contenitore restano. |
| SR-PRIV-02 | Foto, carte d'imbarco e documenti stanno in bucket privati | P0 | ✅ Fatto | `0017_trip_documents_bucket.sql`, `0020_private_trip_media.sql`, `0023_instagram_exports_private.sql` (ZIP Instagram privati, scaricati solo con URL firmato ≤ 24 h) (`trip-media` privato, sola policy `SELECT` per i membri su `trips/{trip_id}/`, path vincolati al viaggio e immutabili); proxy `…/boarding-pass` e `…/documents/[documentId]/file`; test `supabase/tests/0017_trip_documents.test.sql`, `0020_private_media.test.sql`, `documents/route.test.ts` | T-0.9 e T-2.1/T-2.3. I vecchi URL pubblici `/object/public/trip-media/…` smettono di funzionare con la migration; le righe esistenti sono convertite in `storage_path`. Da verificare sul cloud dopo `supabase db push`: bucket privato e nessuna policy residua creata dalla dashboard. Le copertine dei post (`post-covers`) restano pubbliche per scelta (blog pubblico). |
| SR-PRIV-03 | Rimuovere una carta d'imbarco elimina anche il file | P2 | ✅ Fatto | `boarding-pass/route.ts` (DELETE e sostituzione), `legs/[legId]` DELETE, `documents/[documentId]` DELETE, `src/lib/trip-storage.ts` (path ricontrollati sul prefisso del viaggio); test `route.test.ts`, `trip-storage.test.ts`, `documents/route.test.ts` | T-0.9 e T-2.3. Path non prevedibili (`{legId}-{uuid}.{ext}`, `documents/{uuid}.{ext}`). Anche eliminare lo spostamento o il documento rimuove il file. |
| SR-PRIV-04 | Cancellazione account self-service completa (DB + storage) | P1 | ✅ Fatto | `0022_account_deletion.sql` (`purge_user_data`: viaggi condivisi trasferiti al partner, viaggi in solitaria eliminati, file in `storage_deletion_queue`), `src/lib/storage-deletion.ts` (svuotata con la Storage API da `POST /api/account/delete`, dalla DELETE admin e dal cron `cleanup`); test `supabase/tests/0022_account_deletion.test.sql`, `storage-deletion.test.ts`, `account/delete/route.test.ts`, `delete.test.ts` | T-2.9. Dal mobile (`delete_my_account` diretta) i file sono rimossi entro 24 h dal cron. Nei viaggi condivisi si eliminano foto, documenti e spese pagate dall'utente. Lo storico dell'audit admin sull'utente resta (`target_id` a null). |
| SR-PRIV-05 | Nessun dato personale nei log applicativi | P2 | 🟡 Parziale | `src/app/api/trips/route.ts:28` (`console.log` dei viaggi) | — |
| SR-PRIV-06 | Gli ZIP Instagram (file, non solo riga DB) sono eliminati dopo 24 h | P2 | ✅ Fatto | `src/lib/instagram-cleanup.ts` (oggetti > 24 h nel bucket, orfani compresi), `cleanup/route.ts`; test `instagram-cleanup.test.ts` | T-2.6. Cron giornaliero: uno ZIP vive al massimo ~48 h. |
| SR-PRIV-07 | I post pubblicati non espongono dati privati del viaggio | P1 | ✅ Fatto | `src/app/api/posts/[slug]/route.ts` (colonne esplicite), RLS `trips_select` | — |

## SR-OPS — Operatività

| Codice | Requisito | Priorità | Stato | Verifica | Note |
|---|---|---|---|---|---|
| SR-OPS-01 | Error tracking attivo in produzione | P2 | 🔴 Da fare | `src/lib/monitoring.ts` | `initSentry()` non è mai chiamato e legge `SENTRY_DSN` mentre `.env.example` definisce `NEXT_PUBLIC_SENTRY_DSN`. Mancano `instrumentation.ts` e `sentry.*.config`. |
| SR-OPS-02 | Audit log delle azioni amministrative sensibili | P1 | ✅ Fatto | `admin_audit_log`; route `admin/users/[id]/*` | — |
| SR-OPS-03 | Il deploy di produzione parte solo dopo CI verde e applica le migration prima del codice | P1 | ✅ Fatto | `.github/workflows/deploy-production.yml` (`workflow_run` della CI, solo `conclusion == success` su push a `main`, deploya `head_sha` testato; job `apply-migrations` → `deploy`), Supabase CLI e Vercel CLI a versione fissa; `vercel.json` `git.deploymentEnabled.main: false` | T-4.1. Se le migration falliscono il codice non parte. Da verificare dopo il primo deploy: segreti `SUPABASE_DB_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` nell'environment `production` e deploy Git di Vercel spento anche nelle impostazioni del progetto. |
| SR-OPS-04 | Backup/PITR del database attivi e restore provato | P2 | 🔴 Da fare | configurazione esterna (Supabase) | — |
| SR-OPS-05 | Procedura documentata di rotazione e revoca dei segreti | P2 | 🔴 Da fare | assente in `docs/` | — |

## SR-WEB — Sicurezza web

| Codice | Requisito | Priorità | Stato | Verifica | Note |
|---|---|---|---|---|---|
| SR-WEB-01 | Header di sicurezza: nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy | P1 | ✅ Fatto | `next.config.ts`, `vercel.json` | `vercel.json` e `next.config.ts` definiscono `Permissions-Policy` diverse (geolocation). |
| SR-WEB-02 | CSP senza `unsafe-eval` e con script a nonce | P2 | 🟡 Parziale | `next.config.ts` (CSP con `unsafe-inline` e `unsafe-eval`) | — |
| SR-WEB-03 | Cookie sensibili `HttpOnly`, `Secure`, `SameSite` | P1 | ✅ Fatto | `impersonate/route.ts:76-89`; cookie Supabase via `@supabase/ssr` | — |
| SR-WEB-04 | Protezione CSRF sulle route che modificano stato (controllo `Origin`) | P2 | ✅ Fatto | `middleware.ts` (`Origin` / `Sec-Fetch-Site` sui metodi di scrittura di `/api/*`); test `middleware.test.ts` | T-1.9. Oltre a `SameSite=Lax`. Le route cron sono escluse (server-to-server, segreto proprio). |
| SR-WEB-05 | Nessun dettaglio interno negli errori restituiti al client | P1 | 🟡 Parziale | `src/lib/errors.ts`, `withRoute`; test `errors.test.ts`, `with-route.test.ts` | Le route `/api/ai/*` ora passano da `withRoute`; restano le route `/api/admin/*` senza `withErrorHandler`. |
| SR-WEB-06 | Rate limiting sulle route pubbliche e su quelle costose (upload, export, AI) | P2 | 🔴 Da fare | `/api/posts/[slug]`, `/api/trips/[id]/media`, `/api/instagram/generate` | — |

## SR-SDLC — Ciclo di sviluppo

| Codice | Requisito | Priorità | Stato | Verifica | Note |
|---|---|---|---|---|---|
| SR-SDLC-01 | CI su ogni PR: type-check, lint, test, build | P1 | ✅ Fatto | `.github/workflows/ci.yml` | Il job `unit-tests` esegue `test:coverage` con soglie (T-3.1) e carica `lcov.info` su Codecov. |
| SR-SDLC-02 | Lint con zero warning, come richiesto da CLAUDE.md | P3 | ✅ Fatto | `eslint.config.mjs` (config unica), `npm run lint` = `eslint . --max-warnings=0`, eseguito dal job `lint-and-typecheck` | T-3.3/T-3.7 (zero `any`, client tipizzato) e T-3.5 (fetch con SWR, niente più `exhaustive-deps`). Un warning ora fa fallire la CI. |
| SR-SDLC-03 | Coverage ≥ 70% su `src/lib/`, imposta in CI | P2 | ✅ Fatto | `vitest.config.ts` (soglie righe/istruzioni/funzioni 70%, branch 60%; esclusi solo `src/lib/supabase/**`), job CI Unit Tests con `npm run test:coverage` e report caricato | T-3.1. Al 29/09/2026: 81% righe, 79% istruzioni, 66% branch. La CI fallisce sotto soglia. |
| SR-SDLC-04 | Test automatici delle policy RLS con utente anonimo, estraneo, partner | P1 | ✅ Fatto | `supabase/tests/rls_matrix.test.sql` (matrice SELECT/INSERT/UPDATE/DELETE × anonimo/estraneo/partner/owner su ogni tabella con `trip_id`), `supabase/tests/0016_phase0_rls.test.sql` (regressioni S-02/S-03/S-04); job CI `rls-tests` (Postgres 15 + `supabase/tests/support/supabase-stub.sql`) | T-1.1, T-1.2. Una nuova tabella di viaggio senza fixture fa fallire il test. |
| SR-SDLC-05 | Secret scanning in CI e pre-commit | P1 | ✅ Fatto | job `secrets-scan` in `.github/workflows/ci.yml` (bloccante), `.gitleaks.toml`, `.pre-commit-config.yaml` | T-0.3. Scansiona l'albero, non la storia (già esposta: vedi SR-DEV-01). |
| SR-SDLC-06 | Aggiornamenti e audit delle dipendenze | P2 | ✅ Fatto | `.github/dependabot.yml` (npm root, npm `mobile/`, GitHub Actions; settimanale, minor/patch raggruppati), job CI `dependency-audit` (`npm audit --omit=dev --audit-level=high`, bloccante) | T-4.7. Le dipendenze di sviluppo (eslint-config-next, catena tailwind) e `mobile/` restano in report non bloccante, coperte da Dependabot. `sharp` portato a 0.35.5, `postcss`/`source-map-js` forzati con `overrides`. |
| SR-SDLC-07 | GitHub Actions con permessi minimi e azioni fissate per SHA | P2 | ✅ Fatto | `.github/workflows/*.yml`: `permissions: contents: read` a livello di workflow (preview: `pull-requests: write` solo nel job che commenta), ogni `uses:` fissato per SHA con la versione in commento, `persist-credentials: false` nei job con segreti | T-4.1. `amondnet/vercel-action` sostituita dalla CLI ufficiale `vercel@62.4.0`: il token non passa più da codice di terze parti. |

## Manutenzione del registro

- Ogni PR che chiude un requisito aggiorna la riga (stato e colonna Verifica) nello stesso commit.
- Un requisito passa a **Fatto** solo se la colonna Verifica cita un test automatico o un controllo ripetibile; per le configurazioni esterne serve una voce nel registro verifiche di `04-SECURITY-CHECKLIST.md`.
- I nuovi requisiti prendono il primo numero libero dell'area; i codici non si riusano.
