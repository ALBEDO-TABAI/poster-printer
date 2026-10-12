// Phase 8 exemplar bank: our own top-rated posters (rated ≥ 8 by eye in phases 6–7, see docs/RATING_RUBRIC.md anchors
// a13–a20 and docs/PHASE7_STATS.md labels O7 018/019/025/043/046) abstracted into structural recipes. A recipe names
// roles and relations, what variation keeps it working and what content breaks it; it is retrieved by design-problem
// similarity, not by style. Nothing external is imported or copied; the source posters are our own generator output.
import type { DesignProblem } from '../engine/p8/semantic';

export interface Recipe {
  id: string;
  /** the poster(s) it was abstracted from */
  from: string[];
  /** composition / strategy that realises it (P7 composition or P8 strategy) */
  route: string;
  roles: string;
  relations: string[];
  /** variation that keeps it working */
  keeps: string[];
  /** content that breaks it (retrieval avoids these) */
  breaks: string[];
  /** the design problem it answers: preferred ranges */
  fit: { title: [number, number]; info: [number, number]; zh?: boolean; image?: boolean; subject?: DesignProblem['subject'][]; emphasis?: DesignProblem['emphasis'][] };
}

export const RECIPES: Recipe[] = [
  { id: 'hanzi-crop', from: ['a17 像', 'a19 尘', 'O7-019'], route: 'hanzi', roles: 'one glyph = headline + image; title column = explanation; seal = ornament',
    relations: ['glyph ≥ 0.6 short side, cropped by one edge', 'title column aligned to the glyph\'s uncut edge', 'seal ≤ 5% near the column end'],
    keeps: ['any single strong-meaning character', 'light-on-dark or dark-on-light, one contrast only'], breaks: ['Latin-only titles', 'more than 4 info lines', 'a photo that must be seen'],
    fit: { title: [1, 6], info: [0, 3], zh: true, emphasis: ['title'] } },
  { id: 'substitute-glyph', from: ['a20 一盏茶', 'a18 ECHOES'], route: 'substitute', roles: 'headline with one glyph replaced by the image; quiet copy block',
    relations: ['the image takes the glyph\'s exact cell and baseline', 'copy block hangs from the headline\'s left edge'],
    keeps: ['round or compact subjects (cup, disc, O)', 'pale or near-black field'], breaks: ['wide scene photos', 'titles > 12 characters', 'long programmes'],
    fit: { title: [2, 12], info: [0, 4], image: true, subject: ['round', 'tall'], emphasis: ['title', 'image'] } },
  { id: 'type-photo-interlock', from: ['a13 CONCRETE BLOOM'], route: 'interleave', roles: 'headline interleaved with the cut-out subject; info in the calm band',
    relations: ['headline crosses the subject\'s upper body', 'subject in front of 12–75% of the word', 'info aligned to the photo edge'],
    keeps: ['any cut-out subject', '1–3 word headlines'], breaks: ['no cut-out', 'headlines over ~16 characters', 'dense lineups'],
    fit: { title: [2, 16], info: [0, 4], image: true, subject: ['tall', 'round'], emphasis: ['image', 'title'] } },
  { id: 'occlusion-cover', from: ['O7-018'], route: 'cover', roles: 'masthead-scale headline behind the subject; cover lines as info',
    relations: ['subject overlaps the masthead from below', 'cover lines stacked on one side'], keeps: ['portrait-like or object subject'], breaks: ['wide landscapes', 'no cut-out'],
    fit: { title: [2, 14], info: [1, 5], image: true, subject: ['tall'], emphasis: ['image'] } },
  { id: 'vertical-calm', from: ['a14 城市漫游'], route: 'vertical', roles: 'vertical CJK headline column; small photo as evidence; tiny info',
    relations: ['column on a canon line', 'photo top-aligned to the column', 'info under the photo, same left edge'],
    keeps: ['pale fields', '2–6 character titles'], breaks: ['Latin titles', 'long lineups'],
    fit: { title: [2, 8], info: [1, 4], zh: true, emphasis: ['title'] } },
  { id: 'band-scale', from: ['a15 ROOM TONE'], route: 'typeled', roles: 'headline at full measure; photo band in the negative space; info hangs from the headline edge',
    relations: ['headline width = content width', 'band proportion follows the subject', 'everything left-aligned to one edge'],
    keeps: ['any 1–4 word title', 'any picture with a calm band'], breaks: ['titles over ~5 words (switch to programme)'],
    fit: { title: [2, 22], info: [0, 6], emphasis: ['title'] } },
  { id: 'framed-structure', from: ['a16 纸上建筑'], route: 'exhibit', roles: 'framed picture on a canon block; caption title; info columns aligned to the frame',
    relations: ['frame on the canon block (30–50% area)', 'title anchored below / right of the frame', 'info columns share the frame edge'],
    keeps: ['dark or pale field', 'photographs, artworks'], breaks: ['no picture', 'six-act lineups'],
    fit: { title: [2, 24], info: [1, 5], image: true, subject: ['scene', 'wide', 'tall'], emphasis: ['image'] } },
  { id: 'knockout-tension', from: ['O7-025', 'O7-043', 'O7-046'], route: 'knockout', roles: 'one colour block carries the headline as a knockout; photo field opposite; small counterweight',
    relations: ['headline pressed against a frame edge', 'counterweight in the opposite quadrant'], keeps: ['complementary or no-contrast palettes'], breaks: ['very long titles'],
    fit: { title: [2, 14], info: [0, 4], emphasis: ['title', 'image'] } },
  { id: 'programme-sheet', from: ['a15 ROOM TONE (structure)', 'a16 纸上建筑 (info columns)'], route: 'programme', roles: 'headline scaled by row count; the list is the evidence; meta row',
    relations: ['time column aligned', 'list overflows into columns, never shrinks below the info level', 'headline and list share a left edge'],
    keeps: ['4–8 acts', 'bilingual names'], breaks: ['fewer than 3 items'],
    fit: { title: [2, 30], info: [4, 10], emphasis: ['info'] } },
];

/** design problem of a draw's content */
export function problemOf(t: { headline: { t: string; lang: string }; groups: { main: { t: string } }[]; custom?: boolean; customItems?: number }, img: { subject?: { w: number; h: number } | null; cutout?: string | null } | null, iw = 1, ih = 1): DesignProblem {
  const hl = t.headline.t;
  const zh = /[\u3400-\u9fff]/.test(hl);
  const items = t.custom && t.customItems !== undefined ? t.groups.slice(0, t.customItems) : t.groups.slice(0, 3);
  const sj = img?.subject;
  const subject: DesignProblem['subject'] = !img ? 'none' : !sj ? 'scene' : sj.h * ih > sj.w * iw * 1.4 ? 'tall' : sj.w * iw > sj.h * ih * 1.4 ? 'wide' : 'round';
  const infoItems = items.filter((g) => g.main.t).length;
  return {
    titleLen: Array.from(hl.replace(/\s/g, '')).length, titleWords: hl.split(/\s+/).filter(Boolean).length, zh, bilingual: zh && /[A-Za-z]{2}/.test(hl),
    infoItems, infoChars: items.reduce((s, g) => s + g.main.t.length, 0), hasImage: !!img, subject,
    emphasis: infoItems >= 4 ? 'info' : img && img.cutout ? 'image' : 'title',
  };
}

/** recipes ranked by fit to a design problem (higher = better) */
export function retrieve(p: DesignProblem, n = 3): { recipe: Recipe; fit: number }[] {
  const inR = (v: number, [a, b]: [number, number]) => (v >= a && v <= b ? 1 : -Math.min(Math.abs(v - a), Math.abs(v - b)) / Math.max(2, b - a));
  return RECIPES.map((r) => {
    let f = inR(p.titleLen, r.fit.title) + inR(p.infoItems, r.fit.info);
    if (r.fit.zh !== undefined) f += r.fit.zh === p.zh ? 0.5 : -3;
    if (r.fit.image) f += p.hasImage ? 0.5 : -3;
    if (r.fit.subject) f += r.fit.subject.includes(p.subject) ? 0.6 : -0.6;
    if (r.fit.emphasis) f += r.fit.emphasis.includes(p.emphasis) ? 0.8 : -0.2;
    return { recipe: r, fit: f };
  }).sort((a, b) => b.fit - a.fit).slice(0, n);
}
