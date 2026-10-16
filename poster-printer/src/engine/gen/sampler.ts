// Phase 6 composition sampler. It picks an archetype first (a near-uniform target share, down-weighted when used in
// the last few draws) and then a composition inside it. Layouts that averaged below 7 when picked blind are kept,
// but on probation: the taste selector only accepts their best candidates (see select.ts).
import type { ImageAsset } from './ctx';
import type { DrawPlan } from './plan';
import type { ModeKey } from '../types';

export type Arch = 'GG' | 'SPL' | 'SWI' | 'CTR' | 'FAN' | 'CARD' | 'MOD' | 'PART' | 'INSET' | 'FB' | 'LAY' | 'BAND' | 'GRID';
/** composition → archetype (the same coding as the phase 3–6 evaluation labels) */
export const COMP_ARCH: Record<string, Arch> = {
  edge: 'GG', echo: 'GG', typo: 'GG', giant: 'GG', typefill: 'GG',
  knockout: 'SPL', split: 'SPL',
  vertical: 'SWI', swiss: 'SWI', index: 'SWI',
  quote: 'CTR', centered: 'CTR',
  ring: 'FAN', fan: 'FAN',
  bento: 'CARD', cards: 'CARD',
  mosaic: 'MOD', checker: 'MOD',
  veil: 'PART', partition: 'PART',
  inset: 'INSET',
  fullbleed: 'FB', ghost: 'FB',
  object: 'LAY', layered: 'LAY', cover: 'LAY',
  bands: 'BAND', panorama: 'BAND',
  ma: 'INSET', substitute: 'GG', hanzi: 'GG', anomaly: 'MOD', calendar: 'SWI', window: 'FB',
  typeled: 'GG', interleave: 'LAY', programme: 'SWI', exhibit: 'INSET', zoned: 'FB',
  modular: 'GRID', bleedgrid: 'GRID',
};
export const archOf = (comp: string, hasCut: boolean): Arch => (comp === 'cover' && !hasCut ? 'FB' : COMP_ARCH[comp] ?? 'GG');

/** target archetype shares: close to uniform, a little more weight on the type-led families that carry most copy */
const TARGET: Record<Arch, number> = { GG: 0.85, SPL: 0.85, SWI: 1.0, CTR: 1.0, FAN: 0.9, CARD: 0.9, MOD: 0.85, PART: 0.95, INSET: 0.8, FB: 0.9, LAY: 1.1, BAND: 0.85, GRID: 1.0 };
/** preference inside an archetype */
const WITHIN: Record<string, number> = {
  edge: 1.3, echo: 0.8, typo: 0.6, giant: 0.35, typefill: 0.2,
  knockout: 0.9, split: 0.5,
  vertical: 1.3, swiss: 1.0 /* phase 15: 0.45 → 1.0, 白 7.86 (n=7) */, index: 0.5,
  quote: 1.3, centered: 0.4,
  ring: 1.5, fan: 0.2,
  bento: 1.0, cards: 0.45,
  mosaic: 1.0, checker: 0.45,
  veil: 1.0, partition: 0.4,
  inset: 1.0,
  fullbleed: 0.6, ghost: 0.8, cover: 1.0,
  object: 1.2, layered: 0,
  bands: 0.3, panorama: 1.2,
  ma: 1.0, substitute: 1.0, hanzi: 1.0, anomaly: 1.0, calendar: 1.0, window: 1.0,
  modular: 1.2, bleedgrid: 1.0,
};
/** compositions that averaged < 7 when picked blind in phases 4–5: only their best candidates are accepted */
// phase 15: swiss, window, fullbleed and inset left probation — the U1 ratings put them at or above the mean (shrunk 7.37–7.6)
export const PROBATION = new Set(['split', 'checker', 'partition', 'cards', 'fan', 'typefill', 'centered', 'bands', 'giant', 'ghost', 'index', 'ma']);
/** phase 15 (Ar't alignment, scripts/align/verify_u1.py): the U1 mean per composition, shrunk toward the grand mean 7.285
 *  (empirical Bayes, k = within/between variance ≈ 6.5; compositions with n < 4 are left out). The sampler multiplies each
 *  composition's final share by exp(2.5 · (shrunk − 7.285)), clamped to [0.5, 1.8]: a tendency, never a ban. */
export const USER_SHRUNK: Record<string, number> = {
  window: 7.6, cover: 7.6, swiss: 7.58, edge: 7.48, fan: 7.46, layered: 7.43, echo: 7.42, bands: 7.42, bento: 7.42, inset: 7.4,
  split: 7.39, fullbleed: 7.37, checker: 7.33, vertical: 7.29, panorama: 7.25, knockout: 7.23, quote: 7.21, typo: 7.2,
  calendar: 7.18, partition: 7.18, ghost: 7.16, ring: 7.09, ma: 7.07, veil: 7.07, mosaic: 7.06, substitute: 7.05, hanzi: 6.99, centered: 6.91,
};
export const userPrior = (c: string) => (USER_SHRUNK[c] === undefined ? 1 : Math.min(1.8, Math.max(0.5, Math.exp(2.5 * (USER_SHRUNK[c] - 7.285)))));
const NEEDS_IMG = new Set(['fullbleed', 'ghost', 'veil', 'partition', 'mosaic', 'checker', 'bento', 'inset', 'layered', 'object', 'split', 'cards', 'panorama', 'substitute', 'window', 'ma', 'modular', 'bleedgrid']);
/** phase 16: compositions that lay out several pictures (every other composition shows only the first) */
export const MULTI_IMG = new Set(['modular', 'bleedgrid']);
/** long formats: the layouts that can fill a long canvas (phase 6: echo, mosaic and object rated 5–6 on 16:9/21:9 and were dropped there) */
/** very tall formats (taller than 1.9:1, i.e. 1:2.1): the layouts built on an open field rated 4.5–5.5 there */
export const XTALL = 1.9;
const TALL_OFF = new Set(['ma', 'swiss', 'substitute', 'exhibit', 'object', 'inset', 'centered', 'checker']);
const WIDE_OK = new Set(['knockout', 'cover', 'panorama', 'edge', 'quote', 'veil', 'bands', 'split', 'fullbleed', 'ring', 'ma', 'substitute', 'anomaly', 'calendar', 'window', 'hanzi', 'modular', 'bleedgrid']);

export function v2Weights(o: { plan: DrawPlan; images: ImageAsset[]; imagesOn: boolean; modes: Set<ModeKey>; W: number; H: number; zh: boolean; styleComp?: Record<string, number>; recent?: string[]; exclude?: string[] }): Record<string, number> {
  const { W, H } = o;
  const hasImg = o.images.length > 0 && o.imagesOn && !o.plan.typeOnly;
  const hasCut = hasImg && o.images.some((a) => a.cutout && a.subject);
  const wide = W / H > 1.5, xwide = W / H > 2, land = W > H * 1.15, xtall = H / W > XTALL;
  // phase 16: several pictures given (the user's own, a locked set, a picked set): the compositions that show them all lead
  const multi = hasImg && o.images.length >= 2;
  const w: Record<string, number> = {};
  for (const [c, v] of Object.entries(WITHIN)) {
    let x = v * (1 + 0.35 * (o.styleComp?.[c] ?? 0));
    if (!hasImg && NEEDS_IMG.has(c)) x = 0;
    if (c === 'object' && (!hasCut || land)) x = 0;
    if (c === 'cover') x *= hasCut ? 1.3 : hasImg ? 0.45 : 0.25;
    if (c === 'panorama' && !land) x = 0;
    if (wide && !WIDE_OK.has(c)) x = 0;
    if (xtall && TALL_OFF.has(c)) x = 0;
    if (xwide && (c === 'edge' || c === 'quote' || c === 'ring' || c === 'veil' || c === 'split')) x = 0;
    if (wide && (c === 'knockout' || c === 'panorama')) x *= 1.4;
    if (land && !wide) { if (c === 'vertical') x *= 0.3; if (c === 'bands') x = 0; if (c === 'edge') x *= 0.6; }
    if (c === 'echo' && o.zh) x *= 0.35;
    if (c === 'hanzi' && !o.zh) x = 0;
    if (multi) x *= MULTI_IMG.has(c) ? 4 : 0.3;
    if (o.exclude?.includes(c)) x = 0;
    w[c] = x;
  }
  // modes are tendencies
  const mul = (k: string, f: number) => { if (w[k]) w[k] *= f; };
  if (o.modes.has('card')) { mul('bento', 2); mul('index', 2); mul('cards', 2); }
  if (o.modes.has('clash')) { mul('knockout', 2); mul('echo', 1.6); }
  if (o.modes.has('random')) { mul('mosaic', 2); mul('checker', 2); }
  if (o.modes.has('experimental')) { mul('echo', 1.5); mul('ring', 1.5); mul('vertical', 1.5); }
  if (o.modes.has('layered')) { mul('cover', 3); mul('object', 3); }
  if (o.modes.has('bandMask')) { mul('bands', 2.5); mul('panorama', 2); }
  if (o.modes.has('brushMask') || o.modes.has('brushImage')) mul('veil', 2);
  // archetype normalisation: each available archetype gets its target share, split by the preferences inside it
  const sum: Partial<Record<Arch, number>> = {};
  for (const [c, v] of Object.entries(w)) { const a = archOf(c, hasCut); sum[a] = (sum[a] ?? 0) + v; }
  const recA = (o.recent ?? []).slice(-4).reverse().map((c) => archOf(c, hasCut));
  const recC = (o.recent ?? []).slice(-4);
  const out: Record<string, number> = {};
  for (const [c, v] of Object.entries(w)) {
    if (!v) { out[c] = 0; continue; }
    const a = archOf(c, hasCut);
    let x = (TARGET[a] * v) / (sum[a] || 1);
    const k = recA.indexOf(a);
    if (k >= 0) x *= k === 0 ? 0.12 : k === 1 ? 0.3 : 0.55;
    if (recC.includes(c)) x *= 0.6;
    out[c] = x * userPrior(c);
  }
  return out;
}
