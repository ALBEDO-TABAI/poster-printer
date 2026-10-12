// Record & replay: sessions are lists of history entries; playback and WebM capture.
import type { Entry } from '../store';
import { entryScene } from '../store';
import { rasterize } from './exporter';
import { APP_SLUG } from '../config';

export const SESSION_VERSION = 1;
export function sessionJson(entries: Entry[]) {
  return JSON.stringify({ app: APP_SLUG, kind: 'session', version: SESSION_VERSION, created: new Date().toISOString(), entries }, null, 1);
}
export function parseSession(txt: string): Entry[] {
  const j = JSON.parse(txt);
  if (Array.isArray(j)) return j;
  if (j.kind === 'session' && Array.isArray(j.entries)) return j.entries;
  if (j.kind === 'poster' && j.entry) return [j.entry];
  throw new Error('not a session file');
}

/** Render entries to a WebM video (one poster per `interval` ms). */
export async function recordWebM(entries: Entry[], interval: number, onProgress?: (i: number) => void): Promise<Blob | null> {
  if (!entries.length || typeof MediaRecorder === 'undefined') return null;
  const first = entryScene(entries[0]);
  if (!first) return null;
  const W = 1080, H = Math.round((W * first.h) / first.w);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const frames: ImageBitmap[] = [];
  for (let i = 0; i < entries.length; i++) {
    const sc = entryScene(entries[i]);
    if (!sc) continue;
    const b = await rasterize(sc, W / sc.w);
    frames.push(await createImageBitmap(b));
    onProgress?.(i + 1);
  }
  const stream = cv.captureStream(30);
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start();
  for (const f of frames) {
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    const k = Math.min(W / f.width, H / f.height);
    g.drawImage(f, (W - f.width * k) / 2, (H - f.height * k) / 2, f.width * k, f.height * k);
    await new Promise((r) => setTimeout(r, interval));
  }
  rec.stop();
  await done;
  return new Blob(chunks, { type: 'video/webm' });
}
