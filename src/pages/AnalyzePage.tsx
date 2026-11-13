import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CANDIDATE_TONES, CandidateMoves, type Candidate } from '../components/analyze/CandidateMoves';
import { MoveFeedbackCard } from '../components/analyze/MoveFeedbackCard';
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
import { gridToPlacement, isBoardView, nextView, type BoardView } from '../features/assistant/boardReading';
import { inferTurn } from '../features/assistant/boardResolve';
import { AssistantError, explainPosition, readBoardFromImage, useApiKey, type BoardReading } from '../features/assistant/claude';
import { ANALYSIS_DEPTH, getEngine, terminalAnalysis, type Analysis } from '../features/engine/engine';
import { formatScore } from '../features/engine/uci';
import { fenToPosition, positionToFen, startPosition, validatePosition, type EditorPosition } from '../features/mistakes/position';
import { t } from '../i18n';
import type { Side, Uci } from '../types';
import { captureBoardFrame, frameDifference, frameSignature, MOTION } from '../utils/frames';
import { prepareImage, READING_PHOTO_SIDE } from '../utils/image';
import { formatLine, sanToLocal } from '../utils/notation';

/** Analisi continua: ogni quanto si controlla se la scacchiera si muove (nessun costo, è locale). */
const SAMPLE_MS = 600;
/** Campioni fermi consecutivi prima di rileggere (~1,2 s dopo che la mano si è tolta). */
const STILL_SAMPLES = 2;
/** Intervallo minimo tra due letture con Claude. */
const MIN_READ_GAP_MS = 2500;

type Phase<T> = { status: 'idle' } | { status: 'busy' } | { status: 'done'; value: T } | { status: 'error'; error: string };

const VIEW_KEY = 'cm.analyze.view';
const PRACTICE_KEY = 'cm.analyze.practice';

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
  const [reading, setReading] = useState<Phase<BoardReading>>({ status: 'idle' });
  const [position, setPosition] = useState<EditorPosition | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [myColor, setMyColor] = useState<'w' | 'b' | null>(null);
  const [analysis, setAnalysis] = useState<Phase<Analysis>>({ status: 'idle' });
  const [explanation, setExplanation] = useState<Phase<string>>({ status: 'idle' });
  const [live, setLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [liveState, setLiveState] = useState<'watching' | 'moving'>('watching');
  const [readSeconds, setReadSeconds] = useState<number | null>(null);
  const [videoAspect, setVideoAspect] = useState(4 / 3);
  const [viewPref, setViewPref] = useState<BoardView | 'auto'>(() => {
    const saved = loadPref(VIEW_KEY);
    return isBoardView(saved) ? saved : 'auto';
  });
  // Allenamento: i suggerimenti restano nascosti finché l'utente non prova una mossa.
  const [practice, setPractice] = useState(() => loadPref(PRACTICE_KEY) === '1');
  const [revealed, setRevealed] = useState(false);
  const [tried, setTried] = useState<Phase<MoveFeedback>>({ status: 'idle' });
  const [variation, setVariation] = useState<number | null>(null);
  const lastSample = useRef<Uint8Array | null>(null);
  const readSignature = useRef<Uint8Array | null>(null);
  const stillCount = useRef(0);
  const lastReadAt = useRef(0);
  const busy = useRef(false);
  const lastPlacement = useRef<string | null>(null);
  const lastRaw = useRef<string | null>(null);
  const lastView = useRef<BoardView | null>(null);
  /** true se la posizione è stata corretta a mano: una lettura sbagliata non deve cancellarla. */
  const userEdited = useRef(false);
  const evalId = useRef(0);
  const positionRef = useRef<EditorPosition | null>(null);
  positionRef.current = position;
  const viewPrefRef = useRef(viewPref);
  viewPrefRef.current = viewPref;

  // ───── Fotocamera ─────
  const startCamera = async () => {
    setCameraError(false);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        // Bassa risoluzione: basta per ~100 px per casa e il telefono lavora meno.
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      setStream(media);
    } catch {
      setCameraError(true);
    }
  };

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setLive(false);
  }, [stream]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [stream]);

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  // ───── Valutazione: Stockfish, poi la spiegazione di Claude ─────
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
      if (result.lines.length === 0 || !apiKey) return;
      setExplanation({ status: 'busy' });
      try {
        const text = await explainPosition({
          fen,
          evaluation: formatScore(result.score, pos.turn === 'w'),
          lines: result.lines.map((line) => formatLine(playLine(fen, line.pv.slice(0, 6)))),
          playerSide: myColor,
        });
        if (id === evalId.current) setExplanation({ status: 'done', value: text });
      } catch (error) {
        if (id === evalId.current) setExplanation({ status: 'error', error: errorText(error) });
      }
    },
    [apiKey, myColor, profile.settings.analysisDepth],
  );

  // ───── Lettura della scacchiera ─────
  const read = useCallback(
    async (image: string, auto: boolean, fromCamera: boolean) => {
      if (busy.current) return;
      busy.current = true;
      setReading({ status: 'busy' });
      const started = performance.now();
      try {
        // La posizione già nota (magari corretta a mano) permette di scartare le letture impossibili:
        // tra due letture di solito è cambiata una sola mossa.
        const known = positionRef.current && !validatePosition(positionRef.current) ? positionRef.current : null;
        const forced = viewPrefRef.current === 'auto' ? null : viewPrefRef.current;
        const result = await readBoardFromImage(image, {
          reference: fromCamera && known ? { fen: positionToFen(known), locked: userEdited.current } : null,
          view: forced,
          lastView: lastView.current,
          lastRawPlacement: lastRaw.current,
          // Le letture singole (e la prima) sono più accurate; l'analisi continua resta veloce.
          careful: !auto || !known,
        });
        setReadSeconds((performance.now() - started) / 1000);
        setReading({ status: 'done', value: result });
        setLastUpdate(Date.now());
        lastRaw.current = result.rawPlacement;
        lastView.current = result.view;
        if (auto && result.placement === lastPlacement.current) return;
        const changed = lastPlacement.current !== null && result.placement !== lastPlacement.current;
        lastPlacement.current = result.placement;
        const previous = positionRef.current;
        // Tratto: quello dedotto dalla mossa riconosciuta; poi quello visto da Claude; poi, in analisi
        // continua, l'alternanza; infine quello che rende possibile la posizione (re sotto scacco).
        const guessed: Side =
          result.sideToMove !== 'unknown' ? result.sideToMove : auto && changed && previous ? (previous.turn === 'w' ? 'b' : 'w') : (previous?.turn ?? 'w');
        const turn: Side = result.turnKnown ? guessed : inferTurn(result.placement, guessed);
        const next = fenToPosition(`${result.placement} ${turn} KQkq`) ?? startPosition();
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
    [evaluate],
  );

  const captureAndRead = useCallback(
    (auto: boolean) => {
      const video = videoRef.current;
      const frame = video ? captureBoardFrame(video) : null;
      if (!video || !frame) return;
      readSignature.current = frameSignature(video);
      lastReadAt.current = Date.now();
      void read(frame, auto, true);
    },
    [read],
  );

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const image = await prepareImage(file, READING_PHOTO_SIDE);
      void read(image.dataUrl.split(',')[1] ?? '', false, false);
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
    if (reading.status !== 'done') return;
    const placement = gridToPlacement(reading.value.grid, choice);
    if (!placement) return;
    const turn = inferTurn(placement, positionRef.current?.turn ?? 'w');
    const next = fenToPosition(`${placement} ${turn} KQkq`) ?? startPosition();
    lastPlacement.current = placement;
    lastRaw.current = placement;
    userEdited.current = false;
    setReading({ status: 'done', value: { ...reading.value, view: choice, placement, rawPlacement: placement, corrected: [], moves: [] } });
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

  // ───── Analisi continua ─────
  // Nessuna lettura a intervalli fissi: una miniatura locale controlla di continuo la
  // scacchiera e Claude viene chiamato appena la mano si toglie e qualcosa è cambiato.
  useEffect(() => {
    if (!live || !stream) return;
    lastSample.current = null;
    readSignature.current = null;
    stillCount.current = 0;
    setLiveState('watching');
    captureAndRead(true);
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
      if (busy.current || Date.now() - lastReadAt.current < MIN_READ_GAP_MS) return;
      if (readSignature.current && frameDifference(readSignature.current, sample) < MOTION.changed) return;
      captureAndRead(true);
    }, SAMPLE_MS);
    return () => window.clearInterval(id);
  }, [live, stream, captureAndRead]);

  const positionError = position ? validatePosition(position) : null;
  const fen = position && !positionError ? positionToFen(position) : null;
  // Il risultato vale solo per la posizione attuale (la scacchiera può cambiare mentre il motore lavora).
  const done = analysis.status === 'done' && analysis.value.fen === fen ? analysis.value : null;
  const showBoard = fen !== null && (done !== null || analysis.status === 'busy');
  const candidates = useMemo<Candidate[]>(
    () => (done && fen ? done.lines.slice(0, 3).map((line) => ({ line, moves: playLine(fen, line.pv.slice(0, 8)) })) : []),
    [done, fen],
  );
  const best = candidates[0]?.moves[0];
  const turnName = position ? t.sides[position.turn] : '';
  const evalText = done && position ? formatScore(done.score, position.turn === 'w') : '';
  const verdict = best ? `${t.analyze.bestMove}: ${sanToLocal(best.san)}. ${t.analyze.evaluation}: ${evalText}.` : '';
  const showSuggestions = !practice || revealed || tried.status === 'done';
  const variationLine = useMemo(() => (variation !== null && done ? (done.lines[variation]?.pv.slice(0, 10) ?? []) : []), [variation, done]);
  const doneRef = useRef<Analysis | null>(null);
  doneRef.current = done;

  const arrows = useMemo<BoardArrow[]>(() => {
    const out: BoardArrow[] = [];
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
  }, [candidates, showSuggestions, tried]);

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
                    if (v.videoWidth && v.videoHeight) setVideoAspect(v.videoWidth / v.videoHeight);
                  }}
                  className="absolute inset-0 size-full object-contain"
                  data-testid="camera-video"
                />
                {/* Guida: solo il quadrato centrale viene inviato a Claude. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute top-0 left-1/2 aspect-square h-full -translate-x-1/2 rounded-md border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                />
                <p className="absolute inset-x-0 bottom-1 text-center text-xs font-semibold text-white drop-shadow">{t.analyze.camera.guide}</p>
              </div>
            ) : (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 p-4 text-center text-muted">
                <Icon name="camera" size={40} />
                <p className="text-sm">{t.analyze.camera.tip}</p>
              </div>
            )}
          </div>
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
          <div className="flex flex-wrap gap-2">
            {stream ? (
              <>
                <Button
                  icon={<Icon name="eye" size={18} />}
                  onClick={() => captureAndRead(false)}
                  disabled={!apiKey || reading.status === 'busy'}
                  data-testid="capture-read"
                >
                  {t.analyze.camera.capture}
                </Button>
                <Button variant="secondary" onClick={stopCamera}>
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
          {stream && apiKey && (
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="mt-1 size-5 accent-[var(--accent)]" />
              <span>
                <span className="block font-semibold">{t.analyze.camera.live}</span>
                <span className="block text-sm text-muted">{t.analyze.camera.liveHelp}</span>
              </span>
            </label>
          )}
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
            <p className="mt-1 text-xs text-muted">{t.analyze.orientation.help}</p>
          </div>
          <div aria-live="polite" className="space-y-1 text-sm">
            {live && reading.status !== 'busy' && (
              <p className="text-muted" data-testid="live-state">
                {liveState === 'moving' ? t.analyze.camera.moving : t.analyze.camera.watching}
              </p>
            )}
            {reading.status === 'busy' && <p className="font-semibold">{t.analyze.reading}</p>}
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
                {reading.value.moves.length > 0 && (
                  <p className="text-muted" data-testid="read-moves">
                    {t.analyze.moveFound(reading.value.moves.map(sanToLocal).join(' '))}
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
        </Card>

        {position && (
          <Card className="space-y-3" data-testid="analyze-position">
            {showBoard && fen ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold" data-testid="analyze-turn">
                    {t.analyze.turnIs(turnName)}
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
                    <p className="text-sm text-muted">{t.analyze.candidates.viewing(sanToLocal(candidates[variation]?.moves[0]?.san ?? ''))}</p>
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
                      interactive={done !== null && done.lines.length > 0 && tried.status !== 'busy'}
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
            {done && done.lines.length > 0 && (
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
              <>
                <fieldset>
                  <legend className="mb-1 text-sm font-semibold">{t.analyze.myColor}</legend>
                  <div className="flex flex-wrap gap-2">
                    {(['w', 'b', 'none'] as const).map((c) => {
                      const value = c === 'none' ? null : c;
                      return (
                        <button
                          key={c}
                          type="button"
                          aria-pressed={myColor === value}
                          onClick={() => {
                            setMyColor(value);
                            if (value) setFlipped(value === 'b');
                          }}
                          className={`min-h-10 rounded-xl border-2 px-3 text-sm font-semibold ${myColor === value ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
                        >
                          {t.analyze.myColors[c]}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
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
              </>
            )}
          </Card>
        )}
      </div>

      {analysis.status === 'error' && (
        <p role="alert" className="font-semibold text-bad">
          {analysis.error}
        </p>
      )}

      {done && fen && (showSuggestions || done.lines.length === 0) && (
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
                <SpeakButton text={verdict} auto={explanation.status === 'idle' && !apiKey} />
              </div>
              <p className="text-xs text-muted">{t.analyze.evalHelp}</p>
              <p className="text-sm text-muted">{t.analyze.candidates.help}</p>
              <CandidateMoves candidates={candidates} whiteToMove={position?.turn === 'w'} openIndex={variation} onOpen={setVariation} />
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
                <SpeakButton text={`${verdict} ${explanation.value}`} auto />
              </div>
              <p className="mt-1 whitespace-pre-line">{explanation.value}</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
