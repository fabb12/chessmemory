import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChessBoard } from '../components/chess/ChessBoard';
import { buttonClass } from '../components/ui/Button';
import { Card, PageTitle } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { SpeakButton } from '../components/ui/SpeakButton';
import type { Profile } from '../db/schema';
import { findGame } from '../data/games';
import { parseGame } from '../features/games/pgn';
import { reasonOf } from '../features/tutor/moveReason';
import { t } from '../i18n';
import { sanToLocal } from '../utils/notation';

const navButton =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-line bg-surface px-3 text-sm font-semibold hover:bg-surface-2 disabled:opacity-40';

export function GamePage({ profile }: { profile: Profile }) {
  const { id } = useParams();
  const game = id ? findGame(id) : undefined;
  const parsed = useMemo(() => (game ? parseGame(game.pgn) : null), [game]);
  const [index, setIndex] = useState(0);
  const pref = profile.settings.boardOrientation;
  const [orientation, setOrientation] = useState<'white' | 'black'>(pref === 'black' ? 'black' : 'white');
  const listRef = useRef<HTMLOListElement>(null);

  const total = parsed?.moves.length ?? 0;
  const go = useCallback((next: number) => setIndex(Math.max(0, Math.min(total, next))), [total]);

  useEffect(() => setIndex(0), [id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key === 'ArrowRight') go(index + 1);
      else if (event.key === 'ArrowLeft') go(index - 1);
      else if (event.key === 'Home') go(0);
      else if (event.key === 'End') go(total);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, total]);

  // Tiene visibile la mossa corrente nell'elenco.
  useEffect(() => {
    // Solo dentro l'elenco: scrollIntoView sposterebbe anche la pagina.
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-current="step"]');
    if (list && active) list.scrollTop = Math.max(0, active.offsetTop - list.clientHeight / 2);
  }, [index]);

  if (!game || !parsed) {
    return (
      <div>
        <p>{t.games.notFound}</p>
        <Link to="/partite" className={`${buttonClass('secondary')} mt-3`}>
          {t.app.back}
        </Link>
      </div>
    );
  }

  const current = index === 0 ? null : parsed.moves[index - 1]!;
  const fen = current?.fen ?? parsed.startFen;
  const reason = current ? reasonOf(index === 1 ? parsed.startFen : parsed.moves[index - 2]!.fen, current, parsed.moves[index - 2]) : '';

  return (
    <div className="space-y-4" data-testid="game-viewer" data-index={index}>
      <Link to="/partite" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
        <Icon name="arrowLeft" size={16} />
        {t.games.back}
      </Link>
      <header>
        <PageTitle>{game.title}</PageTitle>
        <p className="mt-1 font-medium">
          {t.games.players(game.white, game.black)} · <span className="tabular-nums">{game.result.replace('1/2', '½')}</span>
        </p>
        <p className="text-sm text-muted">
          {t.games.meta(game.event, game.year)} · {game.opening}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,34rem)_1fr] lg:items-start">
        <div className="space-y-3">
          <ChessBoard
            fen={fen}
            orientation={orientation}
            lastMove={current ? { from: current.from, to: current.to } : null}
            lastMoveTone="neutral"
          />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" className={navButton} onClick={() => go(0)} disabled={index === 0}>
              {t.games.first}
            </button>
            <button type="button" aria-label={t.games.previous} className={navButton} onClick={() => go(index - 1)} disabled={index === 0}>
              <Icon name="arrowLeft" />
            </button>
            <button
              type="button"
              aria-label={t.games.next}
              data-testid="game-forward"
              className={navButton}
              onClick={() => go(index + 1)}
              disabled={index >= total}
            >
              <Icon name="arrowRight" />
            </button>
            <button type="button" className={navButton} onClick={() => go(total)} disabled={index >= total}>
              {t.games.last}
            </button>
            <button
              type="button"
              aria-label={t.games.flip}
              title={t.games.flip}
              className={navButton}
              onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
            >
              <Icon name="undo" />
            </button>
          </div>
          <p className="text-center text-xs text-muted tabular-nums">{t.games.position(index, total)}</p>
        </div>

        <div className="space-y-4">
          <Card aria-live="polite" data-testid="game-comment">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-muted tabular-nums">
                {current ? `${current.moveNumber}${current.color === 'w' ? '.' : '…'}${sanToLocal(current.san)}` : t.games.introTitle}
              </h2>
              <SpeakButton
                text={
                  current
                    ? `${current.moveNumber}${current.color === 'w' ? '.' : '…'}${sanToLocal(current.san)}. ${reason}`
                    : `${game.title}. ${game.intro}`
                }
                auto={current ? Boolean(current.comment) : true}
                delay={450}
              />
            </div>
            <p className="mt-1.5" data-testid={current ? undefined : 'game-intro'}>
              {current ? reason : game.intro}
            </p>
            {index === total && (
              <p className="mt-2 font-semibold" data-testid="game-result">
                {game.result.replace('1/2', '½')} · {t.games.result[game.result]}
              </p>
            )}
          </Card>

          <section aria-labelledby="game-moves">
            <h2 id="game-moves" className="sr-only">
              {t.games.movesLabel}
            </h2>
            <ol ref={listRef} className="relative flex max-h-72 flex-wrap gap-1 overflow-y-auto text-sm" aria-label={t.games.movesLabel}>
              {parsed.moves.map((move, i) => (
                <li key={move.ply}>
                  <button
                    type="button"
                    onClick={() => go(i + 1)}
                    aria-current={index === i + 1 ? 'step' : undefined}
                    className={`min-h-9 rounded-lg px-2 font-medium tabular-nums ${
                      index === i + 1
                        ? 'bg-accent text-on-accent'
                        : move.comment
                          ? 'bg-accent-soft hover:bg-accent-soft/70'
                          : 'bg-surface-2 hover:bg-accent-soft'
                    }`}
                  >
                    {move.color === 'w' ? `${move.moveNumber}.` : ''}
                    {sanToLocal(move.san)}
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <Card className="space-y-2">
            <Link to={`/partite/${game.id}/tutor`} className={buttonClass('primary')} data-testid="game-tutor-link">
              <Icon name="camera" size={18} />
              {t.gameTutor.open}
            </Link>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-semibold">{t.games.lessonsTitle}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {game.lessons.map((lesson) => (
                <li key={lesson}>{lesson}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
