export type Group = 'big' | 'small';
export type Role = 'main' | 'sub' | 'note';
export type RoleKey = `${Group}.${Role}`;
export const ROLE_KEYS: RoleKey[] = ['big.main', 'big.sub', 'big.note', 'small.main', 'small.sub', 'small.note'];
export type Lang = 'zh' | 'en';

export interface RoleFont { family: string; weight: number; size: number; tracking: number; leading: number; italic?: boolean; case?: 'upper' | 'title' | 'none' | 'lower' }
export interface FontSet { en: Record<RoleKey, RoleFont>; zh: Record<RoleKey, RoleFont>; glyph: { family: string; weight: number }; glyphZh: { family: string; weight: number } }

type Spec = [family: string, weight: number, extra?: Partial<RoleFont>];
export interface FontRecipe { display: Spec; text: Spec; caption: Spec; zhDisplay: Spec; zhText: Spec; glyph?: Spec; zhGlyph?: Spec; sub?: Spec }

const rf = (s: Spec, d: Partial<RoleFont>): RoleFont => ({ family: s[0], weight: s[1], size: 100, tracking: 0, leading: 1.1, case: 'none', ...d, ...(s[2] || {}) });

/** Expand a compact 3-font recipe into the full role table. */
export function expandRecipe(r: FontRecipe): FontSet {
  const sub = r.sub ?? r.text;
  const en: Record<RoleKey, RoleFont> = {
    'big.main': rf(r.display, { leading: 0.95, tracking: -0.01 }),
    'big.sub': rf(sub, { leading: 1.2 }),
    'big.note': rf(r.caption, { leading: 1.35, tracking: 0.01 }),
    'small.main': rf(r.display, { leading: 1.0 }),
    'small.sub': rf(sub, { leading: 1.25 }),
    'small.note': rf(r.caption, { leading: 1.35, tracking: 0.01 }),
  };
  const zhSub: Spec = [r.zhText[0], r.zhText[1]];
  const zh: Record<RoleKey, RoleFont> = {
    'big.main': rf(r.zhDisplay, { leading: 1.08, tracking: 0.02 }),
    'big.sub': rf(zhSub, { leading: 1.4, tracking: 0.04 }),
    'big.note': rf(zhSub, { leading: 1.6, tracking: 0.06, weight: Math.min(r.zhText[1], 400) }),
    'small.main': rf(r.zhDisplay, { leading: 1.15, tracking: 0.02 }),
    'small.sub': rf(zhSub, { leading: 1.45, tracking: 0.04 }),
    'small.note': rf(zhSub, { leading: 1.6, tracking: 0.06, weight: Math.min(r.zhText[1], 400) }),
  };
  const g = r.glyph ?? r.display;
  const zg = r.zhGlyph ?? r.zhDisplay;
  return { en, zh, glyph: { family: g[0], weight: g[1] }, glyphZh: { family: zg[0], weight: zg[1] } };
}

export function applyCase(t: string, c?: RoleFont['case']) {
  if (!c || c === 'none') return t;
  if (c === 'upper') return t.toUpperCase();
  if (c === 'lower') return t.toLowerCase();
  return t.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/**
 * Optical tracking by size (em units, added to the role's own tracking).
 * Large display type is tightened (its default spacing is drawn for text sizes and looks loose when big),
 * small labels are opened up, and all-caps small text gets the classic generous letterspacing.
 * `rel` is the size in canvas units (u = min(W,H)/100).
 */
export function opticalTracking(rel: number, lang: Lang, upper: boolean): number {
  if (lang === 'zh') {
    // phase 7 (SPEC §15.2, verified on our fonts in Chrome: Noto Sans SC 900 keeps 0.074 em of ink gap at tracking 0,
    // the same as Inter 800): Han type is never tracked negative. With the zh roles' own +0.02 em this gives the
    // measured ladder +0.01 em at display sizes (≥ 9 u ≈ 108 px), +0.02 em at 5–9 u, more for captions.
    if (rel >= 9) return -0.01;
    if (rel >= 5) return 0;
    if (rel <= 1.4) return 0.02;
    return 0;
  }
  let t: number;
  if (rel >= 14) t = -0.03;
  else if (rel >= 7) t = -0.012 - ((rel - 7) / 7) * 0.018;
  else if (rel >= 3.5) t = -0.006;
  else if (rel >= 1.6) t = 0;
  else t = 0.012;
  if (upper) t += rel >= 7 ? 0.012 : rel >= 3 ? 0.03 : 0.07;
  return t;
}

/** Modular type scale: levels base·r^k. */
export function typeScale(base: number, ratio: number, kmin = -1, kmax = 14): number[] {
  const out: number[] = [];
  for (let k = kmin; k <= kmax; k++) out.push(base * ratio ** k);
  return out;
}
/** Snap a size to the scale: nearest level, but never grow more than `maxGrow` (text boxes are already laid out). */
export function snapToScale(size: number, levels: number[], maxGrow = 1.06): number {
  let best = size, bd = Infinity;
  for (const l of levels) {
    if (l > size * maxGrow) continue;
    const d = Math.abs(Math.log(l / size));
    if (d < bd) { bd = d; best = l; }
  }
  return best;
}
