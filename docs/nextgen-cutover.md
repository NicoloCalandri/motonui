# Passaggio in produzione di nextgen

Come portare la produzione di motonui da Next.js (`src/`, su Vercel) a `nextgen/` (Vite + Hono). Lo stato del codice è in `docs/superpowers/plans/2026-10-10-nextgen-realignment-roadmap.md`; le decisioni in `docs/architecture.md` (ADR-09).

Nulla di quanto segue è stato eseguito: sono operazioni su servizi esterni (hosting, DNS, Supabase, Google) che richiedono le credenziali del proprietario. Il repository è pronto fino al punto 1.

## 0. Cosa è già verificato nel repository

- `npm test` in `nextgen/`: suite dell'API e dell'app web verdi.
- `npm run build && npm run smoke`: il build si avvia sotto Node e risponde (salute, shell dell'app, 404 dell'API, 401 senza sessione, rifiuto delle scritture da altri siti).
- `docker build nextgen/` e avvio del container: verificati in locale con variabili fittizie.
- Il job `nextgen` della CI ripete tutto questo a ogni PR, compreso `docker build` dell'immagine (senza avviarla).

Non è verificato, perché richiede un progetto Supabase reale e un browser: accesso con Google, reset della password, invito del partner via email, caricamento di una foto, export Instagram, lettura di un documento con il cookie di sessione.

## 1. Prima di toccare la produzione

1. **Unire il ramo.** `worktree-nextgen-migration` è solo in locale: aprire una PR verso `main`. Non cambia l'app in produzione (tocca `nextgen/`, `docs/` e aggiunge un job alla CI).
2. **Correggere in `src/` i difetti ereditati** elencati nella roadmap (salvataggio automatico dell'editor, date, campi vuoti, pulsanti senza nome) e rieseguire `npm run port:lib` in `nextgen/`.
3. **Scegliere l'hosting.** Serve un servizio che tenga acceso un processo Node (container): Fly.io, Railway, Render, Cloud Run con istanza minima 1, un VPS. **Non** funzioni serverless: l'export Instagram e i cron girano nel processo dopo la risposta.
4. **Ambiente di prova.** Avviare l'immagine su un dominio di prova contro il progetto Supabase di produzione, o una sua copia, con:
   - le variabili di `nextgen/apps/api/.env.example` (stessi valori di Vercel dove il nome coincide; `SUPABASE_URL` e `SUPABASE_ANON_KEY` prendono i valori di `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`). **Non impostare `WEB_DIST`**: la fornisce l'immagine. Una riga `WEB_DIST=` vuota nel file passato a `--env-file` la sovrascrive e il sito resta senza pagine, con l'health check verde (in produzione l'avvio lo segnala con un avviso `[motonui][api][startup]`);
   - `WEB_ORIGIN` e `NEXT_PUBLIC_APP_URL` uguali all'indirizzo pubblico;
   - `ENABLE_CRON=false` finché Vercel è ancora in funzione, per non inviare due volte i promemoria;
   - gli argomenti di build `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MAPBOX_TOKEN`.
5. **Supabase Auth → URL Configuration.** Aggiungere ai *Redirect URLs* l'indirizzo di prova con `/**` (servono `/dashboard`, `/auth/reset-password`, `/invite/*`). Senza, Google e il reset della password tornano al *Site URL* e falliscono. Replicare in `supabase/config.toml` (`additional_redirect_urls`) e nella tabella di parità di `docs/security/05-OPS-RUNBOOK.md`.
6. **Prova manuale**, con due account:
   - registrazione, accesso con password e con Google, reset della password;
   - nuovo viaggio, invito del partner, accettazione dall'altro account;
   - giorni, spostamenti (con carta d'imbarco), alloggi, ristoranti, attività;
   - spese in EUR e in un'altra valuta, saldo tra i due;
   - caricamento di foto e di un documento, apertura del documento;
   - export Instagram fino al download dello ZIP;
   - post del blog: bozza, salvataggio automatico, pubblicazione, pagina pubblica senza sessione;
   - profilo, avatar; area admin, sospensione e impersonazione;
   - eliminazione di un account di prova.

## 2. Il passaggio

1. Abbassare il TTL del record DNS il giorno prima.
2. Puntare il dominio al nuovo servizio. Aggiornare in Supabase il *Site URL* se cambia, e in Google Cloud le origini autorizzate del client OAuth.
3. Sul nuovo servizio: `ENABLE_CRON=true` su **una sola** istanza. Su Vercel: togliere i due cron da `vercel.json`, oppure mettere in pausa il progetto.
4. Controllare `GET /api/health`, un accesso, un caricamento, e la presenza di eventi su Sentry (`GET /api/admin/sentry-test` da admin).

**Per tornare indietro:** ripuntare il DNS a Vercel e riattivare i cron lì. Il database è lo stesso e nessuna migration è legata a `nextgen`, quindi non c'è nulla da ripristinare.

## 3. Dopo, non prima

Solo quando la produzione gira su `nextgen` da almeno una o due settimane senza incidenti:

- rimuovere `src/`, la configurazione Next.js e i workflow di deploy su Vercel;
- spostare in `nextgen/` i file che oggi vengono copiati da `src/` (smettono di essere copie: `scripts/port-lib.mjs` e i test di parità si eliminano);
- riscrivere `CLAUDE.md` e `docs/security/` per Hono (il middleware, `withRoute`, il nonce della CSP e `after()` non esistono più);
- aggiornare ADR-09 a "accettato" e ADR-05 a "sostituito".

## 4. L'app mobile

`mobile/` parla direttamente con Supabase e non usa l'API: il passaggio non la tocca. I link nelle email di invito portano al sito web, come oggi.

## 5. Cosa si perde o cambia

- **SEO del blog pubblico.** Le pagine sono generate nel browser: titolo e descrizione non sono nella prima risposta, e non ci sono più `sitemap.xml`, `robots.txt` né le immagini Open Graph generate. Per riaverli serve un pre-rendering delle due pagine del blog, non ancora fatto.
- **Dimensione del JavaScript.** L'app è un solo file da circa 1,9 MB (540 kB compressi): va spezzato per pagina con `React.lazy`.
- **Lint.** `nextgen/` non ha una configurazione ESLint: `npm run lint` lì fallisce e la CI non lo esegue.
