# ChessMemoryBen

**La palestra della memoria scacchistica.** Una Progressive Web App per scacchisti principianti e intermedi: allenamenti adattivi di circa cinque minuti al giorno per **ricordare** le mosse, **capire** perché funzionano e **riconoscere** la stessa idea in posizioni nuove.

L'app funziona interamente sul dispositivo: i progressi restano in IndexedDB e tutto funziona offline dopo il primo caricamento, compresa l'analisi con Stockfish. Gli **account** sono facoltativi: se si collega un progetto Supabase, le preferenze vengono salvate nell'account e i progressi si possono copiare nel cloud.

> Allenamento, difficoltà e ripassi sono calcolati sul dispositivo da regole documentate e dall'algoritmo di ripetizione dilazionata FSRS. L'intelligenza artificiale (Claude, API Anthropic) è usata solo in «Analizza», per riconoscere la scacchiera dalle foto (insieme a YOLO, che gira sul dispositivo) e per spiegare le mosse. L'app non promette miglioramenti garantiti.

## Prima della vendita

- **Dati del titolare**: compila `src/config/brand.ts` (ragione sociale, indirizzo, email di assistenza, data dell'informativa). Compaiono nella pagina «Informazioni e privacy» (`#/informazioni`); in sviluppo la pagina avvisa se mancano.
- **Testi legali**: informativa privacy e condizioni d'uso descrivono ciò che il codice fa davvero (dati locali, account Supabase facoltativo, immagini inviate ad Anthropic), ma vanno fatti verificare da un consulente (GDPR, minori: l'app è pensata anche per bambini).
- **Stockfish è GPL-3.0**: gira come programma separato in un Web Worker; la pagina «Informazioni» riporta la licenza e il link al sorgente. Mantieni la nota se cambi versione del motore.
- **Chiave API**: oggi l'analisi con la fotocamera usa la chiave Anthropic dell'utente. Per un prodotto in vendita serve un piccolo server che custodisca la chiave e misuri l'uso per abbonamento (vedi le idee in fondo).
- **Modello YOLO (AGPL-3.0)**: il modello dei pezzi incluso (`public/models/chess-pieces.onnx`, pesi MIT di wojciechc1/AI_Chess) è addestrato con Ultralytics YOLOv8, che è AGPL-3.0 e ritiene coperti anche i modelli addestrati. Per un prodotto commerciale chiuso serve la licenza commerciale Ultralytics oppure un modello addestrato con uno strumento a licenza permissiva; senza il file l'app funziona lo stesso (solo Claude + geometria). Dettagli in `public/models/LICENSE-chess-pieces.txt`.
- **Nome e marchio**: il nome è in `src/i18n/it.ts` (`app.name`), nel manifest PWA (`vite.config.ts`) e in `index.html`.

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
- **Analizza (due foto + YOLO + Claude)**: «Fotografa la posizione» guida due foto, scelte per vedere tutti i pezzi in fretta:
  1. **dal tuo lato**, telefono inclinato di circa 45° con tutta la scacchiera nella cornice: dà orientamento e prima lettura;
  2. **di lato** (lato destro, 90°): i pezzi coperti da quelli più alti nella prima foto qui sono di fianco, quindi visibili.

  Se la prima foto basta già (YOLO + regole, oppure Claude e YOLO d'accordo) la seconda si salta da sola; «Basta la prima foto» la salta a mano. Si possono anche caricare 1 o 2 foto dalla galleria. Come funziona la lettura (`src/features/vision/shots.ts`):
  - **YOLO subito, sul dispositivo** (`pieceDetector.ts`, onnxruntime-web): la scacchiera viene trovata da sola nel fotogramma intero (reticolo degli incroci, `autoDetectCorners` + `gridFit.ts`), poi YOLO assegna ogni pezzo alla casa sotto la sua base, con le probabilità per casa (`evidence.ts`).
  - **Claude solo se serve** (modello scelto nelle Impostazioni, Haiku 5.5 predefinito): se YOLO + mosse legali non spiegano la foto con sicurezza, Claude legge quella foto ricevendo la lettura di YOLO con le case incerte («?»); se YOLO non ha trovato la scacchiera, Claude dà gli angoli e YOLO rilegge con quelli. Ogni foto parte appena scattata: la prima viene letta mentre ti sposti per la seconda.
  - **Fusione**: ogni foto viene riportata al punto di vista del Bianco (per la foto laterale l'orientamento si ricava confrontandola con la prima, qualunque lato tu abbia scelto) e le letture vengono fuse casa per casa (`fuseViews`: un pezzo visto in una foto e coperto nell'altra resta).
  - **Regole** (`boardResolve.ts`): la lettura fusa è confrontata con le posizioni raggiungibili con 1–2 semimosse legali dalla posizione precedente (o di partenza): gli errori isolati spariscono, si riconosce la mossa e si deduce il tratto. Una posizione corretta a mano non viene sovrascritta da una lettura sbagliata.
  - Orientamento: «Ruota la lettura» (o «Opzioni di lettura») lo corregge senza rileggere le foto; nelle opzioni anche la numerazione invertita e il modello di Claude.
  - **Chi sei**: foto dal lato del Bianco → sei il Bianco, dal lato del Nero → sei il Nero (si cambia con «Io sono»). Quando tocca a te Stockfish disegna le **3 mosse migliori** e la **linea vincente** (`winningLine.ts`: matto forzato, poi scacco, poi piano) e Claude ne spiega l'idea; quando tocca all'avversario si vede la sua mossa più pericolosa (freccia rossa). **«Prima prova tu»**: Stockfish giudica la tua mossa prima di mostrare i suggerimenti.
  - **Posizione successiva**: «Fotografa la nuova posizione» rifà le due foto; la posizione precedente serve alle regole per riconoscere la mossa.
  - Istruzioni fisse della lettura nel prompt di sistema con *prompt caching*; con «Lettura rapida» (Opus, Fable) la modalità veloce dell'API. Serve una **chiave API Anthropic** dell'utente (resta solo nel browser e va solo ad `api.anthropic.com`); senza chiave legge solo YOLO. Il modello YOLO è incluso (`public/models/`); per riaddestrarlo: `public/models/README.md` e `scripts/yolo/train_export.py`.
- **Partite famose**: 28 partite complete e commentate (Morphy all’Opera, l’Immortale, la Sempreverde, Legal, Steinitz–von Bardeleben, Rotlewi–Rubinstein 1907, Lasker–Thomas 1912, Levitsky–Marshall 1912 («monete d’oro»), Bernstein–Capablanca 1914, Réti–Tartakower, Sämisch–Nimzowitsch 1923 (lo zugzwang), Botvinnik–Capablanca 1938, Spassky–Bronstein 1960, Short–Timman 1991, Aronian–Anand 2013, la partita del secolo di Fischer, Fischer–Spassky 1972 (6ª e 3ª), Karpov–Kasparov 1985, Deep Blue–Kasparov 1997, Kasparov–Topalov 1999) e 7 di Magnus Carlsen (Carlsen–Topalov 2009, Carlsen–Nakamura 2013, Carlsen–Anand 2013 e 2014, Carlsen–Karjakin 2016, Carlsen–Nepomniachtchi 2021), con le categorie «Più corte», «Più lunghe» (calcolate dal numero di mosse), «Più eleganti», «Più strategiche», «Più sconvolgenti», «Più istruttive», «Più importanti» (classifiche in `src/data/gameCategories.ts`) e i giocatori famosi (Morphy, Anderssen, Steinitz, Rubinstein, Marshall, Capablanca, Réti, Nimzowitsch, Botvinnik, Fischer, Spassky, Karpov, Kasparov, Short, Deep Blue, Anand, Topalov, Aronian, Carlsen); da scorrere mossa per mossa anche da tastiera, con «che cosa insegna».
  - **Tutor delle grandi partite** («Rigiocala sulla tua scacchiera»): inquadri la scacchiera vera e il tutor fa da insegnante, mossa per mossa e **per entrambi i colori**. In modalità «Guidami» (predefinita) dice a voce e scrive quale pezzo muovere, da quale casa a quale («Il Bianco muove il cavallo da g1 a f3»); **appena la fotocamera vede la mossa** spiega subito **perché** il campione l'ha giocata e qual è **la lezione** strategica da ricordare; dopo una breve pausa (regolabile, predefinita 2 s) indica la mossa successiva, fino alla fine. La mossa indicata si riconosce con soglie più tolleranti (l'utente sta eseguendo proprio quella: `LENIENT` in `moveMatcher.ts`); se la lettura resta dubbia il tutor lo dice a voce e propone le mosse possibili. Una mossa diversa viene segnalata: si rimette il pezzo e si ripete l'indicazione. Il perché è la spiegazione di Claude (con la chiave API, preparata in anticipo), altrimenti il commento del PGN o una spiegazione ricavata dalla posizione con il principio strategico (`src/features/tutor/moveReason.ts`). Le modalità «Indovina il Bianco / il Nero / tutto» chiedono invece di trovare le mosse del Maestro. Se la mossa non arriva entro un tempo regolabile (predefinito 30 s, 0 = mai): con la fotocamera il tutor ripete l'indicazione, senza fotocamera la considera fatta e va avanti. Con **«Attiva il microfono»** (riconoscimento vocale del browser, in italiano; `src/features/voice/listen.ts`) si può dire «prossima mossa» (o «avanti»), «perché», «ripeti», «indietro», oppure fare una domanda qualsiasi sulla partita: risponde Claude con il contesto (partita, mosse giocate, posizione, mossa indicata). Si può anche saltare a voce a un punto della partita («vai alla quinta mossa», «torna alla mossa 12 del Nero», «vai all'inizio», «vai alla fine»): la scacchiera dello schermo si allinea subito e, con la fotocamera, il tutor chiede di sistemare i pezzi veri: appena la fotocamera vede i pezzi al posto giusto riparte da sola (oppure si dice «pronto»). Sotto la scacchiera ci sono sempre le frecce inizio / indietro / avanti / fine (anche ← → da tastiera). Le domande si possono anche scrivere. All'inizio il tutor chiede il nome (a voce o scritto) e lo usa quando parla («Bravo Marco!»). Mentre parla lo si può interrompere a voce anche a metà frase («zitta», «vai alla prossima», «vai alla quinta mossa»…): si usa la trascrizione provvisoria del riconoscimento e si cerca il comando alla fine di ciò che il microfono sente, scartando le parole che sono l'eco della sua stessa voce. Per non scambiare l'eco dell'altoparlante per un comando (audio alto): durante la voce del tutor interrompono solo «zitta/basta», «prossima» e «vai alla…»; il comando deve comparire in due trascrizioni provvisorie di fila; si scarta se le sue parole distintive le sta dicendo il tutor; e il volume della voce si regola nel tutor. Lo «Storico della lezione» registra tutto quello che si dicono tutor e allievo (con la semimossa e l'ora), resta salvato per ogni partita e si può cancellare. I comandi accettano le varianti naturali («ok, vai alla prossima», «zitta per favore», «vai alla 5ª mossa»). Per chiudere la lezione basta dirlo: «basta», «non voglio (più) giocare», «smettiamo», «ho finito», «spegni il microfono»… → il tutor saluta, spegne il microfono e mette in pausa la lezione («zitta», «stop», «aspetta» invece lo fanno solo tacere). Altrimenti il microfono resta sempre acceso: si riavvia da solo dopo i silenzi e gli errori temporanei, si riaccende alla prossima apertura, e finché microfono o fotocamera sono attivi lo schermo non va in salvaschermo (Screen Wake Lock). Se si salta avanti o indietro («salta», «vai alla quinta mossa», frecce, tempo scaduto) la scacchiera dello schermo si allinea subito; con la fotocamera quella vera resta dov'è finché non la si sistema: la fotocamera riconosce direttamente la posizione di arrivo (pezzi sistemati a mano o più mosse insieme, transizione «align» del tracker) oppure le mosse mancanti una alla volta, senza obbligare a rifarle in sequenza. **Reattività**: le spiegazioni si preparano 5 mosse avanti, due richieste alla volta (quella che serve subito passa in testa, `prefetchQueue.ts`), e se non sono pronte si aspetta al massimo 1,5 s prima di leggere quella locale; le risposte alle domande arrivano in streaming e la voce legge ogni frase appena è completa (`SentenceSplitter`, `speakNext` in `speech.ts`), preceduta da una frase breve immediata («Vediamo.»). Il «Tono di parlata» si sceglie nel tutor: **Maestro istruttivo** (presenta la partita all’inizio, spiega ogni mossa come a lezione — idea, che cosa osservare, principio —, fa una domanda guida quando tocca all’allievo indovinare, riassume le lezioni a fine partita e parla con una voce un po’ più lenta e grave), Formale (dà del Lei), Amichevole, Normale, Giovanile, Sgarbato, Antipatico, Arrogante, Offensivo (prese in giro scherzose solo sul modo di giocare, mai su caratteristiche personali); cambia le frasi del tutor e le istruzioni a Claude, con spiegazioni in cache separate per tono (`src/features/tutor/tone.ts`). Il tutor chiama spesso l'allievo per nome, alternando le frasi («Marco, …», «Ora tocca a te, Marco», «Ottimo Marco!»), anche nelle risposte di Claude.
- **Difficoltà adattiva**: si parte dal livello 1 senza test iniziale, poi il livello sale o scende in base a correttezza e indizi usati (mai in base al tempo).
- **Ripetizione dilazionata** con `ts-fsrs` (FSRS): una scheda per concetto, cronologia delle revisioni, ripassi di oggi in Home.
- **Percorso a step** (in cima ad «Allenati», `src/features/learning/path.ts`): tutte le lezioni (41 concetti) in fila dalla più facile alla più difficile, divise in 5 livelli fino a «Maestro» (matto di Anastasia, matto di Boden, posizione di Lucena, difesa di Philidor, manovra di Réti…). Una lezione si sblocca quando la precedente è superata (mossa trovata da soli). Ogni lezione: il tutor mostra l’idea (Osserva), tu la giochi, e subito dopo **«Il tutor ti spiega perché»** (`WhyPanel`, `lessonWhy.ts`): la variante mossa per mossa con scacchi e risposte forzate, la spiegazione e il principio, letti a voce; con la chiave API «Spiegamelo meglio» chiede a Claude una spiegazione approfondita (perché ogni mossa è necessaria, che cosa succederebbe con un’altra, come riconoscere l’idea in partita). A fine lezione «Da ricordare» e «Prossima lezione». Le nuove lezioni di livello 5 sono state verificate con Stockfish.
- **Allenamento quotidiano** (allenamento libero): ripassi in scadenza + esercizi mirati sulle debolezze + almeno un concetto nuovo, entro un budget indicativo di 5 minuti. Si sceglie la difficoltà (da 1 a 5, o automatica) e si vedono più concetti tra cui scegliere: quelli consigliati sono già selezionati, gli altri si possono aggiungere, e «Cambia proposte» ne propone di diversi (concetti ed esercizi cambiano a ogni allenamento). Sessione ripristinabile se interrotta.
- **Progressi** (ex «Memory DNA», `#/progressi`): per ciascuna delle cinque aree percentuale di successo osservata, esercizi completati, ripassi previsti, concetti consolidati e da ripassare, andamento nel tempo e un consiglio basato su regole locali.
- **Stockfish 19** (WebAssembly, versione *lite* a thread singolo, circa 1,9 MB) gira in un Web Worker, offline. Profondità «rapida» (12) o «approfondita» (18) nelle preferenze.
- **Account (Supabase, facoltativi)**: registrazione e accesso con email e password, password dimenticata, sincronizzazione automatica delle preferenze (tema, orientamento, profondità di analisi, nome nelle partite), salvataggio e ripristino dei progressi nel cloud (le foto restano sul dispositivo).
- **Profilo** (icona in alto a destra): account, livello, preferenze, voce, chiave per l'analisi con la fotocamera, storico, esportazione/importazione JSON validata, ripristino con conferma esplicita, link a «Informazioni, privacy e licenze».
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
  pages/          Home, Allenati, Strategie, Concetto, Analizza, Partite, Progressi, Profilo, Informazioni
  features/
    learning/     evaluateMove, moveTask (scala degli aiuti), sessionBuilder
    memory/       scheduler (ts-fsrs), rating (regole di valutazione)
    adaptation/   difficulty (livello adattivo)
    onboarding/   scelta degli esercizi di valutazione
    progress/     stats (Progressi), streak
  data/exercises/ concetti ed esercizi (dataset)
  db/             schema e database Dexie
  services/       progress (scritture), backup (export/import/reset), mistakes (errori delle partite),
                  gameImport (Lichess / Chess.com), supabase (client facoltativo)
  features/engine/   Stockfish in un Web Worker, lettura dell'output UCI, classificazione degli errori
  features/mistakes/ PGN e ricerca degli errori, editor della posizione (FEN)
  features/account/  AccountProvider (sessione e sincronizzazione), tabelle Supabase
supabase/migrations/ tabelle e regole RLS per gli account
scripts/copy-engine.mjs  copia Stockfish da node_modules a public/engine (postinstall)
scripts/yolo/            addestramento ed esportazione ONNX del modello YOLO dei pezzi
  features/vision/   geometria (omografia, incroci), YOLO (onnxruntime-web), evidenza per casa, lettura ibrida
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
| onnxruntime-web (YOLO sul dispositivo, MIT) | 1.31.1 |
| vite-plugin-pwa | 2.0.0 |
| vitest | 5.1.0 |
| @testing-library/react | 16.3.3 |
| @playwright/test | 1.65.0 |

Le versioni esatte sono fissate in `package-lock.json`.

## Limitazioni note

- Senza account i dati non sono sincronizzati tra dispositivi. Con l'account le preferenze si sincronizzano da sole; i progressi si salvano e ripristinano nel cloud con un comando esplicito (l'ultimo salvataggio sostituisce il precedente, non c'è unione automatica). Le foto degli errori non vanno nel cloud.
- Le foto degli errori delle partite non vengono riconosciute automaticamente: la posizione si dispone a mano accanto alla foto (il riconoscimento c'è solo in «Analizza»).
- Il modello YOLO incluso è preciso sulla scacchiera con cui è stato addestrato ma debole su pezzi molto diversi (sbaglia colore e tipo): in quei casi la lettura passa a Claude. Per migliorarlo vanno etichettate e aggiunte foto della propria scacchiera.
- Stockfish *lite* è molto più forte di qualunque giocatore umano, ma più debole della versione completa; le analisi sono a profondità fissa.
- La libreria contiene 21 concetti: una volta studiati tutti, gli allenamenti sono fatti di soli ripassi.
- La valutazione delle mosse si basa sul dataset curato (mossa preferita + alternative), non su un motore: una mossa buona ma non elencata viene segnalata come «non è l'idea dell'esercizio».
- Interfaccia e contenuti sono solo in italiano.
- `npm audit` segnala vulnerabilità moderate in dipendenze usate solo in fase di build (catena di `vite-plugin-pwa`/workbox); non finiscono nel bundle servito agli utenti.

## Sviluppi futuri (non implementati)

**Nessuna di queste funzioni è presente nell'app**: riconoscimento automatico dei pezzi nelle foto degli errori, foto degli errori nel cloud (Supabase Storage), sincronizzazione continua dei progressi tra dispositivi, spiegazioni generate da un modello tramite backend sicuro. Foto e motore sono pensati solo per lo studio dopo la partita, non per assistenza durante partite in corso.
