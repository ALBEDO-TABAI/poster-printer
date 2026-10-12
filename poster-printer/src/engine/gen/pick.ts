import { Rng } from '../rng';
import type { TextSet, CustomText } from '../../data/texts';
import type { Lang } from '../typo';

export interface PT { t: string; lang: Lang }
export interface PickedTexts {
  set: string;
  headline: PT; sub: PT; note: PT;
  groups: { main: PT; sub: PT; note: PT }[];
  prose: PT[]; meta: PT[]; words: PT[]; glyph: string;
  /** optional real facts (set by headless/CLI callers with real content). When present they replace the synthetic issue
   *  numbers / years / calendar date some compositions invent; absent = unchanged behaviour (random streams are consumed either way) */
  facts?: TextFacts;
  /** phase 8: true when the copy is the user's real content (custom text / CLI brief); grammars then use exactly the
   *  items given and never pad with filler copy */
  custom?: boolean;
  /** with custom copy: how many groups / which group notes are real (the rest is filler kept for the older composers) */
  customItems?: number; customNotes?: boolean[]; customMeta?: number;
}
export interface TextFacts {
  year?: string; issue?: string; date?: { y: number; m: number; d: number };
  /** a short real numeral (day of the month, edition, price) for the compositions' anchor / disc / cell numerals */
  numeral?: string;
  /** index composition: real times per row (programme variant) and real values per row (spec variant); '' = blank */
  times?: string[]; values?: string[];
  /** script signature / script-lettering word from the real copy; '' = none (no invented "Paper Hours") */
  signature?: string;
  /** cover masthead word from the real copy (replaces the invented magazine names) */
  masthead?: string;
  /** round sticker lines from the real copy (e.g. ['LIVE', '12.05'] / ['免费', '']) replacing the invented NEW / FREE / VOL. n */
  sticker?: [string, string];
}

function pickLang(rng: Rng, bias: number): Lang { return rng.chance(bias) ? 'en' : 'zh'; }

export function pickTexts(rng: Rng, sets: TextSet[], englishBias: number, preferSet?: string, custom?: CustomText | null): PickedTexts {
  const pool = preferSet ? sets.filter((s) => s.id === preferSet) : sets;
  const set = rng.pick(pool.length ? pool : sets);
  const b = englishBias / 100;
  const from = (arr: { en: string[]; zh: string[] }, lang: Lang, used: Set<string>): PT => {
    const list = arr[lang].length ? arr[lang] : arr[lang === 'en' ? 'zh' : 'en'];
    const l2: Lang = arr[lang].length ? lang : lang === 'en' ? 'zh' : 'en';
    const cand = list.filter((x) => !used.has(x));
    const t = rng.pick(cand.length ? cand : list);
    used.add(t);
    return { t, lang: l2 };
  };
  // like from(), but returns an empty text once every candidate (in either language) is used
  const fromOpt = (arr: { en: string[]; zh: string[] }, lang: Lang, usedS: Set<string>): PT => {
    for (const lg of [lang, lang === 'en' ? 'zh' : 'en'] as Lang[]) {
      const c = arr[lg].filter((x) => !usedS.has(x));
      if (c.length) { const t = rng.pick(c); usedS.add(t); return { t, lang: lg }; }
    }
    return { t: '', lang };
  };
  const used = new Set<string>();
  const hl = pickLang(rng, b);
  const headline = from(set.headline, hl, used);
  // bilingual pairing: sub in the other language some of the time
  const subLang: Lang = rng.chance(0.45) ? (hl === 'en' ? 'zh' : 'en') : hl;
  const sub = from(set.sub, subLang, used);
  const note = from(set.note, pickLang(rng, Math.min(1, b + 0.15)), used);
  const groups = Array.from({ length: 6 }, () => {
    const lg = pickLang(rng, Math.min(1, b + 0.1));
    return { main: from(set.small, lg, used), sub: from(set.sub, pickLang(rng, Math.min(1, b + 0.2)), used), note: fromOpt(set.note, pickLang(rng, Math.min(1, b + 0.25)), used) };
  });
  const prose = Array.from({ length: 6 }, () => from(set.prose, pickLang(rng, b), used));
  // meta labels: unique; when the set runs out, synthesize plausible editorial labels
  const synth = (lang: Lang): string => {
    const k = rng.int(0, 7);
    const n2 = String(rng.int(1, 48)).padStart(2, '0');
    if (lang === 'zh') return [`第${n2}期`, `${rng.int(2024, 2027)}年${rng.int(1, 12)}月`, `${rng.int(1, 9)}号厅`, `编号 ${n2}`, `页 ${rng.int(2, 96)}`, `${rng.int(8, 21)}:${rng.pick(['00', '30'])} 开始`, `北纬 ${rng.int(20, 45)}°`, `卷${'一二三四五六'[rng.int(0, 5)]}`][k];
    return [`No. ${n2}`, `${rng.int(2024, 2027)}.${String(rng.int(1, 12)).padStart(2, '0')}`, `Ed. ${rng.int(1, 9)}`, `P. ${rng.int(2, 96)}`, `${rng.int(8, 21)}:${rng.pick(['00', '30'])}`, `${rng.int(20, 60)}.${rng.int(10, 99)}° N`, `Vol. ${rng.int(1, 12)}`, `Ref. ${rng.int(100, 999)}`][k];
  };
  const meta: PT[] = [];
  for (let i = 0; i < 10; i++) {
    const lg = pickLang(rng, Math.min(1, b + 0.3));
    const list = set.meta[lg].filter((x) => !used.has(x));
    if (list.length) { const t = rng.pick(list); used.add(t); meta.push({ t, lang: lg }); }
    else { let t = synth(lg); for (let k = 0; k < 4 && used.has(t); k++) t = synth(lg); used.add(t); meta.push({ t, lang: lg }); }
  }
  const words = Array.from({ length: 4 }, () => from(set.small, 'en', used));
  const glyph = rng.pick(set.glyph);
  const out: PickedTexts = { set: set.id, headline, sub, note, groups, prose, meta, words, glyph };
  if (custom) {
    const L = (t: string): PT => ({ t, lang: /[\u4e00-\u9fff]/.test(t) ? 'zh' : 'en' });
    if (custom.headline) out.headline = L(custom.headline);
    if (custom.sub) out.sub = L(custom.sub);
    custom.small?.forEach((s, i) => { if (s && out.groups[i]) out.groups[i].main = L(s); });
    custom.note?.forEach((s, i) => { if (s && out.groups[i]) out.groups[i].note = L(s); });
    out.custom = true;
    out.customItems = (custom.small ?? []).filter(Boolean).length;
    out.customMeta = (custom.meta ?? []).filter(Boolean).length;
    out.customNotes = Array.from({ length: 6 }, (_, i) => !!custom.note?.[i]);
    // real copy has no filler prose: without a prose line the quotable line is the sub-title
    const pr = custom.prose || custom.sub || '';
    if (pr) out.prose = out.prose.map(() => L(pr));
    custom.meta?.forEach((s, i) => { if (s) out.meta[i] = L(s); });
    out.facts = { ...factsFromCopy(custom), ...(out.facts ?? {}) };
  }
  return out;
}

/**
 * Phase 8: facts derived from the user's own copy, so compositions never invent issue numbers, years, dates,
 * numerals, mastheads or stickers for real content (CLI-provided facts take precedence).
 */
export function factsFromCopy(c: CustomText): TextFacts {
  const all = [c.headline, c.sub, ...(c.small ?? []), ...(c.note ?? []), ...(c.meta ?? []), c.prose].filter(Boolean).join(' \n ');
  const f: TextFacts = { signature: '' };
  const y = /\b(19[5-9]\d|20[0-4]\d)\b/.exec(all); if (y) f.year = y[1];
  const iss = /第\s*([一二三四五六七八九十\d]+)\s*[期届回]/.exec(all) ?? /\b(?:NO\.?|Vol\.?|#)\s*(\d{1,3})\b/i.exec(all);
  if (iss) f.issue = /^\d+$/.test(iss[1]) ? `NO. ${iss[1].padStart(2, '0')}` : `第${iss[1]}期`;
  const day = /(\d{1,2})\s*[日号]/.exec(all) ?? /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/.exec(all) ?? /\b\d{1,2}\.(\d{1,2})\b/.exec(all);
  const num = day?.[1] ?? /(?:^|[^\d:.])(\d{1,3})(?![\d:])/.exec(all)?.[1];
  if (num) f.numeral = num.padStart(2, '0');
  const hl = (c.headline ?? '').trim();
  const firstWord = hl.split(/\s+/)[0] ?? '';
  f.masthead = Array.from(hl).length <= 12 ? hl : firstWord;
  const st = (c.small ?? []).find((s) => s && Array.from(s).length <= 8) ?? '';
  f.sticker = /免费|free/i.test(all) ? [/免费/.test(all) ? '免费' : 'FREE', ''] : [st, ''];
  // programmes: notes that are times become the index's time column
  const notes = (c.note ?? []).filter(Boolean);
  if (notes.length >= 3 && notes.every((n) => /^\d{1,2}[:.]\d{2}/.test(n))) f.times = notes;
  return f;
}
