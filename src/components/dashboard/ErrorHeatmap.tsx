import { useMemo, useState, type CSSProperties } from 'react';
import type { AttemptRecord } from '../../db/schema';
import { computeHeatmap, type HeatFilter, type HeatMode } from '../../features/progress/heatmap';
import { formatPercent, t } from '../../i18n';
import { CATEGORIES } from '../../types';
import { Card } from '../ui/Card';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;
const MODES: HeatMode[] = ['missed', 'wrong'];
const FILTERS: HeatFilter[] = ['all', ...CATEGORIES];

/** Colore della casa: dal giallo (raro) al rosso (frequente). */
function heatColor(intensity: number): string {
  const hue = Math.round(52 - 52 * intensity);
  const alpha = (0.38 + 0.55 * intensity).toFixed(2);
  return `hsl(${hue} 95% 52% / ${alpha})`;
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  text,
  testId,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
  text: (v: T) => string;
  testId: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5" data-testid={testId}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={`min-h-9 rounded-full border px-3 text-sm font-semibold transition-colors ${
            o === value ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-muted hover:border-accent/60 hover:text-fg'
          }`}
        >
          {text(o)}
        </button>
      ))}
    </div>
  );
}

export function ErrorHeatmap({ attempts }: { attempts: readonly AttemptRecord[] }) {
  const [mode, setMode] = useState<HeatMode>('missed');
  const [filter, setFilter] = useState<HeatFilter>('all');
  const [selected, setSelected] = useState<string | null>(null);

  const heat = useMemo(() => computeHeatmap(attempts, mode, filter), [attempts, mode, filter]);
  const topSet = new Set(heat.top.map((s) => s.square));
  const topText = heat.top.map((s) => `${s.square} (${t.dna.heat.times(s.count)})`).join(', ');
  const selectedCount = selected ? (heat.counts[selected] ?? 0) : 0;

  return (
    <Card data-testid="error-heatmap" data-mode={mode} data-total={heat.total}>
      <h2 className="font-display text-xl font-semibold">{t.dna.heat.title}</h2>

      <div className="mt-3 space-y-2">
        <Segmented
          label={t.dna.heat.modeLabel}
          options={MODES}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setSelected(null);
          }}
          text={(m) => t.dna.heat.modes[m]}
          testId="heat-mode"
        />
        <Segmented
          label={t.dna.heat.filterLabel}
          options={FILTERS}
          value={filter}
          onChange={(f) => {
            setFilter(f);
            setSelected(null);
          }}
          text={(f) => (f === 'all' ? t.dna.heat.all : t.categories[f])}
          testId="heat-filter"
        />
        <p className="text-sm text-muted">{t.dna.heat.modeHelp[mode]}</p>
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:items-start">
        <div>
          <div
            key={`${mode}-${filter}`}
            role="img"
            aria-label={heat.total ? t.dna.heat.boardLabel(heat.total, topText) : t.dna.heat.empty[mode]}
            className="heat-board relative grid aspect-square w-full grid-cols-8 overflow-hidden rounded-2xl border-[6px] border-[#0f1d42] shadow-[0_0_0_1px_rgb(227_181_83/0.55),0_20px_40px_-12px_rgb(6_11_22/0.5)]"
          >
            {RANKS.map((rank, r) =>
              FILES.map((file, f) => {
                const square = `${file}${rank}`;
                const count = heat.counts[square] ?? 0;
                const intensity = heat.max ? count / heat.max : 0;
                const light = (r + f) % 2 === 0;
                const style = {
                  '--heat-delay': `${(r + f) * 28}ms`,
                  backgroundColor: light ? '#e9edf5' : '#7389ad',
                } as CSSProperties;
                return (
                  <div
                    key={square}
                    data-heat-sq={square}
                    data-count={count}
                    title={t.dna.heat.squareLabel(square, count)}
                    onClick={() => setSelected(square === selected ? null : square)}
                    className={`relative cursor-pointer select-none ${selected === square ? 'z-10 outline-3 outline-offset-[-3px] outline-fg' : ''}`}
                    style={style}
                  >
                    {count > 0 && (
                      <span
                        aria-hidden="true"
                        className={`heat-cell absolute inset-0 flex items-center justify-center text-[0.7rem] font-bold text-white sm:text-xs ${
                          topSet.has(square) ? 'heat-hot' : ''
                        }`}
                        style={{ backgroundColor: heatColor(intensity), textShadow: '0 1px 2px rgb(0 0 0 / 0.55)' }}
                      >
                        {count}
                      </span>
                    )}
                    {f === 0 && (
                      <span aria-hidden="true" className={`absolute left-0.5 top-0 text-[0.6rem] font-bold ${light ? 'text-[#4a5f82]' : 'text-[#f1f4fa]'}`}>
                        {rank}
                      </span>
                    )}
                    {r === 7 && (
                      <span aria-hidden="true" className={`absolute bottom-0 right-0.5 text-[0.6rem] font-bold ${light ? 'text-[#4a5f82]' : 'text-[#f1f4fa]'}`}>
                        {file}
                      </span>
                    )}
                  </div>
                );
              }),
            )}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted" aria-hidden="true">
            <span>{t.dna.heat.legendLow}</span>
            <span className="h-2 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, ${heatColor(0)}, ${heatColor(0.5)}, ${heatColor(1)})` }} />
            <span>{t.dna.heat.legendHigh}</span>
          </div>
          <p className="mt-1 min-h-5 text-sm font-semibold" aria-live="polite" data-testid="heat-selected">
            {selected ? t.dna.heat.squareLabel(selected, selectedCount) : ''}
          </p>
        </div>

        <div className="space-y-4" data-testid="heat-insights">
          {heat.total === 0 ? (
            <p className="rounded-xl bg-accent-soft p-3">{t.dna.heat.empty[mode]}</p>
          ) : (
            <>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-accent-strong">{t.dna.heat.hottest}</h3>
                <ol className="mt-2 flex flex-wrap gap-2">
                  {heat.top.map((s, i) => (
                    <li
                      key={s.square}
                      className="flex items-baseline gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 animate-rise"
                      style={{ animationDelay: `${i * 90}ms` }}
                    >
                      <span className="font-display text-2xl font-semibold">{s.square}</span>
                      <span className="text-sm text-muted">{t.dna.heat.times(s.count)}</span>
                    </li>
                  ))}
                </ol>
              </div>
              {heat.topPiece && <p data-testid="heat-piece">{t.dna.heat.piece(t.pieces[heat.topPiece.type])}</p>}
              <div>
                <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                  <div className="h-full bg-accent-strong" style={{ width: `${Math.round((1 - heat.kingside) * 100)}%` }} />
                  <div className="h-full bg-accent" style={{ width: `${Math.round(heat.kingside * 100)}%` }} />
                </div>
                <div className="mt-1 flex justify-between gap-2 text-sm text-muted">
                  <span>{t.dna.heat.queenside(formatPercent(1 - heat.kingside))}</span>
                  <span>{t.dna.heat.kingside(formatPercent(heat.kingside))}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{t.dna.heat.center(formatPercent(heat.center))}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
