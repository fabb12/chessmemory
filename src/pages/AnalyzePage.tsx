import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CANDIDATE_TONES, CandidateMoves, type Candidate } from '../components/analyze/CandidateMoves';
import { MoveFeedbackCard } from '../components/analyze/MoveFeedbackCard';
import { WinningLineCard } from '../components/analyze/WinningLineCard';
import { ApiKeyForm, ModelLink } from '../components/assistant/ApiKeyForm';
import { BoardEditor } from '../components/chess/BoardEditor';
import { ChessBoard, type BoardArrow } from '../components/chess/ChessBoard';
import { LineViewer, playLine } from '../components/mistakes/LineViewer';
import { Button } from '../components/ui/Button';
import { Card, PageTitle, SectionTitle } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { SpeakButton } from '../components/ui/SpeakButton';
import type { Profile } from '../db/schema';
import { judgeMove, type MoveFeedback } from '../features/analysis/moveCoach';
import { winningLine } from '../features/analysis/winningLine';
import { gridToPlacement, isBoardView, nextView, type BoardView } from '../features/assistant/boardReading';
import { inferTurn } from '../features/assistant/boardResolve';
import { AssistantError, explainPosition, getApiKey, readBoardFromImage, useApiKey, type BoardReading } from '../features/assistant/claude';
import { ANALYSIS_DEPTH, getEngine, terminalAnalysis, type Analysis } from '../features/engine/engine';
import { formatScore } from '../features/engine/uci';
import { fenToPosition, positionToFen, startPosition, validatePosition, type EditorPosition } from '../features/mistakes/position';
import { analyzeImage } from '../features/vision/hybrid';
import { loadDetector, useDetectorStatus } from '../features/vision/pieceDetector';
import { isSure, ShotSession, toBoardReading } from '../features/vision/shots';
import { t } from '../i18n';
import type { Side, Uci } from '../types';
import { captureStill } from '../utils/frames';
import { prepareImage, READING_PHOTO_SIDE } from '../utils/image';
import { formatLine, localSquares, sanToLocal, setFlippedSquares } from '../utils/notation';

/**
 * Foto previste per leggere una posizione: dal proprio lato e dal lato destro.
 * La seconda vede di fianco i pezzi che nella prima sono coperti da quelli più
 * alti; se la prima basta già (YOLO + regole, o Claude + YOLO d'accordo) la
 * seconda si salta da sola.
 */
const SHOTS = 2;

type Phase<T> = { status: 'idle' } | { status: 'busy' } | { status: 'done'; value: T } | { status: 'error'; error: string };

const VIEW_KEY = 'cm.analyze.view';
const PRACTICE_KEY = 'cm.analyze.practice';
const FLIP_SQUARES_KEY = 'cm.analyze.flipSquares';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  /** Foto guidate: indice della prossima foto da scattare, null = nessuna cattura in corso. */
  const [step, setStep] = useState<number | null>(null);
  /** Foto scattate nella lettura in corso (o nell'ultima), come miniature. */
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [reading, setReading] = useState<Phase<BoardReading>>({ status: 'idle' });
  const [readInfo, setReadInfo] = useState<{ seconds: number; shots: number } | null>(null);
  const [position, setPosition] = useState<EditorPosition | null>(null);
  const [flipped, setFlipped] = useState(false);
  // Con che colore gioca l'utente: dedotto dal lato da cui è scattata la foto, o scelto a mano.
  const [myColor, setMyColorState] = useState<Side>('w');
  const [colorSource, setColorSource] = useState<'default' | 'photo' | 'user'>('default');
  const [analysis, setAnalysis] = useState<Phase<Analysis>>({ status: 'idle' });
  const [explanation, setExplanation] = useState<Phase<string>>({ status: 'idle' });
  // Numerazione invertita: il Nero sta sulle righe 1-2 della scacchiera fisica.
  const [flipSquares, setFlipSquares] = useState(() => loadPref(FLIP_SQUARES_KEY) === '1');
  // Vale già per questo render (anche per le scacchiere e le liste dei figli); si spegne lasciando la pagina.
  setFlippedSquares(flipSquares);
  useEffect(() => {
    setFlippedSquares(flipSquares);
    return () => setFlippedSquares(false);
  }, [flipSquares]);
  const detector = useDetectorStatus();
  const [viewPref, setViewPref] = useState<BoardView | 'auto'>(() => {
    const saved = loadPref(VIEW_KEY);
    return isBoardView(saved) ? saved : 'auto';
  });
  // Allenamento: i suggerimenti restano nascosti finché l'utente non prova una mossa.
  const [practice, setPractice] = useState(() => loadPref(PRACTICE_KEY) === '1');
  const [revealed, setRevealed] = useState(false);
  const [tried, setTried] = useState<Phase<MoveFeedback>>({ status: 'idle' });
  const [variation, setVariation] = useState<number | 'win' | null>(null);
  const session = useRef<ShotSession | null>(null);
  const sessionStarted = useRef(0);
  const lastRaw = useRef<string | null>(null);
  const lastView = useRef<BoardView | null>(null);
  /** true se la posizione è stata corretta a mano: una lettura sbagliata non deve cancellarla. */
  const userEdited = useRef(false);
  const evalId = useRef(0);
  const positionRef = useRef<EditorPosition | null>(null);
  positionRef.current = position;
  const myColorRef = useRef(myColor);
  const colorSourceRef = useRef(colorSource);

  const chooseColor = useCallback((color: Side, source: 'photo' | 'user') => {
    myColorRef.current = color;
    colorSourceRef.current = source;
    setMyColorState(color);
    setColorSource(source);
    // I propri pezzi in basso.
    setFlipped(color === 'b');
  }, []);

  // ───── Fotocamera ─────
  const stopCamera = useCallback(() => {
    setStream((current) => {
      current?.getTracks().forEach((track) => track.stop());
      return null;
    });
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [stream]);

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  /** Spiegazione di Claude per la posizione analizzata. */
  const runExplanation = useCallback(
    async (pos: EditorPosition, result: Analysis, id: number) => {
      if (!apiKey) return;
      const fen = result.fen;
      setExplanation({ status: 'busy' });
      try {
        const text = await explainPosition({
          fen,
          evaluation: formatScore(result.score, pos.turn === 'w'),
          // A Claude le mosse con i nomi veri delle case (come nella FEN); la risposta si rinomina dopo.
          lines: result.lines.map((line) => formatLine(playLine(fen, line.pv.slice(0, 8)), false)),
          playerSide: myColorRef.current,
          brief: false,
        });
        if (id === evalId.current) setExplanation({ status: 'done', value: text });
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
      if (result.lines.length === 0 || pos.turn !== myColorRef.current) return;
      await runExplanation(pos, result, id);
    },
    [runExplanation, profile.settings.analysisDepth],
  );

  /** Mostra la posizione letta dalle foto e la fa analizzare a Stockfish. */
  const applyReading = useCallback(
    (result: BoardReading, shots: number) => {
      setReadInfo({ seconds: (performance.now() - sessionStarted.current) / 1000, shots });
      setReading({ status: 'done', value: result });
      lastRaw.current = result.rawPlacement;
      lastView.current = result.view;
      // Chi sei: dal lato del Bianco sei il Bianco, dal lato del Nero sei il Nero.
      if (colorSourceRef.current !== 'user' && (result.view === 'bottom' || result.view === 'top')) {
        chooseColor(result.view === 'bottom' ? 'w' : 'b', 'photo');
      }
      const previous = positionRef.current;
      // Tratto: quello dedotto dalla mossa riconosciuta, poi quello visto da Claude, poi quello che rende possibile la posizione.
      const guessed: Side = result.sideToMove !== 'unknown' ? result.sideToMove : (previous?.turn ?? 'w');
      const turn: Side = result.turnKnown ? guessed : inferTurn(result.placement, guessed);
      // Posizione raggiunta con mosse legali: si tiene la FEN vera (arrocchi già persi, en passant).
      const next = (result.turnKnown && result.fen ? fenToPosition(result.fen) : null) ?? fenToPosition(`${result.placement} ${turn} KQkq`) ?? startPosition();
      userEdited.current = false;
      setPosition(next);
      void evaluate(next);
    },
    [evaluate, chooseColor],
  );

  // ───── Foto guidate: YOLO subito sul dispositivo, Claude solo se serve ─────
  const newSession = useCallback(() => {
    const known = positionRef.current && !validatePosition(positionRef.current) ? positionRef.current : null;
    sessionStarted.current = performance.now();
    session.current = new ShotSession(
      {
        reference: known ? { fen: positionToFen(known), locked: userEdited.current } : null,
        forcedView: viewPref === 'auto' ? null : viewPref,
        lastView: lastView.current,
        lastRawPlacement: lastRaw.current,
        flippedCoordinates: flipSquares,
      },
      { local: analyzeImage, claude: getApiKey() ? readBoardFromImage : null },
    );
    setThumbs([]);
    setReadInfo(null);
    return session.current;
  }, [viewPref, flipSquares]);

  /** Fonde le foto scattate e mostra la posizione. */
  const finish = useCallback(async () => {
    const current = session.current;
    if (!current) return;
    session.current = null;
    setStep(null);
    stopCamera();
    setReading({ status: 'busy' });
    try {
      const [shots, combined] = await Promise.all([current.all(), current.current()]);
      if (!combined) throw new AssistantError(getApiKey() ? 'unreadable' : 'no-key');
      applyReading(toBoardReading(combined, shots), shots.length);
    } catch (error) {
      setReading({ status: 'error', error: errorText(error) });
    }
  }, [applyReading, stopCamera]);

  const addShot = useCallback(
    (image: string, auto: boolean) => {
      const current = session.current;
      if (!current) return;
      const index = current.count;
      setThumbs((list) => [...list, image]);
      setReading({ status: 'busy' });
      const pending = current.add(image);
      if (!auto) return;
      if (index + 1 >= SHOTS) {
        void finish();
        return;
      }
      setStep(index + 1);
      // La prima foto basta già? Allora la seconda non serve.
      pending
        .then((combined) => {
          if (session.current === current && current.count === index + 1 && combined && isSure(combined)) void finish();
        })
        .catch(() => undefined);
    },
    [finish],
  );

  const startCapture = async () => {
    setCameraError(false);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      setStream(media);
      newSession();
      setStep(0);
      setReading({ status: 'idle' });
      // Il modello YOLO si carica intanto, così è pronto alla prima foto.
      void loadDetector();
    } catch {
      setCameraError(true);
    }
  };

  const shoot = () => {
    const video = videoRef.current;
    const image = video ? captureStill(video, READING_PHOTO_SIDE) : null;
    if (image) addShot(image, true);
  };

  const cancelCapture = () => {
    session.current = null;
    setStep(null);
    setThumbs([]);
    setReading({ status: 'idle' });
    stopCamera();
  };

  const onFiles = async (files: FileList | null) => {
    const list = files ? [...files].slice(0, SHOTS) : [];
    if (fileRef.current) fileRef.current.value = '';
    if (list.length === 0) return;
    void loadDetector();
    newSession();
    try {
      for (const file of list) {
        const image = await prepareImage(file, READING_PHOTO_SIDE);
        addShot(image.dataUrl.split(',')[1] ?? '', false);
      }
      await finish();
    } catch {
      session.current = null;
      setReading({ status: 'error', error: t.analyze.errors.unreadable! });
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

  const winExtra = win?.kind === 'mate' ? t.analyze.win.mate(win.mateIn ?? 1) : win?.kind === 'check' ? t.analyze.win.check(win.checkIn ?? 1) : '';
  const shot = step !== null ? t.analyze.shots.steps[step] : null;

  return (
    <div className="space-y-5">
      <header>
        <PageTitle>{t.analyze.title}</PageTitle>
      </header>

      {!apiKey && (
        <Card>
          <SectionTitle>{t.analyze.key.title}</SectionTitle>
          <p className="mt-1 mb-3">{t.analyze.key.needed}</p>
          <ApiKeyForm />
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card className="space-y-3">
          {stream && shot ? (
            <div className="space-y-3" data-testid="shot-capture">
              <div>
                <p className="font-display text-xl font-semibold" data-testid="shot-title">
                  {t.analyze.shots.title(step! + 1, SHOTS, shot.title)}
                </p>
                <p className="text-sm text-muted">{shot.how}</p>
              </div>
              <div className="relative w-full overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: 4 / 3 }}>
                <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-contain" data-testid="camera-video" />
                {/* Cornice: la scacchiera vista di sbieco è un trapezio. */}
                <svg aria-hidden viewBox="0 0 100 75" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
                  <polygon points="22,12 78,12 94,68 6,68" fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="0.6" strokeDasharray="2 1.5" />
                </svg>
              </div>
              <Button size="lg" block icon={<Icon name="camera" size={18} />} onClick={shoot} data-testid="shot-take">
                {t.analyze.shots.take}
              </Button>
              <div className="flex flex-wrap gap-2">
                {step! > 0 && (
                  <Button variant="secondary" size="sm" onClick={() => void finish()} data-testid="shot-skip">
                    {t.analyze.shots.skip}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={cancelCapture}>
                  {t.analyze.shots.cancel}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">{t.analyze.shots.intro}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="lg" icon={<Icon name="camera" size={18} />} onClick={() => void startCapture()} disabled={reading.status === 'busy'} data-testid="camera-start">
                  {position ? t.analyze.shots.again : t.analyze.shots.start}
                </Button>
                <Button variant="secondary" icon={<Icon name="upload" size={18} />} onClick={() => fileRef.current?.click()} disabled={reading.status === 'busy'}>
                  {t.analyze.shots.upload}
                </Button>
                {!position && (
                  <Button variant="ghost" onClick={() => setPosition(startPosition())} data-testid="manual-position">
                    {t.analyze.manual}
                  </Button>
                )}
              </div>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} onChange={(e) => void onFiles(e.target.files)} />
          {cameraError && (
            <p role="alert" className="text-sm font-semibold text-bad">
              {t.analyze.camera.denied}
            </p>
          )}
          {thumbs.length > 0 && (
            <ol className="flex gap-2" data-testid="shot-thumbs">
              {thumbs.map((image, k) => (
                <li key={k} className="w-24 overflow-hidden rounded-lg border border-line">
                  <img src={`data:image/jpeg;base64,${image}`} alt={t.analyze.shots.thumb(k + 1)} className="aspect-[4/3] w-full object-cover" />
                </li>
              ))}
            </ol>
          )}
          <div aria-live="polite" className="space-y-1 text-sm">
            {reading.status === 'busy' && <p className="font-semibold">{t.analyze.reading}</p>}
            {reading.status === 'error' && (
              <p role="alert" className="font-semibold text-bad">
                {reading.error}
              </p>
            )}
            {reading.status === 'done' && (
              <>
                <p className="font-semibold">
                  {t.analyze.confidence[reading.value.confidence]}
                  {readInfo && (
                    <span className="font-normal text-muted" data-testid="read-info">
                      {' '}
                      · {t.analyze.shots.summary(readInfo.shots, readInfo.seconds, reading.value.source)}
                    </span>
                  )}
                </p>
                {reading.value.moves.length > 0 && (
                  <p className="text-muted" data-testid="read-moves">
                    {t.analyze.moveFound(reading.value.moves.map((san) => sanToLocal(san)).join(' '))}
                  </p>
                )}
                {reading.value.corrected.length > 0 && (
                  <p className="text-muted" data-testid="read-corrected">
                    {t.analyze.fixed(reading.value.corrected)}
                  </p>
                )}
                {reading.value.notes && <p className="text-muted">{reading.value.notes}</p>}
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
          </div>
          <details className="rounded-xl bg-surface-2 px-3 py-2 text-sm" data-testid="read-options">
            <summary className="cursor-pointer font-semibold">{t.analyze.options}</summary>
            <div className="mt-2 space-y-3">
              <div>
                <label htmlFor="photo-orientation" className="block font-semibold">
                  {t.analyze.orientation.label}
                </label>
                <select
                  id="photo-orientation"
                  value={viewPref}
                  onChange={(e) => changeView(isBoardView(e.target.value) ? e.target.value : 'auto')}
                  className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 font-semibold"
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
              <label className="flex cursor-pointer items-start gap-3">
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
                <span className="font-semibold">{t.analyze.flipSquares.label}</span>
              </label>
              {apiKey && <ModelLink />}
              {(detector === 'missing' || detector === 'error') && (
                <p className="text-xs text-muted" data-testid="detector-status">
                  {t.analyze.detector[detector]}
                </p>
              )}
            </div>
          </details>
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
                <SpeakButton text={`${verdict} ${winExtra}`} auto={explanation.status === 'idle' && !apiKey} />
              </div>
              <p className="text-xs text-muted">{t.analyze.evalHelp}</p>
              {win && <WinningLineCard line={win} open={variation === 'win'} onToggle={() => setVariation(variation === 'win' ? null : 'win')} />}
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
                <SpeakButton text={`${verdict} ${localSquares(explanation.value)}`} auto />
              </div>
              <p className="mt-1 whitespace-pre-line">{localSquares(explanation.value)}</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
