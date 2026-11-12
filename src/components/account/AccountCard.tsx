import { useEffect, useState, type FormEvent } from 'react';
import { useAccount } from '../../features/account/AccountProvider';
import { downloadProgress, fetchCloudProgressInfo, uploadProgress } from '../../features/account/cloud';
import { dateTimeFormatter, t } from '../../i18n';
import { BackupValidationError, exportBackup, importBackup, validateBackup } from '../../services/backup';
import { Button } from '../ui/Button';
import { Card, SectionTitle } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Icon } from '../ui/Icon';

type Mode = 'signIn' | 'signUp' | 'reset';
type Message = { tone: 'ok' | 'bad'; text: string } | null;

export const MIN_PASSWORD = 8;

/** Traduce gli errori di Supabase Auth in messaggi comprensibili. */
export function authErrorMessage(error: unknown): string {
  const e = error as { message?: string; code?: string; status?: number } | null;
  const code = e?.code ?? '';
  const message = e?.message ?? String(error);
  const lower = message.toLowerCase();
  if (code === 'invalid_credentials' || lower.includes('invalid login credentials')) return t.account.errors.invalid;
  if (code === 'email_not_confirmed' || lower.includes('email not confirmed')) return t.account.errors.notConfirmed;
  if (code === 'user_already_exists' || code === 'email_exists' || lower.includes('already registered')) {
    return t.account.errors.exists;
  }
  if (code === 'weak_password' || lower.includes('password should be')) return t.account.errors.weak;
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || e?.status === 429) {
    return t.account.errors.rate;
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) return t.account.errors.network;
  return t.account.errors.generic(message);
}

function Notice({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p
      data-testid="account-message"
      className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
        message.tone === 'ok' ? 'border-ok/50 bg-ok-soft' : 'border-bad/50 bg-bad-soft'
      }`}
    >
      <Icon name={message.tone === 'ok' ? 'check' : 'cross'} size={18} className="mt-0.5 shrink-0" />
      {message.text}
    </p>
  );
}

const inputClass = 'mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3';

/** Accesso, registrazione e gestione dell'account (Supabase). */
export function AccountCard() {
  const account = useAccount();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [cloudInfo, setCloudInfo] = useState<{ updatedAt: string } | null | undefined>(undefined);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const { client, userId, status } = account;
  useEffect(() => {
    if (!client || !userId) {
      setCloudInfo(undefined);
      return;
    }
    let cancelled = false;
    fetchCloudProgressInfo(client, userId)
      .then((info) => !cancelled && setCloudInfo(info))
      .catch(() => !cancelled && setCloudInfo(undefined));
    return () => {
      cancelled = true;
    };
  }, [client, userId]);

  const run = async (action: () => Promise<Message>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await action());
    } catch (error) {
      setMessage({ tone: 'bad', text: error instanceof BackupValidationError ? t.profile.importError(error.reason) : authErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (mode === 'reset') {
        await account.sendPasswordReset(email);
        return { tone: 'ok', text: t.account.resetSent };
      }
      if (mode === 'signUp') {
        const outcome = await account.signUp(email, password);
        setPassword('');
        return outcome === 'confirm' ? { tone: 'ok', text: t.account.confirmSent } : null;
      }
      await account.signIn(email, password);
      setPassword('');
      return null;
    });
  };

  if (status === 'disabled') {
    return (
      <Card data-testid="account-card" data-status="disabled">
        <SectionTitle>{t.account.title}</SectionTitle>
        <p className="mt-1 text-sm text-muted">{t.account.disabled}</p>
      </Card>
    );
  }

  if (status === 'loading') {
    return (
      <Card data-testid="account-card" data-status="loading">
        <SectionTitle>{t.account.title}</SectionTitle>
        <p className="mt-1 text-sm text-muted">{t.account.loading}</p>
      </Card>
    );
  }

  if (status === 'signedIn' && account.recovery) {
    return (
      <Card data-testid="account-card" data-status="recovery">
        <SectionTitle>{t.account.recoveryTitle}</SectionTitle>
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await account.updatePassword(password);
              setPassword('');
              return { tone: 'ok', text: t.account.passwordSaved };
            });
          }}
        >
          <label className="block">
            <span className="font-semibold">{t.account.newPassword}</span>
            <input type="password" autoComplete="new-password" minLength={MIN_PASSWORD} required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            <span className="text-sm text-muted">{t.account.passwordHelp}</span>
          </label>
          <Button type="submit" block disabled={busy || password.length < MIN_PASSWORD}>
            {t.account.savePassword}
          </Button>
          <div aria-live="polite">
            <Notice message={message} />
          </div>
        </form>
      </Card>
    );
  }

  if (status === 'signedIn') {
    const syncText = t.account.sync[account.sync];
    return (
      <Card data-testid="account-card" data-status="signedIn">
        <SectionTitle>{t.account.title}</SectionTitle>
        <p className="mt-1 font-semibold" data-testid="account-email">
          {t.account.signedInAs(account.email ?? '')}
        </p>
        {syncText && (
          <p className={`mt-1 flex items-center gap-1.5 text-sm ${account.sync === 'error' ? 'text-bad' : 'text-muted'}`} data-testid="account-sync">
            <Icon name="cloud" size={16} />
            {syncText}
          </p>
        )}

        <hr className="my-4 border-line" />
        <h3 className="font-semibold">{t.account.cloudTitle}</h3>
        <p className="mt-1 text-sm text-muted">{t.account.cloudText}</p>
        {cloudInfo !== undefined && (
          <p className="mt-1 text-sm text-muted">
            {cloudInfo ? t.account.cloudLast(dateTimeFormatter.format(new Date(cloudInfo.updatedAt))) : t.account.cloudNone}
          </p>
        )}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            block
            icon={<Icon name="upload" size={18} />}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (!client || !userId) return null;
                await uploadProgress(client, userId, await exportBackup(undefined, Date.now(), { includePhotos: false }));
                setCloudInfo(await fetchCloudProgressInfo(client, userId));
                return { tone: 'ok', text: t.account.cloudSaved };
              })
            }
          >
            {t.account.cloudSave}
          </Button>
          <Button variant="secondary" block icon={<Icon name="download" size={18} />} disabled={busy || cloudInfo === null} onClick={() => setRestoreOpen(true)}>
            {t.account.cloudRestore}
          </Button>
        </div>
        <div aria-live="polite" className="mt-3">
          <Notice message={message} />
        </div>

        <hr className="my-4 border-line" />
        <Button variant="ghost" icon={<Icon name="logout" size={18} />} onClick={() => void run(async () => (await account.signOut(), null))} data-testid="sign-out">
          {t.account.signOut}
        </Button>

        <ConfirmDialog
          open={restoreOpen}
          title={t.account.cloudRestoreTitle}
          confirmLabel={t.account.cloudRestore}
          onCancel={() => setRestoreOpen(false)}
          onConfirm={() => {
            setRestoreOpen(false);
            void run(async () => {
              if (!client || !userId) return null;
              const raw = await downloadProgress(client, userId);
              if (raw === null) return { tone: 'bad', text: t.account.cloudEmpty };
              await importBackup(validateBackup(raw));
              return { tone: 'ok', text: t.account.cloudRestored };
            });
          }}
        >
          <p>{t.account.cloudRestoreText}</p>
        </ConfirmDialog>
      </Card>
    );
  }

  return (
    <Card data-testid="account-card" data-status="signedOut">
      <SectionTitle>{mode === 'reset' ? t.account.forgot : t.account.title}</SectionTitle>
      <p className="mt-1 text-sm text-muted">{t.account.intro}</p>
      <form className="mt-3 space-y-3" onSubmit={submit}>
        <label className="block">
          <span className="font-semibold">{t.account.email}</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} data-testid="account-email-input" />
        </label>
        {mode !== 'reset' && (
          <label className="block">
            <span className="font-semibold">{t.account.password}</span>
            <input
              type="password"
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              required
              minLength={mode === 'signUp' ? MIN_PASSWORD : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              data-testid="account-password-input"
            />
            {mode === 'signUp' && <span className="text-sm text-muted">{t.account.passwordHelp}</span>}
          </label>
        )}
        <Button type="submit" block disabled={busy} data-testid="account-submit">
          {mode === 'signIn' ? t.account.signIn : mode === 'signUp' ? t.account.signUp : t.account.sendReset}
        </Button>
      </form>
      <div aria-live="polite" className="mt-3">
        <Notice message={message} />
      </div>
      <div className="mt-2 flex flex-col items-start gap-1">
        {mode === 'signIn' && (
          <>
            <Button variant="ghost" size="sm" onClick={() => { setMode('signUp'); setMessage(null); }}>
              {t.account.switchToSignUp}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setMode('reset'); setMessage(null); }}>
              {t.account.forgot}
            </Button>
          </>
        )}
        {mode !== 'signIn' && (
          <Button variant="ghost" size="sm" onClick={() => { setMode('signIn'); setMessage(null); }}>
            {mode === 'signUp' ? t.account.switchToSignIn : t.account.backToSignIn}
          </Button>
        )}
      </div>
    </Card>
  );
}
