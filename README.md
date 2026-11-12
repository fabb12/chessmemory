# ChessMemoryBen

**La palestra della memoria scacchistica.** Una Progressive Web App per scacchisti principianti e intermedi: allenamenti adattivi di circa cinque minuti al giorno per **ricordare** le mosse, **capire** perché funzionano e **riconoscere** la stessa idea in posizioni nuove.

L'app funziona interamente sul dispositivo: i progressi restano in IndexedDB e tutto funziona offline dopo il primo caricamento, compresa l'analisi con Stockfish. Gli **account** sono facoltativi: se si collega un progetto Supabase, le preferenze vengono salvate nell'account e i progressi si possono copiare nel cloud.

> Nota sul nome: in questa versione non c'è alcun modello di intelligenza artificiale. Difficoltà, ripassi e consigli sono calcolati da regole locali documentate e dall'algoritmo di ripetizione dilazionata FSRS. L'app non promette miglioramenti garantiti.

## Funzionalità

- **MemoryMirror**, quattro fasi per ogni concetto:
  - **Osserva** – posizione, freccia, animazione della mossa e spiegazione (pezzo, obiettivo, principio, attenzione a).
  - **Ricorda** – l'utente gioca la mossa (tocco, trascinamento o tastiera). Dopo un errore: indizio strategico → indicazione del pezzo → soluzione spiegata, mai subito.
  - **Spiega** – domanda a risposta multipla sul principio, con testi curati nel dataset.
  - **Riconosci** – stessa idea in una posizione diversa; l'esito è registrato separatamente.
- **Libreria didattica**: 37 concetti e 74 esercizi in cinque aree (aperture e sviluppo, tattica, strategia, calcolo delle varianti, finali), difficoltà 1–5, con alternative accettate esplicite. Le posizioni nuove sono controllate con Stockfish.
  - Aperture e sviluppo: centro, sviluppo dei pezzi, arrocco, matto dell’imbecille, sviluppo con tempo sulla donna, fianchetto, rotture centrali (…c5, c4), inchiodatura del cavallo (Ag5, Ab4), trucco della forchetta.
  - Finali: matti di donna, torre e due torri, stallo, regola del quadrato, opposizione, pedone di torre, torre dietro al pedone passato, taglio del re con la torre, manovra di Réti.
- **Voce**: le spiegazioni delle mosse (fase Osserva, soluzioni, domande, commenti delle partite famose, analisi) vengono lette ad alta voce con la voce italiana del dispositivo (Web Speech API, funziona offline). La notazione è pronunciata per esteso («Cxe5+» → «cavallo prende e5, scacco»). La voce si accende e si spegne con il pulsante con l’altoparlante nella barra in alto o nel Profilo («Voce attiva»): da spenta non legge nulla e i pulsanti «Ascolta» spariscono. Lettura automatica e velocità si scelgono nel Profilo (salvate solo sul dispositivo).
- **Analizza (fotocamera + Claude)**: si inquadra la scacchiera della partita in corso (fotocamera dal vivo o foto); Claude (`claude-opus-5-5`, API Anthropic) riconosce i pezzi con un output JSON strutturato, l'utente controlla e corregge la posizione nell'editor, Stockfish la valuta (valutazione, mossa migliore, 3 varianti) e Claude spiega l'idea in italiano semplice, anche a voce. «Analisi continua» rilegge la scacchiera ogni 20 secondi e aggiorna la valutazione quando la posizione cambia.
  - Serve una **chiave API Anthropic** dell'utente (console.anthropic.com), inserita in Analizza o nel Profilo: resta solo nel browser (localStorage), non entra nei backup né nel cloud e viene inviata soltanto ad `api.anthropic.com` (accesso diretto dal browser, perché l'app non ha un server). Ogni lettura ha un costo sull'account Anthropic dell'utente.
  - L'SDK `@anthropic-ai/sdk` viene caricato solo quando si usa Analizza.
- **Partite famose**: 19 partite complete e commentate (Morphy all’Opera, l’Immortale, la Sempreverde, Legal, Steinitz–von Bardeleben, Réti–Tartakower, la partita del secolo di Fischer, Fischer–Spassky 1972 (6ª e 3ª), Karpov–Kasparov 1985, Deep Blue–Kasparov 1997, Kasparov–Topalov 1999) e 7 di Magnus Carlsen (Carlsen–Topalov 2009, Carlsen–Nakamura 2013, Carlsen–Anand 2013 e 2014, Carlsen–Karjakin 2016, Carlsen–Nepomniachtchi 2021), con filtro «Magnus Carlsen»; da scorrere mossa per mossa anche da tastiera, con «che cosa insegna».
- **Difficoltà adattiva**: livello dichiarato, valutazione iniziale di 5 posizioni, poi il livello sale o scende in base a correttezza e indizi usati (mai in base al tempo).
- **Ripetizione dilazionata** con `ts-fsrs` (FSRS): una scheda per concetto, cronologia delle revisioni, ripassi di oggi in Home.
- **Allenamento quotidiano**: ripassi in scadenza + esercizi mirati sulle debolezze + almeno un concetto nuovo, entro un budget indicativo di 5 minuti. Si sceglie la difficoltà (da 1 a 5, o automatica) e si vedono più concetti tra cui scegliere: quelli consigliati sono già selezionati, gli altri si possono aggiungere, e «Cambia proposte» ne propone di diversi (concetti ed esercizi cambiano a ogni allenamento). Sessione ripristinabile se interrotta.
- **Memory DNA**: per ciascuna delle quattro aree percentuale di successo osservata (cinque aree), esercizi completati, ripassi previsti, concetti consolidati e da ripassare, andamento nel tempo e un consiglio basato su regole locali.
- **Stockfish 19** (WebAssembly, versione *lite* a thread singolo, circa 1,9 MB) gira in un Web Worker, offline. Profondità «rapida» (12) o «approfondita» (18) nelle preferenze.
- **Account (Supabase, facoltativi)**: registrazione e accesso con email e password, password dimenticata, sincronizzazione automatica delle preferenze (tema, orientamento, profondità di analisi, nome nelle partite), salvataggio e ripristino dei progressi nel cloud (le foto restano sul dispositivo).
- **Profilo**: account, storico, tema chiaro/scuro, orientamento della scacchiera, esportazione/importazione JSON validata, ripristino con conferma esplicita.
- **PWA**: installabile, service worker con precache completo, indicatore offline.
- **Accessibilità**: navigazione da tastiera (anche sulla scacchiera), stati comunicati con testo e icone oltre che con il colore, layout da 320 px al desktop.

## Requisiti

- Node.js **24** (vedi `.nvmrc`; funziona anche con Node ≥ 22.12)
- npm 10 o successivo

## Comandi

```bash
npm install        # installa le dipendenze
npm run dev        # sviluppo locale su http://localhost:5173
npm run build      # controllo TypeScript + build di produzione in dist/
npm run preview    # serve la build su http://localhost:4173/chessmemory-ai/
npm run test       # test unitari e dei componenti (Vitest + React Testing Library)
npm run test:e2e   # build + test end-to-end (Playwright)
npm run typecheck  # solo controllo TypeScript
npm run validate:data  # solo i test sul dataset
```

Per i test end-to-end serve Chromium: `npx playwright install chromium` (una volta). In alternativa si può indicare un Chromium già presente con `PLAYWRIGHT_CHROMIUM_PATH=/percorso/chromium`.

## Pubblicazione su GitHub Pages

Il workflow `.github/workflows/deploy.yml` esegue test e build e pubblica `dist/` a ogni push sul **ramo predefinito** del repository.

1. Carica il progetto su GitHub.
2. Vai in **Settings → Pages** e in *Build and deployment → Source* scegli **GitHub Actions** (passaggio manuale, da fare una sola volta).
3. Fai un push sul ramo predefinito, oppure avvia il workflow *Deploy su GitHub Pages* da **Actions → Run workflow**.
4. Il sito sarà disponibile su `https://<utente>.github.io/<nome-repository>/`.

Dettagli:

- **Base URL**: il workflow imposta `BASE_PATH=/<nome-repository>/` usando il nome reale del repository, quindi funziona con qualunque nome. Senza variabile, `npm run build` usa `/chessmemory-ai/`. Per un dominio personalizzato o un sito utente: `BASE_PATH=/ npm run build`.
- **Rotte**: l'app usa `HashRouter` (`…/#/allenati`), quindi ricaricare o condividere un indirizzo funziona senza regole di riscrittura lato server.
- Il workflow `ci.yml` esegue typecheck, test, build ed E2E a ogni push e pull request.

## Account con Supabase (facoltativo)

> **Al momento gli account sono disattivati** (`ACCOUNTS_ENABLED = false` in `src/services/supabase.ts`): l'app funziona solo in locale, senza accesso, e il Profilo non mostra la sezione Account. Per riattivarli rimettere la costante a `true`.

Senza configurazione l'app funziona come prima, solo in locale, e il Profilo spiega che gli account non sono attivi.

1. Crea un progetto su [supabase.com](https://supabase.com).
2. In **SQL Editor** esegui `supabase/migrations/20261112000000_accounts.sql` (crea le tabelle `user_preferences` e `user_progress`, con Row Level Security: ogni utente legge e scrive solo le proprie righe).
3. In **Authentication → URL Configuration** imposta come *Site URL* l'indirizzo dell'app (es. `https://<utente>.github.io/<nome-repository>/`) e aggiungilo agli *Redirect URLs* (anche `http://localhost:5173/` per lo sviluppo). I link delle email (conferma, nuova password) tornano a questo indirizzo con il flusso PKCE (`?code=…`), che non interferisce con le rotte `#/…`.
4. Copia *Project URL* e chiave *anon / publishable* (Project Settings → API):
   - in locale: copia `.env.example` in `.env.local` e compila i due valori;
   - per GitHub Pages: **Settings → Secrets and variables → Actions → Variables** del repository, variabili `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (lette dal workflow di deploy).

La chiave *anon* è pubblica per definizione: finisce nel bundle. La protezione dei dati è affidata alle regole RLS. Non usare mai la chiave *service_role* nell'app.

La libreria `@supabase/supabase-js` è caricata solo se gli account sono configurati (import dinamico).

## Installare la PWA

- **Android (Chrome)**: apri il sito, menu ⋮ → *Installa app* (o *Aggiungi a schermata Home*).
- **iPhone / iPad (Safari)**: apri il sito, tocca *Condividi* → *Aggiungi alla schermata Home*.
- **Desktop (Chrome / Edge)**: icona di installazione nella barra degli indirizzi.

Dopo la prima apertura completa l'app funziona anche senza connessione.

## I dati dell'utente

- Salvati solo nel browser, in IndexedDB (Dexie). Nessun dato personale: il profilo contiene un identificativo casuale locale.
- **Cancellando i dati di navigazione i progressi vengono persi.** Dal Profilo si può esportare un backup JSON e reimportarlo; il file importato viene validato campo per campo prima di essere salvato.
- `localStorage` contiene una copia della preferenza di tema, usata per evitare il lampo di colore all'avvio, e, se si accede a un account, la sessione di Supabase (`cm-auth`).
- Il backup JSON (versione 2) comprende anche gli errori salvati e le loro foto; i backup della versione 1 restano importabili. Il salvataggio nel cloud non comprende le foto.
- «Ripristina i progressi» cancella livello, ripassi e statistiche, ma non le preferenze né gli errori salvati.

## Architettura

```
src/
  app/            App, routing (HashRouter), gate dell'onboarding
  components/
    chess/        ChessBoard (react-chessboard), dialogo di promozione
    training/     PhaseStepper, ObservePhase, MoveTask, QuestionCard, ConceptRunner, SessionSummary
    dashboard/    CategoryCard, TrendChart
    layout/ ui/   AppShell, navigazione, componenti di base
  pages/          Onboarding, Home, Allenati, Strategie, Concetto, Memory DNA, Profilo
  features/
    learning/     evaluateMove, moveTask (scala degli aiuti), sessionBuilder
    memory/       scheduler (ts-fsrs), rating (regole di valutazione)
    adaptation/   difficulty (livello adattivo e valutazione iniziale)
    onboarding/   scelta degli esercizi di valutazione
    progress/     stats (Memory DNA), streak
  data/exercises/ concetti ed esercizi (dataset)
  db/             schema e database Dexie
  services/       progress (scritture), backup (export/import/reset), mistakes (errori delle partite),
                  gameImport (Lichess / Chess.com), supabase (client facoltativo)
  features/engine/   Stockfish in un Web Worker, lettura dell'output UCI, classificazione degli errori
  features/mistakes/ PGN e ricerca degli errori, editor della posizione (FEN)
  features/account/  AccountProvider (sessione e sincronizzazione), tabelle Supabase
supabase/migrations/ tabelle e regole RLS per gli account
scripts/copy-engine.mjs  copia Stockfish da node_modules a public/engine (postinstall)
  hooks/ i18n/ utils/ types/ styles/
tests/
  unit/ components/ e2e/
```

Interfaccia, logica didattica, regole degli scacchi (`chess.js`, unica fonte di verità), adattamento, ripassi, persistenza e dataset sono moduli separati e testati singolarmente. I testi dell'interfaccia sono in `src/i18n/it.ts`: per una nuova lingua basta un dizionario con la stessa forma.

### Regole documentate

**Valutazione FSRS** (`src/features/memory/rating.ts`) – il tempo di risposta è registrato ma non entra nella valutazione.

| Valutazione | Condizione |
|---|---|
| Again | Ricorda fallita (soluzione mostrata) |
| Hard | Ricorda riuscita con indizi o errori, oppure Spiega errata, oppure Riconosci fallita |
| Good | Ricorda pulita, Spiega corretta, Riconosci riuscita (anche con aiuti) o assente |
| Easy | Come Good, in un ripasso, con Riconosci pulita |

FSRS è configurato con intervalli in giorni (`enable_short_term: false`), senza fuzz, ritenzione richiesta 0,9 (`src/features/memory/scheduler.ts`). Un concetto è **consolidato** solo con stabilità ≥ 7 giorni *e* ultima prova di riconoscimento riuscita.

**Difficoltà adattiva** (`src/features/adaptation/difficulty.ts`, soglie in `DEFAULT_ADAPTATION_CONFIG`): si sale con media ≥ 0,80 sugli ultimi 5 concetti; si scende con media ≤ 0,30 sugli ultimi 3; dopo ogni cambio servono almeno 4 nuovi risultati. Il livello è didattico, **non** un rating Elo.

**Aiuti** (`src/features/learning/moveTask.ts`): difficoltà 1–2 → due indizi strategici + pezzo; 3–4 → un indizio + pezzo; 5 → un solo indizio.

**Sessione** (`src/features/learning/sessionBuilder.ts`): budget 300 s, 50 s per ripasso, 90 s per concetto nuovo, massimo 2 concetti nuovi e 2 esercizi mirati.

**Sequenza giornaliera** (`src/features/progress/streak.ts`): saltare un solo giorno non azzera la sequenza.

### Verifica del dataset

`tests/unit/dataset.test.ts` controlla per ogni esercizio: FEN valido, colore al tratto, legalità di mosse, risposte e alternative, esito dichiarato (matto, cattura, arrocco), risposte forzate nei matti in due, completezza dei testi, collegamento di trasferimento allo stesso concetto, più verifiche tematiche (forchette, inchiodature, colonne aperte, avamposti, conteggio di attaccanti e difensori…). Le posizioni tattiche e di calcolo sono state inoltre confrontate una tantum con Stockfish: la soluzione coincide sempre con la prima scelta del motore. Nelle posizioni di apertura e strategia esistono più mosse di valore simile: lì l'esercizio chiede di applicare il principio indicato e accetta le alternative elencate.

## Licenza del motore

Stockfish è distribuito con licenza GPL v3: il file della licenza è pubblicato accanto al motore (`engine/COPYING-stockfish.txt`) e il codice sorgente è disponibile su [github.com/official-stockfish/Stockfish](https://github.com/official-stockfish/Stockfish) e [github.com/nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js).

## Versioni installate

| Pacchetto | Versione |
|---|---|
| react / react-dom | 19.3.1 |
| react-router-dom | 7.18.5 |
| typescript | 7.0.2 |
| vite | 8.3.8 |
| tailwindcss / @tailwindcss/vite | 4.3.5 |
| chess.js | 1.4.0 |
| react-chessboard | 5.12.1 |
| dexie / dexie-react-hooks | 4.4.7 / 4.4.0 |
| ts-fsrs | 5.4.2 |
| @supabase/supabase-js | 2.119.0 |
| stockfish (Stockfish.js 19, GPL-3.0) | 19.0.1 |
| vite-plugin-pwa | 2.0.0 |
| vitest | 5.1.0 |
| @testing-library/react | 16.3.3 |
| @playwright/test | 1.65.0 |

Le versioni esatte sono fissate in `package-lock.json`.

## Limitazioni note

- Senza account i dati non sono sincronizzati tra dispositivi. Con l'account le preferenze si sincronizzano da sole; i progressi si salvano e ripristinano nel cloud con un comando esplicito (l'ultimo salvataggio sostituisce il precedente, non c'è unione automatica). Le foto degli errori non vanno nel cloud.
- Le foto della scacchiera non vengono riconosciute automaticamente: la posizione si dispone a mano accanto alla foto.
- Stockfish *lite* è molto più forte di qualunque giocatore umano, ma più debole della versione completa; le analisi sono a profondità fissa.
- La libreria contiene 21 concetti: una volta studiati tutti, gli allenamenti sono fatti di soli ripassi.
- La valutazione delle mosse si basa sul dataset curato (mossa preferita + alternative), non su un motore: una mossa buona ma non elencata viene segnalata come «non è l'idea dell'esercizio».
- Interfaccia e contenuti sono solo in italiano.
- `npm audit` segnala vulnerabilità moderate in dipendenze usate solo in fase di build (catena di `vite-plugin-pwa`/workbox); non finiscono nel bundle servito agli utenti.

## Sviluppi futuri (non implementati)

**Nessuna di queste funzioni è presente nell'app**: riconoscimento automatico dei pezzi dalla foto, foto degli errori nel cloud (Supabase Storage), sincronizzazione continua dei progressi tra dispositivi, spiegazioni generate da un modello tramite backend sicuro. Foto e motore sono pensati solo per lo studio dopo la partita, non per assistenza durante partite in corso.
