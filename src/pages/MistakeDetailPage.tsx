import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LineViewer } from '../components/mistakes/LineViewer';
import { Button, buttonClass } from '../components/ui/Button';
import { Card, PageTitle, SectionTitle } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Icon } from '../components/ui/Icon';
import { CONCEPTS, findConcept } from '../data/exercises';
import type { MistakeRecord, Profile } from '../db/schema';
import { formatScore } from '../features/engine/uci';
import { useMistake, useNow, usePhoto } from '../hooks/useData';
import { dateFormatter, formatRelativeDay, t } from '../i18n';
import { deleteMistake, updateMistakeNotes } from '../services/mistakes';
import { applyUci, sideToMove } from '../utils/chess';
import { sanToLocal } from '../utils/notation';

export function mistakeOrientation(profile: Profile, mistake: Pick<MistakeRecord, 'fen'>): 'white' | 'black' {
  const pref = profile.settings.boardOrientation;
  if (pref === 'white' || pref === 'black') return pref;
  return sideToMove(mistake.fen) === 'w' ? 'white' : 'black';
}

/** Note dell'utente su un errore: cosa ha sbagliato e come proseguire. */
export function MistakeNotes({ mistake }: { mistake: MistakeRecord }) {
  const concept = mistake.conceptId ? findConcept(mistake.conceptId) : undefined;
  return (
    <dl className="space-y-3">
      <div>
        <dt className="text-sm font-semibold text-muted">{t.mistakes.whatWentWrong}</dt>
        <dd className="whitespace-pre-line" data-testid="note-wrong">
          {mistake.whatWentWrong || <span className="text-muted">{t.mistakes.noNotes}</span>}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-muted">{t.mistakes.howToContinue}</dt>
        <dd className="whitespace-pre-line" data-testid="note-continue">
          {mistake.howToContinue || <span className="text-muted">{t.mistakes.noNotes}</span>}
        </dd>
      </div>
      {concept && (
        <div>
          <dt className="text-sm font-semibold text-muted">{t.mistakes.concept}</dt>
          <dd>
            <Link to={`/strategie/${concept.id}`} className="font-semibold text-accent-strong underline underline-offset-2">
              {concept.title}
            </Link>
          </dd>
        </div>
      )}
    </dl>
  );
}

function cpScore(cp: number) {
  if (Math.abs(cp) >= 90_000) {
    const n = Math.round((100_000 - Math.abs(cp)) / 100);
    return { kind: 'mate' as const, value: cp > 0 ? n : -n };
  }
  return { kind: 'cp' as const, value: cp };
}

export function MistakeDetailPage({ profile }: { profile: Profile }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const now = useNow();
  const mistake = useMistake(id);
  const photo = usePhoto(mistake?.photoId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: '', whatWentWrong: '', howToContinue: '', conceptId: '' });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [zoom, setZoom] = useState(false);

  if (mistake === undefined) return <p className="text-muted">{t.app.loading}</p>;
  if (mistake === null) {
    return (
      <Card className="mx-auto max-w-xl">
        <p>{t.mistakes.detailNotFound}</p>
        <Link to="/errori" className={`${buttonClass('secondary')} mt-3`}>
          {t.mistakes.backToList}
        </Link>
      </Card>
    );
  }

  const played = mistake.playedMove ? applyUci(mistake.fen, mistake.playedMove) : null;
  const best = applyUci(mistake.fen, mistake.bestMove);
  const whiteToMove = sideToMove(mistake.fen) === 'w';

  const startEdit = () => {
    setDraft({
      title: mistake.title,
      whatWentWrong: mistake.whatWentWrong,
      howToContinue: mistake.howToContinue,
      conceptId: mistake.conceptId ?? '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    await updateMistakeNotes(mistake.id, { ...draft, conceptId: draft.conceptId || null });
    setEditing(false);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4" data-testid="mistake-detail" data-mistake-id={mistake.id}>
      <Link to="/errori" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent-strong">
        <Icon name="arrowLeft" size={16} />
        {t.mistakes.backToList}
      </Link>

      {params.get('salvato') === '1' && (
        <p className="flex items-center gap-2 rounded-xl border border-ok/50 bg-ok-soft p-3 text-sm" role="status" data-testid="mistake-saved">
          <Icon name="check" size={18} />
          {t.mistakes.saved}
        </p>
      )}

      <header className="space-y-1">
        <PageTitle data-testid="mistake-title-heading">{mistake.title}</PageTitle>
        <p className="text-sm text-muted">
          {mistake.gameInfo ? `${mistake.gameInfo} · ` : ''}
          {t.mistakes.created(dateFormatter.format(new Date(mistake.createdAt)))} · {t.mistakes.reviews(mistake.reviewCount)}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(16rem,1fr)] md:items-start">
        <LineViewer fen={mistake.fen} line={mistake.line} playedMove={mistake.playedMove} orientation={mistakeOrientation(profile, mistake)} />

        <div className="space-y-4">
          <Card>
            <p className="text-sm text-muted">{t.sideToMove[sideToMove(mistake.fen)]}</p>
            <dl className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <dt className="text-sm text-muted">{t.mistakes.played}</dt>
                <dd className="font-display text-2xl font-semibold text-bad" data-testid="detail-played">
                  {played ? sanToLocal(played.san) : <span className="text-base text-muted">{t.mistakes.unknownPlayed}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">{t.mistakes.best}</dt>
                <dd className="font-display text-2xl font-semibold text-ok" data-testid="detail-best">
                  {best ? sanToLocal(best.san) : mistake.bestMove}
                </dd>
              </div>
            </dl>
            {mistake.severity && (
              <p className="mt-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${mistake.severity === 'blunder' ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn'}`}>
                  {t.mistakes.severity[mistake.severity]}
                </span>
              </p>
            )}
            {mistake.engine && (
              <p className="mt-2 text-sm text-muted">
                {t.mistakes.engineEval(
                  formatScore(cpScore(mistake.engine.bestCp), whiteToMove),
                  mistake.engine.playedCp === null ? null : formatScore(cpScore(mistake.engine.playedCp), whiteToMove),
                )}
              </p>
            )}
            <p className="mt-2 text-sm">
              {t.mistakes.nextReview(formatRelativeDay(mistake.card.due, now))}
              {mistake.lastResult && <span className="text-muted"> · {t.mistakes.lastResult[mistake.lastResult]}</span>}
            </p>
            <Link to={`/errori/ripasso?id=${mistake.id}`} className={`${buttonClass('primary', 'md', true)} mt-3`} data-testid="review-this">
              <Icon name="train" size={18} />
              {t.mistakes.reviewNow}
            </Link>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-2">
              <SectionTitle>{t.mistakes.notesTitle}</SectionTitle>
              {!editing && (
                <Button variant="ghost" size="sm" icon={<Icon name="edit" size={16} />} onClick={startEdit} data-testid="edit-notes">
                  {t.mistakes.edit}
                </Button>
              )}
            </div>
            {editing ? (
              <div className="mt-2 space-y-3">
                <label className="block">
                  <span className="text-sm font-semibold">{t.mistakes.titleLabel}</span>
                  <input
                    value={draft.title}
                    maxLength={120}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold">{t.mistakes.whatWentWrong}</span>
                  <textarea
                    value={draft.whatWentWrong}
                    maxLength={2000}
                    rows={3}
                    onChange={(e) => setDraft({ ...draft, whatWentWrong: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-line bg-surface p-3"
                    data-testid="edit-wrong"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold">{t.mistakes.howToContinue}</span>
                  <textarea
                    value={draft.howToContinue}
                    maxLength={2000}
                    rows={3}
                    onChange={(e) => setDraft({ ...draft, howToContinue: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-line bg-surface p-3"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold">{t.mistakes.concept}</span>
                  <select
                    value={draft.conceptId}
                    onChange={(e) => setDraft({ ...draft, conceptId: e.target.value })}
                    className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3"
                  >
                    <option value="">{t.mistakes.conceptNone}</option>
                    {CONCEPTS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {t.categories[c.category]} · {c.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex gap-2">
                  <Button onClick={() => void saveEdit()} data-testid="save-notes">
                    {t.mistakes.saveNotes}
                  </Button>
                  <Button variant="secondary" onClick={() => setEditing(false)}>
                    {t.mistakes.cancelEdit}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <MistakeNotes mistake={mistake} />
              </div>
            )}
          </Card>

          {photo && (
            <Card>
              <button type="button" onClick={() => setZoom((z) => !z)} aria-pressed={zoom} aria-label={t.mistakes.zoomPhoto} className="block w-full overflow-hidden rounded-2xl">
                <img
                  src={photo.dataUrl}
                  width={photo.width}
                  height={photo.height}
                  alt={t.mistakes.photoAlt}
                  className={`w-full object-contain ${zoom ? '' : 'max-h-72'}`}
                  data-testid="detail-photo"
                />
              </button>
            </Card>
          )}

          <Button variant="ghost" className="text-bad" icon={<Icon name="trash" size={18} />} onClick={() => setDeleteOpen(true)} data-testid="delete-mistake">
            {t.mistakes.delete}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title={t.mistakes.deleteTitle}
        confirmLabel={t.mistakes.deleteConfirm}
        danger
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          void deleteMistake(mistake.id).then(() => navigate('/errori', { replace: true }));
        }}
      >
        <p>{t.mistakes.deleteText}</p>
      </ConfirmDialog>
    </div>
  );
}
