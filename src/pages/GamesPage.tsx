import { Link, useSearchParams } from 'react-router-dom';
import { Card, PageTitle } from '../components/ui/Card';
import { GAME_CATEGORIES, gamesIn, isGameCategory, PLY_COUNTS, type GameCategory } from '../data/gameCategories';
import { t } from '../i18n';

export function GamesPage() {
  // La categoria sta nell'indirizzo: tornando indietro da una partita resta quella scelta.
  const [params, setParams] = useSearchParams();
  const raw = params.get('categoria');
  const filter: GameCategory = isGameCategory(raw) ? raw : 'all';
  const setFilter = (f: GameCategory) => setParams(f === 'all' ? {} : { categoria: f }, { replace: true });
  const { games, ranked } = gamesIn(filter);
  return (
    <div className="space-y-6">
      <header>
        <PageTitle>{t.games.title}</PageTitle>
      </header>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t.games.filterLabel} data-testid="games-filter">
        {GAME_CATEGORIES.map((f) => (
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
      {filter !== 'all' && t.games.filterHelp[filter] && (
        <p className="text-muted" data-testid="games-filter-help">
          {t.games.filterHelp[filter]}
        </p>
      )}
      <ul className="grid gap-3 md:grid-cols-2">
        {games.map((game, index) => (
          <li key={game.id}>
            <Link to={`/partite/${game.id}`} className="block h-full rounded-3xl" data-testid={`game-link-${game.id}`}>
              <Card className="cm-card-hover h-full hover:border-accent/50">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">
                    {ranked && (
                      <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white tabular-nums" data-testid="game-rank">
                        {index + 1}
                      </span>
                    )}
                    {game.title}
                  </h2>
                  <span className="shrink-0 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs font-semibold tabular-nums">
                    {game.result.replace('1/2', '½')}
                  </span>
                </div>
                <p className="mt-0.5 text-sm font-medium">{t.games.players(game.white, game.black)}</p>
                <p className="text-xs text-muted">
                  {t.games.meta(game.event, game.year)} · {game.opening} · {t.games.movesCount(PLY_COUNTS.get(game.id) ?? 0)}
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
    </div>
  );
}
