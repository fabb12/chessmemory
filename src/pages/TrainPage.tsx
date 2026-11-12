import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ConceptRunner } from '../components/training/ConceptRunner';
import { SessionSummary } from '../components/training/SessionSummary';
import { Button } from '../components/ui/Button';
import { Card, PageTitle } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Icon } from '../components/ui/Icon';
import { findConcept } from '../data/exercises';
import { db } from '../db/database';
import type { Profile, SessionRecord } from '../db/schema';
import { buildItem, DEFAULT_SESSION_CONFIG } from '../features/learning/sessionBuilder';
import { currentStreak } from '../features/progress/streak';
import { useActiveSession, useNow, useSessions } from '../hooks/useData';
import { useTrainingPlan, useTrainingProposals } from '../hooks/useTrainingPlan';
import { formatRelativeDay, t } from '../i18n';
import { finishSession, recordConceptResult, startSession } from '../services/progress';
import type { ConceptResult, Difficulty, SessionItem } from '../types';

interface Interstitial {
  conceptId: string;
  nextDue: number | null;
  isLast: boolean;
}

/** Seme nuovo a ogni richiesta: i concetti proposti cambiano ogni volta. */
const freshSeed = () => Math.floor(Math.random() * 2 ** 31);

function itemSeconds(item: SessionItem): number {
  return item.kind === 'new' ? DEFAULT_SESSION_CONFIG.secondsPerNew : DEFAULT_SESSION_CONFIG.secondsPerReview;
}

function useElapsed(startedAt: number | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === undefined) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  return startedAt === undefined ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
}

export function TrainPage({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const now = useNow();
  const active = useActiveSession();
  const sessions = useSessions();
  const [chosenLevel, setChosenLevel] = useState<Difficulty | null>(null);
  const [seed, setSeed] = useState(freshSeed);
  /** Concetti scelti a mano; `null` = quelli consigliati dal piano. */
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const plan = useTrainingPlan(now, chosenLevel, seed);
  const proposals = useTrainingProposals(plan, chosenLevel, seed);

  const [interstitial, setInterstitial] = useState<Interstitial | null>(null);
  const [finished, setFinished] = useState<{ record: SessionRecord; levelBefore: Difficulty } | null>(null);
  const [quitOpen, setQuitOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  /** La richiesta di avvio presente nell'URL è già stata gestita. */
  const handled = useRef(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const elapsed = useElapsed(active?.startedAt);

  const practiceConcept = params.get('concetto');
  const wantsStart = params.get('avvia') === '1' || Boolean(practiceConcept);

  const clearRequest = () => setParams({}, { replace: true });

  const reshuffle = (level: Difficulty | null = chosenLevel) => {
    setChosenLevel(level);
    setSeed(freshSeed());
    setPicked(null);
  };

  const toggle = (conceptId: string, defaults: Set<string>) =>
    setPicked((current) => {
      const next = new Set(current ?? defaults);
      if (next.has(conceptId)) next.delete(conceptId);
      else next.add(conceptId);
      return next;
    });

  // Crea la sessione richiesta dall'URL (concetto singolo o piano completo).
  const createRequested = async () => {
    if (practiceConcept) {
      const concept = findConcept(practiceConcept);
      const card = concept ? await db.cards.get(concept.id) : undefined;
      const item = concept ? buildItem(concept.id, card ? 'review' : 'new', card?.reps ?? 0) : null;
      if (item) await startSession({ items: [item], estimatedSeconds: 0 });
    } else if (plan && plan.items.length > 0) {
      await startSession(plan);
    }
  };

  // Esegue l'avvio e, qualunque sia l'esito, toglie la richiesta dall'URL:
  // così la pagina non può restare bloccata su «Caricamento…».
  const runStart = async (task: () => Promise<void>) => {
    setStarting(true);
    try {
      await task();
    } catch (error) {
      console.error('Impossibile avviare l\'allenamento', error);
    } finally {
      setStarting(false);
      clearRequest();
    }
  };

  const confirmReplace = () => {
    setReplaceOpen(false);
    void runStart(async () => {
      await finishSession(); // salva i concetti già completati e chiude la sessione attuale
      await createRequested();
    });
  };

  const cancelReplace = () => {
    setReplaceOpen(false);
    clearRequest();
  };

  // Avvio automatico dalla Home («Inizia il mio allenamento») o dalla libreria.
  useEffect(() => {
    if (!wantsStart) {
      // Nessuna richiesta pendente: la prossima potrà essere gestita di nuovo.
      handled.current = false;
      return;
    }
    if (handled.current || active === undefined) return;
    if (finished) {
      handled.current = true;
      clearRequest();
      return;
    }
    if (active) {
      // C'è già un allenamento in corso: chiedi se terminarlo prima di iniziarne un altro.
      handled.current = true;
      setReplaceOpen(true);
      return;
    }
    if (practiceConcept || plan) {
      handled.current = true;
      void runStart(createRequested);
    }
  }, [wantsStart, practiceConcept, active, plan, finished]);

  // Rete di sicurezza: se dopo qualche secondo la richiesta è ancora pendente
  // senza che nulla sia in corso, la si scarta e si mostra la pagina normale.
  useEffect(() => {
    if (!wantsStart || active || starting || replaceOpen) return;
    const id = window.setTimeout(clearRequest, 5000);
    return () => window.clearTimeout(id);
  }, [wantsStart, active, starting, replaceOpen]);

  const complete = async () => {
    const levelBefore = (active?.levelAtStart ?? profile.adaptive.level) as Difficulty;
    const record = await finishSession();
    setInterstitial(null);
    if (record) setFinished({ record, levelBefore });
    else navigate('/');
  };

  const handleConceptComplete = async (result: ConceptResult) => {
    if (!active || busy) return;
    setBusy(true);
    try {
      await recordConceptResult(result);
      const card = await db.cards.get(result.conceptId);
      setInterstitial({
        conceptId: result.conceptId,
        nextDue: card?.due ?? null,
        isLast: active.results.length + 1 >= active.items.length,
      });
    } finally {
      setBusy(false);
    }
  };

  // ── Risultati finali ──
  if (finished) {
    return (
      <SessionSummary
        session={finished.record}
        previous={(sessions ?? []).filter((s) => s.id !== finished.record.id)}
        streak={currentStreak(profile.streak, Date.now())}
        levelBefore={finished.levelBefore}
        levelAfter={profile.adaptive.level}
      />
    );
  }

  if (active === undefined || starting || (wantsStart && !active && !replaceOpen)) return <p>{t.app.loading}</p>;

  // ── Concetto appena completato ──
  if (interstitial) {
    const concept = findConcept(interstitial.conceptId);
    return (
      <div className="mx-auto max-w-md pt-6 text-center" data-testid="concept-done">
        <span className="mx-auto mb-4 flex size-16 animate-pop items-center justify-center rounded-full bg-ok-soft text-ok shadow-[0_0_0_8px_color-mix(in_srgb,var(--ok)_12%,transparent)]">
          <Icon name="check" size={30} />
        </span>
        <h1 className="font-display text-2xl font-semibold">{t.train.conceptDone}</h1>
        <p className="mt-1 text-lg">{concept?.title}</p>
        {interstitial.nextDue !== null && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-muted" data-testid="next-review">
            <Icon name="calendar" size={18} />
            {t.train.nextReview(formatRelativeDay(interstitial.nextDue, Date.now()))}
          </p>
        )}
        <Button
          size="lg"
          block
          className="mt-6"
          icon={<Icon name="arrowRight" />}
          data-testid="concept-next"
          onClick={() => (interstitial.isLast ? void complete() : setInterstitial(null))}
        >
          {interstitial.isLast ? t.train.seeResults : t.train.nextConcept}
        </Button>
      </div>
    );
  }

  // ── Sessione in corso ──
  if (active) {
    const index = active.results.length;
    const item = active.items[index];
    if (!item) {
      // Tutti i concetti sono stati registrati ma la sessione non era stata chiusa.
      return (
        <div className="mx-auto max-w-md pt-6 text-center">
          <Button size="lg" block onClick={() => void complete()} data-testid="concept-next">
            {t.train.seeResults}
          </Button>
        </div>
      );
    }
    const budgetMin = Math.round(DEFAULT_SESSION_CONFIG.budgetSeconds / 60);
    return (
      <div>
        <div className="mb-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 text-sm text-muted">
              <span data-testid="item-progress">{t.train.itemProgress(index + 1, active.items.length)}</span>
              <span className="tabular-nums" title={t.train.budget}>
                <Icon name="clock" size={14} className="mr-1 inline align-[-2px]" />
                {t.train.elapsed(Math.floor(elapsed / 60), elapsed % 60)} / ~{budgetMin} min
              </span>
            </div>
            <div
              className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-label={t.train.itemProgress(index + 1, active.items.length)}
              aria-valuemin={0}
              aria-valuemax={active.items.length}
              aria-valuenow={index}
            >
              <div
                className="cm-bar h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${(index / active.items.length) * 100}%` }}
              />
            </div>
          </div>
          <Button variant="ghost" onClick={() => setQuitOpen(true)} aria-label={t.train.quit}>
            <Icon name="cross" />
            <span className="hidden sm:inline">{t.train.quit}</span>
          </Button>
        </div>

        <ConceptRunner
          key={`${active.sessionId}-${index}`}
          item={item}
          orientationPref={profile.settings.boardOrientation}
          onComplete={(r) => void handleConceptComplete(r)}
        />

        <ConfirmDialog
          open={replaceOpen}
          title={t.train.replaceTitle}
          confirmLabel={t.train.replaceConfirm}
          onConfirm={confirmReplace}
          onCancel={cancelReplace}
        >
          <p>{t.train.replaceText}</p>
        </ConfirmDialog>

        <ConfirmDialog
          open={quitOpen}
          title={t.train.quitTitle}
          confirmLabel={t.train.quitConfirm}
          onConfirm={() => navigate('/')}
          onCancel={() => setQuitOpen(false)}
          extra={
            <Button
              variant="secondary"
              block
              onClick={() => {
                setQuitOpen(false);
                void complete();
              }}
            >
              {t.train.quitFinish}
            </Button>
          }
        >
          <p>{t.train.quitText}</p>
        </ConfirmDialog>
      </div>
    );
  }

  // ── Presentazione dell'allenamento ──
  const candidates = plan ? [...plan.items, ...proposals] : [];
  const defaults = new Set(plan?.items.map((i) => i.conceptId) ?? []);
  const selectedIds = picked ?? defaults;
  const chosen = candidates.filter((i) => selectedIds.has(i.conceptId));
  const chosenSeconds = chosen.reduce((sum, i) => sum + itemSeconds(i), 0);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header>
        <PageTitle>{t.train.introTitle}</PageTitle>
        <p className="mt-1.5 text-lg text-muted">{t.train.introText}</p>
      </header>
      <Card>
        <fieldset data-testid="level-picker">
          <legend className="font-semibold">{t.train.chooseLevel}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {([null, 1, 2, 3, 4, 5] as const).map((lv) => {
              const on = chosenLevel === lv;
              return (
                <button
                  key={lv ?? 'auto'}
                  type="button"
                  aria-pressed={on}
                  data-testid={`level-${lv ?? 'auto'}`}
                  onClick={() => reshuffle(lv)}
                  className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
                    on ? 'border-accent bg-accent text-white' : 'border-line bg-surface-2 text-fg'
                  }`}
                >
                  {lv === null ? t.train.levelAuto : lv}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-sm text-muted">
            {chosenLevel === null
              ? t.train.levelAutoHelp(profile.adaptive.level)
              : `${t.level.of5(chosenLevel)} · ${t.level.names[chosenLevel]}`}
          </p>
        </fieldset>
        <hr className="my-4 border-line" />
        {!plan ? (
          <p>{t.app.loading}</p>
        ) : candidates.length === 0 ? (
          <p>{t.train.empty}</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{t.train.pickTitle}</p>
                <p className="mt-0.5 text-sm text-muted">{t.train.pickHelp}</p>
              </div>
              <Button
                variant="secondary"
                icon={<Icon name="undo" size={18} />}
                data-testid="reshuffle"
                onClick={() => reshuffle()}
              >
                {t.train.reshuffle}
              </Button>
            </div>
            <ul className="mt-3 divide-y divide-line" data-testid="plan-list">
              {candidates.map((item) => {
                const concept = findConcept(item.conceptId);
                const on = selectedIds.has(item.conceptId);
                return (
                  <li key={item.conceptId}>
                    <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2.5">
                      <input
                        type="checkbox"
                        className="size-5 shrink-0 accent-[var(--accent)]"
                        checked={on}
                        data-testid={`pick-${item.conceptId}`}
                        onChange={() => toggle(item.conceptId, defaults)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{concept?.title}</span>
                        {concept && (
                          <span className="block text-sm text-muted">
                            {t.categories[concept.category]} · {t.level.of5(concept.difficulty)}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 rounded-full border border-accent/25 bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-strong">
                        {t.train.kind[item.kind]}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted" data-testid="pick-summary">
              <Icon name="clock" size={16} />
              {t.train.pickSummary(chosen.length, Math.max(1, Math.round(chosenSeconds / 60)))}
            </p>
            <Button
              size="lg"
              block
              className="mt-3"
              icon={<Icon name="train" />}
              data-testid="start-training"
              disabled={chosen.length === 0}
              onClick={() => void startSession({ items: chosen, estimatedSeconds: chosenSeconds })}
            >
              {t.home.start}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
