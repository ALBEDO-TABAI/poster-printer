// User-uploaded images: analysed client-side (palette + luminance grid), stored in IndexedDB.
import { get, set } from 'idb-keyval';
import type { ImageAsset } from '../engine/gen/ctx';
import { extractPalette } from '../engine/color/extract';
import { CUTOUT_ENDPOINT } from '../config';

const KEY = 'rea.userImages.v1';

export async function loadUserImages(): Promise<ImageAsset[]> {
  return ((await get(KEY)) as ImageAsset[] | undefined) ?? [];
}
export async function saveUserImages(list: ImageAsset[]) { await set(KEY, list); }

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}
const fileToDataUrl = (f: Blob) => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(f); });

export async function analyseImage(file: File, id: string): Promise<ImageAsset> {
  const raw = await fileToDataUrl(file);
  const im = await loadImg(raw);
  const max = 1600;
  const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!; g.drawImage(im, 0, 0, w, h);
  const src = cv.toDataURL('image/jpeg', 0.88);
  const tc = document.createElement('canvas'); const tk = 360 / Math.max(w, h); tc.width = Math.round(w * tk); tc.height = Math.round(h * tk);
  tc.getContext('2d')!.drawImage(cv, 0, 0, tc.width, tc.height);
  const thumb = tc.toDataURL('image/jpeg', 0.8);
  const sc = document.createElement('canvas'); sc.width = 96; sc.height = Math.max(1, Math.round((96 * h) / w));
  const sg = sc.getContext('2d')!; sg.drawImage(cv, 0, 0, sc.width, sc.height);
  const palette = extractPalette(sg.getImageData(0, 0, sc.width, sc.height).data, 5).map((s) => s.hex);
  const lc = document.createElement('canvas'); lc.width = 16; lc.height = 16;
  const lg = lc.getContext('2d')!; lg.drawImage(cv, 0, 0, 16, 16);
  const d = lg.getImageData(0, 0, 16, 16).data;
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum: number[] = [];
  for (let i = 0; i < 256; i++) lum.push(+(0.2126 * lin(d[i * 4]) + 0.7152 * lin(d[i * 4 + 1]) + 0.0722 * lin(d[i * 4 + 2])).toFixed(3));
  // detail map (gradient energy pooled to 16×16) so text placement knows which areas are busy
  const dc = document.createElement('canvas'); dc.width = 64; dc.height = 64;
  const dg = dc.getContext('2d')!; dg.drawImage(cv, 0, 0, 64, 64);
  const dd = dg.getImageData(0, 0, 64, 64).data;
  const gray = (x: number, y: number) => { const i = (Math.min(63, y) * 64 + Math.min(63, x)) * 4; return (dd[i] * 0.299 + dd[i + 1] * 0.587 + dd[i + 2] * 0.114) / 255; };
  const detail: number[] = [];
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
    let e = 0;
    for (let y = j * 4; y < j * 4 + 4; y++) for (let x = i * 4; x < i * 4 + 4; x++) e += Math.abs(gray(x + 1, y) - gray(x, y)) + Math.abs(gray(x, y + 1) - gray(x, y));
    detail.push(+Math.min(1, e / 16 / 0.25).toFixed(2));
  }
  return { id, src, thumb, w, h, palette, lum, lumW: 16, lumH: 16, detail, focus: { x: 0.5, y: 0.45 }, cutout: null, category: 'mine', title: file.name, credit: { title: file.name, license: 'user upload' } } as ImageAsset;
}

/** Ask the local cutout server (rembg / BiRefNet) for an alpha cut-out. Returns a PNG data URL or null. */
export async function requestCutout(asset: ImageAsset): Promise<{ cutout: string; focus: { x: number; y: number }; subject?: { x: number; y: number; w: number; h: number } } | null> {
  try {
    const blob = await (await fetch(asset.src)).blob();
    const r = await fetch(CUTOUT_ENDPOINT, { method: 'POST', body: blob, headers: { 'Content-Type': blob.type || 'image/jpeg' } });
    if (!r.ok) return null;
    const out = await r.blob();
    const url = await fileToDataUrl(out);
    const im = await loadImg(url);
    const cv = document.createElement('canvas'); const s = 64; cv.width = s; cv.height = s;
    const g = cv.getContext('2d')!; g.drawImage(im, 0, 0, s, s);
    const d = g.getImageData(0, 0, s, s).data;
    let sx = 0, sy = 0, sa = 0, x0 = s, y0 = s, x1 = 0, y1 = 0;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const a = d[(y * s + x) * 4 + 3] / 255; sx += x * a; sy += y * a; sa += a;
      if (a > 0.5) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
    }
    const subject = x1 > x0 ? { x: x0 / s, y: y0 / s, w: (x1 - x0) / s, h: (y1 - y0) / s } : undefined;
    return { cutout: url, focus: sa > 0 ? { x: sx / sa / s, y: sy / sa / s } : { x: 0.5, y: 0.45 }, subject };
  } catch { return null; }
}

export async function cutoutAvailable(): Promise<boolean> {
  try { const r = await fetch(CUTOUT_ENDPOINT.replace(/cutout$/, 'health')); return r.ok; } catch { return false; }
}
