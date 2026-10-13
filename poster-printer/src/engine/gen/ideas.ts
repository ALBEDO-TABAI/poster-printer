// Phase 7 — the IDEA layer. Each draw first commits to one idea: a rhetorical operation with explicit tension rules
// (what is the hero, how big, which single rule is broken on purpose, which Itten contrast carries the colour, which
// frame gives the anchor points). Compositions are the realisers of an idea. Ideas are original rule systems drawn
// from design rhetoric (scale shift, substitution, occlusion, repetition-with-difference, concealment/reveal, …),
// never copies of specific posters.
import type { Rng } from '../rng';
import type { Itten } from '../color/itten';

export type IdeaId = 'scale' | 'substitution' | 'occlusion' | 'anomaly' | 'reveal' | 'tension' | 'emptiness' | 'data' | 'hanzi' | 'split' | 'orbit' | 'voice' | 'specimen' | 'immersion' | 'grid';
export type Brk = 'bleed' | 'intrusion' | 'overlap' | 'anomaly' | 'window' | 'offgrid' | 'crop' | 'seam' | 'rotate' | 'hang' | 'none';
export type Frame = 'grid' | 'canon' | 'eyes';

export interface Idea {
  id: IdeaId; zh: string; en: string;
  /** the rule, in one sentence */
  rule: string;
  /** compositions that realise it, with preference */
  realisers: Record<string, number>;
  /** dominant contrast options */
  contrasts: Partial<Record<Itten, number>>;
  frame: Frame;
  /** the single licensed violation */
  brk: Brk;
  weight: number;
  needs?: { img?: boolean; cut?: boolean; zh?: boolean };
  /** multiplier on long formats (16:9 / 21:9); 0 = not offered there */
  wide: number;
}

export interface IdeaPick { id: IdeaId; contrast: Itten | 'none'; frame: Frame; brk: Brk }

export const IDEAS: Idea[] = [
  { id: 'scale', zh: '尺度冲击', en: 'Scale shock', rule: 'the hero takes ≥45% of the area or is cut by two edges; everything else is small (≥10× size gap)', realisers: { edge: 1.2, giant: 0.5, typo: 0.8, typeled: 1 }, contrasts: { lightdark: 3, saturation: 2, complement: 1, hue: 1 }, frame: 'grid', brk: 'bleed', weight: 0.85, wide: 0.6 },
  { id: 'substitution', zh: '替换', en: 'Substitution', rule: 'one glyph of the headline is replaced by the picture', realisers: { substitute: 1 }, contrasts: { saturation: 2, extension: 2, lightdark: 2, coldwarm: 1 }, frame: 'grid', brk: 'intrusion', weight: 0.9, needs: { img: true }, wide: 1.2 },
  { id: 'occlusion', zh: '遮挡', en: 'Occlusion', rule: 'the cut-out subject stands in front of a giant word and hides 15–50% of it; the word stays readable', realisers: { object: 1.6, cover: 1, interleave: 1.2 }, contrasts: { saturation: 2, coldwarm: 2, hue: 1, lightdark: 1 }, frame: 'grid', brk: 'overlap', weight: 2.2, needs: { img: true, cut: true }, wide: 0.8 },
  { id: 'anomaly', zh: '重复与例外', en: 'Repetition + anomaly', rule: '≥6 identical units on a strict rhythm; exactly one differs', realisers: { anomaly: 1.3, echo: 0.7 }, contrasts: { extension: 3, complement: 1, simultaneous: 1, hue: 1 }, frame: 'grid', brk: 'anomaly', weight: 0.7, wide: 1 },
  { id: 'reveal', zh: '揭示', en: 'Reveal', rule: 'the field is a washed version of the picture; one crisp window shows the truth', realisers: { window: 1.3, ghost: 0.5 }, contrasts: { saturation: 2, lightdark: 2, coldwarm: 1 }, frame: 'eyes', brk: 'window', weight: 0.8, needs: { img: true }, wide: 0.4 },
  { id: 'tension', zh: '边缘张力', en: 'Tension edge', rule: 'the hero presses against or crosses a frame edge; a tiny counterweight sits in the opposite quadrant', realisers: { knockout: 0.6, vertical: 1.1, edge: 0.6, split: 0.3 }, contrasts: { lightdark: 2, complement: 2, hue: 1, saturation: 1 }, frame: 'eyes', brk: 'bleed', weight: 0.65, wide: 1.2 },
  { id: 'emptiness', zh: '留白', en: 'Emptiness (ma)', rule: '≥75% quiet; the hero is small (≤12%) and sits exactly on a dynamic-symmetry eye; captions are tiny and tracked', realisers: { ma: 0.7, inset: 1.0, exhibit: 0.8 }, contrasts: { extension: 3, lightdark: 2, saturation: 1 }, frame: 'eyes', brk: 'offgrid', weight: 0.5, wide: 1 },
  { id: 'data', zh: '数据成形', en: 'Data as form', rule: 'a content variable drives the geometry: the date picks the cell, the cell places the headline', realisers: { calendar: 1.2, index: 0.7, programme: 1, swiss: 1.0 /* phase 15: swiss had no idea that realised it (0 auto draws); 白 rates it 7.86 */ }, contrasts: { lightdark: 2, extension: 2, saturation: 1 }, frame: 'grid', brk: 'overlap', weight: 0.7, wide: 1.1 },
  { id: 'hanzi', zh: '汉字即图', en: 'Hanzi as image', rule: 'one character at ≥60% of the short side, cropped by the frame; a seal accent ≤5%', realisers: { hanzi: 1.3, vertical: 0.5 }, contrasts: { extension: 3, lightdark: 2, saturation: 1 }, frame: 'eyes', brk: 'crop', weight: 1.0 /* phase 15: 1.5 → 1.0, 白 rates hanzi lowest of the type-led family (6.71, n=7) */, needs: { zh: true }, wide: 0.8 },
  { id: 'split', zh: '对立分割', en: 'Split meaning', rule: 'two fields with opposite treatments (photo / type, hot / cold, dense / empty) meet at one seam', realisers: { knockout: 0.6, panorama: 1.2, split: 0.5, veil: 0.7, partition: 0.3 }, contrasts: { complement: 2, coldwarm: 2, hue: 2, lightdark: 1 }, frame: 'grid', brk: 'seam', weight: 0.85, wide: 1.5 },
  { id: 'orbit', zh: '环绕', en: 'Orbit', rule: 'the copy circles one disc; the disc is the only full-colour thing', realisers: { ring: 1, fan: 0.25 }, contrasts: { saturation: 2, hue: 1, coldwarm: 1, complement: 1 }, frame: 'grid', brk: 'rotate', weight: 0.9, wide: 0.5 },
  { id: 'voice', zh: '声音', en: 'Voice', rule: 'a sentence is the hero, set large with a hanging quote; the picture is evidence', realisers: { quote: 1, centered: 0.25 }, contrasts: { saturation: 2, lightdark: 1, extension: 1, coldwarm: 1 }, frame: 'canon', brk: 'hang', weight: 0.75, wide: 0.3 },
  { id: 'specimen', zh: '标本', en: 'Specimen', rule: 'the picture is cut into modules and filed like a specimen sheet; one module holds the number', realisers: { bento: 1, mosaic: 1, cards: 0.35, checker: 0.3, modular: 0.6, bleedgrid: 0.8 }, contrasts: { saturation: 1, lightdark: 1, extension: 1, hue: 1 }, frame: 'grid', brk: 'none', weight: 1.0, needs: { img: true }, wide: 0.4 },
  // phase 16: the Swiss modular grid as an idea of its own: order is the message, pictures keep their proportions
  { id: 'grid', zh: '网格秩序', en: 'Grid order', rule: 'every element sits on fields of one modular grid; pictures span whole fields at their own proportion; one hero, the rest a clear step smaller; white fields are part of the order', realisers: { modular: 1.3, bleedgrid: 1.0, swiss: 0.3 }, contrasts: { lightdark: 2, extension: 2, saturation: 1, hue: 1 }, frame: 'grid', brk: 'bleed', weight: 1.0, needs: { img: true }, wide: 1.2 },
  { id: 'immersion', zh: '沉浸', en: 'Immersion', rule: 'the picture is the world; the type is a caption laid on its quietest region', realisers: { fullbleed: 2, veil: 0.6, bands: 0.3, cover: 0.4, bleedgrid: 0.7 }, contrasts: { saturation: 1, coldwarm: 1, lightdark: 1 }, frame: 'grid', brk: 'none', weight: 1.3, needs: { img: true }, wide: 1 },
];
export const IDEA_IDS = IDEAS.map((i) => i.id);
export const ideaById = (id: string) => IDEAS.find((i) => i.id === id);

/**
 * Entropy-aware idea sampler: base weight × feasibility (Σ of the realisers' sampler weights) × recency.
 * `compW` are the composition weights the archetype sampler would use for this draw.
 */
export function sampleIdea(rng: Rng, compW: Record<string, number>, o: { hasImg: boolean; hasCut: boolean; zh: boolean; wide: boolean; recent?: string[]; exclude?: string[]; force?: string }): { idea: Idea; w: Record<string, number> } | null {
  const feas = (I: Idea) => {
    if (I.needs?.img && !o.hasImg) return 0;
    if (I.needs?.cut && !o.hasCut) return 0;
    if (I.needs?.zh && !o.zh) return 0;
    let s = 0;
    for (const [c, r] of Object.entries(I.realisers)) s += (compW[c] ?? 0) * r;
    return s;
  };
  const rec = (o.recent ?? []).slice(-4).reverse();
  const cands: [Idea, number][] = [];
  for (const I of IDEAS) {
    if (o.exclude?.includes(I.id)) continue;
    const f = feas(I);
    if (f <= 0) continue;
    let w = I.weight * Math.sqrt(f) * (o.wide ? I.wide : 1);
    const k = rec.indexOf(I.id);
    if (k >= 0) w *= k === 0 ? 0.1 : k === 1 ? 0.35 : 0.65;
    if (w > 0) cands.push([I, w]);
  }
  // a forced idea (replay, manual composition, the idea param) bypasses exclusion and feasibility
  let idea = o.force ? IDEAS.find((I) => I.id === o.force) : undefined;
  if (!idea && !cands.length) return null;
  if (!idea) { const id = rng.weighted<IdeaId>(cands.map(([I, w]) => [I.id, w] as [IdeaId, number])); idea = cands.find(([I]) => I.id === id)![0]; }
  const w: Record<string, number> = {};
  for (const [c, r] of Object.entries(idea.realisers)) if ((compW[c] ?? 0) > 0) w[c] = compW[c] * r;
  return { idea, w };
}
