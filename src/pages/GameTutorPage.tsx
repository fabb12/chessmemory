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
import { instruction as moveInstruction, reasonOf } from '../features/tutor/moveReason';
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
/** Quanto si aspetta la spiegazione di Claude prima di leggere quella locale. */
const SPEECH_WAIT_MS = 3500;

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

  const [side, setSideState] = useState<UserSide>('none');
  const sideRef = useRef<UserSide>('none');
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
  const [, setTextsVersion] = useState(0);
  const speechTokenRef = useRef(0);
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
    void cache.warm(parsed.moves.map((_, k) => key(k + 1))).then(() => setTextsVersion((v) => v + 1));
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
        setTextsVersion((v) => v + 1);
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
      if (!parsed || !move) return '';
      return (
        queueRef.current?.peek(ply) ??
        (game ? getExplanationCache().peek(explanationKey(game.id, ply)) : undefined) ??
        reasonOf(fenAt(parsed, ply - 1), move, parsed.moves[ply - 2])
      );
    },
    [parsed, game],
  );

  // A ogni nuova posizione: Stockfish la analizza subito (pronto se l'utente devia) e la coda avanza.
  useEffect(() => {
    if (!parsed || !session || session.deviation || isFinished(parsed, session)) return;
    if (isGuessTurn(parsed, session, side)) void analysisOf(session.fen).catch(() => undefined);
    queueRef.current?.advance(session.ply + 1);
  }, [parsed, session, side, analysisOf]);

  /**
   * Dice a voce che cosa fare adesso: la mossa da eseguire (pezzo, casa di partenza
   * e di arrivo) con il perché, oppure «tocca a te» se la mossa va indovinata.
   * `prefix` è il riscontro sulla mossa appena fatta. Se la spiegazione di Claude
   * è in arrivo la si aspetta un poco, poi si legge quella locale.
   */
  const announce = useCallback(
    (state: SessionState, prefix = '') => {
      if (!parsed || !game) return;
      const token = ++speechTokenRef.current;
      const say = (text: string) => {
        if (token === speechTokenRef.current) speak(`${prefix} ${text}`.trim(), 'game-tutor');
      };
      if (isFinished(parsed, state)) return say(t.gameTutor.finished(t.games.result[game.result] ?? game.result));
      if (state.deviation) return say('');
      const move = expectedMove(parsed, state)!;
      if (isGuessTurn(parsed, state, sideRef.current)) return say(t.gameTutor.yourTurn(move.color === 'w' ? game.white : game.black));
      const ply = state.ply + 1;
      const what = moveInstruction(state.fen, move);
      const queue = queueRef.current;
      if (!queue || queue.peek(ply) !== undefined) return say(`${what} ${t.gameTutor.why}: ${explanationFor(ply)}`);
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), SPEECH_WAIT_MS));
      void Promise.race([queue.get(ply), timeout]).then(() => say(`${what} ${t.gameTutor.why}: ${explanationFor(ply)}`));
    },
    [parsed, game, explanationFor],
  );

  const setSide = (next: UserSide) => {
    sideRef.current = next;
    setSideState(next);
    if (sessionRef.current) announce(sessionRef.current);
  };

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
        announce(next, t.gameTutor.takenBack);
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
        setJudgement({ status: 'idle' });
        setShowHint(false);
        if (!guess) {
          // Mossa eseguita su indicazione: il perché è già stato detto, si passa alla prossima.
          setFeedback({ tone: 'good', text: t.gameTutor.played(label) });
          setExplanation(null);
          announce(state, t.gameTutor.done);
          return;
        }
        const head = outcome.firstTry ? t.gameTutor.correct(label) : t.gameTutor.correctLater(label);
        const text = explanationFor(ply);
        setFeedback({ tone: 'good', text: head });
        setExplanation({ ply, text });
        announce(state, `${head} ${text}`);
        return;
      }
      if (outcome.kind === 'deviation') {
        const played = sanToLocal(outcome.deviation.san);
        setShowHint(true);
        if (!guess) {
          const expected = expectedMove(parsed, current)!;
          const text = t.gameTutor.deviationWrongOrder(moveInstruction(current.fen, expected));
          setFeedback({ tone: 'bad', text });
          speechTokenRef.current++;
          speak(text, 'game-tutor');
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
    [parsed, game, side, setSession, explanationFor, analysisOf, announce],
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
    if (sessionRef.current) announce(sessionRef.current);
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
        setCalibrationNote(t.gameTutor.calibration.autoFound);
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
  // Freccia: sempre per le mosse da eseguire su indicazione; per quelle da indovinare solo come suggerimento.
  const hintMove = expected && (!guess || showHint) ? expected : null;
  const overlayArrows: OverlayArrow[] = hintMove && !session.deviation ? [{ from: hintMove.from, to: hintMove.to, tone: 'hint' }] : [];
  const boardArrows: BoardArrow[] = hintMove && !session.deviation ? [{ from: hintMove.from, to: hintMove.to, tone: 'teach' }] : [];
  if (session.deviation) boardArrows.push({ from: session.deviation.uci.slice(0, 2), to: session.deviation.uci.slice(2, 4), tone: 'bad' });
  const orientation = side === 'b' ? 'black' : 'white';
  // Prossima mossa: pezzo da muovere, case e perché (per le mosse da eseguire, o col suggerimento).
  const next =
    expected && !finished && !session.deviation
      ? {
          heading: t.gameTutor.moveNumber(expected.moveNumber, t.sides[expected.color], playerOf(expected.color)),
          what: moveInstruction(session.fen, expected),
          why: explanationFor(session.ply + 1),
        }
      : null;

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

  const jump = (target: SessionState) => {
    setSession(target);
    trackerRef.current?.commit(boardFen(target));
    setFeedback(null);
    setExplanation(null);
    setJudgement({ status: 'idle' });
    setShowHint(false);
    announce(target);
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

      <fieldset>
        <legend className="mb-1 text-sm font-semibold">{t.gameTutor.sideLabel}</legend>
        <div className="flex flex-wrap gap-2" data-testid="tutor-side">
          {(['none', 'w', 'b', 'both'] as const).map((s) => (
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
      </fieldset>

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

        {finished && (
          <p className="text-lg font-semibold" data-testid="tutor-next">
            {t.gameTutor.finished(t.games.result[game.result] ?? game.result)}
          </p>
        )}
        {next && guess && (
          <p className="text-lg font-semibold" data-testid="tutor-next">
            {t.gameTutor.yourTurn(playerOf(expected!.color))}
          </p>
        )}
        {next && (!guess || showHint) && (
          <div className="space-y-1" data-testid="tutor-move">
            <p className="text-sm font-semibold text-muted">{next.heading}</p>
            {!guess && (
              <p className="font-display text-2xl font-semibold" data-testid="tutor-next">
                {next.what}
              </p>
            )}
            {guess && <p className="text-lg font-semibold">{next.what}</p>}
            {!guess && next.why && (
              <p className="text-base" data-testid="tutor-why-move">
                <span className="font-semibold">{t.gameTutor.why}: </span>
                {next.why}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!finished && !session.deviation && (
            <Button variant="secondary" size="sm" icon={<Icon name="speaker" size={16} />} onClick={() => announce(session)} data-testid="tutor-repeat">
              {t.gameTutor.repeat}
            </Button>
          )}
          {guess && !finished && !session.deviation && !showHint && (
            <Button variant="secondary" size="sm" icon={<Icon name="bulb" size={16} />} onClick={() => setShowHint(true)} data-testid="tutor-hint">
              {t.gameTutor.hint}
            </Button>
          )}
          {session.deviation && apiKey && judgement.status === 'done' && (
            <Button variant="secondary" size="sm" icon={<Icon name="chat" size={16} />} onClick={() => void askWhy()} disabled={why.status === 'busy'} data-testid="tutor-why">
              {why.status === 'busy' ? t.gameTutor.whyBusy : t.gameTutor.whyDeviation}
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
        {side !== 'none' && (
          <p className="text-xs text-muted" data-testid="tutor-score">
            {t.gameTutor.score(session.found, parsed.moves.filter((m) => side === 'both' || m.color === side).length)}
          </p>
        )}
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
                      setCalibrationNote(null);
                      trackerRef.current?.resync();
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 p-4 text-center text-muted">
                <Icon name="camera" size={40} />
                <p className="text-sm">{t.gameTutor.framing}</p>
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
            <p className="text-sm" data-testid="tutor-calibration-note">
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
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => jump(undoMove(parsed, session))} disabled={session.ply === 0 && !session.deviation} data-testid="tutor-undo">
              {t.gameTutor.undo}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => jump(skipMove(parsed, session))} disabled={finished} data-testid="tutor-skip">
              {t.gameTutor.skip}
            </Button>
            <span className="ml-auto text-xs text-muted tabular-nums">{t.games.position(session.ply, parsed.moves.length)}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
