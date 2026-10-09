# Voce del brand — motonui

Questa guida dice come parla motonui: nell'app, nelle email, sul blog pubblico e nel README. Estende la sezione "Lingua e tono" di `CLAUDE.md`, che resta la regola breve; qui ci sono i dettagli e gli esempi.

Vale per ogni testo che una persona legge. Codice, commenti, log e nomi di variabili restano in inglese.

---

## 1. Chi è motonui

Se motonui fosse una persona sarebbe l'amico che ha già fatto quel viaggio: sa dove sono i biglietti, ricorda chi ha pagato la cena, e quando qualcosa va storto lo dice con calma e propone cosa fare.

Il nome viene da Motu Nui, una delle tre terre più vicine al Point Nemo, il punto dell'oceano più lontano da qualsiasi costa (circa 2.688 km). La storia è il nostro unico elemento narrativo: l'isola, l'oceano, la rotta, la distanza. Si usa con misura, nei momenti che lo meritano (404, inviti, schermate vuote, login), non in ogni frase.

## 2. A chi parliamo

| Pubblico | Dove | Come ci rivolgiamo |
|---|---|---|
| La coppia che usa l'app | Landing, schermate vuote, inviti alla pianificazione | **Voi**: "Pianificate il vostro prossimo viaggio" |
| La persona che sta facendo un'azione | Form, errori, conferme, email di promemoria, impostazioni | **Tu**: "Controlla la tua email" |
| Chi legge il blog | `/blog` | **Noi** (Nicolò e Giorgia che raccontano): "Il nostro diario di viaggio" |
| Chi sviluppa | README, `docs/` | Impersonale o **tu**, tono tecnico e asciutto |

Regola pratica: una frase usa una sola persona. Mai "pianifica il vostro viaggio e tieni traccia".

## 3. Attributi della voce

**Caldo**
- Siamo: vicini, in seconda persona, con parole di tutti i giorni.
- Non siamo: sdolcinati, pieni di punti esclamativi, finti entusiasti.
- Suona così: "Che bello rivederti 🏝️"
- Non suona così: "Benvenuto nella migliore esperienza di viaggio di sempre!!!"

**Chiaro**
- Siamo: una cosa per frase, il verbo all'inizio, niente gergo.
- Non siamo: burocratici ("non incorrere in penali"), tecnici ("risorsa non trovata"), vaghi ("Errore").
- Suona così: "Cancella entro questa data: dopo potrebbe non essere più gratuito."
- Non suona così: "Si prega di procedere alla cancellazione entro i termini previsti."

**In due**
- Siamo: un'app pensata per una coppia; "insieme", "in due", "chi ha pagato cosa".
- Non siamo: un tour operator, un'agenzia, un'app per gruppi o per chi viaggia da solo.
- Suona così: "Il vostro prossimo viaggio, pianificato in due."
- Non suona così: "Scopri i nostri fantastici tour!"

**Onesto**
- Siamo: precisi su cosa fa il prodotto e su cosa non sappiamo.
- Non siamo: iperbolici ("perfetto", "unica", "ecosistema completo"), né promettiamo ciò che dipende da altri.
- Suona così: "Secondo i dati del viaggio, il check-in dovrebbe essere aperto."
- Non suona così: "Il check-in è aperto."

## 4. Tono per contesto

La voce resta la stessa; cambia quanto calore e quanta storia mettiamo.

| Contesto | Tono | Esempio |
|---|---|---|
| Errore recuperabile | Calmo, dice cosa fare, 🏝️ in chiusura | "Ops! Non riusciamo a salvare. Riprova tra poco 🏝️" |
| Errore di validazione | Preciso, senza colpa, 🏝️ in chiusura | "La password deve avere almeno 10 caratteri 🏝️" |
| Schermata vuota | Invito, mai rimprovero | "Il diario è ancora in bianco. Torna presto: la prossima storia è in viaggio 🏝️" |
| Conferma | Breve | "Salvato" |
| Azione distruttiva | Serio, niente emoji, dice la conseguenza | "Vuoi eliminare questo viaggio? Foto e spese non si potranno recuperare." |
| Account sospeso, limiti, sicurezza | Rispettoso e diretto, storia al minimo | "Il tuo account è in pausa." |
| Email di promemoria | Utile prima di tutto: cosa, quando, codice | "Tavolo prenotato: ecco i dettagli da tenere a portata di mano." |
| Invito del partner | Il momento più caldo | "Un viaggio ti aspetta" |
| 404 | Qui la storia può giocare | "Persi nell'oceano? 🌊" |
| Area admin | Funzionale, italiano, nessuna emoji | "Sospendi account" |

### Struttura di un messaggio di errore

1. **"Ops!"** in apertura, se l'errore è nostro o imprevisto.
2. **Cosa non è riuscito**, in prima persona plurale: "Non riusciamo a caricare le foto."
3. **Cosa fare**: "Riprova tra poco."
4. **🏝️** in chiusura.

Non si mostrano mai messaggi di un fornitore così come arrivano (Supabase, Google, Resend): sono in inglese e fuori tono. Per Supabase Auth si passa da `authErrorMessage()` (`src/lib/auth/auth-error-message.ts`).

Per "non trovato" si usa `Errors.notFound('Viaggio')`, che produce "Ops! Viaggio introvabile 🏝️": "introvabile" non ha genere, quindi funziona con ogni nome.

## 5. Regole di stile

| Regola | Scelta | Esempio |
|---|---|---|
| Nome del prodotto | Sempre minuscolo, anche a inizio frase | "motonui", mai "Motonui" o "Motonui App" |
| Maiuscole in titoli e pulsanti | Solo la prima parola | "Crea viaggio", non "Crea Viaggio" |
| Lingua dell'interfaccia | Italiano; niente inglese se esiste la parola | "Ultimi viaggi", non "Recent Trips" |
| Punto esclamativo | Al massimo uno, raro | "Ops!" |
| Emoji | 🏝️ è l'emoji del brand: una, in chiusura. Altre solo se indicano un tipo (✈️ volo, 🍽️ ristorante) | — |
| Emoji vietate dove | Azioni distruttive, sospensioni, area admin | — |
| Numeri e valuta | Formato italiano | "1.250,00 €", "2.688 km" |
| Date | Per esteso nelle email, brevi nelle liste | "giovedì 1 ottobre 2026", "1 ott 2026" |
| Orari | 24 ore | "20:30" |
| Titoli di pagina | Senza il nome del prodotto: lo aggiunge il template del layout | `title: 'Blog di viaggio'` |
| Testo alternativo | In italiano e descrittivo; `alt=""` per le immagini decorative | — |
| Link e pulsanti | Dicono cosa succede | "Accetta l'invito", non "Clicca qui" |
| Elementi finti | Nessun link o pulsante che non porta da nessuna parte | — |

## 6. Parole

| Usa | Non usare | Nota |
|---|---|---|
| viaggio | avventura, esperienza, tour | "avventura" solo se serve davvero |
| in due, insieme, il vostro viaggio | il tuo viaggio perfetto | Parliamo a una coppia |
| partner | amico, compagno di viaggio, membro | "membro" solo nel codice |
| spese, chi deve quanto a chi | bilanci, saldi | — |
| alloggio | hotel, struttura | Nelle email di scadenza "struttura" è ammesso come etichetta |
| spostamento | tratta, leg | "volo" quando è un volo |
| codice prenotazione | ref., numero prenotazione, prenotazione | Una sola etichetta ovunque |
| diario, post | articolo, contenuto | — |
| accedi, esci | log in, logout, sign in | — |
| carica | upload | — |
| in pausa (account) | bannato, bloccato | — |
| l'AI ti aiuta a scrivere | l'AI scrive per te | Non promettere automazione totale |
| un unico posto | ecosistema, piattaforma, soluzione | — |

### Tagline

- Prodotto: **"Il tuo compagno di viaggio di coppia."**
- Blog pubblico: **"Il nostro diario di viaggio"** (qui parlano Nicolò e Giorgia).
- Storia: **"I viaggi migliori sono quelli che sembrano impossibili finché non li fai."**

Non se ne inventano altre.

## 7. Affermazioni da evitare o da qualificare

- Superlativi senza prova: "il migliore", "l'unica app", "perfetto", "completo".
- Promesse sull'AI: l'assistente aiuta a scrivere e riassume; non garantisce risultati e ha un limite giornaliero.
- Fatti che dipendono da terzi (check-in, scadenze, cancellazioni gratuite): vengono dai dati inseriti dall'utente, quindi si scrivono con "secondo i dati del viaggio" o al condizionale.
- "Temporaneamente" per una sospensione: non sappiamo quanto dura.
- Funzioni a pagamento o non ancora disponibili: non si annunciano nell'interfaccia.

## 8. Voce dell'assistente AI

I prompt in `src/lib/ai/` seguono la stessa voce: prima persona plurale ("noi"), tono caldo e personale, niente frasi da brochure. Quando l'assistente continua un testo dell'utente mantiene lo stile dell'autore: la voce di chi scrive viene prima di quella del brand.

## 9. Prima di pubblicare un testo

- [ ] È in italiano, con il nome `motonui` in minuscolo?
- [ ] Usa una sola persona (tu, voi o noi) dall'inizio alla fine?
- [ ] Un errore dice cosa non è riuscito e cosa fare?
- [ ] Nessun messaggio di un fornitore mostrato così com'è?
- [ ] Nessun superlativo o promessa che non possiamo dimostrare?
- [ ] Le parole sono quelle della tabella al §6?
- [ ] Pulsanti e link portano davvero da qualche parte?
