import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard, type BoardArrow } from '../components/chess/ChessBoard';
import { RobotAvatar } from '../components/play/RobotAvatar';
import { Button } from '../components/ui/Button';
import { Card, PageTitle, SectionTitle } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { SpeakButton } from '../components/ui/SpeakButton';
import type { Profile } from '../db/schema';
import { getEngine, type Analysis } from '../features/engine/engine';
import { explainAiMove, explainUserMove, feedbackText, type UserMoveFeedback } from '../features/play/coach';
import { isPlayLevel, pickAiMove, PLAY_LEVEL_IDS, PLAY_LEVELS, suggestedLevel, type PlayLevelId } from '../features/play/levels';
import {
  announceOwnMove,
  askNameLine,
  engineErrorLine,
  greetByName,
  greeting,
  nameRetryLine,
  hintLine,
  idleLine,
  outcomeLine,
  reactToGrade,
  reactToUserMove,
  undoLine,
  type RobotLine,
  type RobotMood,
} from '../features/play/robot';
import { getTone, useTone } from '../features/tutor/tone';
import { loadUserName, saveUserName } from '../features/tutor/userName';
import { isEcho, listeningSupported, parseName, VoiceListener } from '../features/voice/listen';
import { currentSpeakingId, currentSpeechText, getVoiceAuto, speak, speakNext, stopSpeaking, useSpeakingId } from '../features/voice/speech';
import { t } from '../i18n';
import type { Side, Uci } from '../types';
import { applyUci, sideToMove } from '../utils/chess';
import { sanToLocal } from '../utils/notation';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
/** Profondità delle analisi del tutor (giudizio delle mosse). */
const TUTOR_DEPTH = 12;
const TUTOR_PV = 3;
/** Pausa prima della mossa dell'AI: una risposta istantanea disorienta. */
const AI_DELAY_MS = 450;
const PREFS_KEY = 'cm.play.prefs';
/** Voce di Benbot: un po' più acuta e svelta di quella del sistema. */
const ROBOT_VOICE = 'play-robot';
const ROBOT_SPEECH = { pitch: 1.3, rate: 1.05 };

/** Una battuta di Benbot nel fumetto. */
interface Said extends RobotLine {
  id: number;
  /** Testo letto ad alta voce, se più ricco di quello del fumetto. */
  spoken?: string;
  testId?: string;
}

interface SayOptions {
  /** Sostituisce quello che Benbot stava dicendo (e interrompe la voce). */
  fresh?: boolean;
  spoken?: string;
  testId?: string;
}

type ColorChoice = Side | 'random';

interface Prefs {
  level: PlayLevelId;
  color: ColorChoice;
  tutor: boolean;
}

interface Ply {
  fenBefore: string;
  uci: Uci;
  san: string;
  color: Side;
  fen: string;
}

interface GameSetup {
  userColor: Side;
  level: PlayLevelId;
}

type Outcome = 'win' | 'loss' | 'draw' | 'resigned';

function loadPrefs(fallback: PlayLevelId): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<Prefs> | null;
    return {
      level: isPlayLevel(raw?.level) ? raw.level : fallback,
      color: raw?.color === 'w' || raw?.color === 'b' || raw?.color === 'random' ? raw.color : 'w',
      tutor: typeof raw?.tutor === 'boolean' ? raw.tutor : true,
    };
  } catch {
    return { level: fallback, color: 'w', tutor: true };
  }
}

function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Archiviazione non disponibile (navigazione privata): le scelte valgono solo ora.
  }
}

function outcomeOf(fen: string, userColor: Side): Outcome | null {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) return chess.turn() === userColor ? 'loss' : 'win';
  if (chess.isDraw() || chess.isStalemate()) return 'draw';
  return null;
}

const GRADE_TONE: Record<string, string> = {
  best: 'border-ok/50 bg-ok-soft',
  good: 'border-ok/40 bg-ok-soft',
  inaccuracy: 'border-warn/50 bg-warn-soft',
  mistake: 'border-bad/40 bg-bad-soft',
  blunder: 'border-bad/60 bg-bad-soft',
};

export function PlayPage({ profile }: { profile: Profile }) {
  const fallbackLevel = suggestedLevel(profile.adaptive.level, profile.declaredLevel);
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs(fallbackLevel));
  const [setup, setSetup] = useState<GameSetup | null>(null);
  const [plies, setPlies] = useState<Ply[]>([]);
  const [resigned, setResigned] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [judging, setJudging] = useState(false);
  const [engineError, setEngineError] = useState(false);
  const [said, setSaid] = useState<Said[]>([]);
  const [feedback, setFeedback] = useState<(UserMoveFeedback & { fenBefore: string; ply: number }) | null>(null);
  const [grades, setGrades] = useState<Record<number, string>>({});
  const [hint, setHint] = useState<Uci | null>(null);
  const [preview, setPreview] = useState(false);
  /** Come ti chiami: Benbot lo chiede all'inizio e lo ascolta col microfono. */
  const [name, setName] = useState(loadUserName);
  const [askingName, setAskingName] = useState(false);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const listenerRef = useRef<VoiceListener | null>(null);
  /** Frasi dette da Benbot mentre chiede il nome: il microfono non deve scambiarle per una risposta. */
  const askedRef = useRef<string[]>([]);
  const retriesRef = useRef(0);
  const setupRef = useRef(setup);
  setupRef.current = setup;

  /** Cambia a ogni nuova partita o annullamento: i risultati vecchi vanno scartati. */
  const token = useRef(0);
  const aiPendingFor = useRef<string | null>(null);
  /** Mosse giocate finora: un commento arrivato dopo una mossa successiva è superato. */
  const plyCount = useRef(0);
  plyCount.current = plies.length;
  const cache = useRef(new Map<string, Promise<Analysis>>());
  const saidId = useRef(0);
  const speakingId = useSpeakingId();
  const tone = useTone();

  /** Benbot dice una battuta: compare nel fumetto e, con la lettura automatica, la pronuncia. */
  const say = useCallback((line: RobotLine | null, options: SayOptions = {}) => {
    if (!line?.text) return;
    const entry: Said = { ...line, id: ++saidId.current, spoken: options.spoken, testId: options.testId };
    setSaid((current) => (options.fresh ? [entry] : [...current, entry]));
    if (!getVoiceAuto()) return;
    (options.fresh ? speak : speakNext)(options.spoken ?? line.text, ROBOT_VOICE, ROBOT_SPEECH);
  }, []);

  /** Benbot tace: fumetto vuoto e voce ferma. */
  const hush = useCallback(() => {
    setSaid([]);
    stopSpeaking();
  }, []);

  // Uscendo dalla pagina Benbot smette di parlare e il microfono si spegne.
  useEffect(
    () => () => {
      listenerRef.current?.stop();
      if (currentSpeakingId() === ROBOT_VOICE) stopSpeaking();
    },
    [],
  );

  const stopMic = useCallback(() => {
    listenerRef.current?.stop();
    listenerRef.current = null;
    setListening(false);
  }, []);

  /** Fine della domanda sul nome: con il nome (appena detto) o senza (saltata). */
  const finishName = useCallback(
    (heard: string | null) => {
      stopMic();
      setAskingName(false);
      setNameDraft('');
      const current = setupRef.current;
      if (!current) return;
      if (heard) setName(saveUserName(heard));
      say(heard ? greetByName(heard, current.userColor, prefs.tutor, true, getTone()) : greeting(current.userColor, prefs.tutor, getTone()), { fresh: true });
    },
    [stopMic, say, prefs.tutor],
  );

  /** Quello che il microfono sente mentre Benbot aspetta il nome. */
  const onHeardName = (text: string) => {
    // L'eco della voce di Benbot (il microfono sente l'altoparlante) non è una risposta.
    const spoken = [currentSpeechText(), ...askedRef.current];
    if (spoken.some((line) => isEcho(text, line))) return;
    const heard = parseName(text);
    if (heard && heard.toLowerCase() !== t.play.robot.name.toLowerCase()) return finishName(heard);
    if (currentSpeakingId() === ROBOT_VOICE) return;
    retriesRef.current++;
    const retry = nameRetryLine();
    askedRef.current.push(retry.text);
    say(retry, { fresh: true });
    // Dopo due tentativi il microfono si spegne: resta la casella per scriverlo.
    if (retriesRef.current >= 2) stopMic();
  };
  const onHeardNameRef = useRef(onHeardName);
  onHeardNameRef.current = onHeardName;

  // Il microfono si accende quando Benbot ha finito la domanda (così non sente sé stesso).
  useEffect(() => {
    if (!askingName || listenerRef.current || micError || retriesRef.current >= 2 || speakingId === ROBOT_VOICE) return;
    if (!listeningSupported()) {
      setMicError(true);
      return;
    }
    const listener = new VoiceListener({
      onHeard: (text) => onHeardNameRef.current(text),
      onError: () => {
        stopMic();
        setMicError(true);
      },
    });
    if (!listener.start()) {
      setMicError(true);
      return;
    }
    listenerRef.current = listener;
    setListening(true);
  }, [askingName, speakingId, micError, stopMic]);

  const updatePrefs = (patch: Partial<Prefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      savePrefs(next);
      return next;
    });
  };

  const analyse = useCallback((fen: string, depth: number, multiPv: number): Promise<Analysis> => {
    const key = `${fen}|${depth}|${multiPv}`;
    let job = cache.current.get(key);
    if (!job) {
      job = getEngine().analyse(fen, { depth, multiPv });
      job.catch(() => cache.current.delete(key));
      cache.current.set(key, job);
    }
    return job;
  }, []);

  const fen = plies.at(-1)?.fen ?? START_FEN;
  const turn = sideToMove(fen);
  const outcome: Outcome | null = setup ? (resigned ? 'resigned' : outcomeOf(fen, setup.userColor)) : null;
  const userTurn = Boolean(setup && !outcome && turn === setup.userColor);
  const tutor = prefs.tutor;

  // Turno dell'AI: Stockfish analizza e la mossa viene scelta secondo il livello.
  useEffect(() => {
    // Mentre Benbot chiede il nome aspetta la risposta prima di muovere.
    if (!setup || outcome || turn === setup.userColor || engineError || askingName) return;
    if (aiPendingFor.current === fen) return;
    aiPendingFor.current = fen;
    const tk = token.current;
    const level = PLAY_LEVELS[setup.level];
    const previous = plies.at(-1);
    setThinking(true);
    void (async () => {
      try {
        const [analysis] = await Promise.all([
          analyse(fen, level.depth, level.multiPv),
          new Promise((resolve) => window.setTimeout(resolve, AI_DELAY_MS)),
        ]);
        if (tk !== token.current) return;
        const uci = pickAiMove(analysis, level);
        const move = uci ? applyUci(fen, uci) : null;
        if (!move) return;
        setPlies((list) => [...list, { fenBefore: fen, uci: move.uci, san: move.san, color: move.color, fen: move.fen }]);
        setThinking(false);
        if (!tutor) {
          say(announceOwnMove(move, plies.length, getTone()));
          return;
        }
        const aiPly = plies.length + 1;
        const reply = await analyse(move.fen, TUTOR_DEPTH, TUTOR_PV);
        // Se intanto hai già mosso, il commento sulla mossa dell'AI non serve più.
        if (tk !== token.current || plyCount.current !== aiPly) return;
        const note = explainAiMove(fen, move.uci, analysis, reply, previous ? { fenBefore: previous.fenBefore, uci: previous.uci } : undefined);
        if (note) say({ text: note.text, mood: note.opportunity ? 'worried' : 'idle' }, { testId: 'tutor-ai-note' });
      } catch {
        if (tk === token.current) setEngineError(true);
      } finally {
        if (tk === token.current) {
          setThinking(false);
          aiPendingFor.current = null;
        }
      }
    })();
  }, [setup, outcome, turn, fen, plies, analyse, tutor, engineError, say, askingName]);

  // Fine partita e motore guasto: Benbot lo dice.
  useEffect(() => {
    if (outcome) say(outcomeLine(outcome, getTone()), { fresh: outcome === 'resigned' });
  }, [outcome, say]);
  useEffect(() => {
    if (engineError) say(engineErrorLine(), { fresh: true });
  }, [engineError, say]);

  const startGame = () => {
    token.current++;
    aiPendingFor.current = null;
    const userColor: Side = prefs.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : prefs.color;
    setSetup({ userColor, level: prefs.level });
    setPlies([]);
    setResigned(false);
    setThinking(false);
    setJudging(false);
    setEngineError(false);
    setFeedback(null);
    setGrades({});
    setHint(null);
    setPreview(false);
    stopMic();
    retriesRef.current = 0;
    setMicError(false);
    if (name) {
      setAskingName(false);
      say(greetByName(name, userColor, prefs.tutor, false, getTone()), { fresh: true });
      return;
    }
    // Non sa ancora come ti chiami: lo chiede e poi accende il microfono.
    const ask = askNameLine(getTone());
    askedRef.current = [ask.text];
    setAskingName(true);
    say(ask, { fresh: true });
  };

  /** Il nome scritto nella casella (se il microfono non c'è o non ha capito). */
  const submitName = (event: FormEvent) => {
    event.preventDefault();
    const typed = nameDraft.trim();
    if (typed) finishName(typed.charAt(0).toUpperCase() + typed.slice(1));
  };

  const onMove = (uci: Uci) => {
    if (!setup || !userTurn || thinking) return;
    const move = applyUci(fen, uci);
    if (!move) return;
    const fenBefore = fen;
    const ply = plies.length + 1;
    const previous = plies.at(-1);
    setPlies((list) => [...list, { fenBefore, uci: move.uci, san: move.san, color: move.color, fen: move.fen }]);
    setHint(null);
    setPreview(false);
    // Muovere mentre Benbot aspetta il nome: si gioca, il nome si chiederà un'altra volta.
    if (askingName) {
      stopMic();
      setAskingName(false);
    }
    if (!tutor) {
      // Senza tutor Benbot reagisce «a caldo» a catture, scacchi, arrocchi.
      const reaction = reactToUserMove(fenBefore, move, ply, getTone());
      if (reaction) say(reaction, { fresh: true });
      else hush();
      return;
    }
    hush();
    const tk = token.current;
    setJudging(true);
    setFeedback(null);
    void (async () => {
      try {
        const before = await analyse(fenBefore, TUTOR_DEPTH, TUTOR_PV);
        const after = await analyse(move.fen, TUTOR_DEPTH, TUTOR_PV);
        if (tk !== token.current) return;
        const result = explainUserMove(fenBefore, move.uci, before, after, previous ? { fenBefore: previous.fenBefore, uci: previous.uci } : undefined);
        if (result) {
          setFeedback({ ...result, fenBefore, ply });
          setGrades((g) => ({ ...g, [ply]: result.grade }));
          const reaction = reactToGrade(result.grade, ply, getTone());
          say(reaction, { spoken: [reaction.text, result.why, result.better].filter(Boolean).join(' ') });
        }
      } catch {
        if (tk === token.current) setEngineError(true);
      } finally {
        if (tk === token.current) setJudging(false);
      }
    })();
  };

  /** Torna a prima dell'ultima mossa propria, per riprovarla. */
  const undo = () => {
    if (!setup) return;
    let index = -1;
    for (let i = plies.length - 1; i >= 0; i--) {
      if (plies[i]!.color === setup.userColor) {
        index = i;
        break;
      }
    }
    if (index < 0) return;
    token.current++;
    aiPendingFor.current = null;
    setPlies(plies.slice(0, index));
    setResigned(false);
    setThinking(false);
    setJudging(false);
    setFeedback(null);
    setHint(null);
    setPreview(false);
    say(undoLine(index, getTone()), { fresh: true });
  };

  const showHint = async () => {
    const tk = token.current;
    try {
      const analysis = await analyse(fen, TUTOR_DEPTH, TUTOR_PV);
      if (tk !== token.current) return;
      const best = analysis.lines[0]?.pv[0] ?? null;
      setHint(best);
      const san = best ? applyUci(fen, best)?.san : null;
      if (san) say(hintLine(sanToLocal(san), getTone()), { fresh: true });
    } catch {
      setEngineError(true);
    }
  };

  const arrows = useMemo<BoardArrow[]>(() => {
    if (preview && feedback) {
      const list: BoardArrow[] = [];
      if (feedback.bestUci) list.push({ from: feedback.bestUci.slice(0, 2), to: feedback.bestUci.slice(2, 4), tone: 'good' });
      const played = plies[feedback.ply - 1];
      if (played) list.push({ from: played.uci.slice(0, 2), to: played.uci.slice(2, 4), tone: 'bad' });
      return list;
    }
    if (hint && userTurn) return [{ from: hint.slice(0, 2), to: hint.slice(2, 4), tone: 'teach' }];
    return [];
  }, [preview, feedback, hint, userTurn, plies]);

  const last = plies.at(-1);
  const lastTone = last && last.color === setup?.userColor && feedback?.ply === plies.length && ['mistake', 'blunder'].includes(feedback.grade) ? 'bad' : 'neutral';
  const counts = Object.values(grades).reduce(
    (acc, g) => ({ mistakes: acc.mistakes + (g === 'mistake' ? 1 : 0), blunders: acc.blunders + (g === 'blunder' ? 1 : 0) }),
    { mistakes: 0, blunders: 0 },
  );

  const speaking = speakingId !== null;
  const mood: RobotMood = thinking && !speaking ? 'thinking' : (said.findLast((line) => line.mood !== 'idle')?.mood ?? 'idle');
  const lastSaid = said.at(-1);
  /** Toccando Benbot: tace se sta parlando, altrimenti ripete quello che ha detto. */
  const toggleRobotVoice = () => {
    if (speaking) return stopSpeaking();
    const text = said.length ? said.map((line) => line.spoken ?? line.text).join(' ') : idleLine(thinking, plies.length, tone);
    speak(text, ROBOT_VOICE, ROBOT_SPEECH);
  };

  if (!setup) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex animate-rise items-center gap-4">
          <RobotAvatar mood="happy" waving className="h-28 w-auto shrink-0 text-fg sm:h-32" />
          <div className="min-w-0">
            <PageTitle>{t.play.title}</PageTitle>
            <p className="mt-1.5 text-lg text-muted">{t.play.intro}</p>
          </div>
        </header>

        <Card className="space-y-6" data-testid="play-setup">
          <fieldset>
            <legend className="font-display text-xl font-semibold">{t.play.levelLabel}</legend>
            <p className="mt-1 text-sm text-muted">{t.play.levelHint}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {PLAY_LEVEL_IDS.map((id) => {
                const active = prefs.level === id;
                return (
                  <label
                    key={id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors ${
                      active ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="play-level"
                      className="mt-1 accent-accent"
                      checked={active}
                      onChange={() => updatePrefs({ level: id })}
                      data-testid={`play-level-${id}`}
                    />
                    <span>
                      <span className="block font-semibold">
                        {t.play.levels[id]!.name} <span className="text-sm font-normal text-muted">· {t.play.elo(PLAY_LEVELS[id].elo)}</span>
                      </span>
                      <span className="block text-sm text-muted">{t.play.levels[id]!.text}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-display text-xl font-semibold">{t.play.colorLabel}</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {(['w', 'b', 'random'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={prefs.color === c}
                  onClick={() => updatePrefs({ color: c })}
                  data-testid={`play-color-${c}`}
                  className={`min-h-11 rounded-2xl border px-4 font-semibold ${
                    prefs.color === c ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface hover:border-accent/40'
                  }`}
                >
                  {t.play.colors[c]}
                </button>
              ))}
            </div>
          </fieldset>

          <TutorToggle on={tutor} onChange={(on) => updatePrefs({ tutor: on })} />

          {name && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted" data-testid="play-known-name">
              {t.play.robot.knownName(name)}
              <button type="button" className="font-semibold text-accent underline" onClick={() => setName(saveUserName(''))} data-testid="play-change-name">
                {t.play.robot.changeName}
              </button>
            </p>
          )}

          <Button size="lg" block onClick={startGame} data-testid="play-start" icon={<Icon name="play" />}>
            {t.play.start}
          </Button>
        </Card>
      </div>
    );
  }

  const status = outcome
    ? t.play.result[outcome]
    : engineError
      ? t.play.engineError
      : thinking
        ? t.play.aiThinking
        : t.play.yourTurn;

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <PageTitle className="mr-auto text-2xl sm:text-3xl">{t.play.title}</PageTitle>
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-sm font-semibold" data-testid="play-level-badge">
            {t.play.levelBadge(t.play.levels[setup.level]!.name)}
          </span>
        </div>
        <ChessBoard
          fen={preview && feedback ? feedback.fenBefore : fen}
          orientation={setup.userColor === 'w' ? 'white' : 'black'}
          interactive={userTurn && !thinking && !preview && !engineError}
          onMove={onMove}
          arrows={arrows}
          lastMove={preview ? null : last ? { from: last.uci.slice(0, 2), to: last.uci.slice(2, 4) } : null}
          lastMoveTone={lastTone}
        />
        <div className="flex items-center justify-center gap-3">
          <p role="status" aria-live="polite" className="text-center font-semibold" data-testid="play-status">
            {status}
          </p>
          {!outcome && (
            <button
              type="button"
              onClick={showHint}
              disabled={!userTurn || thinking || engineError}
              title={t.play.hint}
              aria-label={t.play.hint}
              aria-pressed={Boolean(hint && userTurn)}
              data-testid="play-hint"
              className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-40 ${
                hint && userTurn ? 'border-warn bg-warn-soft text-warn' : 'border-line bg-surface text-fg hover:border-warn hover:text-warn'
              }`}
            >
              <Icon name="bulb" size={22} />
            </button>
          )}
        </div>
        {hint && userTurn && (
          <p className="text-center text-sm" data-testid="play-hint-text">
            {t.play.hintText(sanToLocal(applyUci(fen, hint)?.san ?? hint))}
          </p>
        )}
        {outcome && outcome !== 'resigned' && tutor && (
          <p className="text-center text-sm text-muted" data-testid="play-summary">
            {t.play.summary(counts.mistakes, counts.blunders)}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-3" data-testid="robot">
          <button
            type="button"
            onClick={toggleRobotVoice}
            title={speaking ? t.play.robot.stop : t.play.robot.repeat}
            aria-label={speaking ? t.play.robot.stop : t.play.robot.repeat}
            data-testid="robot-button"
            className="shrink-0 rounded-3xl p-1 text-fg transition-transform hover:scale-105 active:scale-95"
          >
            <RobotAvatar
              mood={mood}
              speaking={speaking}
              waving={lastSaid ? lastSaid.mood === 'happy' || lastSaid.mood === 'wow' : false}
              waveKey={lastSaid?.id}
              className="h-28 w-auto sm:h-32"
            />
          </button>
          <div className="relative mt-3 min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-line bg-surface p-3 shadow-sm" data-testid="robot-bubble">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">{t.play.robot.name}</p>
            {said.length === 0 ? (
              <p className="mt-1 text-muted">{idleLine(thinking || judging, plies.length, tone)}</p>
            ) : (
              said.map((line) => (
                <p key={line.id} className="mt-1 animate-rise" data-testid={line.testId}>
                  {line.text}
                </p>
              ))
            )}
            {askingName && (
              <form onSubmit={submitName} className="mt-3 space-y-2 border-t border-line pt-3" data-testid="play-name">
                {listening && (
                  <p className="flex items-center gap-2 text-sm font-semibold text-accent" data-testid="play-name-listening">
                    <span className="relative inline-flex size-8 items-center justify-center rounded-full bg-accent text-on-accent">
                      <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" aria-hidden="true" />
                      <Icon name="mic" size={18} />
                    </span>
                    {t.play.robot.listening}
                  </p>
                )}
                {micError && <p className="text-xs text-muted">{t.play.robot.micDenied}</p>}
                <div className="flex gap-2">
                  <label className="sr-only" htmlFor="play-name-input">
                    {t.play.robot.nameLabel}
                  </label>
                  <input
                    id="play-name-input"
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    placeholder={t.play.robot.namePlaceholder}
                    autoComplete="given-name"
                    maxLength={40}
                    data-testid="play-name-input"
                    className="min-h-10 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-sm"
                  />
                  <Button type="submit" size="sm" disabled={!nameDraft.trim()} data-testid="play-name-ok">
                    {t.play.robot.nameOk}
                  </Button>
                </div>
                <button type="button" onClick={() => finishName(null)} className="text-xs font-semibold text-muted underline" data-testid="play-name-skip">
                  {t.play.robot.nameSkip}
                </button>
              </form>
            )}
          </div>
        </div>

        <Card className="space-y-3">
          <TutorToggle on={tutor} onChange={(on) => updatePrefs({ tutor: on })} compact />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={undo} disabled={!plies.some((p) => p.color === setup.userColor)} data-testid="play-undo" icon={<Icon name="undo" size={18} />}>
              {t.play.undo}
            </Button>
            {!outcome && plies.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setResigned(true)} data-testid="play-resign" icon={<Icon name="flag" size={18} />}>
                {t.play.resign}
              </Button>
            )}
            <Button variant={outcome ? 'primary' : 'ghost'} size="sm" onClick={() => {
              hush();
              stopMic();
              setAskingName(false);
              setSetup(null);
            }} data-testid="play-new" icon={<Icon name="play" size={18} />}>
              {t.play.newGame}
            </Button>
          </div>
        </Card>

        {tutor && (
          <Card className="space-y-3" data-testid="tutor-panel">
            <SectionTitle className="flex items-center gap-2">
              <Icon name="brain" size={20} />
              {t.play.tutorPanel}
            </SectionTitle>
            {judging && <p className="text-sm text-muted">{t.play.analysing}</p>}
            {feedback && (
              <div className={`space-y-2 rounded-2xl border p-3 ${GRADE_TONE[feedback.grade] ?? 'border-line'}`} data-testid="tutor-feedback" data-grade={feedback.grade}>
                <p className="text-xs font-semibold text-muted">
                  <span className="uppercase tracking-wide">{t.play.yourMove}</span>: {sanToLocal(feedback.san)}
                </p>
                <p className="flex items-start justify-between gap-2 font-display text-lg font-semibold">
                  {feedback.title}
                  <SpeakButton text={feedbackText(feedback)} />
                </p>
                {feedback.why && (
                  <div>
                    <p className="text-sm font-semibold">{!feedback.better ? t.play.whyGood : feedback.grade === 'inaccuracy' ? t.play.whyNotBest : t.play.whyWrong}</p>
                    <p className="text-sm" data-testid="tutor-why">{feedback.why}</p>
                  </div>
                )}
                {feedback.better && (
                  <div>
                    <p className="text-sm font-semibold">{t.play.betterWas}</p>
                    <p className="text-sm" data-testid="tutor-better">{feedback.better}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setPreview((v) => !v)} aria-pressed={preview} data-testid="tutor-show-better" icon={<Icon name="eye" size={18} />}>
                        {t.play.showBetter}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={undo} icon={<Icon name="undo" size={18} />}>
                        {t.play.undo}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {!judging && !feedback && <p className="text-sm text-muted">{t.play.tutorIdle}</p>}
          </Card>
        )}

        <Card>
          <SectionTitle className="text-base">{t.play.movesTitle}</SectionTitle>
          <ol className="mt-2 grid grid-cols-[2.5rem_1fr_1fr] gap-x-2 gap-y-1 text-sm tabular-nums" data-testid="play-moves">
            {Array.from({ length: Math.ceil(plies.length / 2) }, (_, i) => (
              <li key={i} className="contents">
                <span className="text-muted">{i + 1}.</span>
                {[plies[i * 2], plies[i * 2 + 1]].map((ply, j) => {
                  const grade = grades[i * 2 + j + 1];
                  return (
                    <span key={j} className={grade === 'blunder' || grade === 'mistake' ? 'font-semibold text-bad' : grade === 'inaccuracy' ? 'text-warn' : ''}>
                      {ply ? sanToLocal(ply.san) : ''}
                      {grade === 'blunder' ? '??' : grade === 'mistake' ? '?' : grade === 'inaccuracy' ? '?!' : ''}
                    </span>
                  );
                })}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function TutorToggle({ on, onChange, compact = false }: { on: boolean; onChange: (on: boolean) => void; compact?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{t.play.tutorLabel}</span>
        {!compact && <span className="block text-sm text-muted">{t.play.tutorText}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={t.play.tutorLabel}
        onClick={() => onChange(!on)}
        data-testid="play-tutor-toggle"
        className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors ${on ? 'border-accent bg-accent' : 'border-line bg-surface-2'}`}
      >
        <span className={`inline-block size-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-7' : 'translate-x-1'}`} />
        <span className="sr-only">{on ? t.play.tutorOn : t.play.tutorOff}</span>
      </button>
    </div>
  );
}
