import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { t } from '../../i18n';

/** Invita a installare l'app sul dispositivo (Android/desktop: pulsante; iPhone/iPad: istruzioni). */
export function InstallCard() {
  const { state, install } = useInstallPrompt();
  if (state === 'installed') return null;
  if (state === 'unavailable') return null;
  return (
    <Card className="border-accent/40" data-testid="install-card">
      <h2 className="font-display text-xl font-semibold">{t.install.title}</h2>
      <p className="mt-1 text-muted">{t.install.text}</p>
      {state === 'available' ? (
        <Button size="lg" className="mt-3" onClick={() => void install()} data-testid="install-button">
          {t.install.button}
        </Button>
      ) : (
        <p className="mt-3 rounded-xl bg-accent-soft p-3" data-testid="install-ios">
          {t.install.ios}
        </p>
      )}
    </Card>
  );
}
