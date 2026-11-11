import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card, PageTitle, SectionTitle } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Icon } from '../components/ui/Icon';
import type { Profile } from '../db/schema';
import { useSessions } from '../hooks/useData';
import { dateTimeFormatter, t } from '../i18n';
import {
  BackupValidationError,
  MAX_BACKUP_BYTES,
  exportBackup,
  importBackup,
  parseBackupText,
  resetProgress,
  type BackupData,
} from '../services/backup';
import { updateSettings } from '../services/progress';
import type { BoardOrientationPreference, ThemePreference } from '../types';

const THEMES: ThemePreference[] = ['system', 'light', 'dark'];
const ORIENTATIONS: BoardOrientationPreference[] = ['auto', 'white', 'black'];

function Segmented<T extends string>({
  legend,
  name,
  value,
  options,
  labels,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 font-semibold">{legend}</legend>
      <div className="flex flex-col gap-2 sm:flex-row">
        {options.map((option) => (
          <label
            key={option}
            className={`flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-medium ${
              value === option ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="size-4 accent-(--accent)"
            />
            {labels[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ProfilePage({ profile }: { profile: Profile }) {
  const sessions = useSessions();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [pendingImport, setPendingImport] = useState<BackupData | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetChecked, setResetChecked] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const handleExport = async () => {
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chessmemory-backup-${backup.exportedAt.slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage({ tone: 'ok', text: t.profile.exported });
    } catch (error) {
      setMessage({ tone: 'bad', text: error instanceof Error ? error.message : String(error) });
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new BackupValidationError('file troppo grande');
      setPendingImport(parseBackupText(await file.text()));
      setMessage(null);
    } catch (error) {
      const reason = error instanceof BackupValidationError ? error.reason : 'file non leggibile';
      setMessage({ tone: 'bad', text: t.profile.importError(reason) });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    try {
      await importBackup(pendingImport);
      setMessage({ tone: 'ok', text: t.profile.imported });
    } catch {
      setMessage({ tone: 'bad', text: t.profile.importError(t.app.storageError) });
    }
    setPendingImport(null);
  };

  const confirmReset = async () => {
    await resetProgress();
    setResetOpen(false);
    setResetChecked(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageTitle>{t.profile.title}</PageTitle>

      <Card>
        <SectionTitle>{t.profile.levelSection}</SectionTitle>
        <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted">{t.profile.declared}</dt>
            <dd className="text-base font-semibold" data-testid="profile-declared">
              {profile.declaredLevel ? t.declared[profile.declaredLevel] : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{t.profile.current}</dt>
            <dd className="text-base font-semibold" data-testid="profile-level">
              {t.level.of5(profile.adaptive.level)}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-sm text-muted">{t.level.notElo}</p>
      </Card>

      <Card>
        <SectionTitle>{t.profile.prefsSection}</SectionTitle>
        <div className="mt-3 space-y-4">
          <Segmented
            legend={t.profile.theme}
            name="theme"
            value={profile.settings.theme}
            options={THEMES}
            labels={t.profile.themes}
            onChange={(theme) => void updateSettings({ theme })}
          />
          <Segmented
            legend={t.profile.orientation}
            name="orientation"
            value={profile.settings.boardOrientation}
            options={ORIENTATIONS}
            labels={t.profile.orientations}
            onChange={(boardOrientation) => void updateSettings({ boardOrientation })}
          />
        </div>
      </Card>

      <Card>
        <SectionTitle>{t.profile.historySection}</SectionTitle>
        {!sessions || sessions.length === 0 ? (
          <p className="mt-2 text-muted">{t.profile.historyEmpty}</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted" data-testid="sessions-total">
              {t.profile.sessionsTotal(sessions.length)}
            </p>
            <ul className="mt-2 divide-y divide-line" data-testid="session-history">
              {sessions.slice(0, 20).map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2">
                  <span className="font-medium">{dateTimeFormatter.format(new Date(s.finishedAt))}</span>
                  <span className="text-sm text-muted tabular-nums">
                    {t.profile.historyRow(s.correctAnswers, s.totalAnswers, s.items.length)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>{t.profile.dataSection}</SectionTitle>
        <p className="mt-1 text-sm text-muted">{t.profile.dataNote}</p>
        {persisted !== null && (
          <p className="mt-1 text-sm text-muted">
            {persisted ? t.profile.storagePersisted : t.profile.storageBestEffort}
          </p>
        )}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" block icon={<Icon name="download" size={18} />} onClick={() => void handleExport()} data-testid="export-data">
            {t.profile.export}
          </Button>
          <Button variant="secondary" block icon={<Icon name="upload" size={18} />} onClick={() => fileRef.current?.click()}>
            {t.profile.import}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-label={t.profile.import}
            data-testid="import-file"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </div>
        <div aria-live="polite">
          {message && (
            <p
              data-testid="data-message"
              className={`mt-3 flex items-start gap-2 rounded-xl border p-3 text-sm ${
                message.tone === 'ok' ? 'border-ok/50 bg-ok-soft' : 'border-bad/50 bg-bad-soft'
              }`}
            >
              <Icon name={message.tone === 'ok' ? 'check' : 'cross'} size={18} className="mt-0.5 shrink-0" />
              {message.text}
            </p>
          )}
        </div>
        <hr className="my-4 border-line" />
        <Button variant="ghost" className="text-bad" icon={<Icon name="trash" size={18} />} onClick={() => setResetOpen(true)} data-testid="reset-open">
          {t.profile.reset}
        </Button>
      </Card>

      <p className="text-center text-sm text-muted">{t.profile.version(__APP_VERSION__)}</p>

      <ConfirmDialog
        open={pendingImport !== null}
        title={t.profile.importConfirmTitle}
        confirmLabel={t.profile.importConfirm}
        onConfirm={() => void confirmImport()}
        onCancel={() => setPendingImport(null)}
      >
        <p>
          {pendingImport ? t.profile.importConfirmText(pendingImport.sessions.length, pendingImport.cards.length) : ''}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={resetOpen}
        title={t.profile.resetTitle}
        confirmLabel={t.profile.resetConfirm}
        danger
        confirmDisabled={!resetChecked}
        onConfirm={() => void confirmReset()}
        onCancel={() => {
          setResetOpen(false);
          setResetChecked(false);
        }}
      >
        <p>{t.profile.resetText}</p>
        <label className="flex min-h-11 cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={resetChecked}
            onChange={(e) => setResetChecked(e.target.checked)}
            className="mt-1 size-5 shrink-0 accent-(--accent)"
            data-testid="reset-check"
          />
          <span>{t.profile.resetCheck}</span>
        </label>
      </ConfirmDialog>
    </div>
  );
}
