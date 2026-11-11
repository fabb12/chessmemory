import { useState } from 'react';
import { dateFormatter, formatPercent, t } from '../../i18n';
import type { TrendPoint } from '../../features/progress/stats';

interface TrendChartProps {
  points: readonly TrendPoint[];
  /** Nome della serie (la categoria), usato per l'accessibilità. */
  label: string;
}

const W = 320;
const H = 120;
const PAD = { top: 12, right: 14, bottom: 22, left: 34 };

function dayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return dateFormatter.format(new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

/**
 * Andamento della percentuale di successo per giorno di allenamento.
 * Una sola serie, un solo asse (0–100%), con tooltip al passaggio/focus
 * e tabella dei dati come alternativa testuale.
 */
export function TrendChart({ points, label }: TrendChartProps) {
  const [active, setActive] = useState<number | null>(null);

  if (points.length === 0) return <p className="text-sm text-muted">{t.dna.trendEmpty}</p>;
  if (points.length === 1) {
    const only = points[0];
    return (
      <p className="text-sm text-muted">
        {only ? `${dayLabel(only.day)}: ${formatPercent(only.rate)}. ` : ''}
        {t.dna.trendSingle}
      </p>
    );
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (innerW * i) / (points.length - 1);
  const y = (rate: number) => PAD.top + innerH * (1 - rate);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.rate).toFixed(1)}`).join(' ');
  const activePoint = active !== null ? points[active] : undefined;
  const last = points[points.length - 1];
  const summary = points.map((p) => `${dayLabel(p.day)} ${formatPercent(p.rate)}`).join(', ');

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`${label}. ${t.dna.trendAlt(summary)}`}
          onMouseLeave={() => setActive(null)}
        >
          {[0, 0.5, 1].map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(tick) + 3.5} textAnchor="end" fontSize={10} fill="var(--muted)">
                {formatPercent(tick)}
              </text>
            </g>
          ))}
          <text x={PAD.left} y={H - 5} fontSize={10} fill="var(--muted)">
            {dayLabel(points[0]?.day ?? '')}
          </text>
          <text x={W - PAD.right} y={H - 5} fontSize={10} textAnchor="end" fill="var(--muted)">
            {dayLabel(last?.day ?? '')}
          </text>

          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 3" />
          )}
          <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <circle
              key={p.day}
              cx={x(i)}
              cy={y(p.rate)}
              r={active === i ? 5.5 : 4}
              fill="var(--accent)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ))}
          {/* Aree sensibili più grandi dei punti */}
          {points.map((p, i) => (
            <rect
              key={`hit-${p.day}`}
              x={x(i) - innerW / (points.length - 1) / 2}
              y={0}
              width={innerW / (points.length - 1)}
              height={H}
              fill="transparent"
              tabIndex={0}
              aria-label={`${dayLabel(p.day)}: ${formatPercent(p.rate)}, ${p.answers} ${t.dna.answers.toLowerCase()}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onClick={() => setActive(i)}
              style={{ outline: 'none' }}
            />
          ))}
        </svg>
        {activePoint && active !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-2 py-1 text-xs shadow-md"
            style={{ left: `${(x(active) / W) * 100}%` }}
          >
            <span className="font-semibold">{formatPercent(activePoint.rate)}</span>
            <span className="text-muted">
              {' '}
              · {dayLabel(activePoint.day)} · {activePoint.answers} {t.dna.answers.toLowerCase()}
            </span>
          </div>
        )}
      </div>
      <details className="mt-1 text-sm">
        <summary className="inline-flex min-h-9 cursor-pointer items-center text-muted underline-offset-2 hover:underline">
          {t.dna.trendTable}
        </summary>
        <table className="mt-1 w-full text-left tabular-nums">
          <thead>
            <tr className="text-muted">
              <th scope="col" className="py-1 font-medium">{t.dna.day}</th>
              <th scope="col" className="py-1 font-medium">{t.dna.success}</th>
              <th scope="col" className="py-1 font-medium">{t.dna.answers}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.day} className="border-t border-line">
                <td className="py-1">{dayLabel(p.day)}</td>
                <td className="py-1">{formatPercent(p.rate)}</td>
                <td className="py-1">{p.answers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
