import { useEffect, useRef } from 'react';

/**
 * Anteprima della scacchiera raddrizzata (vista dall'alto) com'è vista dal
 * programma dopo la trasformazione prospettica, con la griglia 8×8.
 * Se le case non sono quadrati regolari, gli angoli vanno sistemati.
 */
export function RectifiedPreview({ image, label }: { image: ImageBitmap | ImageData | null; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !image) return;
    canvas.width = image.width;
    canvas.height = image.height;
    if (image instanceof ImageData) ctx.putImageData(image, 0, 0);
    else ctx.drawImage(image, 0, 0);
    ctx.strokeStyle = 'rgba(80, 220, 140, 0.8)';
    ctx.lineWidth = 1;
    const step = image.width / 8;
    for (let k = 1; k < 8; k++) {
      ctx.beginPath();
      ctx.moveTo(k * step, 0);
      ctx.lineTo(k * step, image.height);
      ctx.moveTo(0, k * step);
      ctx.lineTo(image.width, k * step);
      ctx.stroke();
    }
  }, [image]);

  return (
    <figure className="space-y-1">
      <canvas ref={canvasRef} className="aspect-square w-full rounded-lg border border-line bg-black" data-testid="rectified-preview" aria-label={label} />
      <figcaption className="text-xs text-muted">{label}</figcaption>
    </figure>
  );
}
