# 02 — Threat Model

> motonui · baseline commit `483599c` (29/09/2026) · metodo STRIDE per componente, rischio = probabilità × impatto.
> Da rivedere a ogni fase di `docs/tasks.md` e ogni volta che si aggiunge un confine di fiducia (nuovo servizio esterno, nuovo client, nuovo bucket).

## 1. Ambito e metodo

**In ambito:** web app Next.js su Vercel, API `/api/**`, middleware, database e storage Supabase, app mobile Expo, integrazioni (Anthropic, Mapbox, exchangerate-api, Open-Meteo, Resend), pipeline GitHub Actions → Vercel/Supabase.
**Fuori ambito:** sicurezza interna di Supabase, Vercel e Anthropic; dispositivi degli utenti; social engineering sugli account personali.

**Scala del rischio.** Probabilità (P) e impatto (I) da 1 a 3; rischio = P × I.
**Alto** 6–9 · **Medio** 3–4 · **Basso** 1–2.
Stato: **Aperta** (nessun controllo efficace) · **Parziale** (controllo presente ma aggirabile o incompleto) · **Mitigata** (controllo efficace e verificabile).

## 2. Beni da proteggere

| ID | Bene | Perché conta | Dove vive |
|---|---|---|---|
| A-01 | Account e sessioni | Accesso a tutto il resto | Supabase Auth, cookie `sb-*`, SecureStore mobile |
| A-02 | Ruolo e piano (`profiles.role`, `plan`, `suspended_at`) | Decidono privilegi admin, accesso premium e blocco | `public.profiles` |
| A-03 | Dati del viaggio (itinerario, alloggi, prenotazioni, spese) | Rivelano dove sarà la coppia e quando: sono dati di sicurezza fisica, non solo privacy | tabelle `trips`, `days`, `legs`, `accommodations`, `expenses`… |
| A-04 | Documenti e carte d'imbarco | Nome, PNR, codici a barre: permettono di modificare o cancellare prenotazioni | bucket `trip-media` (oggi pubblico) |
| A-05 | Foto e video | Privacy, posizione GPS negli EXIF | bucket `trip-media` |
| A-06 | Email degli utenti | Phishing, enumerazione | `auth.users`, `admin_user_view` |
| A-07 | Segreti di servizio (service role, Anthropic, Resend, segreto impersonazione, `CRON_SECRET`) | Bypass totale o costi | Vercel env, GitHub secrets, **oggi anche nel repo** |
| A-08 | Budget AI e quote | Costo diretto | `usage_counters`, `ai_usage`, account Anthropic |
| A-09 | Integrità del blog pubblico | Reputazione, SEO, XSS verso i lettori | `posts` |
| A-10 | Pipeline di rilascio e schema DB | Chi controlla il deploy controlla l'app | GitHub Actions, `SUPABASE_DB_URL`, `VERCEL_TOKEN` |

## 3. Possibili attaccanti

| ID | Attaccante | Capacità | Motivazione |
|---|---|---|---|
| TA-1 | Anonimo su Internet | Conosce URL pubblici, anon key (pubblica per design), legge il repo pubblico | Dati, costi, defacement, phishing |
| TA-2 | Utente registrato estraneo | Sessione valida propria, chiamate REST dirette a Supabase con anon key + JWT | Accesso a dati altrui, privilegi, quote gratis |
| TA-3 | Partner (co-membro del viaggio) | Tutto ciò che fa TA-2 più l'appartenenza legittima al viaggio | Semi-fidato: la relazione può finire; va limitato a ciò che il ruolo prevede |
| TA-4 | Chi possiede un segreto trapelato | Segreti letti dal repo pubblico o da log | Uso della chiave Anthropic, token forgiati |
| TA-5 | Contenuto malevolo | File caricati, testo nei prompt, markup nel blog | SSRF, XSS, prompt injection, DoS di `sharp` |
| TA-6 | Admin compromesso o curioso | Ruolo admin legittimo | Accesso eccessivo ai dati degli utenti |
| TA-7 | Supply chain | Dipendenza npm o GitHub Action compromessa | Esfiltrazione di segreti in CI |

## 4. Confini di fiducia

| ID | Confine | Cosa lo attraversa | Controllo principale |
|---|---|---|---|
| TB-1 | Browser → Vercel (middleware, RSC, API) | Cookie di sessione, input form, upload | Middleware, `withErrorHandler`, Zod, `requireTripMember` |
| TB-2 | Browser/Mobile → Supabase REST e Auth | anon key + JWT utente | **Solo RLS** |
| TB-3 | API → Supabase come utente | JWT inoltrato dai cookie | RLS |
| TB-4 | API → Supabase come service role | Chiave service role | Codice della route (nessuna RLS) |
| TB-5 | API → servizi esterni | Prompt, URL, email, chiavi API | Chiavi solo server; allowlist (da fare) |
| TB-6 | Vercel Cron → API | Richiesta GET schedulata | `CRON_SECRET` (da implementare) |
| TB-7 | GitHub Actions → Vercel/Supabase prod | `VERCEL_TOKEN`, `SUPABASE_DB_URL` | Environment protetti, permessi del workflow |
| TB-8 | Internet → blog pubblico | Richieste anonime | RLS `posts_select_published`, colonne esplicite |

Il confine più importante è **TB-2**: esiste sia per scelta (app mobile) sia per costruzione (client component con `supabase-js`). Ogni permesso concesso dalla RLS è raggiungibile senza passare dalle API.

## 5. Minacce per componente

### 5.1 Autenticazione e middleware
| ID | STRIDE | Minaccia | Att. | P | I | Rischio | Stato | Controllo / SR |
|---|---|---|---|---|---|---|---|---|
| T-AUTH-01 | S | Open redirect su `auth/callback` e login usato per phishing | TA-1 | 3 | 2 | **6 Alto** | Aperta | SR-AUTH-03 |
| T-AUTH-02 | E | Utente sospeso si riattiva azzerando `suspended_at` via REST | TA-2 | 3 | 2 | **6 Alto** | Aperta | SR-AUTHZ-04, SR-AUTH-04 |
| T-AUTH-03 | S | Brute force / credential stuffing | TA-1 | 2 | 2 | 4 Medio | Parziale | Rate limit di Supabase Auth; SR-AUTH-07 |
| T-AUTH-04 | T | CSRF su route di scrittura | TA-1 | 1 | 2 | 2 Basso | Parziale | `SameSite=Lax`; SR-WEB-04 |
| T-AUTH-05 | D | Middleware fa query profilo a ogni richiesta (anche asset non esclusi) | TA-1 | 2 | 1 | 2 Basso | Aperta | cache breve del profilo |

### 5.2 Database e RLS
| ID | STRIDE | Minaccia | Att. | P | I | Rischio | Stato | Controllo / SR |
|---|---|---|---|---|---|---|---|---|
| T-DB-01 | E | Auto-promozione ad admin o premium (`profiles_update_own` senza `WITH CHECK`) | TA-2 | 3 | 3 | **9 Alto** | Aperta | SR-AUTHZ-04 |
| T-DB-02 | I | `admin_user_view` espone email di tutti gli utenti ad anon/authenticated | TA-1 | 3 | 3 | **9 Alto** | Aperta (da confermare su cloud) | SR-AUTHZ-05 |
| T-DB-03 | E | Partner si prende l'ownership del viaggio (`trips.owner_id`) e lo cancella | TA-3 | 2 | 2 | 4 Medio | Aperta | SR-AUTHZ-06 |
| T-DB-04 | T | Spostamento di record tra viaggi (`trip_id` aggiornabile) | TA-3 | 2 | 2 | 4 Medio | Aperta | SR-AUTHZ-06 |
| T-DB-05 | E | Search-path hijacking su funzioni `SECURITY DEFINER` senza `search_path` | TA-2 | 1 | 3 | 3 Medio | Parziale | SR-AUTHZ-07 |
| T-DB-06 | T | Più di due membri in un viaggio | TA-3 | 1 | 1 | 1 Basso | Aperta | SR-AUTHZ-09 |
| T-DB-07 | T | Avvelenamento di `weather_cache` (scrivibile da ogni autenticato) | TA-2 | 2 | 1 | 2 Basso | Aperta | policy solo service role |
| T-DB-08 | I | Nuova tabella senza RLS in una migration futura | — | 2 | 3 | **6 Alto** | Parziale | SR-AUTHZ-01, SR-SDLC-04 |

### 5.3 API (Server Bridge)
| ID | STRIDE | Minaccia | Att. | P | I | Rischio | Stato | Controllo / SR |
|---|---|---|---|---|---|---|---|---|
| T-API-01 | E | Route che usa il service role senza controllo di membership | TA-2 | 2 | 3 | **6 Alto** | Parziale | SR-AUTHZ-03; `api/trips` POST, `storage.ts` |
| T-API-02 | I | Stack trace o dettagli DB nelle risposte delle route non avvolte | TA-1 | 2 | 1 | 2 Basso | Parziale | SR-WEB-05 |
| T-API-03 | T | Input non validato (multipart, query) | TA-2 | 2 | 2 | 4 Medio | Parziale | SR-INPUT-01 |
| T-API-04 | D | Upload e export pesanti senza rate limit | TA-2 | 2 | 2 | 4 Medio | Aperta | SR-WEB-06 |
| T-API-05 | R | Azioni utente non tracciate (solo admin in audit log) | TA-3 | 1 | 1 | 1 Basso | Aperta | accettato per ora |

### 5.4 Storage e media
| ID | STRIDE | Minaccia | Att. | P | I | Rischio | Stato | Controllo / SR |
|---|---|---|---|---|---|---|---|---|
| T-STO-01 | I | Foto, carte d'imbarco e documenti leggibili da chiunque abbia l'URL; path prevedibili per le carte d'imbarco | TA-1 | 3 | 3 | **9 Alto** | Aperta | SR-PRIV-02, SR-CRYPTO-05 |
| T-STO-02 | T | Membro riscrive `media.url` e fa cancellare al server file di altri viaggi | TA-2/3 | 2 | 3 | **6 Alto** | Aperta | SR-AUTHZ-06 |
| T-STO-03 | I | Posizione GPS negli EXIF delle foto | TA-1 | 3 | 2 | **6 Alto** | Aperta | SR-PRIV-01 |
| T-STO-04 | T | SSRF: il server scarica `media.url` arbitrario durante l'export | TA-2 | 2 | 2 | 4 Medio | Aperta | SR-INPUT-07 |
| T-STO-05 | D | Immagini "pixel flood" o decompression bomb su `sharp` | TA-5 | 1 | 2 | 2 Basso | Parziale | limite 50 MB; aggiungere `limitInputPixels` |
| T-STO-06 | T | File con MIME falsificato | TA-5 | 1 | 2 | 2 Basso | Mitigata | SR-INPUT-02 (magic bytes) |
| T-STO-07 | I | ZIP Instagram e carte d'imbarco rimossi mai cancellati | TA-1 | 2 | 2 | 4 Medio | Aperta | SR-PRIV-03, SR-PRIV-06 |

### 5.5 AI
| ID | STRIDE | Minaccia | Att. | P | I | Rischio | Stato | Controllo / SR |
|---|---|---|---|---|---|---|---|---|
| T-AI-01 | D | Azzeramento della quota `ai_usage` via REST, costi illimitati | TA-2 | 3 | 2 | **6 Alto** | Aperta | SR-INT-02, SR-INT-03 |
| T-AI-02 | D | Race sulle quote con richieste parallele | TA-2 | 2 | 1 | 2 Basso | Aperta | RPC atomica |
| T-AI-03 | T | Prompt injection tramite testi del viaggio o di pagine esterne | TA-5 | 2 | 1 | 2 Basso | Mitigato | SR-INPUT-06 (T-5.3) |
| T-AI-04 | I | Chiave Anthropic esposta | TA-4 | 3 | 2 | **6 Alto** | Aperta | SR-DEV-01, SR-INT-01 |

### 5.6 Admin e impersonazione
| ID | STRIDE | Minaccia | Att. | P | I | Rischio | Stato | Controllo / SR |
|---|---|---|---|---|---|---|---|---|
| T-ADM-01 | E | Accesso admin ottenuto tramite T-DB-01 | TA-2 | 3 | 3 | **9 Alto** | Aperta | SR-AUTHZ-04 |
| T-ADM-02 | S | Token di impersonazione forgiato con il segreto pubblico | TA-4 | 3 | 1 | 3 Medio | Aperta | SR-DEV-01; impatto basso finché il token non cambia identità |
| T-ADM-03 | R | Token revocato ancora valido fino alla scadenza | TA-6 | 1 | 2 | 2 Basso | Aperta | SR-CRYPTO-04 |
| T-ADM-04 | E | `ADMIN_AUTH_BYPASS=true` impostato per errore in produzione | — | 1 | 3 | 3 Medio | Parziale | SR-DEV-03 |
| T-ADM-05 | R | Azioni admin sensibili | TA-6 | 1 | 2 | 2 Basso | Mitigata | SR-OPS-02 (audit log) |

### 5.7 Cron ed email
| ID | STRIDE | Minaccia | Att. | P | I | Rischio | Stato | Controllo / SR |
|---|---|---|---|---|---|---|---|---|
| T-CRN-01 | D | Retention e promemoria mai eseguiti (dati trattenuti oltre il previsto) | — | 3 | 1 | 3 Medio | Aperta | SR-INT-06 |
| T-CRN-02 | S | Confronto del segreto non a tempo costante | TA-1 | 1 | 1 | 1 Basso | Aperta | SR-INT-06 |
| T-EML-01 | T | HTML/link iniettati nelle email di promemoria dal partner | TA-3 | 2 | 1 | 2 Basso | Aperta | SR-INT-07 |

### 5.8 Blog pubblico
| ID | STRIDE | Minaccia | Att. | P | I | Rischio | Stato | Controllo / SR |
|---|---|---|---|---|---|---|---|---|
| T-BLG-01 | T | XSS persistente tramite `content_json` scritto via REST | TA-2 | 1 | 3 | 3 Medio | Parziale | SR-INPUT-04, SR-INPUT-05 |
| T-BLG-02 | I | Post pubblicato espone dati privati del viaggio | TA-1 | 1 | 2 | 2 Basso | Mitigata | SR-PRIV-07 |
| T-BLG-03 | D | Scraping/DoS di `/api/posts/[slug]` | TA-1 | 2 | 1 | 2 Basso | Parziale | ISR `revalidate=3600`; SR-WEB-06 |

### 5.9 Mobile
| ID | STRIDE | Minaccia | Att. | P | I | Rischio | Stato | Controllo / SR |
|---|---|---|---|---|---|---|---|---|
| T-MOB-01 | I | Token di sessione su dispositivo | TA-1 | 1 | 2 | 2 Basso | Mitigata | SecureStore su iOS/Android |
| T-MOB-02 | I | Token in `localStorage` nella build web di Expo | TA-5 | 1 | 2 | 2 Basso | Parziale | Accettabile se la build web non viene distribuita |
| T-MOB-03 | E | Il mobile eredita ogni debolezza RLS (nessun livello API intermedio) | TA-2 | 3 | 3 | **9 Alto** | Aperta | vedi §5.2 |

### 5.10 CI/CD e supply chain
| ID | STRIDE | Minaccia | Att. | P | I | Rischio | Stato | Controllo / SR |
|---|---|---|---|---|---|---|---|---|
| T-CI-01 | I | Segreti nel repo pubblico | TA-1/4 | 3 | 3 | **9 Alto** | Aperta | SR-DEV-01, SR-SDLC-05 |
| T-CI-02 | T | Deploy in produzione senza CI verde; codice prima delle migration | — | 2 | 2 | 4 Medio | Aperta | SR-OPS-03 |
| T-CI-03 | T | Action di terze parti non fissata per SHA riceve `VERCEL_TOKEN` | TA-7 | 1 | 3 | 3 Medio | Aperta | SR-SDLC-07 |
| T-CI-04 | T | Dipendenza vulnerabile | TA-7 | 2 | 2 | 4 Medio | Parziale | Dependabot; SR-SDLC-06 |

## 6. I sei rischi aperti principali

| # | Rischio | Minacce | Rischio | Perché è in cima | Task |
|---|---|---|---|---|---|
| 1 | **Segreti pubblici nel repository** | T-CI-01, T-AI-04, T-ADM-02 | 9 | Sfruttabile da chiunque, senza account, già oggi | T-0.1–T-0.3 |
| 2 | **Auto-promozione ad admin/premium e auto-riattivazione** | T-DB-01, T-ADM-01, T-AUTH-02 | 9 | Una sola richiesta REST con un account gratuito; apre l'intero pannello admin | T-0.4 |
| 3 | **Email di tutti gli utenti tramite `admin_user_view`** | T-DB-02 | 9 | Accessibile con la sola anon key, se i grant di default sono attivi | T-0.5 |
| 4 | **Media e documenti pubblici, con GPS negli EXIF** | T-STO-01, T-STO-03, T-STO-07 | 9 | Carte d'imbarco con PNR a path prevedibili; posizione della coppia nelle foto | T-0.9, T-2.1–T-2.3 |
| 5 | **Colonne strutturali modificabili → cancellazione di file altrui e SSRF** | T-STO-02, T-STO-04, T-DB-03, T-DB-04 | 6 | Combina una RLS permissiva con un'operazione del service role | T-0.6, T-2.4 |
| 6 | **Quota AI azzerabile dall'utente** | T-AI-01, T-AI-02 | 6 | Costo economico diretto e non limitato | T-1.5 |

Subito sotto la soglia: open redirect (T-AUTH-01, rischio 6, correzione di mezz'ora con T-0.7) e assenza di test RLS (T-DB-08), che è la causa comune di tre dei sei rischi.

## 7. Minacce previste per le fasi successive

| Fase | Novità | Minacce da gestire in progettazione | Controlli previsti |
|---|---|---|---|
| 2 — Invito partner | Token di invito, email, RPC `accept_trip_invite` | Token indovinabili o riusabili; invito accettato da un account diverso dal destinatario; superamento del limite di due membri con accettazioni concorrenti; enumerazione email ("utente già registrato") | Token 256 bit salvato come hash, monouso, scadenza 7 gg; controllo email del destinatario; `SELECT … FOR UPDATE` sul viaggio; risposta identica per email esistenti e non |
| 2 — Storage privato | Bucket privati, URL firmati | URL firmati troppo longevi condivisi per errore; policy `storage.objects` basate su path manipolabili | TTL 1 h (24 h solo per ZIP); path costruiti dal server; test storage nella suite RLS |
| 2 — Pipeline media ed export asincrono | `sharp`, ZIP, job in background | Decompression bomb; esaurimento di memoria/tempo delle funzioni; ZIP con path traversal nei nomi dei file | `limitInputPixels`, limite di 10 slide, nomi file generati; job idempotenti con stato |
| 2 — Cron | `CRON_SECRET` | Esecuzione ripetuta di invii email; segreto nei log | Idempotenza con `sent_at`; mai loggare header |
| 3 — SWR e fetch client | Più chiamate dal browser | Dati di altri viaggi in cache condivisa del client dopo logout | Chiavi SWR per utente, `mutate` globale al logout |
| 4 — Rate limiting e osservabilità | Contatori, Sentry | Dati personali nei breadcrumb; DoS sul contatore stesso | `beforeSend` con scrubbing; contatori con TTL |
| 5 — SEO e OG image | Generazione immagini per post | SSRF o XSS tramite titolo e cover nell'immagine OG | Solo dati del post pubblicato; cover dal bucket pubblico dedicato |
| Futuro — Realtime | Canali Supabase Realtime | Sottoscrizione a canali di viaggi altrui | RLS su `realtime.messages`, canali per `trip_id` |
| Futuro — Pagamenti premium | Webhook di pagamento | Webhook falsificati che attivano il premium | Verifica della firma, idempotenza, aggiornamento del piano solo lato server |
