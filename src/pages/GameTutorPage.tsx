import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChessBoard, type BoardArrow } from '../components/chess/ChessBoard';
import { Button, buttonClass } from '../components/ui/Button';
import { Card, PageTitle, SectionTitle } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { BoardOverlay, type OverlayArrow } from '../components/vision/BoardOverlay';
import { RectifiedPreview } from '../components/vision/RectifiedPreview';
import { findGame } from '../data/games';
import { judgeMove, type MoveFeedback } from '../features/analysis/moveCoach';
import { nextView, type BoardView } from '../features/assistant/boardReading';
import { explainDeviation, explainMasterMove, useApiKey } from '../features/assistant/claude';
import { getEngine, type Analysis } from '../features/engine/engine';
import type { RankedTransition, Transition } from '../features/engine/moveMatcher';
import { formatScore } from '../features/engine/uci';
import { parseGame, type GameMove } from '../features/games/pgn';
import { getExplanationCache, explanationKey } from '../features/tutor/explanationCache';
import {
  boardFen,
  expectedMove,
  extraTransitions,
  fenAt,
  isFinished,
  isGuessTurn,
  playOnBoard,
  preferredTransition,
  skipMove,
  startSession,
  takeBack,
  undoMove,
  type SessionState,
  type UserSide,
} from '../features/tutor/gameSession';
import { PrefetchQueue } from '../features/tutor/prefetchQueue';
import { loadCalibration, saveCalibration } from '../features/vision/calibration';
import { plausibleCorners, type Corners } from '../features/vision/geometry';
import { BoardTracker, type TrackerStatus } from '../features/vision/tracker';
import { speak, stopSpeaking } from '../features/voice/speech';
import { t } from '../i18n';
import type { Uci } from '../types';
import { applyUci } from '../utils/chess';
import { formatLine, sanToLocal } from '../utils/notation';
import { playLine } from '../components/mistakes/LineViewer';

/** Profondità di Stockfish per giudicare le deviazioni: veloce, l'analisi parte prima che l'utente muova. */
const JUDGE_DEPTH = 12;

type Feedback = { tone: 'good' | 'bad' | 'info'; text: string } | null;
type Phase<T> = { status: 'idle' } | { status: 'busy' } | { status: 'done'; value: T } | { status: 'error' };

/** Quadrilatero di partenza: quadrato centrale (lato = 80% del lato corto). */
function defaultCorners(aspect: number): Corners {
  const w = aspect >= 1 ? 0.8 / aspect : 0.8;
  const h = aspect >= 1 ? 0.8 : 0.8 * aspect;
  return [
    { x: 0.5 - w / 2, y: 0.5 - h / 2 },
    { x: 0.5 + w / 2, y: 0.5 - h / 2 },
    { x: 0.5 + w / 2, y: 0.5 + h / 2 },
    { x: 0.5 - w / 2, y: 0.5 + h / 2 },
  ];
}

function moveLabel(move: GameMove): string {
  return `${move.moveNumber}${move.color === 'w' ? '.' : '…'}${sanToLocal(move.san)}`;
}

export function GameTutorPage() {
  const { id } = useParams();
  const game = id ? findGame(id) : undefined;
  const parsed = useMemo(() => (game ? parseGame(game.pgn) : null), [game]);
  const apiKey = useApiKey();

  const [side, setSide] = useState<UserSide>(() => (game?.result === '1-0' ? 'w' : game?.result === '0-1' ? 'b' : 'both'));
  const [session, setSessionState] = useState<SessionState | null>(() => (parsed ? startSession(parsed) : null));
  const sessionRef = useRef(session);
  const setSession = useCallback((next: SessionState) => {
    sessionRef.current = next;
    setSessionState(next);
  }, []);

  // ───── Fotocamera e visione ─────
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [aspect, setAspect] = useState(4 / 3);
  const [corners, setCornersState] = useState<Corners | null>(null);
  const cornersRef = useRef<Corners | null>(null);
  const [view, setViewState] = useState<BoardView>('bottom');
  const [status, setStatus] = useState<TrackerStatus>('idle');
  const [preview, setPreview] = useState<ImageBitmap | ImageData | null>(null);
  const [calibrationNote, setCalibrationNote] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const trackerRef = useRef<BoardTracker | null>(null);

  // ───── Tutor ─────
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [explanation, setExplanation] = useState<{ ply: number; text: string } | null>(null);
  const [judgement, setJudgement] = useState<Phase<MoveFeedback>>({ status: 'idle' });
  const [why, setWhy] = useState<Phase<string>>({ status: 'idle' });
  const [unsure, setUnsure] = useState<RankedTransition[] | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [readyAhead, setReadyAhead] = useState(0);
  const analysisRef = useRef<Map<string, Promise<Analysis>>>(new Map());
  const queueRef = useRef<PrefetchQueue | null>(null);

  const setCorners = useCallback((next: Corners | null) => {
    cornersRef.current = next;
    setCornersState(next);
  }, []);

  // Nuova partita: si riparte da capo.
  useEffect(() => {
    if (parsed) setSession(startSession(parsed));
    setFeedback(null);
    setExplanation(null);
  }, [parsed, setSession]);

  /** Analisi di Stockfish di una posizione, avviata in anticipo e riusata. */
  const analysisOf = useCallback((fen: string): Promise<Analysis> => {
    const cache = analysisRef.current;
    let job = cache.get(fen);
    if (!job) {
      job = getEngine().analyse(fen, { depth: JUDGE_DEPTH, multiPv: 3 });
      job.catch(() => cache.delete(fen));
      cache.set(fen, job);
    }
    return job;
  }, []);

  // ───── Spiegazioni: cache + coda che sta qualche mossa avanti ─────
  useEffect(() => {
    if (!parsed || !game) return;
    const cache = getExplanationCache();
    const key = (ply: number) => explanationKey(game.id, ply);
    void cache.warm(parsed.moves.map((_, k) => key(k + 1))).then(() => setReadyAhead(queueRef.current?.readyAhead((sessionRef.current?.ply ?? 0) + 1) ?? 0));
    if (!apiKey) {
      queueRef.current = null;
      return;
    }
    const queue = new PrefetchQueue({
      cache,
      key,
      total: parsed.moves.length,
      lookahead: 3,
      fetch: (ply) => {
        const move = parsed.moves[ply - 1]!;
        const player = move.color === 'w' ? `${game.white} (Bianco)` : `${game.black} (Nero)`;
        return explainMasterMove({
          fen: fenAt(parsed, ply - 1),
          move: moveLabel(move),
          player,
          game: `${game.white} – ${game.black}, ${game.event} ${game.year}`,
          comment: move.comment,
          continuation: formatLine(playLine(move.fen, parsed.moves.slice(ply, ply + 4).map((m) => m.uci)), false),
        });
      },
      onReady: (ply, text) => {
        const s = sessionRef.current;
        if (s) setReadyAhead(queue.readyAhead(s.ply + 1));
        // La spiegazione della mossa appena giocata è arrivata dopo: si mostra adesso.
        setExplanation((current) => (current && current.ply === ply ? { ply, text } : current));
      },
    });
    queueRef.current = queue;
    queue.advance((sessionRef.current?.ply ?? 0) + 1);
    return () => queue.dispose();
  }, [parsed, game, apiKey]);

  const explanationFor = useCallback(
    (ply: number): string => {
      const move = parsed?.moves[ply - 1];
      return queueRef.current?.peek(ply) ?? (game ? getExplanationCache().peek(explanationKey(game.id, ply)) : undefined) ?? move?.comment ?? t.gameTutor.noComment;
    },
    [parsed, game],
  );

  // A ogni nuova posizione: Stockfish la analizza subito (pronto se l'utente devia) e la coda avanza.
  useEffect(() => {
    if (!parsed || !session || session.deviation || isFinished(parsed, session)) return;
    if (isGuessTurn(parsed, session, side)) void analysisOf(session.fen).catch(() => undefined);
    queueRef.current?.advance(session.ply + 1);
    if (queueRef.current) setReadyAhead(queueRef.current.readyAhead(session.ply + 1));
  }, [parsed, session, side, analysisOf]);

  // ───── Applicazione di una mossa riconosciuta (fotocamera, correzione o scacchiera 2D) ─────
  const applyTransition = useCallback(
    (transition: Transition) => {
      const current = sessionRef.current;
      if (!parsed || !game || !current) return;
      setUnsure(null);
      setWhy({ status: 'idle' });
      if (transition.kind === 'takeback') {
        const next = takeBack(current);
        setSession(next);
        trackerRef.current?.commit(boardFen(next));
        setJudgement({ status: 'idle' });
        setShowHint(false);
        setFeedback({ tone: 'info', text: t.gameTutor.takenBack });
        speak(t.gameTutor.takenBack, 'game-tutor');
        return;
      }
      if (!transition.uci || !transition.san) return;
      const guess = isGuessTurn(parsed, current, side);
      const { state, outcome } = playOnBoard(parsed, current, transition.uci, transition.san, transition.fen, guess);
      if (outcome.kind === 'ignored') return;
      setSession(state);
      trackerRef.current?.commit(boardFen(state));
      if (outcome.kind === 'match') {
        const ply = state.ply;
        const label = moveLabel(outcome.move);
        const head = !guess ? t.gameTutor.played(label) : outcome.firstTry ? t.gameTutor.correct(label) : t.gameTutor.correctLater(label);
        const text = explanationFor(ply);
        setFeedback({ tone: guess ? 'good' : 'info', text: head });
        setExplanation({ ply, text });
        setJudgement({ status: 'idle' });
        setShowHint(false);
        speak(`${head} ${text}`, 'game-tutor');
        return;
      }
      if (outcome.kind === 'deviation') {
        const played = sanToLocal(outcome.deviation.san);
        setShowHint(true);
        if (!guess) {
          setFeedback({ tone: 'bad', text: t.gameTutor.deviationWrongOrder });
          speak(t.gameTutor.deviationWrongOrder, 'game-tutor');
          return;
        }
        setFeedback({ tone: 'bad', text: t.gameTutor.deviation(played) });
        setJudgement({ status: 'busy' });
        const fen = current.fen;
        void analysisOf(fen)
          .then((analysis) => judgeMove(analysis, transition.uci!, getEngine(), JUDGE_DEPTH))
          .then((verdict) => {
            if (sessionRef.current?.deviation?.uci !== transition.uci) return;
            if (!verdict) {
              setJudgement({ status: 'error' });
              return;
            }
            setJudgement({ status: 'done', value: verdict });
            const expected = expectedMove(parsed, current);
            const player = expected?.color === 'b' ? game.black : game.white;
            const text =
              verdict.grade === 'best' || verdict.grade === 'good'
                ? t.gameTutor.deviationGood(played, player)
                : t.gameTutor.deviationBad(played, t.gameTutor.grades[verdict.grade] ?? verdict.grade);
            setFeedback({ tone: 'bad', text });
            speak(text, 'game-tutor');
          })
          .catch(() => setJudgement({ status: 'error' }));
      }
    },
    [parsed, game, side, setSession, explanationFor, analysisOf],
  );
  const applyRef = useRef(applyTransition);
  applyRef.current = applyTransition;

  /** Mossa fatta sulla scacchiera 2D (senza fotocamera) o scelta nella correzione rapida. */
  const playUci = (uci: Uci) => {
    const s = sessionRef.current;
    if (!s) return;
    const move = applyUci(boardFen(s), uci);
    if (move) applyRef.current({ id: uci, fen: move.fen, kind: 'move', uci, san: move.san });
  };

  // ───── Fotocamera ─────
  const startCamera = async () => {
    setCameraError(false);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
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
    setPreview(null);
  }, [stream]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [stream]);
  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);
  useEffect(() => () => stopSpeaking(), []);

  // Il tracker vive finché la fotocamera è accesa.
  useEffect(() => {
    if (!stream || !parsed) return;
    const tracker = new BoardTracker(
      {
        video: () => videoRef.current,
        corners: () => cornersRef.current,
        fen: () => (sessionRef.current ? boardFen(sessionRef.current) : null),
        extraTransitions: () => (sessionRef.current ? extraTransitions(sessionRef.current) : []),
        preferred: () => (sessionRef.current ? preferredTransition(parsed, sessionRef.current) : null),
      },
      {
        onStatus: setStatus,
        onView: (v) => setViewState(v),
        onPreview: setPreview,
        onResult: (result) => {
          if (result.kind === 'match') applyRef.current(result.transition);
          else if (result.kind === 'unsure') setUnsure(result.ranked.slice(0, 3));
        },
      },
    );
    trackerRef.current = tracker;
    tracker.start();
    return () => {
      tracker.dispose();
      trackerRef.current = null;
    };
  }, [stream, parsed]);

  const onVideoReady = (video: HTMLVideoElement) => {
    if (!video.videoWidth || !video.videoHeight) return;
    const ratio = video.videoWidth / video.videoHeight;
    setAspect(ratio);
    if (cornersRef.current) return;
    const saved = loadCalibration(ratio);
    if (saved) {
      setCorners(saved);
      setCalibrationNote(t.gameTutor.calibration.loaded);
    } else {
      setCorners(defaultCorners(ratio));
      void autoDetect();
    }
    trackerRef.current?.resync();
  };

  const autoDetect = async () => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    setDetecting(true);
    setCalibrationNote(t.gameTutor.calibration.autoBusy);
    try {
      const found = await tracker.detectCorners();
      if (found.corners && plausibleCorners(found.corners, 0.03)) {
        setCorners(found.corners);
        saveCalibration(found.corners, aspect);
        tracker.resync();
        setCalibrationNote(t.gameTutor.calibration.autoFound(found.matched));
      } else {
        setCalibrationNote(t.gameTutor.calibration.autoFailed);
      }
    } finally {
      setDetecting(false);
    }
  };

  const rotateView = () => {
    const next = nextView(view);
    setViewState(next);
    const tracker = trackerRef.current;
    if (tracker) {
      tracker.view = next;
      tracker.autoView = false;
      tracker.resync();
    }
  };

  if (!game || !parsed || !session) {
    return (
      <div>
        <p>{t.games.notFound}</p>
        <Link to="/partite" className={`${buttonClass('secondary')} mt-3`}>
          {t.app.back}
        </Link>
      </div>
    );
  }

  const expected = expectedMove(parsed, session);
  const finished = isFinished(parsed, session);
  const guess = isGuessTurn(parsed, session, side);
  const playerOf = (color: 'w' | 'b') => (color === 'w' ? game.white : game.black);
  const fen = boardFen(session);
  const lastMove = session.ply > 0 ? parsed.moves[session.ply - 1]! : null;
  // Freccia: sempre per le mosse da eseguire per l'avversario; per le proprie solo come suggerimento.
  const hintMove = expected && (!guess || showHint) ? expected : null;
  const overlayArrows: OverlayArrow[] = hintMove && !session.deviation ? [{ from: hintMove.from, to: hintMove.to, tone: 'hint' }] : [];
  const boardArrows: BoardArrow[] = hintMove && !session.deviation ? [{ from: hintMove.from, to: hintMove.to, tone: 'teach' }] : [];
  if (session.deviation) boardArrows.push({ from: session.deviation.uci.slice(0, 2), to: session.deviation.uci.slice(2, 4), tone: 'bad' });
  const orientation = side === 'b' ? 'black' : 'white';
  const instruction = finished
    ? t.gameTutor.finished(t.games.result[game.result] ?? game.result)
    : session.deviation
      ? null
      : guess
        ? t.gameTutor.yourTurn(playerOf(expected!.color))
        : t.gameTutor.playFor(playerOf(expected!.color), moveLabel(expected!));

  const askWhy = async () => {
    const deviation = session.deviation;
    if (!deviation || !expected || judgement.status !== 'done') return;
    setWhy({ status: 'busy' });
    try {
      const analysis = await analysisOf(session.fen);
      const after = await getEngine().analyse(deviation.fen, { depth: JUDGE_DEPTH, multiPv: 1 });
      const masterLine = analysis.lines.find((l) => l.pv[0] === expected.uci);
      const text = await explainDeviation({
        fen: session.fen,
        played: sanToLocal(deviation.san),
        master: sanToLocal(expected.san),
        player: playerOf(expected.color),
        playedEval: judgement.value.evaluation,
        masterEval: masterLine ? formatScore(masterLine.score, expected.color === 'w') : formatScore(analysis.score, expected.color === 'w'),
        refutation: after.lines[0] ? formatLine(playLine(deviation.fen, after.lines[0].pv.slice(0, 6)), false) : '',
      });
      if (sessionRef.current?.deviation?.uci !== deviation.uci) return;
      setWhy({ status: 'done', value: text });
      speak(text, 'game-tutor');
    } catch {
      setWhy({ status: 'error' });
    }
  };

  const correct = (transition: Transition | null) => {
    if (transition) applyRef.current(transition);
    else {
      setUnsure(null);
      trackerRef.current?.commit(boardFen(sessionRef.current!));
    }
  };

  const viewSide = t.analyze.orientation.sides[view] ?? view;

  return (
    <div className="space-y-4" data-testid="game-tutor">
      <Link to={`/partite/${game.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
        <Icon name="arrowLeft" size={16} />
        {t.gameTutor.back}
      </Link>
      <header>
        <PageTitle>{t.gameTutor.title(game.title)}</PageTitle>
        <p className="mt-1 font-medium">
          {t.games.players(game.white, game.black)} · {t.games.meta(game.event, game.year)}
        </p>
      </header>

      {/* Istruzione e riscontro: in alto, grandi, leggibili da lontano. */}
      <div
        role="status"
        aria-live="polite"
        data-testid="tutor-instruction"
        data-tone={feedback?.tone ?? 'info'}
        className={`space-y-2 rounded-2xl border-2 px-4 py-3 ${
          feedback?.tone === 'good' ? 'border-ok bg-ok-soft' : feedback?.tone === 'bad' ? 'border-bad bg-surface' : 'border-line bg-surface'
        }`}
      >
        {feedback && (
          <p className={`font-display text-xl font-semibold ${feedback.tone === 'good' ? 'text-ok' : feedback.tone === 'bad' ? 'text-bad' : ''}`} data-testid="tutor-feedback">
            {feedback.text}
          </p>
        )}
        {explanation && !session.deviation && (
          <p className="text-base" data-testid="tutor-explanation">
            {explanation.text}
          </p>
        )}
        {judgement.status === 'busy' && <p className="text-sm text-muted">{t.gameTutor.evaluating}</p>}
        {instruction && (
          <p className="text-lg font-semibold" data-testid="tutor-next">
            {instruction}
          </p>
        )}
        {!guess && !finished && !session.deviation && <p className="text-sm text-muted">{t.gameTutor.playForHelp}</p>}
        <div className="flex flex-wrap gap-2">
          {guess && !finished && !session.deviation && !showHint && (
            <Button variant="secondary" size="sm" icon={<Icon name="bulb" size={16} />} onClick={() => setShowHint(true)} data-testid="tutor-hint">
              {t.gameTutor.hint}
            </Button>
          )}
          {session.deviation && apiKey && judgement.status === 'done' && (
            <Button variant="secondary" size="sm" icon={<Icon name="chat" size={16} />} onClick={() => void askWhy()} disabled={why.status === 'busy'} data-testid="tutor-why">
              {why.status === 'busy' ? t.gameTutor.whyBusy : t.gameTutor.why}
            </Button>
          )}
          {session.deviation && (
            <Button variant="secondary" size="sm" icon={<Icon name="undo" size={16} />} onClick={() => correct({ id: 'takeback', fen: session.fen, kind: 'takeback' })} data-testid="tutor-takeback">
              {t.gameTutor.restored}
            </Button>
          )}
        </div>
        {why.status === 'done' && (
          <p className="text-base" data-testid="tutor-why-text">
            {why.value}
          </p>
        )}
        <p className="text-xs text-muted" data-testid="tutor-score">
          {t.gameTutor.score(session.found, parsed.moves.filter((m) => side === 'both' || m.color === side).length)}
          {apiKey ? ` · ${t.gameTutor.prefetch(readyAhead)}` : ''}
        </p>
      </div>

      {unsure && (
        <Card className="space-y-2" data-testid="tutor-unsure">
          <p className="font-semibold">{t.gameTutor.unsure}</p>
          <div className="flex flex-wrap gap-2">
            {unsure.map((r) => (
              <Button key={r.transition.id} variant="secondary" size="sm" onClick={() => correct(r.transition)}>
                {r.transition.kind === 'takeback' ? t.gameTutor.takebackOption : sanToLocal(r.transition.san ?? r.transition.id)}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => correct(null)}>
              {t.gameTutor.noneOfThese}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card className="space-y-3">
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">{t.gameTutor.sideLabel}</legend>
            <div className="flex flex-wrap gap-2" data-testid="tutor-side">
              {(['w', 'b', 'both'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={side === s}
                  onClick={() => setSide(s)}
                  className={`min-h-10 rounded-xl border-2 px-4 text-sm font-semibold ${side === s ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
                >
                  {t.gameTutor.sides[s]}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">{t.gameTutor.sideHelp}</p>
          </fieldset>

          <div className="overflow-hidden rounded-2xl border border-line bg-surface-2">
            {stream ? (
              <div className="relative w-full bg-black" style={{ aspectRatio: aspect }}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  onLoadedMetadata={(e) => onVideoReady(e.currentTarget)}
                  className="absolute inset-0 size-full object-contain"
                  data-testid="tutor-video"
                />
                {corners && (
                  <BoardOverlay
                    corners={corners}
                    view={view}
                    pieces={fen.split(' ')[0]}
                    arrows={overlayArrows}
                    onChange={setCorners}
                    onChangeEnd={(next) => {
                      saveCalibration(next, aspect);
                      setCalibrationNote(t.gameTutor.calibration.saved);
                      trackerRef.current?.resync();
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 p-4 text-center text-muted">
                <Icon name="camera" size={40} />
                <ol className="list-decimal space-y-1 pl-5 text-left text-sm">
                  {t.gameTutor.calibration.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
          {cameraError && (
            <p role="alert" className="text-sm font-semibold text-bad">
              {t.gameTutor.cameraDenied}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {stream ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => void autoDetect()} disabled={detecting} data-testid="tutor-autodetect">
                  {detecting ? t.gameTutor.calibration.autoBusy : t.gameTutor.calibration.auto}
                </Button>
                <Button variant="secondary" size="sm" onClick={rotateView} data-testid="tutor-rotate">
                  {t.gameTutor.calibration.rotate}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => trackerRef.current?.resync()} data-testid="tutor-resync">
                  {t.gameTutor.calibration.resync}
                </Button>
                <Button variant="ghost" size="sm" onClick={stopCamera}>
                  {t.gameTutor.cameraStop}
                </Button>
              </>
            ) : (
              <Button icon={<Icon name="camera" size={18} />} onClick={() => void startCamera()} data-testid="tutor-camera-start">
                {t.gameTutor.cameraStart}
              </Button>
            )}
          </div>
          {stream && (
            <p className="text-sm" data-testid="tutor-status" data-status={status}>
              <span className="font-semibold">{t.gameTutor.status[status]}</span>
              <span className="text-muted"> · {t.gameTutor.calibration.view(viewSide)}</span>
            </p>
          )}
          {calibrationNote && stream && (
            <p className="text-xs text-muted" data-testid="tutor-calibration-note">
              {calibrationNote}
            </p>
          )}
          {stream && preview && (
            <div className="max-w-56">
              <RectifiedPreview image={preview} label={t.gameTutor.calibration.preview} />
            </div>
          )}
          {!apiKey && <p className="text-xs text-muted">{t.gameTutor.noKey}</p>}
        </Card>

        <Card className="space-y-3">
          <SectionTitle>{t.gameTutor.boardTitle}</SectionTitle>
          <ChessBoard
            fen={fen}
            orientation={orientation}
            interactive={!finished}
            onMove={playUci}
            arrows={boardArrows}
            lastMove={lastMove && !session.deviation ? { from: lastMove.from, to: lastMove.to } : null}
            lastMoveTone="neutral"
          />
          <p className="text-xs text-muted">{t.gameTutor.boardHelp}</p>
          <div className="space-y-2 rounded-xl border border-line p-3">
            <p className="text-sm font-semibold">{t.gameTutor.manualTitle}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const next = skipMove(parsed, session);
                  setSession(next);
                  trackerRef.current?.commit(boardFen(next));
                  if (next.ply > session.ply) {
                    const text = explanationFor(next.ply);
                    setExplanation({ ply: next.ply, text });
                    setFeedback({ tone: 'info', text: t.gameTutor.played(moveLabel(parsed.moves[next.ply - 1]!)) });
                  }
                }}
                disabled={finished}
                data-testid="tutor-skip"
              >
                {t.gameTutor.skip}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const next = undoMove(parsed, session);
                  setSession(next);
                  trackerRef.current?.commit(boardFen(next));
                  setFeedback(null);
                  setExplanation(null);
                }}
                disabled={session.ply === 0 && !session.deviation}
                data-testid="tutor-undo"
              >
                {t.gameTutor.undo}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted tabular-nums">{t.games.position(session.ply, parsed.moves.length)}</p>
        </Card>
      </div>
    </div>
  );
}
