import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, PageTitle } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { FAMOUS_GAMES } from '../data/games';
import { parseGame } from '../features/games/pgn';
import { t } from '../i18n';

const plyCounts = new Map(FAMOUS_GAMES.map((g) => [g.id, parseGame(g.pgn).moves.length]));

export function GamesPage() {
  const [filter, setFilter] = useState<'all' | 'carlsen'>('all');
  const games =
    filter === 'carlsen' ? FAMOUS_GAMES.filter((g) => `${g.white} ${g.black}`.includes('Carlsen')) : FAMOUS_GAMES;
  return (
    <div className="space-y-6">
      <header>
        <PageTitle>{t.games.title}</PageTitle>
        <p className="mt-1.5 text-lg text-muted">{t.games.intro}</p>
      </header>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t.games.filterLabel} data-testid="games-filter">
        {(['all', 'carlsen'] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            data-testid={`games-filter-${f}`}
            onClick={() => setFilter(f)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
              filter === f ? 'border-accent bg-accent text-white' : 'border-line bg-surface-2 text-fg'
            }`}
          >
            {t.games.filters[f]}
          </button>
        ))}
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {games.map((game) => (
          <li key={game.id}>
            <Link to={`/partite/${game.id}`} className="block h-full rounded-3xl" data-testid={`game-link-${game.id}`}>
              <Card className="cm-card-hover h-full hover:border-accent/50">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{game.title}</h2>
                  <span className="shrink-0 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs font-semibold tabular-nums">
                    {game.result.replace('1/2', '½')}
                  </span>
                </div>
                <p className="mt-0.5 text-sm font-medium">{t.games.players(game.white, game.black)}</p>
                <p className="text-xs text-muted">
                  {t.games.meta(game.event, game.year)} · {game.opening} · {t.games.movesCount(plyCounts.get(game.id) ?? 0)}
                </p>
                <p className="mt-2 text-sm text-muted">{game.summary}</p>
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Temi">
                  {game.themes.map((theme) => (
                    <li key={theme} className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-strong">
                      {t.games.themes[theme]}
                    </li>
                  ))}
                </ul>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-2 text-sm text-muted">
        <Icon name="bulb" size={16} />
        {t.games.keyboardHint}
      </p>
    </div>
  );
}
