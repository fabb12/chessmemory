import { useEffect, useRef, useState } from 'react';
import { ANALYSIS_DEPTH, getEngine, type AnalysisDepth } from '../../features/engine/engine';
import { scoreToCp } from '../../features/engine/uci';
import {
  PgnError,
  detectPlayerColor,
  parsePgn,
  scanGameForMistakes,
  type GameMistake,
  type GameMove,
  type ParsedGame,
} from '../../features/mistakes/game';
import { t } from '../../i18n';
import { GameImportError, fetchRecentGames, type GameSite, type RemoteGame } from '../../services/gameImport';
import type { Side, Uci } from '../../types';
import { applyUci } from '../../utils/chess';
import { sanToLocal } from '../../utils/notation';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

export interface PickedMove {
  fen: string;
  playedMove: Uci;
  moveNumber: number;
  gameInfo: string;
  suggestion: {
    bestMove: Uci;
    line: Uci[];
    severity: GameMistake['severity'];
    depth: number;
    bestCp: number;
    playedCp: number;
  } | null;
}

type Tab = 'paste' | GameSite;

interface GamePickerProps {
  playerName: string;
  analysisDepth: AnalysisDepth;
  onPick: (picked: PickedMove) => void;
}

function moveLabel(move: GameMove): string {
  return move.color === 'w' ? `${move.moveNumber}.${sanToLocal(move.san)}` : `${move.moveNumber}…${sanToLocal(move.san)}`;
}

/** Scelta della partita e della mossa sbagliata, con ricerca automatica degli errori. */
export function GamePicker({ playerName, analysisDepth, onPick }: GamePickerProps) {
  const [tab, setTab] = useState<Tab>('paste');
  const [pgn, setPgn] = useState('');
  const [username, setUsername] = useState(playerName);
  const [remote, setRemote] = useState<RemoteGame[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<ParsedGame | null>(null);
  const [player, setPlayer] = useState<Side>('w');
  const [scan, setScan] = useState<{ done: number; total: number } | null>(null);
  const [found, setFound] = useState<GameMistake[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const loadGame = (text: string) => {
    try {
      const parsed = parsePgn(text);
      setGame(parsed);
      setPlayer(detectPlayerColor(parsed.headers, username || playerName) ?? 'w');
      setFound(null);
      setError(null);
    } catch (e) {
      setError(t.mistakes.pgnError(e instanceof PgnError ? e.message : String(e)));
    }
  };

  const loadRemote = async (site: GameSite) => {
    setLoading(true);
    setError(null);
    setRemote(null);
    try {
      setRemote(await fetchRecentGames(site, username));
    } catch (e) {
      setError(e instanceof GameImportError || e instanceof TypeError ? t.mistakes.fetchError : String(e));
    } finally {
      setLoading(false);
    }
  };

  const runScan = async () => {
    if (!game) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setFound(null);
    setError(null);
    setScan({ done: 0, total: 0 });
    try {
      const result = await scanGameForMistakes(game.moves, player, getEngine(), {
        depth: ANALYSIS_DEPTH[analysisDepth] - 2,
        signal: controller.signal,
        onProgress: setScan,
      });
      setFound(result);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(t.mistakes.engineError);
    } finally {
      setScan(null);
    }
  };

  const pick = (move: GameMove, mistake: GameMistake | null) => {
    abortRef.current?.abort();
    onPick({
      fen: move.fenBefore,
      playedMove: move.uci,
      moveNumber: move.moveNumber,
      gameInfo: game?.label ?? '',
      suggestion: mistake
        ? {
            bestMove: mistake.bestMove,
            line: mistake.line,
            severity: mistake.severity,
            depth: mistake.depth,
            bestCp: scoreToCp(mistake.bestScore),
            playedCp: scoreToCp(mistake.playedScore),
          }
        : null,
    });
  };

  if (game) {
    const own = game.moves.filter((m) => m.color === player);
    return (
      <div className="space-y-4" data-testid="game-picker">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold" data-testid="game-label">
            {game.label}
          </p>
          <Button variant="ghost" size="sm" icon={<Icon name="arrowLeft" size={16} />} onClick={() => setGame(null)}>
            {t.mistakes.back}
          </Button>
        </div>

        <fieldset>
          <legend className="mb-1.5 font-semibold">{t.mistakes.youPlayed}</legend>
          <div className="flex gap-2">
            {(['w', 'b'] as Side[]).map((side) => (
              <label
                key={side}
                className={`flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-medium ${
                  player === side ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name="player-color"
                  checked={player === side}
                  onChange={() => {
                    setPlayer(side);
                    setFound(null);
                  }}
                  className="size-4 accent-(--accent)"
                />
                {t.sides[side]}
                {side === 'w' && game.headers.White ? ` (${game.headers.White})` : ''}
                {side === 'b' && game.headers.Black ? ` (${game.headers.Black})` : ''}
              </label>
            ))}
          </div>
        </fieldset>

        {scan ? (
          <div className="space-y-2" aria-live="polite">
            <p className="text-sm">{t.mistakes.scanning(scan.done, scan.total)}</p>
            <progress className="w-full" max={Math.max(1, scan.total)} value={scan.done} />
            <Button variant="secondary" size="sm" onClick={() => abortRef.current?.abort()}>
              {t.mistakes.scanStop}
            </Button>
          </div>
        ) : (
          <Button block icon={<Icon name="search" />} onClick={() => void runScan()} data-testid="scan-game">
            {t.mistakes.scan}
          </Button>
        )}

        {found && (
          <div aria-live="polite" data-testid="scan-results">
            {found.length === 0 ? (
              <p className="rounded-xl border border-ok/40 bg-ok-soft p-3 text-sm">{t.mistakes.scanNone}</p>
            ) : (
              <>
                <p className="mb-2 font-semibold">{t.mistakes.scanFound(found.length)}</p>
                <ul className="space-y-2">
                  {found.map((m) => {
                    const best = applyUci(m.move.fenBefore, m.bestMove);
                    return (
                      <li key={m.move.ply}>
                        <button
                          type="button"
                          onClick={() => pick(m.move, m)}
                          className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface p-3 text-left hover:bg-surface-2"
                          data-testid="found-mistake"
                        >
                          <span>
                            <span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-bold ${m.severity === 'blunder' ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn'}`}>
                              {t.mistakes.severity[m.severity]}
                            </span>
                            <strong>{moveLabel(m.move)}</strong>
                          </span>
                          <span className="text-sm text-muted">
                            {t.mistakes.best}: {best ? sanToLocal(best.san) : m.bestMove}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold">{t.mistakes.pickMove}</p>
          <ol className="flex flex-wrap gap-1.5" aria-label={t.mistakes.movesLabel}>
            {own.map((move) => (
              <li key={move.ply}>
                <button
                  type="button"
                  onClick={() => pick(move, found?.find((f) => f.move.ply === move.ply) ?? null)}
                  className="min-h-11 rounded-lg bg-surface-2 px-2.5 text-sm font-medium tabular-nums hover:bg-accent-soft"
                  data-ply={move.ply}
                >
                  {moveLabel(move)}
                </button>
              </li>
            ))}
          </ol>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-bad/50 bg-bad-soft p-3 text-sm">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="game-picker">
      <div role="tablist" className="flex gap-1 rounded-2xl bg-surface-2 p-1">
        {(['paste', 'lichess', 'chesscom'] as Tab[]).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              setRemote(null);
              setError(null);
            }}
            className={`min-h-11 flex-1 rounded-xl px-2 text-sm font-semibold ${tab === id ? 'bg-surface shadow' : 'text-muted'}`}
          >
            {t.mistakes.importTabs[id]}
          </button>
        ))}
      </div>

      {tab === 'paste' ? (
        <div className="space-y-2">
          <label htmlFor="pgn-text" className="font-semibold">
            {t.mistakes.pgnLabel}
          </label>
          <textarea
            id="pgn-text"
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
            rows={7}
            placeholder={t.mistakes.pgnPlaceholder}
            className="w-full rounded-xl border border-line bg-surface p-3 font-mono text-sm"
            data-testid="pgn-input"
          />
          <Button block onClick={() => loadGame(pgn)} disabled={!pgn.trim()} data-testid="pgn-load">
            {t.mistakes.pgnLoad}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor="game-username" className="font-semibold">
            {t.mistakes.username}
          </label>
          <div className="flex gap-2">
            <input
              id="game-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3"
            />
            <Button onClick={() => void loadRemote(tab)} disabled={loading || !username.trim()}>
              {t.mistakes.fetchGames}
            </Button>
          </div>
          {loading && <p className="text-sm text-muted">{t.mistakes.fetching}</p>}
          {remote && remote.length === 0 && <p className="text-sm text-muted">{t.mistakes.noGames}</p>}
          {remote && remote.length > 0 && (
            <div>
              <p className="mb-2 font-semibold">{t.mistakes.chooseGame}</p>
              <ul className="space-y-2">
                {remote.map((g, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => loadGame(g.pgn)}
                      className="min-h-11 w-full rounded-xl border border-line bg-surface p-3 text-left text-sm font-medium hover:bg-surface-2"
                    >
                      {g.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-bad/50 bg-bad-soft p-3 text-sm" data-testid="game-error">
          {error}
        </p>
      )}
    </div>
  );
}
