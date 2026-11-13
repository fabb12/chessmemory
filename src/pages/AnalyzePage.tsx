import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiKeyForm } from '../components/assistant/ApiKeyForm';
import { BoardEditor } from '../components/chess/BoardEditor';
import { ChessBoard } from '../components/chess/ChessBoard';
import { playLine } from '../components/mistakes/LineViewer';
import { Button } from '../components/ui/Button';
import { Card, PageTitle, SectionTitle } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { SpeakButton } from '../components/ui/SpeakButton';
import type { Profile } from '../db/schema';
import { AssistantError, explainPosition, readBoardFromImage, useApiKey, type BoardReading } from '../features/assistant/claude';
import { ANALYSIS_DEPTH, getEngine, terminalAnalysis, type Analysis } from '../features/engine/engine';
import { formatScore } from '../features/engine/uci';
import { fenToPosition, positionToFen, startPosition, validatePosition, type EditorPosition } from '../features/mistakes/position';
import { t } from '../i18n';
import { captureBoardFrame, frameDifference, frameSignature, MOTION } from '../utils/frames';
import { prepareImage, READING_PHOTO_SIDE } from '../utils/image';
import { formatLine, sanToLocal } from '../utils/notation';

/** Analisi continua: ogni quanto si controlla se la scacchiera si muove (nessun costo, è locale). */
const SAMPLE_MS = 600;
/** Campioni fermi consecutivi prima di rileggere (~1,2 s dopo che la mano si è tolta). */
const STILL_SAMPLES = 2;
/** Intervallo minimo tra due letture con Claude. */
const MIN_READ_GAP_MS = 2500;

type Phase<T> = { status: 'idle' } | { status: 'busy' } | { status: 'done'; value: T } | { status: 'error'; error: string };

function errorText(error: unknown): string {
  const kind = error instanceof AssistantError ? error.kind : 'other';
  return t.analyze.errors[kind] ?? t.analyze.errors.other!;
}

export function AnalyzePage({ profile }: { profile: Profile }) {
  const apiKey = useApiKey();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [reading, setReading] = useState<Phase<BoardReading>>({ status: 'idle' });
  const [position, setPosition] = useState<EditorPosition | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [myColor, setMyColor] = useState<'w' | 'b' | null>(null);
  const [analysis, setAnalysis] = useState<Phase<Analysis>>({ status: 'idle' });
  const [explanation, setExplanation] = useState<Phase<string>>({ status: 'idle' });
  const [live, setLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [liveState, setLiveState] = useState<'watching' | 'moving'>('watching');
  const [readSeconds, setReadSeconds] = useState<number | null>(null);
  const [videoAspect, setVideoAspect] = useState(4 / 3);
  const lastSample = useRef<Uint8Array | null>(null);
  const readSignature = useRef<Uint8Array | null>(null);
  const stillCount = useRef(0);
  const lastReadAt = useRef(0);
  const busy = useRef(false);
  const lastPlacement = useRef<string | null>(null);
  const positionRef = useRef<EditorPosition | null>(null);
  positionRef.current = position;

  // ───── Fotocamera ─────
  const startCamera = async () => {
    setCameraError(false);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        // Bassa risoluzione: basta per ~100 px per casa e il telefono lavora meno.
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      setStream(media);
    } catch {
      setCameraError(true);
    }
  };

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setLive(false);
  }, [stream]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [stream]);

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  // ───── Valutazione: Stockfish, poi la spiegazione di Claude ─────
  const evaluate = useCallback(
    async (pos: EditorPosition) => {
      if (validatePosition(pos)) return;
      const fen = positionToFen(pos);
      setAnalysis({ status: 'busy' });
      setExplanation({ status: 'idle' });
      let result: Analysis;
      try {
        result = terminalAnalysis(fen) ?? (await getEngine().analyse(fen, { depth: ANALYSIS_DEPTH[profile.settings.analysisDepth], multiPv: 3 }));
        setAnalysis({ status: 'done', value: result });
      } catch {
        setAnalysis({ status: 'error', error: t.analyze.errors.engine! });
        return;
      }
      if (result.lines.length === 0 || !apiKey) return;
      setExplanation({ status: 'busy' });
      try {
        const text = await explainPosition({
          fen,
          evaluation: formatScore(result.score, pos.turn === 'w'),
          lines: result.lines.map((line) => formatLine(playLine(fen, line.pv.slice(0, 6)))),
          playerSide: myColor,
        });
        setExplanation({ status: 'done', value: text });
      } catch (error) {
        setExplanation({ status: 'error', error: errorText(error) });
      }
    },
    [apiKey, myColor, profile.settings.analysisDepth],
  );

  // ───── Lettura della scacchiera ─────
  const read = useCallback(
    async (image: string, auto: boolean, fromCamera: boolean) => {
      if (busy.current) return;
      busy.current = true;
      setReading({ status: 'busy' });
      const started = performance.now();
      try {
        // La posizione già nota (magari corretta a mano) aiuta Claude a non sbagliare i pezzi dubbi.
        const known = positionRef.current && !validatePosition(positionRef.current) ? positionToFen(positionRef.current).split(' ')[0] : null;
        const result = await readBoardFromImage(image, { previous: fromCamera ? (known ?? lastPlacement.current) : null });
        setReadSeconds((performance.now() - started) / 1000);
        setReading({ status: 'done', value: result });
        setLastUpdate(Date.now());
        if (auto && result.placement === lastPlacement.current) return;
        const changed = lastPlacement.current !== null && result.placement !== lastPlacement.current;
        lastPlacement.current = result.placement;
        const previous = positionRef.current;
        // Tratto: quello visto da Claude; altrimenti, in analisi continua, alterna.
        const turn =
          result.sideToMove !== 'unknown'
            ? result.sideToMove
            : auto && changed && previous
              ? previous.turn === 'w'
                ? 'b'
                : 'w'
              : (previous?.turn ?? 'w');
        const next = fenToPosition(`${result.placement} ${turn} KQkq`) ?? startPosition();
        setPosition(next);
        if (auto) void evaluate(next);
        else setAnalysis({ status: 'idle' });
      } catch (error) {
        setReading({ status: 'error', error: errorText(error) });
        if (auto) setLive(false);
      } finally {
        busy.current = false;
      }
    },
    [evaluate],
  );

  const captureAndRead = useCallback(
    (auto: boolean) => {
      const video = videoRef.current;
      const frame = video ? captureBoardFrame(video) : null;
      if (!video || !frame) return;
      readSignature.current = frameSignature(video);
      lastReadAt.current = Date.now();
      void read(frame, auto, true);
    },
    [read],
  );

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const image = await prepareImage(file, READING_PHOTO_SIDE);
      void read(image.dataUrl.split(',')[1] ?? '', false, false);
    } catch {
      setReading({ status: 'error', error: t.analyze.errors.unreadable! });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ───── Analisi continua ─────
  // Nessuna lettura a intervalli fissi: una miniatura locale controlla di continuo la
  // scacchiera e Claude viene chiamato appena la mano si toglie e qualcosa è cambiato.
  useEffect(() => {
    if (!live || !stream) return;
    lastSample.current = null;
    readSignature.current = null;
    stillCount.current = 0;
    setLiveState('watching');
    captureAndRead(true);
    const id = window.setInterval(() => {
      const video = videoRef.current;
      const sample = video ? frameSignature(video) : null;
      if (!sample) return;
      const previous = lastSample.current;
      lastSample.current = sample;
      if (!previous) return;
      const motion = frameDifference(previous, sample);
      if (motion > MOTION.moving) {
        stillCount.current = 0;
        setLiveState('moving');
        return;
      }
      if (motion >= MOTION.still) return;
      stillCount.current += 1;
      if (stillCount.current < STILL_SAMPLES) return;
      setLiveState('watching');
      if (busy.current || Date.now() - lastReadAt.current < MIN_READ_GAP_MS) return;
      if (readSignature.current && frameDifference(readSignature.current, sample) < MOTION.changed) return;
      captureAndRead(true);
    }, SAMPLE_MS);
    return () => window.clearInterval(id);
  }, [live, stream, captureAndRead]);

  const positionError = position ? validatePosition(position) : null;
  const fen = position && !positionError ? positionToFen(position) : null;
  const done = analysis.status === 'done' ? analysis.value : null;
  const bestLine = useMemo(() => (done && fen ? playLine(fen, done.lines[0]?.pv ?? []) : []), [done, fen]);
  const best = bestLine[0];
  const turnName = position ? t.sides[position.turn] : '';
  const evalText = done && position ? formatScore(done.score, position.turn === 'w') : '';
  const verdict = best ? `${t.analyze.bestMove}: ${sanToLocal(best.san)}. ${t.analyze.evaluation}: ${evalText}.` : '';

  return (
    <div className="space-y-5">
      <header>
        <PageTitle>{t.analyze.title}</PageTitle>
        <p className="mt-1.5 text-lg text-muted">{t.analyze.intro}</p>
      </header>

      {!apiKey && (
        <Card>
          <SectionTitle>{t.analyze.key.title}</SectionTitle>
          <p className="mt-1 mb-3">{t.analyze.key.needed}</p>
          <ApiKeyForm />
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface-2">
            {stream ? (
              <div className="relative w-full bg-black" style={{ aspectRatio: videoAspect }}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    if (v.videoWidth && v.videoHeight) setVideoAspect(v.videoWidth / v.videoHeight);
                  }}
                  className="absolute inset-0 size-full object-contain"
                  data-testid="camera-video"
                />
                {/* Guida: solo il quadrato centrale viene inviato a Claude. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute top-0 left-1/2 aspect-square h-full -translate-x-1/2 rounded-md border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                />
                <p className="absolute inset-x-0 bottom-1 text-center text-xs font-semibold text-white drop-shadow">{t.analyze.camera.guide}</p>
              </div>
            ) : (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 p-4 text-center text-muted">
                <Icon name="camera" size={40} />
                <p className="text-sm">{t.analyze.camera.tip}</p>
              </div>
            )}
          </div>
          <details className="rounded-xl bg-surface-2 px-3 py-2 text-sm" data-testid="camera-tips">
            <summary className="cursor-pointer font-semibold">{t.analyze.camera.tipsTitle}</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {t.analyze.camera.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </details>
          {cameraError && (
            <p role="alert" className="text-sm font-semibold text-bad">
              {t.analyze.camera.denied}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {stream ? (
              <>
                <Button
                  icon={<Icon name="eye" size={18} />}
                  onClick={() => captureAndRead(false)}
                  disabled={!apiKey || reading.status === 'busy'}
                  data-testid="capture-read"
                >
                  {t.analyze.camera.capture}
                </Button>
                <Button variant="secondary" onClick={stopCamera}>
                  {t.analyze.camera.stop}
                </Button>
              </>
            ) : (
              <Button icon={<Icon name="camera" size={18} />} onClick={() => void startCamera()} data-testid="camera-start">
                {t.analyze.camera.start}
              </Button>
            )}
            <Button variant="secondary" icon={<Icon name="upload" size={18} />} onClick={() => fileRef.current?.click()} disabled={!apiKey}>
              {t.analyze.camera.upload}
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => void onFile(e.target.files?.[0])} />
            {!position && (
              <Button variant="ghost" onClick={() => setPosition(startPosition())} data-testid="manual-position">
                {t.analyze.manual}
              </Button>
            )}
          </div>
          {stream && apiKey && (
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="mt-1 size-5 accent-[var(--accent)]" />
              <span>
                <span className="block font-semibold">{t.analyze.camera.live}</span>
                <span className="block text-sm text-muted">{t.analyze.camera.liveHelp}</span>
              </span>
            </label>
          )}
          <div aria-live="polite" className="space-y-1 text-sm">
            {live && reading.status !== 'busy' && (
              <p className="text-muted" data-testid="live-state">
                {liveState === 'moving' ? t.analyze.camera.moving : t.analyze.camera.watching}
              </p>
            )}
            {reading.status === 'busy' && <p className="font-semibold">{t.analyze.reading}</p>}
            {reading.status === 'error' && (
              <p role="alert" className="font-semibold text-bad">
                {reading.error}
              </p>
            )}
            {reading.status === 'done' && (
              <>
                <p className="font-semibold">
                  {t.analyze.confidence[reading.value.confidence]} · {t.analyze.readDone}
                  {readSeconds !== null && <span className="font-normal text-muted"> ({t.analyze.readTime(readSeconds)})</span>}
                </p>
                {reading.value.notes && <p className="text-muted">{reading.value.notes}</p>}
                {reading.value.sideToMove === 'unknown' && <p className="text-muted">{t.analyze.sideUnknown}</p>}
              </>
            )}
            {lastUpdate && live && <p className="text-muted">{t.analyze.camera.lastUpdate(new Date(lastUpdate).toLocaleTimeString('it-IT'))}</p>}
          </div>
        </Card>

        {position && (
          <Card className="space-y-3" data-testid="analyze-position">
            {done && fen ? (
              <ChessBoard
                fen={fen}
                orientation={flipped ? 'black' : 'white'}
                arrows={best ? [{ from: best.from, to: best.to, tone: 'teach' }] : []}
              />
            ) : (
              <BoardEditor
                value={position}
                onChange={(p) => {
                  setPosition(p);
                  setAnalysis({ status: 'idle' });
                }}
                orientation={flipped ? 'black' : 'white'}
                onFlip={() => setFlipped((f) => !f)}
              />
            )}
            {positionError && Object.keys(position.placement).length > 0 && (
              <p role="alert" className="text-sm font-semibold text-bad">
                {t.mistakes.editor.errors[positionError]}
              </p>
            )}
            <fieldset>
              <legend className="mb-1 text-sm font-semibold">{t.analyze.myColor}</legend>
              <div className="flex flex-wrap gap-2">
                {(['w', 'b', 'none'] as const).map((c) => {
                  const value = c === 'none' ? null : c;
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={myColor === value}
                      onClick={() => {
                        setMyColor(value);
                        if (value) setFlipped(value === 'b');
                      }}
                      className={`min-h-10 rounded-xl border-2 px-3 text-sm font-semibold ${myColor === value ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
                    >
                      {t.analyze.myColors[c]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {done ? (
              <Button variant="secondary" block icon={<Icon name="edit" size={18} />} onClick={() => setAnalysis({ status: 'idle' })}>
                {t.analyze.manual}
              </Button>
            ) : (
              <Button
                size="lg"
                block
                icon={<Icon name="target" />}
                disabled={positionError !== null || analysis.status === 'busy'}
                onClick={() => void evaluate(position)}
                data-testid="evaluate"
              >
                {analysis.status === 'busy' ? t.analyze.evaluating : `${t.analyze.evaluate} · ${t.analyze.turn} ${turnName}`}
              </Button>
            )}
          </Card>
        )}
      </div>

      {analysis.status === 'error' && (
        <p role="alert" className="font-semibold text-bad">
          {analysis.error}
        </p>
      )}

      {done && fen && (
        <Card className="space-y-3" data-testid="analyze-result" aria-live="polite">
          {done.lines.length === 0 ? (
            <p className="font-semibold">{t.analyze.gameOver}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <div>
                  <p className="text-sm text-muted">{t.analyze.evaluation}</p>
                  <p className="font-display text-3xl font-semibold tabular-nums" data-testid="analyze-eval">
                    {evalText}
                  </p>
                </div>
                {best && (
                  <div>
                    <p className="text-sm text-muted">{t.analyze.bestMove}</p>
                    <p className="font-display text-3xl font-semibold" data-testid="analyze-best">
                      {sanToLocal(best.san)}
                    </p>
                  </div>
                )}
                <SpeakButton text={verdict} auto={explanation.status === 'idle' && !apiKey} />
              </div>
              <p className="text-xs text-muted">{t.analyze.evalHelp}</p>
              <div>
                <p className="text-sm font-semibold">{t.analyze.lines}</p>
                <ol className="mt-1 space-y-1 text-sm tabular-nums">
                  {done.lines.map((line) => (
                    <li key={line.multipv} className="rounded-lg bg-surface-2 px-2 py-1">
                      <strong>{formatScore(line.score, position?.turn === 'w')}</strong> {formatLine(playLine(fen, line.pv.slice(0, 8)))}
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
          {explanation.status === 'busy' && <p className="font-semibold">{t.analyze.explaining}</p>}
          {explanation.status === 'error' && (
            <div className="space-y-2">
              <p role="alert" className="font-semibold text-bad">
                {explanation.error}
              </p>
              {position && (
                <Button variant="secondary" onClick={() => void evaluate(position)}>
                  {t.analyze.retryExplain}
                </Button>
              )}
            </div>
          )}
          {explanation.status === 'done' && (
            <div className="rounded-xl border border-l-4 border-line border-l-accent bg-surface p-3.5" data-testid="analyze-explanation">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-accent-strong">{t.analyze.explanation}</p>
                <SpeakButton text={`${verdict} ${explanation.value}`} auto />
              </div>
              <p className="mt-1 whitespace-pre-line">{explanation.value}</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
