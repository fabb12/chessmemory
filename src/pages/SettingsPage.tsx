import { ApiKeyForm, ModelSettings } from '../components/assistant/ApiKeyForm';
import { Card, PageTitle, SectionTitle } from '../components/ui/Card';
import { VoiceSettings } from '../components/ui/VoiceSettings';
import { t } from '../i18n';

/** Impostazioni dell'app: modello di Claude (con la lettura rapida), chiave API e voce. */
export function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="settings-page">
      <header>
        <PageTitle>{t.settings.title}</PageTitle>
        <p className="mt-1.5 text-muted">{t.settings.intro}</p>
      </header>

      <Card>
        <SectionTitle>{t.settings.modelSection}</SectionTitle>
        <p className="mt-1 mb-3 text-sm text-muted">{t.settings.modelNote}</p>
        <ModelSettings />
      </Card>

      <Card>
        <SectionTitle>{t.settings.keySection}</SectionTitle>
        <div className="mt-3">
          <ApiKeyForm />
        </div>
      </Card>

      <Card>
        <SectionTitle>{t.settings.voiceSection}</SectionTitle>
        <div className="mt-3">
          <VoiceSettings />
        </div>
      </Card>
    </div>
  );
}
