import { useEffect, useId } from 'react';
import { currentSpeakingId, speak, speechSupported, stopSpeaking, useSpeakingId, useVoiceAuto, useVoiceEnabled } from '../../features/voice/speech';
import { t } from '../../i18n';
import { Icon } from './Icon';

interface SpeakButtonProps {
  text: string;
  /** Legge da solo il testo quando compare (se la lettura automatica è attiva). */
  auto?: boolean;
  /** Ritardo della lettura automatica, in millisecondi. */
  delay?: number;
  className?: string;
}

/** Pulsante «Ascolta»: legge il testo con la voce del dispositivo. */
export function SpeakButton({ text, auto = false, delay = 300, className = '' }: SpeakButtonProps) {
  const id = useId();
  const speakingId = useSpeakingId();
  const enabled = useVoiceEnabled();
  const autoOn = useVoiceAuto();
  const speaking = speakingId === id;
  const supported = speechSupported();

  useEffect(() => {
    if (!supported || !enabled || !auto || !autoOn || !text) return;
    const timer = window.setTimeout(() => speak(text, id), delay);
    return () => window.clearTimeout(timer);
  }, [supported, enabled, auto, autoOn, text, id, delay]);

  // Uscendo dalla schermata la voce si ferma.
  useEffect(
    () => () => {
      if (currentSpeakingId() === id) stopSpeaking();
    },
    [id],
  );

  if (!supported || !enabled) return null;
  return (
    <button
      type="button"
      onClick={() => (speaking ? stopSpeaking() : speak(text, id))}
      aria-pressed={speaking}
      data-testid="speak-button"
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-fg ${className}`}
    >
      <Icon name={speaking ? 'stop' : 'speaker'} size={16} />
      {speaking ? t.voice.stop : t.voice.listen}
    </button>
  );
}
