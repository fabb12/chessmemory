import { useRef, useState } from 'react';
import { t } from '../../i18n';
import { prepareImage, rotateImage, type PreparedImage } from '../../utils/image';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

interface PhotoCaptureProps {
  photo: PreparedImage | null;
  onChange: (photo: PreparedImage | null) => void;
}

/**
 * Acquisizione della foto della scacchiera: fotocamera posteriore sui
 * telefoni (attributo «capture»), oppure un'immagine dalla galleria.
 */
export function PhotoCapture({ photo, onChange }: PhotoCaptureProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await prepareImage(file));
    } catch {
      setError(t.mistakes.photoError);
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  const rotate = async () => {
    if (!photo) return;
    setBusy(true);
    try {
      onChange(await rotateImage(photo));
    } catch {
      setError(t.mistakes.photoError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="photo-capture">
      {photo ? (
        <figure className="space-y-2">
          <button
            type="button"
            onClick={() => setZoom((z) => !z)}
            className="block w-full overflow-hidden rounded-2xl border border-line bg-surface-2"
            aria-label={t.mistakes.zoomPhoto}
            aria-pressed={zoom}
          >
            <img
              src={photo.dataUrl}
              alt={t.mistakes.photoAlt}
              width={photo.width}
              height={photo.height}
              data-testid="photo-preview"
              className={`mx-auto w-full object-contain ${zoom ? 'max-h-none' : 'max-h-[min(60dvh,30rem)]'}`}
            />
          </button>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={<Icon name="undo" size={16} />} onClick={() => void rotate()} disabled={busy}>
              {t.mistakes.rotatePhoto}
            </Button>
            <Button variant="secondary" size="sm" icon={<Icon name="upload" size={16} />} onClick={() => galleryRef.current?.click()} disabled={busy}>
              {t.mistakes.changePhoto}
            </Button>
            <Button variant="ghost" size="sm" className="text-bad" icon={<Icon name="trash" size={16} />} onClick={() => onChange(null)} disabled={busy}>
              {t.mistakes.removePhoto}
            </Button>
          </div>
        </figure>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button block size="lg" icon={<Icon name="camera" />} onClick={() => cameraRef.current?.click()} disabled={busy}>
            {t.mistakes.takePhoto}
          </Button>
          <Button block size="lg" variant="secondary" icon={<Icon name="upload" />} onClick={() => galleryRef.current?.click()} disabled={busy}>
            {t.mistakes.choosePhoto}
          </Button>
        </div>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-label={t.mistakes.takePhoto}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label={t.mistakes.choosePhoto}
        data-testid="photo-input"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <div aria-live="polite">
        {busy && <p className="text-sm text-muted">{t.mistakes.photoProcessing}</p>}
        {error && (
          <p className="rounded-xl border border-bad/50 bg-bad-soft p-3 text-sm" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
