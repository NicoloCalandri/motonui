# 04 — Security Checklist

> motonui · da usare a ogni pull request e prima di ogni rilascio. I codici `SR-…` rimandano a `01-SECURITY-REQUIREMENTS.md`, i `T-…` a `docs/tasks.md`.

## Legenda

| Tipo | Significato |
|---|---|
| 🤖 **Auto** | Eseguito dalla CI; la PR non si può unire se fallisce |
| 🤖⏳ **Auto (previsto)** | Diventerà automatico con il task indicato; fino ad allora si verifica a mano |
| 👤 **Manuale** | Verificato dal revisore o da chi rilascia |
| ⛔ **Bloccante** | Se non è soddisfatto il rilascio non parte, senza eccezioni |

Oggi sono automatici solo type-check, lint (senza soglia sui warning), test e build. Il resto della colonna "Auto (previsto)" dipende dalle fasi 0, 1, 3 e 4 del piano.

---

## A. A ogni pull request

### A.1 Controlli automatici

| # | Controllo | Tipo | Comando / job | SR | Stato oggi |
|---|---|---|---|---|---|
| A1 | Type-check senza errori | 🤖 ⛔ | `npm run type-check` | SDLC-01 | ✅ attivo |
| A2 | Lint senza errori | 🤖 ⛔ | `npm run lint` | SDLC-01 | ✅ attivo |
| A3 | Lint senza warning | 🤖⏳ ⛔ | `eslint . --max-warnings=0` (T-3.7) | SDLC-02 | 🔴 306 warning |
| A4 | Test unitari verdi | 🤖 ⛔ | `npm test` | SDLC-01 | ✅ attivo |
| A5 | Coverage `src/lib/**` ≥ 70% | 🤖⏳ ⛔ | `npm run test:coverage` con soglia (T-3.1) | SDLC-03 | 🔴 29,6% |
| A6 | Build di produzione | 🤖 ⛔ | `npm run build` | SDLC-01 | ✅ attivo |
| A7 | Nessun segreto nei file modificati | 🤖⏳ ⛔ | gitleaks in pre-commit e CI (T-0.3) | SDLC-05, DEV-01 | 🔴 assente |
| A8 | Test RLS verdi (anonimo, estraneo, partner, owner) | 🤖⏳ ⛔ | job `rls-tests` con `supabase start` (T-1.1) | SDLC-04 | 🔴 assente |
| A9 | Ogni tabella ha RLS e ogni policy UPDATE/INSERT ha `WITH CHECK` | 🤖⏳ ⛔ | test di meta-controllo su `pg_policies` (T-1.1) | AUTHZ-01, AUTHZ-06 | 🔴 assente |
| A10 | Nessuna vulnerabilità alta o critica nelle dipendenze | 🤖⏳ ⛔ | `npm audit --audit-level=high` (T-4.7) | SDLC-06 | 🟡 solo Dependabot |
| A11 | Linter DB di Supabase senza errori | 🤖⏳ | `supabase db lint` | AUTHZ-07 | 🔴 assente |

### A.2 Revisione manuale: si applica solo se la PR tocca l'area

**Database e migration** (`supabase/migrations/**`)

- [ ] 👤 ⛔ Ogni nuova tabella ha `enable row level security` e policy per ogni operazione necessaria (SR-AUTHZ-01).
- [ ] 👤 ⛔ Ogni policy `UPDATE` ha `WITH CHECK`; nessuna policy permissiva ne allarga un'altra sulla stessa operazione (SR-AUTHZ-04, SR-AUTHZ-06).
- [ ] 👤 ⛔ Le colonne strutturali (`id`, `trip_id`, `owner_id`, `uploaded_by`, `author_id`, path di storage) sono protette dal trigger di immutabilità (SR-AUTHZ-06).
- [ ] 👤 ⛔ Le funzioni `SECURITY DEFINER` hanno `set search_path` e controllano `auth.uid()` all'interno (SR-AUTHZ-07).
- [ ] 👤 ⛔ Nessuna vista nello schema `public` legge `auth.users` o tabelle private senza `security_invoker = true` o `REVOKE` esplicito (SR-AUTHZ-05).
- [ ] 👤 La migration è retrocompatibile con il codice attualmente in produzione, perché viene applicata prima del deploy (SR-OPS-03).
- [ ] 👤 Sono stati aggiunti i test RLS per la nuova tabella o policy.

**Route API** (`src/app/api/**`)

- [ ] 👤 ⛔ Usa `withRoute` (o, finché non esiste, `withErrorHandler` + `getAuthUser`) (SR-WEB-05).
- [ ] 👤 ⛔ Tutti gli input (params, query, body, `multipart`) passano da uno schema Zod (SR-INPUT-01).
- [ ] 👤 ⛔ Le route sotto `/api/trips/[id]/**` chiamano `requireTripMember` (SR-AUTHZ-03).
- [ ] 👤 ⛔ Se usa il service role, rispetta le quattro condizioni di `03-SECURITY-ARCHITECTURE.md` §3.3.
- [ ] 👤 Le route pubbliche sono dichiarate come tali nel middleware e selezionano colonne esplicite.
- [ ] 👤 I `fetch` lato server passano da `safe-fetch` con allowlist e timeout (SR-INPUT-07).
- [ ] 👤 Gli errori verso il client sono in italiano, senza dettagli interni; i log non contengono dati personali (SR-PRIV-05).

**Storage e media**

- [ ] 👤 ⛔ I file privati vanno in bucket privati e si servono solo con URL firmati (SR-PRIV-02, SR-CRYPTO-05).
- [ ] 👤 ⛔ I path di storage sono costruiti dal server a partire da `trip_id` e dall'id del record, mai letti da colonne scrivibili dal client.
- [ ] 👤 Le immagini passano dalla pipeline (strip EXIF, thumbnail) prima di essere visibili (SR-PRIV-01).
- [ ] 👤 La cancellazione del record elimina anche il file (SR-PRIV-03).
- [ ] 👤 Gli upload grandi vanno direttamente allo storage con URL firmato di upload, non attraverso la route (limite ~4,5 MB di Vercel).

**AI**

- [ ] 👤 ⛔ Ogni chiamata ad Anthropic passa dalla quota unica atomica (SR-INT-02, SR-INT-03).
- [ ] 👤 Il model id viene da `lib/ai/models.ts`.
- [ ] 👤 I dati dell'utente nel prompt sono delimitati come non fidati (SR-INPUT-06).
- [ ] 👤 Il testo lungo è in streaming.

**Frontend**

- [ ] 👤 ⛔ Nessun nuovo `dangerouslySetInnerHTML` su contenuto non sanificato in rendering (SR-INPUT-05).
- [ ] 👤 ⛔ Nessun segreto in variabili `NEXT_PUBLIC_*` o `EXPO_PUBLIC_*`.
- [ ] 👤 I redirect usano `safeRedirectPath()` (SR-AUTH-03).
- [ ] 👤 Le modifiche alla CSP non aggiungono `unsafe-eval` né domini senza motivo (SR-WEB-02).

**Auth, admin e configurazione**

- [ ] 👤 ⛔ Nessun nuovo bypass di autenticazione; quelli esistenti restano opt-in e bloccati in produzione (SR-DEV-03).
- [ ] 👤 Le azioni admin nuove scrivono in `admin_audit_log` (SR-OPS-02).
- [ ] 👤 Le nuove variabili d'ambiente sono documentate in `.env.example` con valori segnaposto.

**CI/CD**

- [ ] 👤 ⛔ Le azioni sono fissate per SHA e il workflow dichiara `permissions` minimi (SR-SDLC-07).
- [ ] 👤 I segreti sono usati solo nei job e negli environment che ne hanno bisogno.

---

## B. Prima di ogni rilascio in produzione

Tutti i punti sono ⛔ **bloccanti** salvo indicazione. Chi rilascia registra l'esito nel registro (sezione D).

| # | Controllo | Tipo | Come si verifica | SR |
|---|---|---|---|---|
| B1 | Tutti i controlli A.1 verdi sul commit da rilasciare | 🤖 ⛔ | Stato della CI su `main` | SDLC-01 |
| B2 | Nessun requisito P0 aperto; P1 aperti solo con eccezione firmata nel registro | 👤 ⛔ | `01-SECURITY-REQUIREMENTS.md` | — |
| B3 | Nessun file `.env` con valori nel repo | 🤖⏳ ⛔ | `git ls-files | grep -E '(^|/)\.env'` → solo `.env.example` | DEV-01 |
| B4 | Segreti ruotati se esposti dopo l'ultimo rilascio | 👤 ⛔ | Runbook di rotazione | OPS-05 |
| B5 | Variabili Vercel separate per Production e Preview; `ADMIN_AUTH_BYPASS` assente | 👤 ⛔ | Dashboard Vercel | DEV-03 |
| B6 | Migration applicate su staging e test RLS verdi contro lo stesso schema | 🤖⏳ ⛔ | Job di staging | SDLC-04 |
| B7 | Supabase Security Advisor senza errori | 👤 ⛔ | Dashboard Supabase → Advisors | AUTHZ-05, AUTHZ-07 |
| B8 | Prova REST manuale con account di test: non si può cambiare `role`/`plan`/`suspended_at`; `admin_user_view` non leggibile con anon key | 👤 ⛔ | `curl` con anon key e JWT di test, esito nel registro | AUTHZ-04, AUTHZ-05 |
| B9 | Bucket: solo `avatars` (ed eventuali copertine pubbliche) pubblici | 👤 ⛔ | Dashboard Storage | PRIV-02 |
| B10 | Auth: conferma email, password minima 10, leaked password protection | 👤 ⛔ | Dashboard Supabase → Auth | AUTH-06, AUTH-07 |
| B11 | Cron eseguiti con successo nelle ultime 24 h su Preview o Production | 👤 ⛔ | Log Vercel | INT-06 |
| B12 | Sentry riceve un errore di prova senza dati personali | 👤 ⛔ | Evento di prova | OPS-01 |
| B13 | Header di sicurezza corretti in produzione | 👤 | securityheaders.com o `curl -I` | WEB-01, WEB-02 |
| B14 | Token Mapbox ristretto al dominio di produzione | 👤 | Dashboard Mapbox | INT-04 |
| B15 | Backup/PITR attivo; ultimo restore di prova < 90 giorni | 👤 | Dashboard Supabase | OPS-04 |
| B16 | Branch protection su `main` con check obbligatori | 👤 ⛔ | Impostazioni GitHub | SDLC-07 |
| B17 | Smoke test post-deploy: login, creazione viaggio, invito, upload foto, pubblicazione post, blog anonimo | 👤 ⛔ | Account di test | — |

### Rilascio d'urgenza (hotfix di sicurezza)

Si possono saltare B13–B15. B1, B2 (limitatamente al problema corretto), B3, B6, B8 e B17 restano obbligatori. Entro 48 ore si completa la checklist intera e si registra l'hotfix.

---

## C. Verifiche periodiche

| Frequenza | Controllo | SR |
|---|---|---|
| Settimanale | Revisione PR di Dependabot | SDLC-06 |
| Mensile | Lettura di `admin_audit_log` e accessi admin | OPS-02 |
| Mensile | Costi Anthropic confrontati con le quote registrate | INT-02 |
| Trimestrale | Revisione di `02-THREAT-MODEL.md` e aggiornamento degli stati in `01-SECURITY-REQUIREMENTS.md` | — |
| Trimestrale | Restore di prova del database | OPS-04 |
| Annuale, o subito dopo un'esposizione | Rotazione di tutti i segreti | OPS-05 |

---

## D. Registro delle verifiche

Una riga per ogni verifica: revisione di PR significative, rilascio, verifica periodica, incidente. Non si cancellano righe; le correzioni si aggiungono come nuove righe.

| Data | Commit / versione | Tipo | Eseguita da | Ambito | Esito | Riferimenti |
|---|---|---|---|---|---|---|
| 2026-09-29 | `483599c` | Baseline: revisione statica del codice | Claude (su richiesta di Nicolò) | Intero repo, migration 0001–0015, CI | 🔴 **Non rilasciabile.** `tsc` 0 errori; lint 0 errori e 306 warning; 181/181 test verdi; coverage `src/lib` 29,6%. Requisiti: 17 fatti, 18 parziali, 31 da fare; 5 P0 aperti (SR-DEV-01, SR-AUTHZ-04, SR-AUTHZ-05, SR-AUTHZ-06, SR-PRIV-02). Nessuna verifica eseguita sul progetto cloud. | `REVIEW.md`, `01-SECURITY-REQUIREMENTS.md` |
| 2026-09-29 | branch `claude/eloquent-lovelace-dwicxb` | Fase 0 (T-0.2–T-0.8): verifica locale | Claude (su richiesta di Nicolò) | Migration `0016`, redirect, gitleaks, `.gitignore`, documentazione | 🟡 Migration 0001–0016 applicate su Postgres 16 con stub di Supabase: `supabase/tests/0016_phase0_rls.test.sql` verde (21 controlli) e rosso sullo schema precedente (S-02 riprodotto). 200/200 test Vitest dell'app verdi, lint 0 errori. Restano: rimozione di `.env.local`/`mobile/.env` e artefatti, rotazione segreti, T-0.9, verifica sul cloud. | T-0.4–T-0.7 |
| 2026-09-29 | branch `claude/t-0.9-private-documents` | T-0.9: verifica locale | Claude (su richiesta di Nicolò) | Bucket privato `trip-documents`, route boarding pass, script di migrazione | 🟡 Migration 0001–0017 applicate su Postgres 16 con stub di Supabase (anche riapplicando 0017): `0016_phase0_rls.test.sql` e `0017_trip_documents.test.sql` verdi. 232/232 test Vitest; il test della route fallisce se si rimuove il controllo sul prefisso del path. Script di migrazione non eseguito: nessun accesso allo storage cloud. | T-0.9 |
| | | Esecuzione `npm run storage:migrate-boarding-passes -- --apply` in produzione, poi verifica che nessun `trips/*/boarding-passes/*` risponda su `/object/public/trip-media/` | | | | T-0.9 |
| | | Rotazione segreti esposti | | | | T-0.1 |
| | | Verifica REST su cloud (B8) | | | | T-0.4, T-0.5 |

### Eccezioni accettate

Un requisito P1 può restare aperto al rilascio solo se registrato qui, con scadenza e motivazione.

| Data | Requisito | Motivazione | Mitigazione temporanea | Scadenza | Approvato da |
|---|---|---|---|---|---|
| | | | | | |
