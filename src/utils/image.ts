/**
 * Preparazione delle foto della scacchiera: ridimensionate e ricompresse in
 * JPEG per occupare poco spazio nel database locale (di solito 100–250 kB).
 */

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
}

export const MAX_PHOTO_SIDE = 1280;
const JPEG_QUALITY = 0.82;
/** File più grandi vengono rifiutati prima ancora di essere letti. */
export const MAX_INPUT_BYTES = 30 * 1024 * 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('immagine non leggibile'));
    img.src = src;
  });
}

function draw(
  source: CanvasImageSource,
  width: number,
  height: number,
  rotate90 = false,
): PreparedImage {
  const canvas = document.createElement('canvas');
  canvas.width = rotate90 ? height : width;
  canvas.height = rotate90 ? width : height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas non disponibile');
  if (rotate90) {
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
  }
  ctx.drawImage(source, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY), width: canvas.width, height: canvas.height };
}

/** Legge un file immagine (fotocamera o galleria) e lo riduce a una dimensione ragionevole. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) throw new Error('il file non è un’immagine');
  if (file.size > MAX_INPUT_BYTES) throw new Error('immagine troppo grande');
  const url = URL.createObjectURL(file);
  try {
    // L'orientamento EXIF delle foto del telefono è applicato dal browser (image-orientation: from-image).
    const img = await loadImage(url);
    const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    return draw(img, width, height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Ruota la foto di 90° in senso orario. */
export async function rotateImage(image: PreparedImage): Promise<PreparedImage> {
  const img = await loadImage(image.dataUrl);
  return draw(img, img.naturalWidth, img.naturalHeight, true);
}
