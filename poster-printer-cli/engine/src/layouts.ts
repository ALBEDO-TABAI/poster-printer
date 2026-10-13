// Phase 16 — picture-set analysis and Swiss layout recommendation. The resolver asks: given these pictures (their
// number, proportions, subjects, busyness, colour) and this copy (length, list, mood, density, format), which grid
// layouts can carry them, and why? Every recommendation carries its reasons, so an agent can explain the choice.
import type { ImageAsset } from '@rea/engine/gen/ctx';
import { canvasSize, type Ratio } from '@rea/engine/types';

export type Orient = 'tall' | 'portrait' | 'square' | 'landscape' | 'panorama';
export interface PicInfo { id: string; w: number; h: number; ar: number; orient: Orient; busy: number; subject: { x: number; y: number; w: number; h: number } | null; subjectShare: number; palette: string[]; user: boolean }
export interface SetInfo {
  n: number; pics: PicInfo[];
  orientations: Partial<Record<Orient, number>>;
  /** spread of the proportions (std of log w/h): 0 = all alike, > 0.35 = clearly mixed */
  spread: number;
  /** pictures read as one series (alike proportions and related colour) */
  series: boolean;
  /** mean busyness (0 calm … 1 busy) */
  busy: number;
  /** text-friendly summary */
  note: string;
}
export interface LayoutRec { composition: 'modular' | 'bleedgrid'; layout: string; score: number; reasons: string[] }

export const LAYOUT_CATALOG = [
  { composition: 'modular', layout: 'hero', zh: '主图卫星', count: '1–7', when: 'one picture matters most: it takes a large span and bleeds off its outer edges; the others form a row or column of satellites a clear step smaller; type sits in its own fields' },
  { composition: 'modular', layout: 'flow', zh: '悬挂线', count: '1–4 (≤ half the columns)', when: 'calm, editorial: the headline sits on a flowline; pictures and the info column hang from it at their own heights (ragged feet, open space below)' },
  { composition: 'modular', layout: 'steps', zh: '尺度递进', count: '2–3', when: 'a sequence with a direction: 1 → 2 → 3 field squares on a diagonal (the hero is the last step and bleeds), type in the empty triangles' },
  { composition: 'modular', layout: 'strip', zh: '图片横条', count: '2–8', when: 'a series of alike pictures: one or two justified rows at a common height, bleeding left and right; type above / below' },
  { composition: 'modular', layout: 'blocks', zh: '模块分区', count: '2–8', when: 'a specimen sheet / catalogue: equal modules, the hero may take four; type in the head row' },
  { composition: 'bleedgrid', layout: 'mosaic', zh: '满版拼贴', count: '2–8', when: 'edge to edge, mixed proportions: a slicing tree solved for the sheet so every picture keeps its proportion; the type gets its own cell (paper, accent or ink)' },
  { composition: 'bleedgrid', layout: 'rows', zh: '满版行列', count: '2–8', when: 'edge to edge, a gallery wall: justified rows (or columns on long sheets) with a type cell' },
] as const;

const orientOf = (ar: number): Orient => (ar < 0.6 ? 'tall' : ar < 0.88 ? 'portrait' : ar <= 1.14 ? 'square' : ar <= 1.9 ? 'landscape' : 'panorama');
const hexHue = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16); const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 0.08) return -1;
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; return h < 0 ? h + 360 : h;
};

export function analyseSet(assets: ImageAsset[]): SetInfo {
  const pics: PicInfo[] = assets.slice(0, 8).map((a) => {
    const ar = a.w / Math.max(1, a.h);
    const busy = a.detail?.length ? a.detail.reduce((s, v) => s + v, 0) / a.detail.length : 0.35;
    return { id: a.id, w: a.w, h: a.h, ar: +ar.toFixed(3), orient: orientOf(ar), busy: +busy.toFixed(2), subject: a.subject ?? null, subjectShare: a.subject ? +(a.subject.w * a.subject.h).toFixed(2) : 1, palette: a.palette ?? [], user: !!a.user };
  });
  const n = pics.length;
  const orientations: SetInfo['orientations'] = {};
  for (const p of pics) orientations[p.orient] = (orientations[p.orient] ?? 0) + 1;
  const logs = pics.map((p) => Math.log(p.ar));
  const mean = logs.reduce((s, v) => s + v, 0) / Math.max(1, n);
  const spread = n > 1 ? Math.sqrt(logs.reduce((s, v) => s + (v - mean) ** 2, 0) / n) : 0;
  // colour relation: the dominant hues of the pictures fall within one 70° band (or the pictures are near-neutral)
  const hues = pics.map((p) => p.palette.map(hexHue).filter((h) => h >= 0)[0] ?? -1).filter((h) => h >= 0);
  let hueBand = 0;
  if (hues.length > 1) { const s = [...hues].sort((a, b) => a - b); let gap = 360 - (s[s.length - 1] - s[0]); for (let i = 1; i < s.length; i++) gap = Math.max(gap, s[i] - s[i - 1]); hueBand = 360 - gap; }
  const series = n >= 2 && spread < 0.22 && hueBand < 90;
  const busy = n ? pics.reduce((s, p) => s + p.busy, 0) / n : 0;
  const ori = Object.entries(orientations).map(([k, v]) => `${v} ${k}`).join(', ');
  const note = n ? `${n} picture${n > 1 ? 's' : ''} (${ori}); proportions ${spread < 0.15 ? 'alike' : spread < 0.35 ? 'somewhat mixed' : 'clearly mixed'} (spread ${spread.toFixed(2)})${series ? ', reads as one series' : ''}; ${busy > 0.45 ? 'busy' : busy < 0.25 ? 'calm' : 'moderate'} detail` : 'no pictures';
  return { n, pics, orientations, spread: +spread.toFixed(3), series, busy: +busy.toFixed(2), note };
}

/** layouts that can carry this picture set and this copy, best first, each with its reasons */
export function recommendLayouts(set: SetInfo, o: { ratio: string; density: 'airy' | 'balanced' | 'packed'; mood: string[]; listItems: number; heavyCopy: boolean; use?: string; asked?: string }): LayoutRec[] {
  const { n } = set;
  if (!n) return [];
  const [W, H] = canvasSize(o.ratio as Ratio);
  const wide = W / H > 1.5, tall = H / W > 1.5;
  const S: Record<string, { s: number; why: string[] }> = {};
  const add = (k: string, v: number, why: string) => { (S[k] ??= { s: 0, why: [] }).s += v; S[k].why.push(why); };
  // ---- count (the strongest signal)
  if (n === 1) { add('hero', 3, 'one picture: it is the hero on a field span, bleeding off its outer edges'); add('flow', 2.2, 'one picture: it can hang from a flowline under the headline'); }
  else if (n === 2) { add('hero', 2.8, 'two pictures: a big–small pair reads at once'); add('steps', 2.2, 'two pictures: a two-step scale progression'); add('strip', 1.4, 'two pictures side by side at a common height'); add('mosaic', 1.6, 'two pictures can fill the sheet edge to edge with a type cell'); add('flow', 1.4, 'two pictures can hang from a flowline'); }
  else if (n <= 4) { add('hero', 2.6, `${n} pictures: one hero and ${n - 1} satellites`); add('strip', 2, `${n} pictures in a justified row`); add('blocks', 1.8, `${n} pictures as equal modules`); add('mosaic', 2.2, `${n} pictures edge to edge`); add('rows', 1.6, `${n} pictures as a gallery wall`); if (n === 3) add('steps', 1.6, 'three pictures: a 1 → 2 → 3 scale progression'); if (n <= 3) add('flow', 1.2, `${n} pictures hanging from a flowline`); }
  else { add('blocks', 2.6, `${n} pictures: a specimen sheet of modules`); add('mosaic', 2.8, `${n} pictures fill the sheet edge to edge`); add('rows', 2.3, `${n} pictures as justified rows`); add('strip', 2.1, `${n} pictures in two justified rows`); add('hero', 1.6, `${n} pictures: a hero with ${n - 1} satellites`); }
  // ---- proportions
  if (n >= 2) {
    if (set.series) { add('strip', 1.2, 'the pictures read as one series (alike proportions and colour): a strip or rows show the rhythm'); add('rows', 0.9, 'a series reads well as a gallery wall'); add('blocks', 0.6, 'a series files well as modules'); }
    if (set.spread > 0.35) { add('mosaic', 1.1, `mixed proportions (spread ${set.spread.toFixed(2)}): the slicing tree keeps every picture whole`); add('hero', 0.5, 'mixed proportions: satellites can differ in shape'); add('blocks', -0.8, 'mixed proportions crop hard in equal modules'); add('strip', -0.4, 'mixed proportions make an uneven row'); }
    const pano = (set.orientations.panorama ?? 0) + (set.orientations.tall ?? 0);
    if (pano) add('mosaic', 0.5, `${pano} extreme proportion${pano > 1 ? 's' : ''} (panorama / tall): only a solved tree avoids heavy crops`);
  }
  // ---- busyness: butt-joined busy pictures fight each other; white space separates them
  if (set.busy > 0.45 && n >= 3) { add('mosaic', -0.6, 'busy pictures butt-joined compete: prefer fields with gutters (or seams)'); add('blocks', 0.4, 'gutters separate busy pictures'); add('hero', 0.3, 'gutters separate busy pictures'); }
  // ---- copy
  if (o.listItems >= 4) { add('hero', 1, `${o.listItems}-item list: the info block needs its own column`); add('flow', 0.8, 'a long list hangs well in a flowline column'); add('mosaic', -0.4, 'a long list needs a large type cell in a bleed grid'); add('rows', -0.4, 'a long list needs a large type cell'); }
  if (o.heavyCopy) { add('hero', 0.4, 'heavy copy: modular fields give the text room'); add('blocks', 0.3, 'heavy copy: the head row and modules carry text'); }
  // ---- intent
  const m = o.mood;
  if (o.density === 'airy' || m.some((x) => ['calm', 'minimal', 'elegant', 'luxurious'].includes(x))) { add('flow', 1, 'calm / airy: white fields under a flowline'); add('steps', 0.8, 'calm / airy: a progression in open space'); add('hero', 0.4, 'calm: one clear hero'); add('mosaic', -0.8, 'calm: an edge-to-edge sheet is loud'); add('rows', -0.6, 'calm: an edge-to-edge sheet is loud'); }
  if (o.density === 'packed' || m.some((x) => ['bold', 'loud', 'raw', 'playful'].includes(x))) { add('mosaic', 1, 'bold / packed: the sheet filled edge to edge'); add('rows', 0.6, 'bold / packed: a full gallery wall'); add('blocks', 0.4, 'packed: modules carry a lot'); }
  if (m.some((x) => ['editorial', 'technical', 'swiss'].includes(x))) { add('hero', 0.4, 'editorial: hero and satellites on a strict grid'); add('flow', 0.4, 'editorial: a flowline'); add('blocks', 0.4, 'technical: a specimen sheet'); }
  if (o.use === 'full-bleed') { add('mosaic', 2, 'imagery: full-bleed → the bleed grid'); add('rows', 1.4, 'imagery: full-bleed → the bleed grid'); }
  else if (o.use === 'hero') add('hero', 1, 'imagery: hero → one dominant picture');
  else if (o.use === 'accent') { add('flow', 0.6, 'imagery: accent → pictures support the type'); add('steps', 0.5, 'imagery: accent'); }
  // ---- format
  if (wide) { add('strip', 0.5, 'long format: a row runs the width'); add('hero', 0.5, 'long format: hero | satellites | text column'); add('mosaic', 0.4, 'long format: a mosaic holds the width'); add('steps', -1.2, 'long format: no room for a diagonal'); add('flow', -0.2, 'long format: hanging pictures read as a thin band'); }
  if (tall) { add('hero', 0.4, 'tall format: a hero band and stacked satellites'); add('strip', -0.4, 'tall format: rows get thin'); add('blocks', 0.3, 'tall format: modules stack'); }
  // ---- feasibility (the engine's own limits)
  const cap: Record<string, [number, number]> = { hero: [1, 7], flow: [1, wide ? 5 : 3], steps: [2, 3], strip: [2, 8], blocks: [2, 8], mosaic: [2, 8], rows: [2, 8] };
  if (o.asked && o.asked !== 'auto' && o.asked !== 'single' && S[o.asked]) add(o.asked, 10, 'requested in the brief');
  const out: LayoutRec[] = [];
  for (const [k, v] of Object.entries(S)) {
    const [lo, hi] = cap[k] ?? [1, 8];
    if (n < lo || n > hi) continue;
    out.push({ composition: k === 'mosaic' || k === 'rows' ? 'bleedgrid' : 'modular', layout: k, score: +v.s.toFixed(2), reasons: v.why });
  }
  return out.sort((a, b) => b.score - a.score);
}
