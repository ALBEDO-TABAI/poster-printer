import { isCJKChar } from './breaker';

export interface FontSpec { family: string; weight: number; size: number; tracking?: number; italic?: boolean; fallback?: string }
export interface FontMetrics { cap: number; asc: number; desc: number } // per 1px font size

export interface Measurer {
  width(text: string, f: FontSpec): number;
  metrics(f: FontSpec): FontMetrics;
  /** optional (phase 8): real glyph ink extents in px at f.size — left inset from the advance origin, right edge, ascent, descent */
  ink?(text: string, f: FontSpec): { left: number; right: number; ascent: number; descent: number } | null;
}

export const cssFamily = (f: FontSpec) => `"${f.family}"${f.fallback ? `, "${f.fallback}"` : ''}, "Noto Sans SC", sans-serif`;
export const cssFont = (f: FontSpec, size = f.size) => `${f.italic ? 'italic ' : ''}${Math.round(f.weight)} ${size}px ${cssFamily(f)}`;

/** Approximate measurer for tests / SSR. */
export const approxMeasurer: Measurer = {
  width(text, f) {
    let w = 0;
    for (const c of text) w += isCJKChar(c) ? 1 : c === ' ' ? 0.28 : /[A-Z0-9]/.test(c) ? 0.66 : 0.52;
    return w * f.size + (f.tracking || 0) * f.size * Math.max(0, [...text].length - 1);
  },
  metrics() { return { cap: 0.7, asc: 0.92, desc: 0.24 }; },
};

/** size buckets for the width cache: 0.5 px steps up to 24 px, then 4 %; opsz axes saturate by ~72 px */
export const sizeBucket = (s: number) => { const v = Math.max(4, Math.min(72, s)); return v <= 24 ? Math.round(v * 2) / 2 : +(24 * Math.pow(1.04, Math.round(Math.log(v / 24) / Math.log(1.04)))).toFixed(2); };

/** Canvas-based measurer for the browser. Caches widths. */
export function canvasMeasurer(): Measurer {
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(8, 8) : document.createElement('canvas');
  const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
  const cache = new Map<string, number>();
  const mcache = new Map<string, FontMetrics>();
  const inkCache = new Map<string, { left: number; right: number; ascent: number; descent: number }>();
  return {
    width(text, f) {
      // phase 12: measured at the real size (bucketed), not at 100 px: variable faces with an optical-size axis (Inter,
      // Roboto Flex, Fraunces, Newsreader…) are wider at text sizes, and the renderer uses font-optical-sizing:auto
      const ms = sizeBucket(f.size);
      const key = `${f.family}|${f.fallback}|${f.weight}|${f.italic ? 1 : 0}|${ms}|${text}`;
      let w = cache.get(key);
      if (w === undefined) {
        ctx.font = cssFont(f, ms);
        w = ctx.measureText(text).width / ms;
        if (cache.size > 40000) cache.clear();
        cache.set(key, w);
      }
      return w * f.size + (f.tracking || 0) * f.size * Math.max(0, [...text].length - 1);
    },
    ink(text, f) {
      const key = `ink|${f.family}|${f.fallback}|${f.weight}|${f.italic ? 1 : 0}|${text}`;
      let v = inkCache.get(key);
      if (!v) {
        ctx.font = cssFont(f, 100);
        const mt = ctx.measureText(text);
        v = { left: -mt.actualBoundingBoxLeft / 100, right: mt.actualBoundingBoxRight / 100, ascent: mt.actualBoundingBoxAscent / 100, descent: mt.actualBoundingBoxDescent / 100 };
        if (inkCache.size > 4000) inkCache.clear();
        inkCache.set(key, v);
      }
      return { left: v.left * f.size, right: v.right * f.size, ascent: v.ascent * f.size, descent: v.descent * f.size };
    },
    metrics(f) {
      const key = `${f.family}|${f.weight}|${f.italic ? 1 : 0}`;
      let m = mcache.get(key);
      if (!m) {
        ctx.font = cssFont(f, 100);
        const H = ctx.measureText('HXE');
        const g = ctx.measureText('永国');
        const cap = H.actualBoundingBoxAscent / 100;
        m = { cap: cap > 0.3 ? cap : 0.7, asc: Math.max(H.fontBoundingBoxAscent ?? 92, g.actualBoundingBoxAscent) / 100, desc: (H.fontBoundingBoxDescent ?? 24) / 100 };
        mcache.set(key, m);
      }
      return m;
    },
  };
}
