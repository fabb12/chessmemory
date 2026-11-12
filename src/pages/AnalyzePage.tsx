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
import { prepareImage } from '../utils/image';
import { formatLine, sanToLocal } from '../utils/notation';

const LIVE_INTERVAL_S = 20;
const MAX_SIDE = 1280;

type Phase<T> = { status: 'idle' } | { status: 'busy' } | { status: 'done'; value: T } | { status: 'error'; error: string };

/** Fotogramma corrente del video in JPEG (base64 senza prefisso), lato massimo 1280 px. */
function captureFrame(video: HTMLVideoElement): string | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1] ?? null;
}

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
  const busy = useRef(false);
  const lastPlacement = useRef<string | null>(null);
  const positionRef = useRef<EditorPosition | null>(null);
  positionRef.current = position;

  // ───── Fotocamera ─────
  const startCamera = async () => {
    setCameraError(false);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
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
    async (image: string, auto: boolean) => {
      if (busy.current) return;
      busy.current = true;
      setReading({ status: 'busy' });
      try {
        const result = await readBoardFromImage(image);
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
      const frame = videoRef.current ? captureFrame(videoRef.current) : null;
      if (frame) void read(frame, auto);
    },
    [read],
  );

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const image = await prepareImage(file);
      void read(image.dataUrl.split(',')[1] ?? '', false);
    } catch {
      setReading({ status: 'error', error: t.analyze.errors.unreadable! });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ───── Analisi continua ─────
  useEffect(() => {
    if (!live || !stream) return;
    captureAndRead(true);
    const id = window.setInterval(() => captureAndRead(true), LIVE_INTERVAL_S * 1000);
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
              <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full bg-black object-contain" data-testid="camera-video" />
            ) : (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 p-4 text-center text-muted">
                <Icon name="camera" size={40} />
                <p className="text-sm">{t.analyze.camera.tip}</p>
              </div>
            )}
          </div>
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
                <span className="block text-sm text-muted">{t.analyze.camera.liveHelp(LIVE_INTERVAL_S)}</span>
              </span>
            </label>
          )}
          <div aria-live="polite" className="space-y-1 text-sm">
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
