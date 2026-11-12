import { setVoiceAuto, setVoiceRate, speak, speechSupported, useVoiceAuto, useVoiceRate } from '../../features/voice/speech';
import { t } from '../../i18n';
import { Button } from './Button';
import { Icon } from './Icon';

const RATES = [
  { value: 0.8, key: 'slow' },
  { value: 1, key: 'normal' },
  { value: 1.2, key: 'fast' },
] as const;

/** Preferenze della voce: lettura automatica e velocità (solo su questo dispositivo). */
export function VoiceSettings() {
  const auto = useVoiceAuto();
  const rate = useVoiceRate();

  if (!speechSupported()) return <p className="text-muted">{t.voice.unsupported}</p>;

  return (
    <div className="space-y-4">
      <p className="text-muted">{t.voice.settingsText}</p>
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => setVoiceAuto(e.target.checked)}
          className="size-5 accent-[var(--accent)]"
          data-testid="voice-auto"
        />
        <span className="font-semibold">{t.voice.auto}</span>
      </label>
      <fieldset>
        <legend className="mb-1.5 font-semibold">{t.voice.rate}</legend>
        <div className="flex flex-wrap gap-2">
          {RATES.map((r) => (
            <label
              key={r.key}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-xl border-2 px-3 text-sm font-semibold ${
                rate === r.value ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
              }`}
            >
              <input
                type="radio"
                name="voice-rate"
                className="sr-only"
                checked={rate === r.value}
                onChange={() => setVoiceRate(r.value)}
              />
              {t.voice.rates[r.key]}
            </label>
          ))}
        </div>
      </fieldset>
      <Button variant="secondary" icon={<Icon name="speaker" size={16} />} onClick={() => speak(t.voice.testText, 'voice-test')}>
        {t.voice.test}
      </Button>
    </div>
  );
}
