import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CANDIDATE_TONES, CandidateMoves, type Candidate } from '../components/analyze/CandidateMoves';
import { BoardOverlay } from '../components/vision/BoardOverlay';
import { MoveFeedbackCard } from '../components/analyze/MoveFeedbackCard';
import { WinningLineCard } from '../components/analyze/WinningLineCard';
import { ApiKeyForm } from '../components/assistant/ApiKeyForm';
import { BoardEditor } from '../components/chess/BoardEditor';
import { ChessBoard, type BoardArrow } from '../components/chess/ChessBoard';
import { LineViewer, playLine } from '../components/mistakes/LineViewer';
import { Button } from '../components/ui/Button';
import { Card, PageTitle, SectionTitle } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { SpeakButton } from '../components/ui/SpeakButton';
import type { Profile } from '../db/schema';
import { judgeMove, type MoveFeedback } from '../features/analysis/moveCoach';
import { tutorSpeech, type TutorMove } from '../features/analysis/tutor';
import { winningLine } from '../features/analysis/winningLine';
import { gridToPlacement, isBoardView, nextView, placementToRanks, ranksToGrid, type BoardView } from '../features/assistant/boardReading';
import { inferTurn, resolveReading } from '../features/assistant/boardResolve';
import { gridEvidence, informative } from '../features/vision/evidence';
import {
  AssistantError,
  explainPosition,
  getApiKey,
  readBoardFromImage,
  setFastMode,
  useApiKey,
  useAssistantUsage,
  useFastMode,
  type BoardReading,
} from '../features/assistant/claude';
import { ANALYSIS_DEPTH, getEngine, terminalAnalysis, type Analysis } from '../features/engine/engine';
import { formatScore } from '../features/engine/uci';
import { fenToPosition, positionToFen, startPosition, validatePosition, type EditorPosition } from '../features/mistakes/position';
import { t } from '../i18n';
import type { Side, Uci } from '../types';
import { fromCrop, toCrop, type Corners, type Rect } from '../features/vision/geometry';
import { analyzeImage, localBoardReading, resolveLocal, trustLocal, type VisionResult } from '../features/vision/hybrid';
import { loadDetector, useDetectorStatus } from '../features/vision/pieceDetector';
import { loadCalibration, saveCalibration } from '../features/vision/calibration';
import { cellChanges, changesBySquare, inferMove } from '../features/vision/localMove';
import { captureFrame, frameDifference, frameSignature, MOTION, sampleSquares } from '../utils/frames';
import { prepareImage, READING_PHOTO_SIDE } from '../utils/image';
import { formatLine, localSquares, sanToLocal, setFlippedSquares } from '../utils/notation';
import { setVoiceEnabled, speak, speechSupported, stopSpeaking } from '../features/voice/speech';

/** Analisi continua: ogni quanto si controlla se la scacchiera si muove (nessun costo, è locale). */
const SAMPLE_MS = 400;
/** Campioni fermi consecutivi prima di rileggere (~0,8 s dopo che la mano si è tolta). */
const STILL_SAMPLES = 2;
/** Intervallo minimo tra due letture con Claude. */
const MIN_READ_GAP_MS = 1500;

interface HistoryEntry {
  /** Mosse in SAN inglese (si traducono quando si mostrano, con la numerazione scelta). */
  sans: string[];
  /** local = riconosciuta sul dispositivo (case cambiate o YOLO), claude = letta da Claude. */
  source: 'local' | 'claude';
  /** Posizione prima della mossa: serve a rileggere se la mossa era sbagliata. */
  before: EditorPosition;
}

type Phase<T> = { status: 'idle' } | { status: 'busy' } | { status: 'done'; value: T } | { status: 'error'; error: string };

const VIEW_KEY = 'cm.analyze.view';
const PRACTICE_KEY = 'cm.analyze.practice';
const TUTOR_MODE_KEY = 'cm.analyze.tutorMode';
const FLIP_SQUARES_KEY = 'cm.analyze.flipSquares';

/** video = osserva di continuo la scacchiera; photo = legge solo quando scatti una foto dopo ogni mossa. */
type TutorMode = 'video' | 'photo';

function loadPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function savePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // preferenza non salvata: vale solo per questa pagina
  }
}

function errorText(error: unknown): string {
  const kind = error instanceof AssistantError ? error.kind : 'other';
  return t.analyze.errors[kind] ?? t.analyze.errors.other!;
}

export function AnalyzePage({ profile }: { profile: Profile }) {
  const apiKey = useApiKey();
  const fast = useFastMode();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [reading, setReading] = useState<Phase<BoardReading>>({ status: 'idle' });
  const [position, setPosition] = useState<EditorPosition | null>(null);
  const [flipped, setFlipped] = useState(false);
  // Con che colore gioca l'utente: dedotto dal lato da cui è scattata la foto, o scelto a mano.
  const [myColor, setMyColorState] = useState<Side>('w');
  const [colorSource, setColorSource] = useState<'default' | 'photo' | 'user'>('default');
  const [analysis, setAnalysis] = useState<Phase<Analysis>>({ status: 'idle' });
  const [explanation, setExplanation] = useState<Phase<string>>({ status: 'idle' });
  // Modalità tutor: osserva di continuo la scacchiera e dice (a voce) la mossa migliore.
  const [live, setLive] = useState(false);
  const [tutorText, setTutorText] = useState('');
  // Numerazione invertita: il Nero sta sulle righe 1-2 della scacchiera fisica.
  const [flipSquares, setFlipSquares] = useState(() => loadPref(FLIP_SQUARES_KEY) === '1');
  // Vale già per questo render (anche per le scacchiere e le liste dei figli); si spegne lasciando la pagina.
  setFlippedSquares(flipSquares);
  useEffect(() => {
    setFlippedSquares(flipSquares);
    return () => setFlippedSquares(false);
  }, [flipSquares]);
  const flipSquaresRef = useRef(flipSquares);
  flipSquaresRef.current = flipSquares;
  const [tutorMode, setTutorModeState] = useState<TutorMode>(() => (loadPref(TUTOR_MODE_KEY) === 'photo' ? 'photo' : 'video'));
  /** Modalità foto: l'ultima foto non mostrava mosse nuove. */
  const [noChange, setNoChange] = useState(false);
  const usage = useAssistantUsage();
  const liveRef = useRef(false);
  liveRef.current = live;
  /** Mossa che ha portato alla posizione in analisi, con l'analisi di prima (per il giudizio del tutor). */
  const pendingMove = useRef<{ move: TutorMove; previous: Analysis | null } | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [liveState, setLiveState] = useState<'watching' | 'moving'>('watching');
  // Lettura che non corrisponde a nessuna mossa legale: va confermata da una seconda lettura prima che il tutor ne parli.
  const [verifying, setVerifying] = useState(false);
  const unconfirmed = useRef<string | null>(null);
  const detector = useDetectorStatus();
  const detectorReady = useRef(false);
  detectorReady.current = detector === 'ready';
  const [readSeconds, setReadSeconds] = useState<number | null>(null);
  const [videoAspect, setVideoAspect] = useState(4 / 3);
  const [viewPref, setViewPref] = useState<BoardView | 'auto'>(() => {
    const saved = loadPref(VIEW_KEY);
    return isBoardView(saved) ? saved : 'auto';
  });
  // Angoli della scacchiera nell'inquadratura (frazioni del fotogramma).
  const [corners, setCornersState] = useState<Corners | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  // Allenamento: i suggerimenti restano nascosti finché l'utente non prova una mossa.
  const [practice, setPractice] = useState(() => loadPref(PRACTICE_KEY) === '1');
  const [revealed, setRevealed] = useState(false);
  const [tried, setTried] = useState<Phase<MoveFeedback>>({ status: 'idle' });
  const [variation, setVariation] = useState<number | 'win' | null>(null);
  const lastSample = useRef<Uint8Array | null>(null);
  const readSignature = useRef<Uint8Array | null>(null);
  /** Colori delle case nel fotogramma della posizione attuale (per riconoscere la mossa senza Claude). */
  const snapshot = useRef<Float32Array | null>(null);
  const stillCount = useRef(0);
  const lastReadAt = useRef(0);
  const busy = useRef(false);
  const lastPlacement = useRef<string | null>(null);
  const lastRaw = useRef<string | null>(null);
  const lastView = useRef<BoardView | null>(null);
  /** true se la posizione è stata corretta a mano: una lettura sbagliata non deve cancellarla. */
  const userEdited = useRef(false);
  const cornersByUser = useRef(false);
  const cornersRef = useRef<Corners | null>(null);
  const evalId = useRef(0);
  const positionRef = useRef<EditorPosition | null>(null);
  positionRef.current = position;
  const viewPrefRef = useRef(viewPref);
  viewPrefRef.current = viewPref;
  const myColorRef = useRef(myColor);
  const colorSourceRef = useRef(colorSource);

  const chooseColor = useCallback((color: Side, source: 'photo' | 'user') => {
    myColorRef.current = color;
    colorSourceRef.current = source;
    setMyColorState(color);
    setColorSource(source);
    // Le proprie pezzi in basso.
    setFlipped(color === 'b');
  }, []);

  const setCorners = useCallback((next: Corners | null) => {
    cornersRef.current = next;
    setCornersState(next);
  }, []);

  // ───── Fotocamera ─────
  const startCamera = async () => {
    setCameraError(false);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      setStream(media);
      // Il modello YOLO (se installato) si carica intanto, così è pronto alla prima mossa.
      void loadDetector();
    } catch {
      setCameraError(true);
    }
  };

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setLive(false);
    stopSpeaking();
    setCorners(null);
    snapshot.current = null;
  }, [stream, setCorners]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [stream]);

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  /** Spiegazione di Claude per la posizione analizzata (breve nella modalità tutor). */
  const runExplanation = useCallback(
    async (pos: EditorPosition, result: Analysis, id: number, brief: boolean) => {
      if (!apiKey) return;
      const fen = result.fen;
      setExplanation({ status: 'busy' });
      try {
        const text = await explainPosition({
          fen,
          evaluation: formatScore(result.score, pos.turn === 'w'),
          // A Claude le mosse con i nomi veri delle case (come nella FEN); la risposta si rinomina dopo.
          lines: result.lines.map((line) => formatLine(playLine(fen, line.pv.slice(0, brief ? 6 : 8)), false)),
          playerSide: myColorRef.current,
          brief,
        });
        if (id !== evalId.current) return;
        setExplanation({ status: 'done', value: text });
        if (liveRef.current) speak(localSquares(text), 'tutor');
      } catch (error) {
        if (id === evalId.current) setExplanation({ status: 'error', error: errorText(error) });
      }
    },
    [apiKey],
  );

  // ───── Valutazione: Stockfish, poi (quando tocca a te) la spiegazione di Claude ─────
  const evaluate = useCallback(
    async (pos: EditorPosition) => {
      if (validatePosition(pos)) {
        setAnalysis({ status: 'idle' });
        return;
      }
      const id = ++evalId.current;
      const fen = positionToFen(pos);
      setAnalysis({ status: 'busy' });
      setExplanation({ status: 'idle' });
      setTried({ status: 'idle' });
      setVariation(null);
      setRevealed(false);
      let result: Analysis;
      try {
        result = terminalAnalysis(fen) ?? (await getEngine().analyse(fen, { depth: ANALYSIS_DEPTH[profile.settings.analysisDepth], multiPv: 3 }));
        // Una lettura più recente ha già sostituito questa: il risultato non serve più.
        if (id !== evalId.current) return;
        setAnalysis({ status: 'done', value: result });
      } catch {
        if (id === evalId.current) setAnalysis({ status: 'error', error: t.analyze.errors.engine! });
        return;
      }
      // La spiegazione riguarda la propria mossa: quando tocca all'avversario non serve (e non costa).
      // Nella modalità tutor arriva solo se la chiedi («Perché?»): il tutor parla già da solo, senza token.
      if (result.lines.length === 0 || pos.turn !== myColorRef.current || liveRef.current) return;
      await runExplanation(pos, result, id, false);
    },
    [runExplanation, profile.settings.analysisDepth],
  );

  // ───── Lettura della scacchiera con Claude ─────
  const read = useCallback(
    async (image: string, rect: Rect | null, auto: boolean, fromCamera: boolean, localGuess: string | null = null) => {
      if (busy.current) return;
      busy.current = true;
      setReading({ status: 'busy' });
      const started = performance.now();
      try {
        // La posizione già nota (magari corretta a mano) permette di scartare le letture impossibili:
        // tra due letture di solito è cambiata una sola mossa.
        const known = positionRef.current && !validatePosition(positionRef.current) ? positionRef.current : null;
        const forced = viewPrefRef.current === 'auto' ? null : viewPrefRef.current;
        const reference = fromCamera && known ? { fen: positionToFen(known), locked: userEdited.current } : null;
        // 1. Visione locale (angoli rifiniti + YOLO), se la scacchiera è già stata trovata.
        const quad = fromCamera && rect && cornersRef.current ? toCrop(rect, cornersRef.current) : null;
        let vision: VisionResult | null = null;
        if (quad) {
          try {
            vision = await analyzeImage(image, quad);
          } catch {
            vision = null;
          }
        }
        // YOLO vede pochi dei pezzi che ci sono (pezzi diversi da quelli dell'addestramento, luce…):
        // la sua lettura quasi vuota non conta, né per le regole né come indizio per Claude.
        const expected = known ? Object.keys(known.placement).length : 0;
        if (vision?.evidence && known && !informative(vision.evidence, expected)) vision = { ...vision, evidence: null };
        // 2. Se YOLO e le regole bastano, niente Claude: zero token e risposta immediata.
        let result: BoardReading | null = null;
        if (vision?.evidence) {
          const local = resolveLocal({
            evidence: vision.evidence,
            reference,
            forcedView: forced,
            lastView: lastView.current,
            lastRawPlacement: lastRaw.current,
          });
          // La mossa vista confrontando le case e confermata da YOLO vale anche con qualche casa incerta.
          const agrees = localGuess !== null && local.placement === localGuess && (local.fitCost ?? Infinity) <= 1.5;
          if (trustLocal(local, vision.evidence) || agrees) result = localBoardReading(local, vision.evidence, vision.corners);
        } else if (localGuess && reference && lastView.current) {
          // YOLO non aiuta su questa scena: vale la mossa vista confrontando le case, come senza modello.
          const guessGrid = ranksToGrid(placementToRanks(localGuess), lastView.current);
          const guessed = resolveReading({
            grid: guessGrid,
            claimedView: lastView.current,
            forcedView: lastView.current,
            reference,
          });
          if (guessed.moves.length > 0 && guessed.corrected.length === 0) {
            result = localBoardReading(guessed, gridEvidence(guessGrid), vision?.corners ?? quad);
          }
        }
        // 3. Altrimenti Claude, con la lettura di YOLO come indizio e fusa casa per casa.
        if (!result) {
          if (!getApiKey()) throw new AssistantError('no-key');
          result = await readBoardFromImage(image, {
            reference,
            view: forced,
            lastView: lastView.current,
            lastRawPlacement: lastRaw.current,
            vision,
            flippedCoordinates: flipSquaresRef.current,
            analyze: vision ? undefined : (found) => analyzeImage(image, found),
          });
        }
        setReadSeconds((performance.now() - started) / 1000);
        setReading({ status: 'done', value: result });
        setLastUpdate(Date.now());
        lastRaw.current = result.rawPlacement;
        lastView.current = result.view;
        // Angoli della scacchiera: servono al ritaglio delle prossime foto e alle mosse viste senza Claude.
        if (fromCamera && rect && result.corners && !cornersByUser.current) {
          const mapped = result.corners.map((p) => fromCrop(rect, p)) as Corners;
          const before = cornersRef.current;
          setCorners(mapped);
          const video = videoRef.current;
          // Griglia spostata (rifinita con gli incroci): i colori delle case vanno ricampionati.
          const moved = !before || mapped.some((p, k) => Math.hypot(p.x - before[k]!.x, p.y - before[k]!.y) > 0.004);
          if (video && (!snapshot.current || moved)) snapshot.current = sampleSquares(video, mapped);
        }
        // Chi sei: dal lato del Bianco sei il Bianco, dal lato del Nero sei il Nero.
        if (colorSourceRef.current !== 'user' && (result.view === 'bottom' || result.view === 'top')) {
          chooseColor(result.view === 'bottom' ? 'w' : 'b', 'photo');
        }
        if (auto && result.placement === lastPlacement.current) {
          unconfirmed.current = null;
          setVerifying(false);
          setNoChange(true);
          return;
        }
        // Nel tutor una lettura che nessuna mossa legale spiega (pezzo urtato, mano, riflesso…)
        // non sostituisce subito la posizione: si rilegge e la si accetta solo se è confermata.
        if (auto && fromCamera && known && result.moves.length === 0 && !result.turnKnown && unconfirmed.current !== result.placement) {
          unconfirmed.current = result.placement;
          setVerifying(true);
          window.setTimeout(() => {
            if (liveRef.current) captureAndReadRef.current(true);
          }, MIN_READ_GAP_MS);
          return;
        }
        unconfirmed.current = null;
        setVerifying(false);
        setNoChange(false);
        const changed = lastPlacement.current !== null && result.placement !== lastPlacement.current;
        lastPlacement.current = result.placement;
        const previous = positionRef.current;
        // Tratto: quello dedotto dalla mossa riconosciuta; poi quello visto da Claude; poi, in analisi
        // continua, l'alternanza; infine quello che rende possibile la posizione (re sotto scacco).
        const guessed: Side =
          result.sideToMove !== 'unknown' ? result.sideToMove : auto && changed && previous ? (previous.turn === 'w' ? 'b' : 'w') : (previous?.turn ?? 'w');
        const turn: Side = result.turnKnown ? guessed : inferTurn(result.placement, guessed);
        // Posizione raggiunta con mosse legali: si tiene la FEN vera (arrocchi già persi, en passant).
        const next = (result.turnKnown && result.fen ? fenToPosition(result.fen) : null) ?? fenToPosition(`${result.placement} ${turn} KQkq`) ?? startPosition();
        if (fromCamera && previous && result.moves.length > 0) {
          const source = result.source === 'local' ? 'local' : 'claude';
          setHistory((h) => [...h, { sans: result.moves, source, before: previous }]);
          const lastSan = result.moves[result.moves.length - 1]!;
          pendingMove.current = {
            move: { san: lastSan, color: next.turn === 'w' ? 'b' : 'w' },
            previous: result.moves.length === 1 && doneRef.current?.fen === positionToFen(previous) ? doneRef.current : null,
          };
        } else {
          pendingMove.current = null;
        }
        userEdited.current = false;
        setPosition(next);
        // Subito le mosse migliori sulla scacchiera: l'utente può comunque correggere i pezzi.
        void evaluate(next);
      } catch (error) {
        setReading({ status: 'error', error: errorText(error) });
        if (auto) setLive(false);
      } finally {
        busy.current = false;
      }
    },
    [evaluate, chooseColor, setCorners],
  );

  const captureAndRead = useCallback(
    (auto: boolean, localGuess: string | null = null) => {
      const video = videoRef.current;
      if (!video || busy.current) return;
      const frame = captureFrame(video, cornersRef.current);
      if (!frame) return;
      readSignature.current = frameSignature(video);
      snapshot.current = cornersRef.current ? sampleSquares(video, cornersRef.current) : null;
      lastReadAt.current = Date.now();
      void read(frame.data, frame.rect, auto, true, localGuess);
    },
    [read],
  );
  const captureAndReadRef = useRef(captureAndRead);
  captureAndReadRef.current = captureAndRead;

  /**
   * Prova a riconoscere la mossa confrontando le case con il fotogramma della
   * posizione precedente, senza chiamare Claude. Restituisce false se non è sicuro.
   */
  const tryLocalMove = useCallback(
    (signature: Uint8Array): boolean | 'none' => {
      const video = videoRef.current;
      const quad = cornersRef.current;
      const before = snapshot.current;
      const view = lastView.current;
      const pos = positionRef.current;
      if (!video || !quad || !before || !view || !pos || validatePosition(pos)) return false;
      const now = sampleSquares(video, quad);
      if (!now) return false;
      const result = inferMove(positionToFen(pos), changesBySquare(cellChanges(before, now), view));
      if (result.kind === 'unsure') return false;
      if (result.kind === 'move' && detectorReady.current) {
        // Con YOLO disponibile la mossa vista dai colori delle case viene verificata sui pezzi
        // (sul dispositivo, senza costi) prima che il tutor ne parli.
        captureAndRead(true, result.fen.split(' ')[0] ?? null);
        return true;
      }
      snapshot.current = now;
      readSignature.current = signature;
      if (result.kind === 'none') return 'none';
      const next = fenToPosition(result.fen);
      if (!next) return false;
      setHistory((h) => [...h, { sans: [result.san], source: 'local', before: pos }]);
      pendingMove.current = {
        move: { san: result.san, color: pos.turn },
        previous: doneRef.current?.fen === positionToFen(pos) ? doneRef.current : null,
      };
      lastPlacement.current = result.fen.split(' ')[0] ?? null;
      lastRaw.current = null;
      userEdited.current = false;
      setNoChange(false);
      positionRef.current = next;
      setPosition(next);
      setLastUpdate(Date.now());
      void evaluate(next);
      return true;
    },
    [evaluate, captureAndRead],
  );

  /** L'ultima mossa vista è sbagliata: si torna alla posizione prima e Claude rilegge la scacchiera. */
  const rereadLast = () => {
    const last = history[history.length - 1];
    if (last) {
      setHistory((h) => h.slice(0, -1));
      positionRef.current = last.before;
      setPosition(last.before);
      lastPlacement.current = null;
    }
    captureAndRead(true);
  };

  const recalibrate = () => {
    cornersByUser.current = false;
    unconfirmed.current = null;
    setVerifying(false);
    setCorners(null);
    snapshot.current = null;
    captureAndRead(live);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const image = await prepareImage(file, READING_PHOTO_SIDE);
      void read(image.dataUrl.split(',')[1] ?? '', null, false, false);
    } catch {
      setReading({ status: 'error', error: t.analyze.errors.unreadable! });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  /** Cambia l'orientamento della foto e rilegge la stessa griglia (senza chiamare Claude). */
  const changeView = (choice: BoardView | 'auto') => {
    setViewPref(choice);
    savePref(VIEW_KEY, choice);
    if (choice === 'auto') return;
    lastView.current = choice;
    if (colorSourceRef.current !== 'user' && (choice === 'bottom' || choice === 'top')) chooseColor(choice === 'bottom' ? 'w' : 'b', 'photo');
    if (reading.status !== 'done') return;
    const placement = gridToPlacement(reading.value.grid, choice);
    if (!placement) return;
    const turn = inferTurn(placement, positionRef.current?.turn ?? 'w');
    const next = fenToPosition(`${placement} ${turn} KQkq`) ?? startPosition();
    lastPlacement.current = placement;
    lastRaw.current = placement;
    userEdited.current = false;
    setReading({ status: 'done', value: { ...reading.value, view: choice, placement, rawPlacement: placement, corrected: [], moves: [], fen: null } });
    setPosition(next);
    void evaluate(next);
  };

  const togglePractice = (on: boolean) => {
    setPractice(on);
    savePref(PRACTICE_KEY, on ? '1' : '0');
    setRevealed(false);
    setTried({ status: 'idle' });
  };

  const swapTurn = () => {
    if (!position) return;
    const next: EditorPosition = { ...position, turn: position.turn === 'w' ? 'b' : 'w' };
    setPosition(next);
    void evaluate(next);
  };

  const pickColor = (color: Side) => {
    chooseColor(color, 'user');
    // Ora le mosse consigliate (e la spiegazione) riguardano l'altro colore.
    if (positionRef.current && !validatePosition(positionRef.current)) void evaluate(positionRef.current);
  };

  // ───── Analisi continua ─────
  // Una miniatura locale controlla di continuo se la scacchiera si muove. Appena la mano
  // si toglie e qualcosa è cambiato: prima si prova a riconoscere la mossa confrontando
  // le case (istantaneo, senza costi); solo se il risultato è dubbio si chiama Claude.
  useEffect(() => {
    if (!live || !stream || tutorMode !== 'video') return;
    lastSample.current = null;
    stillCount.current = 0;
    setLiveState('watching');
    if (!positionRef.current || !snapshot.current) captureAndRead(true);
    const id = window.setInterval(() => {
      const video = videoRef.current;
      const sample = video ? frameSignature(video) : null;
      if (!sample) return;
      const previous = lastSample.current;
      lastSample.current = sample;
      if (!previous) return;
      const motion = frameDifference(previous, sample);
      if (motion > MOTION.moving) {
        stillCount.current = 0;
        setLiveState('moving');
        return;
      }
      if (motion >= MOTION.still) return;
      stillCount.current += 1;
      if (stillCount.current < STILL_SAMPLES) return;
      setLiveState('watching');
      if (busy.current) return;
      if (readSignature.current && frameDifference(readSignature.current, sample) < MOTION.changed) return;
      if (tryLocalMove(sample)) return;
      if (Date.now() - lastReadAt.current < MIN_READ_GAP_MS) return;
      captureAndRead(true);
    }, SAMPLE_MS);
    return () => window.clearInterval(id);
  }, [live, stream, tutorMode, captureAndRead, tryLocalMove]);

  /**
   * Modalità foto: un solo fotogramma per mossa, quando lo decide l'utente.
   * Come nel video, prima il confronto delle case (gratis), poi YOLO/Claude solo se serve.
   */
  const shootPhoto = () => {
    if (busy.current) return;
    setNoChange(false);
    const video = videoRef.current;
    const sample = video ? frameSignature(video) : null;
    if (sample && positionRef.current && snapshot.current) {
      if (readSignature.current && frameDifference(readSignature.current, sample) < MOTION.changed) {
        setNoChange(true);
        return;
      }
      const local = tryLocalMove(sample);
      if (local === 'none') {
        setNoChange(true);
        return;
      }
      if (local) return;
    }
    captureAndRead(true);
  };

  const chooseTutorMode = (mode: TutorMode) => {
    setTutorModeState(mode);
    savePref(TUTOR_MODE_KEY, mode);
  };

  const positionError = position ? validatePosition(position) : null;
  const fen = position && !positionError ? positionToFen(position) : null;
  // Il risultato vale solo per la posizione attuale (la scacchiera può cambiare mentre il motore lavora).
  const done = analysis.status === 'done' && analysis.value.fen === fen ? analysis.value : null;
  const showBoard = fen !== null && (done !== null || analysis.status === 'busy');
  const myTurn = position?.turn === myColor;
  const candidates = useMemo<Candidate[]>(
    () => (done && fen ? done.lines.slice(0, 3).map((line) => ({ line, moves: playLine(fen, line.pv.slice(0, 8)) })) : []),
    [done, fen],
  );
  const win = useMemo(() => (done && fen ? winningLine(fen, done.lines[0]) : null), [done, fen]);
  const best = candidates[0]?.moves[0];
  const turnName = position ? t.sides[position.turn] : '';
  const evalText = done && position ? formatScore(done.score, position.turn === 'w') : '';
  const verdict = best ? `${t.analyze.bestMove}: ${sanToLocal(best.san)}. ${t.analyze.evaluation}: ${evalText}.` : '';
  const showSuggestions = myTurn && (!practice || revealed || tried.status === 'done');
  const variationLine = useMemo<Uci[]>(() => {
    if (variation === 'win') return win?.moves.map((m) => m.uci) ?? [];
    if (variation !== null && done) return done.lines[variation]?.pv.slice(0, 10) ?? [];
    return [];
  }, [variation, done, win]);
  const doneRef = useRef<Analysis | null>(null);
  doneRef.current = done;

  // Il tutor parla a ogni nuova posizione analizzata: frase costruita sul dispositivo, zero token.
  const spokenFor = useRef<Analysis | null>(null);
  useEffect(() => {
    if (!live || !done || !fen || spokenFor.current === done) return;
    spokenFor.current = done;
    const pending = pendingMove.current;
    pendingMove.current = null;
    const text = tutorSpeech({
      fen,
      analysis: done,
      myColor,
      lastMove: pending?.move ?? null,
      previous: pending?.previous ?? null,
      hideBest: practice,
    });
    setTutorText(text);
    speak(text, 'tutor');
  }, [live, done, fen, myColor, practice]);

  const startTutor = () => {
    pendingMove.current = null;
    spokenFor.current = null;
    setTutorText('');
    setNoChange(false);
    // Il tutor parla: se la voce era spenta la si accende (si spegne dall'altoparlante in alto).
    if (speechSupported()) setVoiceEnabled(true);
    setLive(true);
    // In modalità foto la prima foto si scatta subito: è la posizione di partenza.
    if (tutorMode === 'photo') captureAndRead(true);
  };

  const stopTutor = () => {
    setLive(false);
    stopSpeaking();
  };

  /** «Perché?»: spiegazione breve di Claude, solo su richiesta (è l'unica parte del tutor che costa token). */
  const askWhy = () => {
    const pos = positionRef.current;
    const current = doneRef.current;
    if (pos && current) void runExplanation(pos, current, evalId.current, true);
  };
  const localMoves = history.filter((h) => h.source === 'local').length;

  const arrows = useMemo<BoardArrow[]>(() => {
    const out: BoardArrow[] = [];
    if (!myTurn) {
      // Turno dell'avversario: la sua mossa più pericolosa, in rosso.
      if (best) out.push({ from: best.from, to: best.to, tone: 'bad' });
      return out;
    }
    if (showSuggestions) {
      candidates.forEach((candidate, index) => {
        const move = candidate.moves[0];
        if (move) out.push({ from: move.from, to: move.to, tone: CANDIDATE_TONES[index] ?? 'third' });
      });
    }
    if (tried.status === 'done') {
      const from = tried.value.uci.slice(0, 2);
      const to = tried.value.uci.slice(2, 4);
      const index = out.findIndex((a) => a.from === from && a.to === to);
      if (index >= 0) out.splice(index, 1);
      out.push({ from, to, tone: tried.value.grade === 'best' || tried.value.grade === 'good' ? 'good' : 'bad' });
    }
    return out;
  }, [best, candidates, myTurn, showSuggestions, tried]);

  /** L'utente prova una mossa sulla scacchiera: Stockfish la giudica. */
  const tryMove = async (uci: Uci) => {
    const current = doneRef.current;
    if (!current) return;
    setTried({ status: 'busy' });
    try {
      const feedback = await judgeMove(current, uci, getEngine(), ANALYSIS_DEPTH[profile.settings.analysisDepth]);
      if (doneRef.current !== current) return;
      setTried(feedback ? { status: 'done', value: feedback } : { status: 'idle' });
    } catch {
      if (doneRef.current === current) setTried({ status: 'error', error: t.analyze.errors.engine! });
    }
  };

  const fixPieces = () => {
    setAnalysis({ status: 'idle' });
    setVariation(null);
    setTried({ status: 'idle' });
  };

  // Stato dell'analisi continua, in una frase.
  const bestLocal = best ? sanToLocal(best.san) : '';
  const banner =
    reading.status === 'busy'
      ? { text: t.analyze.live.banner.reading, tone: 'neutral' }
      : verifying
        ? { text: t.analyze.live.banner.verifying, tone: 'neutral' }
        : noChange && tutorMode === 'photo'
          ? { text: t.analyze.live.banner.noChange, tone: 'neutral' }
            : liveState === 'moving' && tutorMode === 'video'
            ? { text: t.analyze.live.banner.moving, tone: 'neutral' }
            : !position
              ? { text: t.analyze.live.banner.waiting, tone: 'neutral' }
              : analysis.status === 'busy'
                ? { text: t.analyze.live.banner.thinking, tone: 'neutral' }
                : myTurn
                  ? { text: tutorText || (bestLocal ? t.analyze.live.banner.mine(bestLocal) : t.analyze.live.banner.mineNoMove), tone: 'mine' }
                  : { text: tutorText || t.analyze.live.banner.theirs, tone: 'theirs' };
  const tutorSpeaking = banner.tone === 'mine' || banner.tone === 'theirs';
  const winExtra = win?.kind === 'mate' ? t.analyze.win.mate(win.mateIn ?? 1) : win?.kind === 'check' ? t.analyze.win.check(win.checkIn ?? 1) : '';

  return (
    <div className="space-y-5">
      <header>
        <PageTitle>{t.analyze.title}</PageTitle>
        <p className="mt-1.5 text-lg text-muted">{t.analyze.intro}</p>
      </header>

      {!apiKey && (
        <Card>
          <SectionTitle>{t.analyze.key.title}</SectionTitle>
          <p className="mt-1 mb-3">{t.analyze.key.needed}</p>
          <ApiKeyForm />
        </Card>
      )}

      {live && (
        <div
          role="status"
          data-testid="live-banner"
          data-tone={banner.tone}
          className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 px-4 py-3 ${
            banner.tone === 'mine' ? 'border-ok bg-ok-soft' : banner.tone === 'theirs' ? 'border-line bg-surface-2' : 'border-line bg-surface'
          }`}
        >
          <span className={`font-display text-xl font-semibold ${banner.tone === 'mine' ? 'text-ok' : ''}`}>{banner.text}</span>
          {tutorSpeaking && (
            <span className="flex flex-wrap gap-2">
              {tutorText && (
                <Button variant="secondary" size="sm" icon={<Icon name="speaker" size={16} />} onClick={() => speak(tutorText, 'tutor')} data-testid="tutor-repeat">
                  {t.analyze.live.repeat}
                </Button>
              )}
              {banner.tone === 'mine' && !practice && apiKey && best && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Icon name="chat" size={16} />}
                  onClick={askWhy}
                  disabled={explanation.status === 'busy'}
                  data-testid="tutor-why"
                >
                  {explanation.status === 'busy' ? t.analyze.explaining : t.analyze.live.why}
                </Button>
              )}
            </span>
          )}
          {explanation.status === 'done' && banner.tone === 'mine' && (
            <p className="w-full text-base" data-testid="tutor-explanation">
              {localSquares(explanation.value)}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface-2">
            {stream ? (
              <div className="relative w-full bg-black" style={{ aspectRatio: videoAspect }}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    if (!v.videoWidth || !v.videoHeight) return;
                    const ratio = v.videoWidth / v.videoHeight;
                    setVideoAspect(ratio);
                    // Calibrazione salvata (stessa fotocamera, non spostata): la griglia è già al suo posto.
                    const saved = cornersRef.current ? null : loadCalibration(ratio);
                    if (saved) {
                      cornersByUser.current = true;
                      setCorners(saved);
                    }
                  }}
                  className="absolute inset-0 size-full object-contain"
                  data-testid="camera-video"
                />
                {corners ? (
                  <BoardOverlay
                    corners={corners}
                    view={viewPref === 'auto' ? (reading.status === 'done' ? reading.value.view : null) : viewPref}
                    onChangeEnd={(next) => saveCalibration(next, videoAspect)}
                    onChange={(next) => {
                      cornersByUser.current = true;
                      setCorners(next);
                      // La griglia è cambiata: il confronto delle case riparte da qui.
                      const video = videoRef.current;
                      snapshot.current = video ? sampleSquares(video, next) : null;
                    }}
                  />
                ) : (
                  <>
                    {/* Guida: alla prima lettura viene inviato solo il quadrato centrale. */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute top-0 left-1/2 aspect-square h-full -translate-x-1/2 rounded-md border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                    />
                    <p className="absolute inset-x-0 bottom-1 text-center text-xs font-semibold text-white drop-shadow">{t.analyze.camera.guide}</p>
                  </>
                )}
              </div>
            ) : (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 p-4 text-center text-muted">
                <Icon name="camera" size={40} />
                <p className="text-sm">{t.analyze.camera.tip}</p>
              </div>
            )}
          </div>
          {stream && corners && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-muted">{t.analyze.live.calibrated}</p>
              <Button variant="ghost" size="sm" onClick={recalibrate} disabled={!apiKey || reading.status === 'busy'}>
                {t.analyze.live.recalibrate}
              </Button>
            </div>
          )}
          {stream && detector !== 'idle' && (
            <p className={`text-xs ${detector === 'ready' ? 'text-ok' : 'text-muted'}`} data-testid="detector-status">
              {t.analyze.live.detector[detector]}
            </p>
          )}
          <details className="rounded-xl bg-surface-2 px-3 py-2 text-sm" data-testid="camera-tips">
            <summary className="cursor-pointer font-semibold">{t.analyze.camera.tipsTitle}</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {t.analyze.camera.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </details>
          {cameraError && (
            <p role="alert" className="text-sm font-semibold text-bad">
              {t.analyze.camera.denied}
            </p>
          )}
          {stream && apiKey && (
            <div className="space-y-2 rounded-xl border border-line p-3">
              {live ? (
                <>
                  {tutorMode === 'photo' && (
                    <Button
                      size="lg"
                      block
                      icon={<Icon name="camera" size={18} />}
                      onClick={shootPhoto}
                      disabled={reading.status === 'busy'}
                      data-testid="tutor-shoot"
                    >
                      {reading.status === 'busy' ? t.analyze.live.banner.reading : t.analyze.live.shoot}
                    </Button>
                  )}
                  <Button variant="secondary" block icon={<Icon name="stop" size={18} />} onClick={stopTutor} data-testid="live-toggle">
                    {t.analyze.live.stop}
                  </Button>
                </>
              ) : (
                <>
                  <fieldset>
                    <legend className="mb-1 text-sm font-semibold">{t.analyze.live.mode.label}</legend>
                    <div className="grid grid-cols-2 gap-2" data-testid="tutor-mode">
                      {(['video', 'photo'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={tutorMode === mode}
                          onClick={() => chooseTutorMode(mode)}
                          className={`min-h-11 rounded-xl border-2 px-3 py-1.5 text-left text-sm ${tutorMode === mode ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
                          data-testid={`tutor-mode-${mode}`}
                        >
                          <span className="block font-semibold">{t.analyze.live.mode[mode]}</span>
                          <span className="block text-xs text-muted">{t.analyze.live.mode.help[mode]}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <Button size="lg" block icon={<Icon name="play" size={18} />} onClick={startTutor} data-testid="live-toggle">
                    {t.analyze.live.start}
                  </Button>
                  <p className="text-sm font-semibold">{t.analyze.live.stepsTitle}</p>
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
                    {(tutorMode === 'photo' ? t.analyze.live.photoSteps : t.analyze.live.steps).map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </>
              )}
              {(live || usage.readings > 0) && (
                <p className="text-xs text-muted" data-testid="tutor-usage">
                  {t.analyze.live.usage(usage.readings, usage.explanations, usage.input + usage.output, usage.cached, localMoves)}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {stream ? (
              <>
                <Button
                  variant="secondary"
                  icon={<Icon name="eye" size={18} />}
                  onClick={() => captureAndRead(false)}
                  disabled={!apiKey || reading.status === 'busy'}
                  data-testid="capture-read"
                >
                  {t.analyze.camera.capture}
                </Button>
                <Button variant="ghost" onClick={stopCamera}>
                  {t.analyze.camera.stop}
                </Button>
              </>
            ) : (
              <Button icon={<Icon name="camera" size={18} />} onClick={() => void startCamera()} data-testid="camera-start">
                {t.analyze.camera.start}
              </Button>
            )}
            <Button variant="secondary" icon={<Icon name="upload" size={18} />} onClick={() => fileRef.current?.click()} disabled={!apiKey}>
              {t.analyze.camera.upload}
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => void onFile(e.target.files?.[0])} />
            {!position && (
              <Button variant="ghost" onClick={() => setPosition(startPosition())} data-testid="manual-position">
                {t.analyze.manual}
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="photo-orientation" className="block text-sm font-semibold">
                {t.analyze.orientation.label}
              </label>
              <select
                id="photo-orientation"
                value={viewPref}
                onChange={(e) => changeView(isBoardView(e.target.value) ? e.target.value : 'auto')}
                className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-semibold"
                data-testid="photo-orientation"
              >
                <option value="auto">{t.analyze.orientation.auto}</option>
                {(['bottom', 'top', 'left', 'right'] as const).map((v) => (
                  <option key={v} value={v}>
                    {t.analyze.orientation.options[v]}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex cursor-pointer items-start gap-3 pt-1">
              <input
                type="checkbox"
                checked={fast}
                onChange={(e) => setFastMode(e.target.checked)}
                className="mt-1 size-5 accent-[var(--accent)]"
                data-testid="fast-toggle"
              />
              <span>
                <span className="block text-sm font-semibold">{t.analyze.fast.label}</span>
                <span className="block text-xs text-muted">{t.analyze.fast.help}</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 pt-1 sm:col-span-2">
              <input
                type="checkbox"
                checked={flipSquares}
                onChange={(e) => {
                  setFlipSquares(e.target.checked);
                  savePref(FLIP_SQUARES_KEY, e.target.checked ? '1' : '0');
                }}
                className="mt-1 size-5 accent-[var(--accent)]"
                data-testid="flip-squares"
              />
              <span>
                <span className="block text-sm font-semibold">{t.analyze.flipSquares.label}</span>
                <span className="block text-xs text-muted">{t.analyze.flipSquares.help}</span>
              </span>
            </label>
          </div>
          <div aria-live="polite" className="space-y-1 text-sm">
            {reading.status === 'busy' && !live && <p className="font-semibold">{t.analyze.reading}</p>}
            {reading.status === 'error' && (
              <p role="alert" className="font-semibold text-bad">
                {reading.error}
              </p>
            )}
            {reading.status === 'done' && (
              <>
                <p className="font-semibold">
                  {t.analyze.confidence[reading.value.confidence]} · {t.analyze.readDone}
                  {readSeconds !== null && <span className="font-normal text-muted"> ({t.analyze.readTime(readSeconds)})</span>}
                </p>
                {reading.value.moves.length > 0 && !live && (
                  <p className="text-muted" data-testid="read-moves">
                    {t.analyze.moveFound(reading.value.moves.map((san) => sanToLocal(san)).join(' '))}
                  </p>
                )}
                {reading.value.corrected.length > 0 && (
                  <p className="text-muted" data-testid="read-corrected">
                    {t.analyze.fixed(reading.value.corrected.length, reading.value.corrected)}
                  </p>
                )}
                {reading.value.notes && <p className="text-muted">{reading.value.notes}</p>}
                {!reading.value.turnKnown && reading.value.sideToMove === 'unknown' && <p className="text-muted">{t.analyze.sideUnknown}</p>}
                <p className="flex flex-wrap items-center gap-x-3 text-muted">
                  <span>{t.analyze.orientation.detected(t.analyze.orientation.sides[reading.value.view] ?? '')}</span>
                  <button
                    type="button"
                    onClick={() => changeView(nextView(reading.value.view))}
                    className="min-h-9 rounded-lg px-2 font-semibold text-accent-strong underline"
                    data-testid="rotate-reading"
                  >
                    {t.analyze.orientation.rotate}
                  </button>
                </p>
              </>
            )}
            {lastUpdate && live && <p className="text-muted">{t.analyze.camera.lastUpdate(new Date(lastUpdate).toLocaleTimeString('it-IT'))}</p>}
          </div>
          {history.length > 0 && (
            <div className="space-y-2 rounded-xl bg-surface-2 p-3" data-testid="live-history">
              <p className="text-sm font-semibold">{t.analyze.live.history}</p>
              <ol className="flex flex-wrap gap-1 text-sm">
                {history.slice(-12).map((entry, index) => (
                  <li key={`${history.length}-${index}`} className="rounded-lg bg-surface px-2 py-0.5 tabular-nums" title={t.analyze.live.sources[entry.source]}>
                    {entry.sans.map((san) => sanToLocal(san)).join(' ')}
                    {entry.source === 'local' && <span aria-hidden className="ml-1 text-ok">⚡</span>}
                  </li>
                ))}
              </ol>
              {stream && (
                <Button variant="ghost" size="sm" icon={<Icon name="undo" size={16} />} onClick={rereadLast} disabled={reading.status === 'busy'}>
                  {t.analyze.live.wrong}
                </Button>
              )}
            </div>
          )}
        </Card>

        {position && (
          <Card className="space-y-3" data-testid="analyze-position">
            <fieldset>
              <legend className="mb-1 text-sm font-semibold">
                {t.analyze.side.label}
                {colorSource === 'photo' && <span className="font-normal text-muted"> · {t.analyze.side.fromPhoto}</span>}
              </legend>
              <div className="flex flex-wrap gap-2" data-testid="my-color">
                {(['w', 'b'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={myColor === c}
                    onClick={() => pickColor(c)}
                    className={`min-h-10 rounded-xl border-2 px-4 text-sm font-semibold ${myColor === c ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
                  >
                    {t.sides[c]}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">{t.analyze.side.help}</p>
            </fieldset>
            {showBoard && fen ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={`font-semibold ${myTurn ? 'text-ok' : ''}`} data-testid="analyze-turn">
                    {myTurn ? t.analyze.turnMine(turnName) : t.analyze.turnTheirs(turnName)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={swapTurn}>
                      {t.analyze.changeTurn}
                    </Button>
                    <Button variant="secondary" size="sm" icon={<Icon name="edit" size={16} />} onClick={fixPieces} data-testid="fix-pieces">
                      {t.analyze.fixPieces}
                    </Button>
                  </div>
                </div>
                {variation !== null && variationLine.length > 0 ? (
                  <div className="space-y-2" data-testid="analyze-variation">
                    <p className="text-sm text-muted">
                      {t.analyze.candidates.viewing(
                        sanToLocal((variation === 'win' ? win?.moves[0]?.san : candidates[variation]?.moves[0]?.san) ?? ''),
                      )}
                    </p>
                    <LineViewer fen={fen} line={variationLine} orientation={flipped ? 'black' : 'white'} showBestArrow={false} testId="analyze-line" />
                    <Button variant="secondary" block onClick={() => setVariation(null)}>
                      {t.analyze.candidates.hideLine}
                    </Button>
                  </div>
                ) : (
                  <>
                    <ChessBoard
                      fen={fen}
                      orientation={flipped ? 'black' : 'white'}
                      interactive={myTurn && done !== null && done.lines.length > 0 && tried.status !== 'busy'}
                      onMove={(uci) => void tryMove(uci)}
                      arrows={arrows}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button variant="ghost" size="sm" icon={<Icon name="undo" size={16} />} onClick={() => setFlipped((f) => !f)}>
                        {t.analyze.flipBoard}
                      </Button>
                      {analysis.status === 'busy' && <p className="text-sm font-semibold">{t.analyze.evaluating}</p>}
                    </div>
                  </>
                )}
              </>
            ) : (
              <BoardEditor
                value={position}
                onChange={(p) => {
                  userEdited.current = true;
                  setPosition(p);
                  setAnalysis({ status: 'idle' });
                }}
                orientation={flipped ? 'black' : 'white'}
                onFlip={() => setFlipped((f) => !f)}
              />
            )}
            {positionError && Object.keys(position.placement).length > 0 && !showBoard && (
              <p role="alert" className="text-sm font-semibold text-bad">
                {t.mistakes.editor.errors[positionError]}
              </p>
            )}
            {done && done.lines.length > 0 && !myTurn && (
              <div className="space-y-1 rounded-xl bg-surface-2 p-3" data-testid="opponent-turn">
                <p className="font-semibold">{t.analyze.opponent.waiting}</p>
                {best && <p className="text-sm text-muted">{t.analyze.opponent.threat(sanToLocal(best.san))}</p>}
              </div>
            )}
            {done && done.lines.length > 0 && myTurn && (
              <div className="space-y-2 rounded-xl bg-surface-2 p-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={practice}
                    onChange={(e) => togglePractice(e.target.checked)}
                    className="mt-1 size-5 accent-[var(--accent)]"
                    data-testid="practice-toggle"
                  />
                  <span>
                    <span className="block font-semibold">{t.analyze.coach.toggle}</span>
                    <span className="block text-sm text-muted">{t.analyze.coach.help}</span>
                  </span>
                </label>
                {practice && !showSuggestions && (
                  <div className="space-y-2" data-testid="practice-prompt">
                    <p className="font-semibold">{t.analyze.coach.prompt(turnName)}</p>
                    <Button variant="secondary" size="sm" onClick={() => setRevealed(true)} data-testid="reveal">
                      {t.analyze.coach.reveal}
                    </Button>
                  </div>
                )}
                {practice && showSuggestions && tried.status !== 'done' && revealed && (
                  <Button variant="ghost" size="sm" onClick={() => setRevealed(false)}>
                    {t.analyze.coach.hide}
                  </Button>
                )}
                {tried.status === 'busy' && <p className="font-semibold">{t.analyze.coach.judging}</p>}
                {tried.status === 'error' && (
                  <p role="alert" className="font-semibold text-bad">
                    {tried.error}
                  </p>
                )}
                {tried.status === 'done' && best && (
                  <MoveFeedbackCard feedback={tried.value} bestSan={sanToLocal(best.san)} onRetry={() => setTried({ status: 'idle' })} />
                )}
              </div>
            )}
            {!showBoard && (
              <Button
                size="lg"
                block
                icon={<Icon name="target" />}
                disabled={positionError !== null}
                onClick={() => void evaluate(position)}
                data-testid="evaluate"
              >
                {`${t.analyze.evaluate} · ${t.analyze.turn} ${turnName}`}
              </Button>
            )}
          </Card>
        )}
      </div>

      {analysis.status === 'error' && (
        <p role="alert" className="font-semibold text-bad">
          {analysis.error}
        </p>
      )}

      {done && fen && ((showSuggestions && done.lines.length > 0) || done.lines.length === 0) && (
        <Card className="space-y-3" data-testid="analyze-result" aria-live="polite">
          {done.lines.length === 0 ? (
            <p className="font-semibold">{t.analyze.gameOver}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <div>
                  <p className="text-sm text-muted">{t.analyze.evaluation}</p>
                  <p className="font-display text-3xl font-semibold tabular-nums" data-testid="analyze-eval">
                    {evalText}
                  </p>
                </div>
                {best && (
                  <div>
                    <p className="text-sm text-muted">{t.analyze.bestMove}</p>
                    <p className="font-display text-3xl font-semibold" data-testid="analyze-best">
                      {sanToLocal(best.san)}
                    </p>
                  </div>
                )}
                {!live && <SpeakButton text={`${verdict} ${winExtra}`} auto={explanation.status === 'idle' && !apiKey} />}
              </div>
              <p className="text-xs text-muted">{t.analyze.evalHelp}</p>
              {win && <WinningLineCard line={win} open={variation === 'win'} onToggle={() => setVariation(variation === 'win' ? null : 'win')} />}
              <p className="text-sm text-muted">{t.analyze.candidates.help}</p>
              <CandidateMoves
                candidates={candidates}
                whiteToMove={position?.turn === 'w'}
                openIndex={typeof variation === 'number' ? variation : null}
                onOpen={setVariation}
              />
            </>
          )}
          {explanation.status === 'busy' && <p className="font-semibold">{t.analyze.explaining}</p>}
          {explanation.status === 'error' && (
            <div className="space-y-2">
              <p role="alert" className="font-semibold text-bad">
                {explanation.error}
              </p>
              {position && (
                <Button variant="secondary" onClick={() => void evaluate(position)}>
                  {t.analyze.retryExplain}
                </Button>
              )}
            </div>
          )}
          {explanation.status === 'done' && (
            <div className="rounded-xl border border-l-4 border-line border-l-accent bg-surface p-3.5" data-testid="analyze-explanation">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-accent-strong">{t.analyze.explanation}</p>
                {!live && <SpeakButton text={`${verdict} ${localSquares(explanation.value)}`} auto />}
              </div>
              <p className="mt-1 whitespace-pre-line">{localSquares(explanation.value)}</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
