import type { WinningLine } from '../../features/analysis/winningLine';
import { t } from '../../i18n';
import { formatLine } from '../../utils/notation';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

interface WinningLineCardProps {
  line: WinningLine;
  open: boolean;
  onToggle: () => void;
}

/** La continuazione migliore per chi deve muovere: fino al matto, o fino allo scacco, o il piano. */
export function WinningLineCard({ line, open, onToggle }: WinningLineCardProps) {
  const title =
    line.kind === 'mate' ? t.analyze.win.mate(line.mateIn ?? 1) : line.kind === 'check' ? t.analyze.win.check(line.checkIn ?? 1) : t.analyze.win.plan;
  const lead = line.kind === 'mate' ? t.analyze.win.mateLead : line.kind === 'check' ? t.analyze.win.checkLead : t.analyze.win.planLead;
  const tone = line.kind === 'plan' ? 'border-l-accent' : 'border-l-ok';
  return (
    <div className={`rounded-xl border border-l-4 border-line bg-surface p-3.5 ${tone}`} data-testid="winning-line" data-kind={line.kind}>
      <p className="font-display text-xl font-semibold">{title}</p>
      <p className="mt-0.5 text-sm text-muted">{lead}</p>
      <p className="mt-1.5 font-semibold tabular-nums">{formatLine(line.moves)}</p>
      <Button variant="secondary" size="sm" className="mt-2" icon={<Icon name="play" size={16} />} aria-pressed={open} onClick={onToggle}>
        {open ? t.analyze.candidates.hideLine : t.analyze.win.show}
      </Button>
    </div>
  );
}
