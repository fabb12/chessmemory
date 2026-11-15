/**
 * Foto dalla fotocamera per la lettura della scacchiera: il fotogramma intero
 * (la scacchiera può stare ovunque, la si cerca dopo), ridotto a `maxSide` px
 * e compresso in JPEG. Restituisce il base64 senza prefisso.
 */
export function captureStill(video: HTMLVideoElement, maxSide: number): string | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82).split(',')[1] ?? null;
}
