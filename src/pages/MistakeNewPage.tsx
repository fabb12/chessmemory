import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BoardEditor } from '../components/chess/BoardEditor';
import { ChessBoard } from '../components/chess/ChessBoard';
import { BestMoveStep, type BestMoveChoice } from '../components/mistakes/BestMoveStep';
import { GamePicker, type PickedMove } from '../components/mistakes/GamePicker';
import { PhotoCapture } from '../components/mistakes/PhotoCapture';
import { Button } from '../components/ui/Button';
import { Card, PageTitle } from '../components/ui/Card';
import { Icon, type IconName } from '../components/ui/Icon';
import { CONCEPTS } from '../data/exercises';
import type { MistakeSource, Profile } from '../db/schema';
import {
  emptyPosition,
  fenToPosition,
  positionToFen,
  validatePosition,
  type EditorPosition,
} from '../features/mistakes/position';
import { t } from '../i18n';
import { MistakeValidationError, createMistake } from '../services/mistakes';
import type { Uci } from '../types';
import { applyUci, sideToMove } from '../utils/chess';
import type { PreparedImage } from '../utils/image';
import { sanToLocal } from '../utils/notation';

type Step = 'source' | 'position' | 'played' | 'best' | 'notes';

const STEPS: Record<MistakeSource, Step[]> = {
  photo: ['source', 'position', 'played', 'best', 'notes'],
  manual: ['source', 'position', 'played', 'best', 'notes'],
  pgn: ['source', 'position', 'best', 'notes'],
};

const STEP_NAMES: Record<Step, string> = {
  source: t.mistakes.stepSource,
  position: t.mistakes.stepPosition,
  played: t.mistakes.stepPlayed,
  best: t.mistakes.stepBest,
  notes: t.mistakes.stepNotes,
};

const SOURCE_ICONS: Record<MistakeSource, IconName> = { photo: 'camera', pgn: 'book', manual: 'edit' };

function orientationFor(profile: Profile, fen: string): 'white' | 'black' {
  const pref = profile.settings.boardOrientation;
  if (pref === 'white' || pref === 'black') return pref;
  return sideToMove(fen) === 'w' ? 'white' : 'black';
}

export function MistakeNewPage({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const [source, setSource] = useState<MistakeSource | null>(null);
  const [step, setStep] = useState<Step>('source');
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [position, setPosition] = useState<EditorPosition>(() => emptyPosition());
  const [editorFlipped, setEditorFlipped] = useState(false);
  const [fenText, setFenText] = useState('');
  const [fenError, setFenError] = useState(false);
  const [fen, setFen] = useState<string | null>(null);
  const [playedMove, setPlayedMove] = useState<Uci | null>(null);
  const [gameInfo, setGameInfo] = useState<string | null>(null);
  const [moveNumber, setMoveNumber] = useState<number | null>(null);
  const [suggestion, setSuggestion] = useState<BestMoveChoice | null>(null);
  const [choice, setChoice] = useState<BestMoveChoice | null>(null);
  const [title, setTitle] = useState('');
  const [whatWentWrong, setWhatWentWrong] = useState('');
  const [howToContinue, setHowToContinue] = useState('');
  const [conceptId, setConceptId] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const steps = source ? STEPS[source] : STEPS.photo;
  const stepIndex = steps.indexOf(step);
  const positionError = useMemo(() => validatePosition(position), [position]);
  const orientation = fen ? orientationFor(profile, fen) : 'white';

  const goTo = (next: Step) => {
    setStep(next);
    window.scrollTo(0, 0);
  };
  const back = () => {
    const prev = steps[stepIndex - 1];
    if (prev) goTo(prev);
  };

  const chooseSource = (s: MistakeSource) => {
    setSource(s);
    goTo('position');
  };

  const confirmPosition = () => {
    if (positionError) return;
    const next = positionToFen(position);
    if (next !== fen) {
      setFen(next);
      setPlayedMove(null);
      setChoice(null);
      setSuggestion(null);
    }
    goTo('played');
  };

  const applyFenText = () => {
    const parsed = fenToPosition(fenText);
    setFenError(!parsed);
    if (parsed) {
      setPosition(parsed);
      setEditorFlipped(parsed.turn === 'b');
    }
  };

  const onPicked = (picked: PickedMove) => {
    setFen(picked.fen);
    setPlayedMove(picked.playedMove);
    setGameInfo(picked.gameInfo || null);
    setMoveNumber(picked.moveNumber);
    setChoice(null);
    setSuggestion(
      picked.suggestion
        ? {
            bestMove: picked.suggestion.bestMove,
            line: picked.suggestion.line,
            alternatives: [],
            severity: picked.suggestion.severity,
            engine: {
              depth: picked.suggestion.depth,
              bestCp: picked.suggestion.bestCp,
              playedCp: picked.suggestion.playedCp,
            },
          }
        : null,
    );
    goTo('best');
  };

  const onBestConfirmed = (c: BestMoveChoice) => {
    setChoice(c);
    if (!title) setTitle(t.mistakes.titleDefault(moveNumber));
    goTo('notes');
  };

  const save = async () => {
    if (!fen || !choice || !source) return;
    setSaving(true);
    setSaveError(null);
    try {
      const record = await createMistake(
        {
          title: title || t.mistakes.titleDefault(moveNumber),
          fen,
          playedMove,
          bestMove: choice.bestMove,
          alternatives: choice.alternatives,
          line: choice.line,
          whatWentWrong,
          howToContinue,
          conceptId: conceptId || null,
          source,
          gameInfo,
          moveNumber,
          severity: choice.severity,
          engine: choice.engine,
        },
        photo,
      );
      navigate(`/errori/${record.id}?salvato=1`, { replace: true });
    } catch (error) {
      const reason = error instanceof MistakeValidationError ? error.reason : t.app.storageError;
      setSaveError(t.mistakes.saveError(reason));
      setSaving(false);
    }
  };

  const playedApplied = fen && playedMove ? applyUci(fen, playedMove) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-4" data-testid="mistake-new" data-step={step}>
      <header className="space-y-1">
        <PageTitle>{t.mistakes.newTitle}</PageTitle>
        <p className="text-sm font-semibold text-muted" data-testid="wizard-step">
          {t.mistakes.stepOf(stepIndex + 1, steps.length, STEP_NAMES[step])}
        </p>
        <ol className="flex gap-1.5" aria-hidden="true">
          {steps.map((s, i) => (
            <li key={s} className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? 'bg-accent' : 'bg-line'}`} />
          ))}
        </ol>
      </header>

      {step === 'source' && (
        <div className="grid gap-3 md:grid-cols-3">
          {(['photo', 'pgn', 'manual'] as MistakeSource[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => chooseSource(s)}
              data-testid={`source-${s}`}
              className="flex min-h-32 flex-col items-start gap-2 rounded-3xl border-2 border-line bg-surface p-5 text-left shadow-sm transition-colors hover:border-accent hover:bg-accent-soft"
            >
              <span className="rounded-2xl bg-accent-soft p-2.5 text-accent-strong">
                <Icon name={SOURCE_ICONS[s]} size={26} />
              </span>
              <span className="font-display text-lg font-semibold">{t.mistakes.sources[s].title}</span>
              <span className="text-sm text-muted">{t.mistakes.sources[s].text}</span>
            </button>
          ))}
          <p className="flex items-start gap-2 text-sm text-muted md:col-span-3">
            <Icon name="flag" size={16} className="mt-0.5 shrink-0" />
            {t.mistakes.fairPlay}
          </p>
        </div>
      )}

      {step === 'position' && source === 'pgn' && (
        <Card>
          <GamePicker playerName={profile.settings.playerName} analysisDepth={profile.settings.analysisDepth} onPick={onPicked} />
        </Card>
      )}

      {step === 'position' && source !== 'pgn' && (
        <div className={`grid gap-4 ${source === 'photo' ? 'lg:grid-cols-2' : ''} lg:items-start`}>
          {source === 'photo' && (
            <Card className="space-y-3">
              <PhotoCapture photo={photo} onChange={setPhoto} />
              <p className="text-sm text-muted">{t.mistakes.photoHelp}</p>
            </Card>
          )}
          <Card className={source === 'manual' ? 'mx-auto w-full max-w-2xl' : ''}>
            <BoardEditor
              value={position}
              onChange={setPosition}
              orientation={editorFlipped ? 'black' : 'white'}
              onFlip={() => setEditorFlipped((f) => !f)}
            />
            <details className="mt-3" open={source === 'manual'}>
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">{t.mistakes.editor.fen}</summary>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={fenText}
                  onChange={(e) => setFenText(e.target.value)}
                  placeholder={positionToFen(position)}
                  aria-label={t.mistakes.editor.fen}
                  spellCheck={false}
                  autoCapitalize="none"
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 font-mono text-sm"
                  data-testid="fen-input"
                />
                <Button variant="secondary" onClick={applyFenText} disabled={!fenText.trim()} data-testid="fen-apply">
                  {t.mistakes.editor.fenApply}
                </Button>
              </div>
              {fenError && <p className="mt-1 text-sm text-bad">{t.mistakes.editor.fenInvalid}</p>}
            </details>
            <div aria-live="polite">
              {positionError && Object.keys(position.placement).length > 0 && (
                <p className="mt-3 rounded-xl border border-warn/40 bg-warn-soft p-3 text-sm" data-testid="position-error">
                  {t.mistakes.editor.errors[positionError]}
                </p>
              )}
            </div>
          </Card>
        </div>
      )}

      {step === 'played' && fen && (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(16rem,1fr)] md:items-start" data-testid="played-step">
          <ChessBoard
            fen={playedApplied?.fen ?? fen}
            orientation={orientation}
            interactive={!playedMove}
            onMove={setPlayedMove}
            lastMove={playedApplied ? { from: playedApplied.from, to: playedApplied.to } : null}
            lastMoveTone="bad"
          />
          <div className="space-y-3">
            <p>{t.sideToMove[sideToMove(fen)]}</p>
            {playedApplied ? (
              <>
                <p className="rounded-xl border border-bad/40 bg-bad-soft p-3 font-semibold" data-testid="played-move">
                  {t.mistakes.playedIs(sanToLocal(playedApplied.san))}
                </p>
                <Button variant="secondary" icon={<Icon name="undo" size={18} />} onClick={() => setPlayedMove(null)}>
                  {t.mistakes.playedUndo}
                </Button>
                <Button block size="lg" icon={<Icon name="arrowRight" />} onClick={() => goTo('best')} data-testid="played-next">
                  {t.mistakes.next}
                </Button>
              </>
            ) : (
              <>
                <p>{t.mistakes.playedPrompt}</p>
                <Button variant="secondary" block onClick={() => goTo('best')} data-testid="played-skip">
                  {t.mistakes.playedSkip}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {step === 'best' && fen && (
        <BestMoveStep
          fen={fen}
          playedMove={playedMove}
          orientation={orientation}
          analysisDepth={profile.settings.analysisDepth}
          initial={suggestion}
          onConfirm={onBestConfirmed}
        />
      )}

      {step === 'notes' && fen && choice && (
        <Card className="mx-auto max-w-2xl space-y-4">
          <div>
            <label htmlFor="mistake-title" className="font-semibold">
              {t.mistakes.titleLabel}
            </label>
            <input
              id="mistake-title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3"
              data-testid="mistake-title"
            />
          </div>
          {gameInfo && (
            <p className="text-sm text-muted">
              {t.mistakes.gameInfo}: {gameInfo}
            </p>
          )}
          <div>
            <label htmlFor="mistake-wrong" className="font-semibold">
              {t.mistakes.whatWentWrong}
            </label>
            <textarea
              id="mistake-wrong"
              value={whatWentWrong}
              maxLength={2000}
              rows={3}
              onChange={(e) => setWhatWentWrong(e.target.value)}
              placeholder={t.mistakes.whatWentWrongPlaceholder}
              aria-describedby="mistake-wrong-help"
              className="mt-1 w-full rounded-xl border border-line bg-surface p-3"
              data-testid="mistake-wrong"
            />
            <p id="mistake-wrong-help" className="text-sm text-muted">
              {t.mistakes.whatWentWrongHelp}
            </p>
          </div>
          <div>
            <label htmlFor="mistake-continue" className="font-semibold">
              {t.mistakes.howToContinue}
            </label>
            <textarea
              id="mistake-continue"
              value={howToContinue}
              maxLength={2000}
              rows={3}
              onChange={(e) => setHowToContinue(e.target.value)}
              placeholder={t.mistakes.howToContinuePlaceholder}
              className="mt-1 w-full rounded-xl border border-line bg-surface p-3"
              data-testid="mistake-continue"
            />
          </div>
          <div>
            <label htmlFor="mistake-concept" className="font-semibold">
              {t.mistakes.concept}
            </label>
            <select
              id="mistake-concept"
              value={conceptId}
              onChange={(e) => setConceptId(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3"
            >
              <option value="">{t.mistakes.conceptNone}</option>
              {CONCEPTS.map((c) => (
                <option key={c.id} value={c.id}>
                  {t.categories[c.category]} · {c.title}
                </option>
              ))}
            </select>
          </div>
          {saveError && (
            <p role="alert" className="rounded-xl border border-bad/50 bg-bad-soft p-3 text-sm">
              {saveError}
            </p>
          )}
          <Button block size="lg" icon={<Icon name="check" />} onClick={() => void save()} disabled={saving} data-testid="mistake-save">
            {t.mistakes.save}
          </Button>
        </Card>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        {stepIndex > 0 && (
          <Button variant="ghost" icon={<Icon name="arrowLeft" />} onClick={back} data-testid="wizard-back">
            {t.mistakes.back}
          </Button>
        )}
        {step === 'position' && source !== 'pgn' && (
          <Button
            className="ml-auto"
            icon={<Icon name="arrowRight" />}
            onClick={confirmPosition}
            disabled={positionError !== null}
            data-testid="position-next"
          >
            {t.mistakes.next}
          </Button>
        )}
      </div>
    </div>
  );
}
