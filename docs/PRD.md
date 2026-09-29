# PRD.md — motonui

> Versione 1.0 · 29/09/2026 · Owner: Nicolò, Giorgia · Stato del codice: commit `483599c`

---

## 1. Problema

Una coppia che viaggia usa oggi quattro o cinque strumenti separati: un foglio o un'app per l'itinerario, Splitwise per le spese, il rullino del telefono per le foto, Instagram per condividere e, a volte, un blog. Le informazioni non si parlano: le spese non sanno in che giorno sei, le foto non sanno in che tappa, il post del blog va riscritto da zero. motonui mette tutto nello stesso viaggio condiviso, pensato per **due persone**, e riusa i dati del viaggio per produrre contenuti (post, caption, carousel).

## 2. Utenti

| Persona | Bisogni principali |
|---|---|
| **Nicolò** — pianifica, gestisce voli e logistica, sviluppa l'app | Itinerario dettagliato con voli e carte d'imbarco; saldo spese chiaro; controllo tecnico e admin |
| **Giorgia** — co-fondatrice, racconta il viaggio | Foto organizzate per giorno; scrivere e pubblicare post con aiuto AI; export pronto per Instagram |
| **Lettore del blog** — anonimo | Leggere i post pubblicati, velocemente e senza login |
| **Admin** (oggi Nicolò) | Gestire utenti, sospensioni, piano premium, controllare costi AI |

> Nota: `CLAUDE.md` nomina "Sara" come co-fondatrice. Il nome corretto è **Giorgia**; va aggiornato in `CLAUDE.md`, nei seed e nei testi (task T-0.8).

## 3. Obiettivi

| ID | Obiettivo | Metrica di successo |
|---|---|---|
| G-1 | Un viaggio condiviso da due persone, dalla pianificazione al ricordo | Entrambi i membri attivi sullo stesso viaggio (≥ 1 modifica ciascuno) |
| G-2 | Sapere in ogni momento chi deve quanto a chi | Saldo calcolato in EUR con tassi reali; differenza con calcolo manuale < 0,01 € |
| G-3 | Dal viaggio al contenuto in pochi minuti | Post pubblicato o ZIP Instagram generato in < 5 minuti dal primo clic |
| G-4 | Dati privati davvero privati | Zero risorse private raggiungibili senza autorizzazione (test RLS e storage verdi) |
| G-5 | Costi AI sotto controllo | ≤ 20 chiamate/giorno per utente free; costo mensile entro il budget definito in admin |

### Non obiettivi (per questa release)
- Viaggi di gruppo oltre due persone.
- Pubblicazione diretta su Instagram tramite API (si produce uno ZIP da caricare a mano).
- Prenotazione di voli o alloggi.
- Modifica collaborativa in tempo reale (Realtime).
- Monetizzazione: il piano premium esiste nel codice, ma pagamenti e checkout sono fuori scope.

## 4. Requisiti funzionali e stato attuale

Legenda: ✅ presente e funzionante · 🟡 presente con lacune · 🔴 assente o non funzionante.

### 4.1 Account e coppia
| ID | Requisito | Stato | Note |
|---|---|---|---|
| FR-01 | Registrazione e login con email+password e Google | ✅ | Magic link non presente (ADR-06) |
| FR-02 | **Invitare il partner** in un viaggio via email o link, accettazione con il proprio account, massimo due membri | ✅ | `POST /api/trips/[id]/invites`, pagina `/invite/[token]`, RPC della migration `0021` (T-2.5) |
| FR-03 | Profilo con nome e avatar | ✅ | |
| FR-04 | Cancellazione account self-service | 🟡 | Non cancella i file dei viaggi |
| FR-05 | Recupero password | ✅ | `auth/forgot-password`, `reset-password` |

### 4.2 Itinerario
| ID | Requisito | Stato | Note |
|---|---|---|---|
| FR-10 | Creare, modificare, archiviare un viaggio | ✅ | Creazione non atomica (ADR-02) |
| FR-11 | Giorni, tratte (volo, treno, auto…), alloggi | ✅ | |
| FR-12 | Ristoranti e attività prenotati | ✅ | |
| FR-13 | Carta d'imbarco allegata alla tratta | 🟡 | Pubblica e non cancellata dallo storage |
| FR-14 | Documenti di viaggio | 🟡 | Stesso problema di privacy |
| FR-15 | Mappa del viaggio e calendario | ✅ | |
| FR-16 | Checklist bagagli e meteo | ✅ | |
| FR-17 | Promemoria email (check-in, scadenze pagamento, prenotazioni) | 🔴 | Logica presente, cron non funzionante |

### 4.3 Spese
| ID | Requisito | Stato | Note |
|---|---|---|---|
| FR-20 | Registrare una spesa con valuta, categoria, pagatore, giorno | ✅ | |
| FR-21 | Conversione in EUR con tasso del giorno (cache 24h) e fallback esplicito | 🟡 | Il fallback tratta la valuta estera come EUR |
| FR-22 | Saldo "chi deve quanto a chi" tra i due membri | 🟡 | Con un solo membro mostra "in attesa del partner" (T-2.8); resta la dipendenza dai tassi disponibili |
| FR-23 | Riepilogo per categoria e budget del viaggio | ✅ | |

### 4.4 Media e Instagram
| ID | Requisito | Stato | Note |
|---|---|---|---|
| FR-30 | Upload foto/video con validazione | ✅ | |
| FR-31 | Thumbnail 400×400 WebP generata all'upload | 🔴 | |
| FR-32 | Rimozione EXIF/GPS prima della conservazione | 🔴 | |
| FR-33 | Griglia media per giorno | 🟡 | Carica gli originali, niente thumbnail |
| FR-34 | Generare carousel/story/reel come ZIP con caption opzionale | ✅ | Carosello 4:5 (fino a 10 foto) e storia 9:16: `InstagramGenerator` nella tab Foto, job asincrono (T-2.7). Reel non supportato (servirebbe un video) |
| FR-35 | ZIP disponibile 24 h tramite link firmato, poi eliminato | ✅ | Bucket privato (migration `0023`), URL firmato fino alla scadenza, rimozione dal cron `cleanup` (T-2.6/T-2.7) |

### 4.5 Blog e AI
| ID | Requisito | Stato | Note |
|---|---|---|---|
| FR-40 | Editor Tiptap con bozza e pubblicazione | ✅ | |
| FR-41 | Blog pubblico `/blog` e `/blog/[slug]` senza login | ✅ | |
| FR-42 | SEO: metadata, Open Graph, sitemap | 🟡 | Sitemap referenziata ma assente |
| FR-43 | Assistente di scrittura AI in streaming | ✅ | Quota aggirabile |
| FR-44 | Generazione bozza post dai dati del giorno | ✅ | |
| FR-45 | Briefing destinazione con cache 30 giorni | ✅ | Retention mai eseguita |

### 4.6 Amministrazione
| ID | Requisito | Stato | Note |
|---|---|---|---|
| FR-50 | Lista utenti, dettaglio, sospensione, eliminazione | ✅ | Ruolo admin auto-assegnabile (S-02) |
| FR-51 | Gestione piano premium e limiti per funzionalità | ✅ | |
| FR-52 | Audit log delle azioni admin | ✅ | |
| FR-53 | Vista in sola lettura dei dati di un utente | 🟡 | Impersonazione inerte (ADR-07) |

### 4.7 Mobile
| ID | Requisito | Stato | Note |
|---|---|---|---|
| FR-60 | App Expo: login, lista viaggi, dettaglio, blog, profilo | 🟡 | Sottoinsieme del web; accede direttamente a Supabase |

## 5. Requisiti non funzionali

| ID | Area | Requisito |
|---|---|---|
| NFR-01 | Sicurezza | Tutti i requisiti P0 e P1 di `docs/security/01-SECURITY-REQUIREMENTS.md` chiusi prima del rilascio pubblico |
| NFR-02 | Privacy | Nessun dato personale (foto, documenti, email) accessibile senza autorizzazione; EXIF rimossi |
| NFR-03 | Prestazioni | LCP < 2,5 s su 4G per dashboard e post del blog; griglia media servita da thumbnail |
| NFR-04 | Affidabilità | Operazioni multi-tabella transazionali; job asincroni per export > 10 s |
| NFR-05 | Accessibilità | WCAG 2.1 AA sui flussi principali; tutti i controlli interattivi usabili da tastiera con `aria-label` |
| NFR-06 | Mobile-first | Drawer sotto `md`, navigazione a tab inferiore |
| NFR-07 | Lingua | UI e messaggi in italiano con tono caldo; codice e commenti in inglese |
| NFR-08 | Qualità | `tsc` 0 errori, `eslint` 0 warning, coverage `src/lib` ≥ 70%, file ≤ 300 righe |
| NFR-09 | Osservabilità | Errori in Sentry, log strutturati senza dati personali |
| NFR-10 | Costi | Quota AI atomica per utente; tetto globale giornaliero per funzionalità |

## 6. Rilasci

| Release | Contenuto | Criterio di uscita |
|---|---|---|
| **R0 — Contenimento** (fase 0) | Rotazione segreti, fix RLS critiche, open redirect | Nessun P0 aperto |
| **R1 — Beta privata a due** (fasi 1–2) | Invito partner, media privati con thumbnail, cron funzionanti, UI Instagram | Criteri di accettazione di `CLAUDE.md` soddisfatti; test RLS verdi |
| **R2 — Qualità** (fase 3) | Coverage, tipi, fetching, refactoring | NFR-08 soddisfatto |
| **R3 — Blog pubblico** (fasi 4–5) | Osservabilità, deploy sicuro, SEO e sitemap | Checklist di rilascio (`04-SECURITY-CHECKLIST.md`) completa |

## 7. Rischi e dipendenze

- **Il fix delle policy RLS può rompere flussi esistenti** che oggi funzionano grazie a policy troppo larghe (es. aggiornamenti dal mobile). Mitigazione: test RLS scritti prima del fix.
- **La migrazione dello storage a privato** richiede di riscrivere gli URL esistenti in `media.url`, `legs.boarding_pass_url`, `documents`. Serve uno script di migrazione dati.
- **Vercel Hobby** limita durata delle funzioni e numero di cron: l'export Instagram va spezzato in job asincroni.
- Dipendenze esterne: Supabase, Vercel, Anthropic, Mapbox, exchangerate-api, Open-Meteo, Resend.

## 8. Domande aperte

1. Il piano premium resta nel perimetro o si congela fino alla R3?
2. L'app mobile deve arrivare alla parità con il web o resta un companion in sola lettura?
3. Il blog pubblico mostra entrambi gli autori, o i post sono firmati "Nicolò & Giorgia"?
4. Budget mensile AI da impostare come tetto globale.
