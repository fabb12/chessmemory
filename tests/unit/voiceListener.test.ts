import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceListener } from '../../src/features/voice/listen';

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  starts = 0;
  running = false;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onresult: unknown = null;
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    if (this.running) throw new Error('InvalidStateError');
    this.running = true;
    this.starts++;
    this.onstart?.();
  }
  stop() {}
  abort() {
    this.running = false;
  }
  /** Il browser chiude l'ascolto (silenzio, schermo, rete). */
  end(error?: string) {
    if (error) this.onerror?.({ error });
    this.running = false;
    this.onend?.();
  }
}

describe('microfono sempre acceso', () => {
  afterEach(() => {
    vi.useRealTimers();
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  });

  it('si riavvia dopo silenzi ed errori temporanei, anche dopo un «not-allowed» a metà', () => {
    vi.useFakeTimers();
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
    const onError = vi.fn();
    const listener = new VoiceListener({ onHeard: () => undefined, onError });
    expect(listener.start()).toBe(true);
    const rec = FakeRecognition.instances.at(-1)!;
    rec.end();
    vi.advanceTimersByTime(300);
    expect(rec.starts).toBe(2);
    rec.end('network');
    vi.advanceTimersByTime(300);
    rec.end('not-allowed'); // schermo spento: temporaneo
    vi.advanceTimersByTime(5000);
    expect(rec.starts).toBe(4);
    expect(onError).not.toHaveBeenCalled();
    listener.stop();
    rec.end();
    vi.advanceTimersByTime(10_000);
    expect(rec.starts).toBe(4);
  });
});
