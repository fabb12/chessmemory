import { greeting } from '../../features/play/robot';
import { setTone, TONE_LABELS, TONES, useTone } from '../../features/tutor/tone';
import { speak, speechSupported } from '../../features/voice/speech';
import { t } from '../../i18n';
import { Button } from './Button';
import { Icon } from './Icon';

/** Tono di parlata di tutte le voci dell'AI (Benbot, tutor, spiegazioni di Claude). */
export function ToneSettings() {
  const tone = useTone();
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="sr-only">{t.settings.toneSection}</legend>
        <div className="flex flex-wrap gap-2" data-testid="settings-tone">
          {TONES.map((value) => (
            <label
              key={value}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-xl border-2 px-3 text-sm font-semibold ${
                tone === value ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
              }`}
            >
              <input type="radio" name="ai-tone" className="sr-only" value={value} checked={tone === value} onChange={() => setTone(value)} />
              {TONE_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>
      {speechSupported() && (
        <Button
          variant="secondary"
          icon={<Icon name="speaker" size={16} />}
          onClick={() => speak(greeting('w', false, tone).text, 'tone-test')}
        >
          {t.settings.tonePreview}
        </Button>
      )}
    </div>
  );
}
