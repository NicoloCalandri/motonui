# REVIEW.md — Analisi del codice: miglioramenti su qualità, sicurezza e testabilità

> Commit `483599c` · 173 commit · 269 file tracciati. Strumenti eseguiti: `tsc --noEmit` (0 errori), `eslint .` (0 errori, 306 warning), `vitest run --coverage` (24 file, 181 test verdi, coverage `src/lib` 29,6% righe).
>
> Severità: **Critica** (sfruttabile oggi, impatto alto) · **Alta** · **Media** · **Bassa**. Ogni finding rimanda al requisito (`SR-…`) e al task (`T-…` in `docs/tasks.md`).

---

## 1. Cosa funziona bene

Prima dei problemi, vale la pena fissare cosa c'è di solido, perché è la base su cui costruire:

- **Gestione errori coerente** con `withErrorHandler`, `AppError` e il formato `{ error, code, status }` in italiano, testato al 95%.
- **Sanificazione Tiptap** a whitelist, con limiti di profondità e numero di nodi (`src/lib/sanitize.ts`).
- **Validazione degli upload** con magic bytes oltre al MIME dichiarato.
- **RLS attiva su tutte le 25 tabelle** e helper di autorizzazione applicativa (`src/lib/authz.ts`) che verificano anche l'appartenenza di giorno, tratta e pagatore al viaggio.
- **Recenti correzioni di sicurezza ben eseguite** (piano del 16/09): cookie di impersonazione `httpOnly`, bypass admin opt-in, fix del controllo sospensione nel middleware con test di regressione.
- **Quote premium lato server** con service role e soglie di allerta.
- **TypeScript senza errori** e test veloci con pattern di mock consistenti.

---

## 2. Sicurezza

### S-01 · Critica · Segreti committati in un repository pubblico
`.env.local`, `.env.example` e `mobile/.env` sono nel repo (commit `21ba1db`, `2b42a11`, `d13a21e`). Contengono una chiave Anthropic, un token Mapbox, `ADMIN_IMPERSONATION_SECRET`, l'email admin e una stringa commentata che ha l'aspetto di una password. Le chiavi Supabase di `.env.local` puntano a `127.0.0.1` (istanza locale) e hanno quindi impatto limitato; `.env.example` però contiene una anon key del progetto cloud e un valore `sb_publishable…` nella variabile del service role.
**Cosa fare:** ruotare tutto ciò che è reale (Anthropic, Mapbox, segreto di impersonazione, password se è tale), rimuovere i file, aggiornare `.gitignore`, aggiungere gitleaks. Riscrivere la storia è facoltativo: il repo è già pubblico, quindi ciò che protegge davvero è la rotazione. → SR-DEV-01, SR-DEV-02, SR-SDLC-05 · T-0.1–T-0.3

### S-02 · Critica · Chiunque può diventare admin o premium da solo
In `0007_admin_role.sql` convivono due policy UPDATE permissive su `profiles`:

```sql
create policy "admin_role_immutable_by_user" ... using (auth.uid() = id) with check (role = 'user');
create policy "profiles_update_own"          ... using (auth.uid() = id);   -- nessun WITH CHECK
```

Postgres combina le policy permissive in OR, e senza `WITH CHECK` la seconda usa la clausola `USING` anche come controllo sul nuovo valore. Risultato: con la propria sessione e la anon key un utente può eseguire `PATCH /rest/v1/profiles?id=eq.<suo id>` con `{"role":"admin"}`, `{"plan":"premium"}` o `{"suspended_at":null}`. `requireAdmin` e `requireFeatureAccess` leggono proprio quei campi.
**Cosa fare:** eliminare `profiles_update_own`, lasciare un'unica policy con `WITH CHECK` e revocare l'UPDATE sulle colonne sensibili (`REVOKE UPDATE (role, plan, premium_until, premium_enabled_at, premium_enabled_by, suspended_at, suspended_reason) ON profiles FROM authenticated`). Aggiungere il test RLS. → SR-AUTHZ-04 · T-0.4

### S-03 · Critica · `admin_user_view` espone le email di tutti gli utenti
La vista fa join con `auth.users` e, come ogni vista Postgres creata senza `security_invoker`, gira con i privilegi del proprietario ignorando la RLS. Nessuna migration revoca i grant che Supabase assegna di default ad `anon` e `authenticated` sullo schema `public`. Va verificato sul progetto cloud (Security Advisor di Supabase la segnala come *security definer view* ed *exposed auth.users*); se confermato, `GET /rest/v1/admin_user_view` restituisce email, ultimo accesso e ruolo di tutti.
**Cosa fare:** `REVOKE ALL ON public.admin_user_view FROM anon, authenticated;` oppure spostarla in uno schema non esposto e leggerla solo con il service role. → SR-AUTHZ-05 · T-0.5

### S-04 · Alta · Colonne strutturali modificabili via REST
Le policy UPDATE di `trips`, `media`, `expenses` (e altre) hanno solo `USING`. Conseguenze concrete:
- il partner può impostare `trips.owner_id` su di sé e poi cancellare il viaggio;
- un membro può riscrivere `media.url` con un path di **un altro viaggio**: `DELETE /api/trips/[id]/media/[mediaId]` ricava il path da `media.url` e lo cancella con il service role (`media/[mediaId]/route.ts:26-31`), quindi si possono eliminare file altrui;
- lo stesso `media.url` viene scaricato lato server in `instagram-export.ts:70` → SSRF verso host arbitrari.
**Cosa fare:** trigger `BEFORE UPDATE` che rifiuta modifiche a `id`, `trip_id`, `owner_id`, `uploaded_by`, `url`/`storage_path`, `created_at`; `WITH CHECK` su tutte le policy; path di storage ricostruiti dal server. → SR-AUTHZ-06, SR-INPUT-07 · T-0.6, T-2.4

### S-05 · Alta · Foto, carte d'imbarco e documenti pubblici
`uploadFile` restituisce sempre `…/object/public/trip-media/…`. Le carte d'imbarco finiscono in `trips/{tripId}/boarding-passes/{legId}.ext` (path prevedibile, dati personali e codice di prenotazione) e non vengono cancellate quando si rimuovono. Le foto originali conservano i metadati EXIF, GPS incluso. Il bucket `trip-media` non è definito in nessuna migration, quindi la sua visibilità dipende da una configurazione manuale non tracciata.
→ SR-PRIV-01, SR-PRIV-02, SR-PRIV-03, SR-CRYPTO-05 · T-2.1–T-2.3

### S-06 · Alta · Open redirect su login e callback OAuth
`auth/callback/route.ts` fa `NextResponse.redirect(new URL(redirectTo, origin))`: con `?redirect=https://sito-esterno` il secondo argomento viene ignorato. La pagina di login fa `router.push(redirectTo)` e costruisce l'URL OAuth senza `encodeURIComponent`. È un vettore classico per phishing credibile ("accedi a motonui" → pagina finta).
**Cosa fare:** `safeRedirectPath()` che accetta solo path che iniziano con un singolo `/`. → SR-AUTH-03 · T-0.7

### S-07 · Media · Quota AI aggirabile e duplicata
`checkRateLimit` (`blog-assistant.ts:105`) legge e scrive `ai_usage` con il client dell'utente, e la RLS permette all'utente `UPDATE` sulle proprie righe: basta azzerare il contatore via REST. Esiste inoltre un secondo sistema (`usage_counters`, server-side) con limiti diversi; entrambi fanno lettura-poi-scrittura e sono soggetti a race con richieste parallele. → SR-INT-02, SR-INT-03 · T-1.5

### S-08 · Media · Cron mai eseguiti
Vercel Cron invoca le route con **GET** e header `Authorization: Bearer $CRON_SECRET`. `send-reminders` esporta solo POST e controlla `x-admin-secret`; in più il middleware reindirizza al login perché la richiesta non ha sessione. `cleanup` non è nemmeno schedulato: ZIP Instagram, `ai_usage` e cache non vengono mai ripuliti. → SR-INT-06, SR-PRIV-06 · T-2.6

### S-09 · Media · Contenuto del blog sanificato solo in scrittura
`posts_update` consente all'autore di scrivere `content_json` via REST, saltando `sanitizeTiptapDocument`; la pagina pubblica lo rende con `dangerouslySetInnerHTML`. Le estensioni Tiptap limitano molto i vettori, ma una seconda sanificazione in rendering costa poco. → SR-INPUT-05 · T-1.6

### S-10 · Media · Impersonazione incompleta
Il middleware imposta `x-impersonated-user-id` sulla **risposta**, non sulla richiesta, e nessuno lo legge: l'impersonazione non cambia la vista. La revoca (`exit` cancella la riga in `impersonation_tokens`) non viene mai verificata, e il token è salvato in chiaro. Con il segreto attualmente pubblico chiunque può firmare un token valido; oggi l'impatto è basso proprio perché il token fa poco, ma diventerebbe critico se l'impersonazione venisse completata. → SR-AUTHZ-10, SR-CRYPTO-03, SR-CRYPTO-04 · T-1.8

### S-11 · Media · Email con HTML non sottoposto a escape
`email.ts` interpola `carrier`, `from`, `to`, `pnr`, `userName` nel markup. Il partner può inserire link o markup nelle email inviate all'altro membro. → SR-INT-07 · T-1.7

### S-12 · Bassa · Varie
- `is_trip_member` e `handle_new_user` sono `SECURITY DEFINER` senza `search_path` (SR-AUTHZ-07).
- CSP con `unsafe-eval`; `connect-src` include `api.anthropic.com` che il browser non deve mai chiamare (SR-WEB-02).
- `console.log` dei viaggi dell'utente in `api/trips/route.ts:28` (SR-PRIV-05).
- `weather_cache` scrivibile da qualsiasi utente autenticato: cache poisoning dei dati meteo mostrati ad altri.
- Il middleware reindirizza le API non autenticate invece di rispondere 401 (SR-AUTH-05).
- Nessun limite sul numero di membri per viaggio (SR-AUTHZ-09).

---

## 3. Qualità del codice

| ID | Severità | Finding | Dove | Task |
|---|---|---|---|---|
| Q-01 | Alta | Invito del partner assente: la UI chiama un endpoint inesistente | `trips/new/page.tsx:112` | T-2.5 |
| Q-02 | Alta | Creazione viaggio non atomica con service role; membership fallita = viaggio orfano invisibile | `api/trips/route.ts:44-71` | T-2.5 |
| Q-03 | Alta | Split spese: se manca il tasso, `amount_eur ?? amount` somma valute diverse come EUR; aritmetica in float | `expenses.ts:133,187`, `trips.ts:120` | T-3.2 |
| Q-04 | Media | 97 `any`, `createServerClient<any>`, cast `(supabase.from('x') as any)` ovunque: i tipi generati non sono usati | `src/lib/supabase/*`, route | T-3.3 |
| Q-05 | Media | 29 file fanno fetch in `useEffect` contro la regola di progetto; manca SWR/React Query | `components/*`, `(app)/layout.tsx` | T-3.5 |
| Q-06 | Media | 11 file oltre 300 righe (`types.ts` 844, `LegDrawer.tsx` 647, `BookingsTab.tsx` 592…) | vedi elenco in tasks | T-3.6 |
| Q-07 | Media | Due sistemi di quota AI, model id sparsi e disallineati (`claude-sonnet-4-5` contro `claude-sonnet-4-6` richiesto) | `lib/ai/*` | T-1.5 |
| Q-08 | Media | Pipeline media scritta ma non collegata: niente thumbnail 400×400 WebP all'upload | `lib/media/process.ts` | T-2.2 |
| Q-09 | Media | Instagram generator senza UI; job sincrono dentro la richiesta HTTP (timeout Vercel con 10 foto) | `api/instagram/generate` | T-2.7 |
| Q-10 | Media | Sentry mai inizializzato; nome variabile incoerente (`SENTRY_DSN` vs `NEXT_PUBLIC_SENTRY_DSN`) | `lib/monitoring.ts` | T-4.2 |
| Q-11 | Media | `vercel.json` riscrive `/sitemap.xml` su `/api/sitemap`, che non esiste | `vercel.json` | T-5.2 |
| Q-12 | Bassa | Escape HTML in scrittura (`sanitizePlainText`) → testo salvato con entità, doppio escape in UI e mobile | `lib/sanitize.ts` | T-1.6 |
| Q-13 | Bassa | Errori di Zod restituiti come JSON grezzo nel messaggio; `validateFile` → 500 invece di 400 | route, `storage.ts` | T-1.4 |
| Q-14 | Bassa | Header di sicurezza duplicati e divergenti tra `vercel.json` e `next.config.ts` | config | T-4.4 |
| Q-15 | Bassa | Artefatti nel repo: `chat.py`, `undefined/promptfooconfig.yaml`, `tmp/`, `tsconfig.tsbuildinfo`, `.replit`, `.expo/`, `supabase/.temp` | radice | T-0.3 |
| Q-16 | Bassa | Due config Tailwind (`.js` e `.ts`) e due config ESLint (`.eslintrc.json` e `eslint.config.mjs`) | radice | T-3.6 |
| Q-17 | Bassa | `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `README.md` descrivono cose non vere (magic link, Cloudinary, `ADMIN_CLEANUP_SECRET` come protezione sufficiente, "tutte le API validano con Zod") | `docs/` | T-0.8 |
| Q-18 | Bassa | Migration numerate 0001, 0002, poi 0007: i numeri mancanti rendono difficile capire la storia dello schema | `supabase/migrations` | — (documentare) |
| Q-19 | Alta | Upload fino a 50 MB via route API: su Vercel il corpo della richiesta è limitato a circa 4,5 MB, quindi foto HEIC grandi e video falliscono in produzione (in locale funziona) | `api/trips/[id]/media/route.ts`, `boarding-pass/route.ts` | T-2.2 |

---

## 4. Testabilità

### Stato
- 24 file di test, 181 test, tutti verdi. Buona base su `errors`, `url`, `require-admin`, `premium/access`, pagine principali.
- Coverage `src/lib` al **29,6%** righe contro il 70% richiesto; a zero: `authz.ts`, `reminders.ts`, `email.ts`, `weather.ts`, `monitoring.ts`, tutto `lib/ai/*`, `media/upload.ts`, `media/captions.ts`, i client Supabase.
- **Nessun test RLS**: i tre finding più gravi (S-02, S-03, S-04) sono tutti nel database e nessun test li avrebbe intercettati.
- Nessun test sulle route `trips/**` (le più numerose) né sul middleware di impersonazione.
- La CI carica su Codecov una coverage che non genera (`npm test` non passa `--coverage`), e non impone soglie.

### Ostacoli strutturali
| ID | Ostacolo | Rimedio | Task |
|---|---|---|---|
| T-A | Le funzioni di dominio creano da sole il client Supabase (`getTripExpenseSummary`, `storage.ts`), quindi vanno mockate a livello di modulo | Iniettare il client come parametro (pattern già usato da `authz.ts`) | T-3.4 |
| T-B | Logica pura mescolata a I/O (`convertCurrency` fa fetch, cache e calcolo) | Separare `computeRate()` puro da `fetchRates()` | T-3.2 |
| T-C | Route che ripetono auth/validazione/membership a mano | `withRoute()` testabile una volta sola | T-1.3 |
| T-D | Nessun ambiente DB per i test | Supabase locale in CI (`supabase start`) + test RLS con tre JWT | T-1.1 |
| T-E | `Date.now()`/`new Date()` sparsi (quote, scadenze, reminder) | Passare `now` come parametro nelle funzioni di dominio | T-3.4 |
| T-F | Lavoro pesante (sharp, ZIP) dentro la richiesta | Funzioni pure `buildSlides()` testabili senza rete, orchestrazione separata | T-2.7 |

### Obiettivi
- `src/lib` ≥ 70% (soglia bloccante in `vitest.config.ts`), con priorità: `expenses` → `authz` → `media` → `premium/access` → `ai/quota`.
- Suite RLS obbligatoria in CI per ogni tabella: anonimo, utente estraneo, partner, owner.
- Un test di contratto per ogni route `trips/**` generato dallo schema Zod (input valido, input non valido, non membro).
