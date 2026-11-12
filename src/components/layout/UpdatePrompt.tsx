import { useRegisterSW } from 'virtual:pwa-register/react';
import { t } from '../../i18n';
import { Button } from '../ui/Button';

/** Se c'è una nuova versione dell'app, chiede all'utente se vuole aggiornare. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  if (!needRefresh) return null;
  return (
    <div
      role="alertdialog"
      aria-labelledby="update-title"
      aria-describedby="update-text"
      data-testid="update-prompt"
      className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-2xl border-2 border-accent bg-surface p-4 shadow-lg md:bottom-6"
    >
      <p id="update-title" className="font-display text-lg font-semibold">
        {t.app.update.title}
      </p>
      <p id="update-text" className="mt-1 text-sm text-muted">
        {t.app.update.text}
      </p>
      <div className="mt-3 flex gap-2">
        <Button onClick={() => void updateServiceWorker(true)}>{t.app.update.accept}</Button>
        <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
          {t.app.update.later}
        </Button>
      </div>
    </div>
  );
}
