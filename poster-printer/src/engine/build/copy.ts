// Phase 18: the copy as slots. The course's first step is to sort the copy into its levels (先梳理文字层级); a
// construction is then chosen for the levels that exist, and the slots it needs are filled from here.
// Real copy (texts.custom) is sacred: nothing is invented — no years, issue numbers or English echoes it did not give.
import type { Ctx } from '../gen/ctx';
import type { PT } from '../gen/pick';
import type { Slot } from './types';

export interface Copy {
  title: PT;
  cn: string | null; // the Han side of the title (the title itself, or a short Han line when the title is Latin)
  en: string | null; // the Latin side (the title itself, or a Latin line that echoes a Han title)
  sub: PT | null;
  num: { v: string; unit: string } | null;
  date: string | null;
  year: string | null;
  items: { main: PT; note: PT | null }[];
  meta: PT[];
  para: PT | null;
  labels: PT[];
  /** an index / issue number (No.07, #5): real when given, synthetic copy only otherwise */
  index: string | null;
  /** the date in parts (null when there is no parseable date) */
  dp: DateParts | null;
  custom: boolean;
}
export interface DateParts { y?: string; m: string; d: string; m2?: string; d2?: string; wd?: string; wd2?: string; time?: string }

const WD_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
/** parse 2026.12.05 / 12.05 / 12月5日 / 10.16-10.22 / 2026-12-05 20:00 into parts; the weekday only when the year is known */
export function dateParts(s: string | null, times: string[] = []): DateParts | null {
  if (!s) return null;
  let m = s.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  let y: string | undefined, mo: string, d: string, m2: string | undefined, d2: string | undefined;
  if (m) { y = m[1]; mo = m[2]; d = m[3]; }
  else if ((m = s.match(/(\d{1,2})月(\d{1,2})日/))) { mo = m[1]; d = m[2]; }
  else if ((m = s.match(/(\d{1,2})[./](\d{1,2})(?:\s?[-–~]\s?(\d{1,2})[./](\d{1,2}))?/))) { mo = m[1]; d = m[2]; m2 = m[3]; d2 = m[4]; }
  else return null;
  const r = s.match(/[-–~]\s?(?:(\d{4})[./-])?(\d{1,2})[./-](\d{1,2})\s*$/);
  if (!m2 && r && r.index! > 4) { m2 = r[2]; d2 = r[3]; }
  const pad = (x: string) => x.padStart(2, '0');
  const wd = (yy?: string, mm?: string, dd?: string) => (yy && mm && dd ? WD_EN[new Date(Date.UTC(+yy, +mm - 1, +dd)).getUTCDay()] : undefined);
  const t = s.match(/\b(\d{1,2}:\d{2})\b/)?.[1] ?? times[0];
  return { y, m: pad(mo), d: pad(d), m2: m2 ? pad(m2) : undefined, d2: d2 ? pad(d2) : undefined, wd: wd(y, mo, d), wd2: m2 ? wd(y, m2, d2) : undefined, time: t };
}

const HAN = /[㐀-鿿]/;
const LATIN = /[A-Za-z]/;
const isHan = (s: string) => HAN.test(s) && (s.match(/[㐀-鿿]/g)?.length ?? 0) >= (s.match(/[A-Za-z]/g)?.length ?? 0) / 2;
const pt = (t: string): PT => ({ t, lang: isHan(t) ? 'zh' : 'en' });
const short = (p: PT) => (p.lang === 'zh' ? Array.from(p.t.replace(/\s/g, '')).length <= 5 : p.t.length <= 16 && p.t.split(/\s+/).length <= 2);

/** a number worth setting large: a date, a time, a price, an edition */
const NUM_RE = /(¥|￥|\$|€)?\s?(\d{1,4}(?:[./:-]\d{1,2}){0,2})(\s?(?:%|折|元|st|nd|rd|th|日|号|期|F|℃|分|秒|h|min|km|cm|mm|kg|g|ml))?/;
function numOf(texts: PT[]): { v: string; unit: string } | null {
  for (const p of texts) {
    const m = p.t.match(NUM_RE);
    if (!m || m[2].length < 2) continue;
    const cur = m[1] ?? '';
    const unit = (m[3] ?? '').trim();
    return { v: m[2], unit: cur ? cur : unit };
  }
  return null;
}
const DATE_RE = /(\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./]\d{1,2}(?:\s?[-–~]\s?\d{1,2}[./]\d{1,2})?|\d{1,2}月\d{1,2}日)/;

export function copyOf(ctx: Ctx): Copy {
  const T = ctx.texts;
  // real copy: the app's custom copy, or copy that arrives with facts (the CLI's briefs)
  const custom = !!T.custom || !!T.facts;
  const hl = T.headline;
  const groups = custom && T.customItems !== undefined ? T.groups.slice(0, T.customItems) : T.groups;
  const items = groups.filter((g) => g.main.t).map((g, i) => ({ main: g.main, note: g.note.t && !(custom && T.customNotes && !T.customNotes[i]) ? g.note : null }));
  const meta = (custom && T.customMeta !== undefined ? T.meta.slice(0, T.customMeta) : T.meta).filter((m) => m.t);
  const sub = T.sub.t ? T.sub : null;
  // the bilingual pair: a Han title with a Latin line (or the reverse) given in the copy
  // real copy: only what the user gave (the sample word pool is filler)
  const pool = [sub, ...(custom ? [] : T.words), ...(custom ? [] : groups.map((g) => g.main))].filter((p): p is PT => !!p && !!p.t);
  let cn: string | null = null, en: string | null = null;
  if (hl.lang === 'zh') {
    cn = hl.t;
    const e = pool.find((p) => p.lang === 'en' && LATIN.test(p.t) && p.t.length <= 28);
    en = e ? e.t : null;
  } else {
    en = hl.t;
    const c = pool.find((p) => p.lang === 'zh' && Array.from(p.t).length <= 8);
    cn = c ? c.t : null;
  }
  // the bilingual line is the subtitle itself: one slot, never both
  const sub2 = sub && (sub.t === en || sub.t === cn) ? null : sub;
  const all = [hl, ...(sub ? [sub] : []), ...meta, ...items.map((i) => i.main), ...items.flatMap((i) => (i.note ? [i.note] : []))];
  const f = T.facts;
  const date = (f?.date ? `${f.date.y}.${String(f.date.m).padStart(2, '0')}.${String(f.date.d).padStart(2, '0')}` : null) ?? all.map((p) => p.t.match(DATE_RE)?.[1]).find(Boolean) ?? null;
  const year = f?.year || date?.match(/\b(19|20)\d{2}\b/)?.[0] || (custom ? null : String(2024 + ctx.rd.int(1, 3)));
  const num = f?.numeral ? { v: f.numeral, unit: '' } : numOf([...meta, ...items.map((i) => i.main), ...(sub ? [sub] : [])]);
  const para = T.prose[0]?.t ? T.prose[0] : T.note.t && T.note.t.length > 12 ? T.note : null;
  const labels = [...(custom ? [] : T.words), ...meta, ...items.map((i) => i.main)].filter((p) => p.t && short(p));
  const index = f?.issue ?? (custom ? null : `No.${String(ctx.rd.int(1, 48)).padStart(2, '0')}`);
  const times = items.map((i) => i.main.t.match(/\b\d{1,2}:\d{2}\b/)?.[0]).filter((x): x is string => !!x);
  return { title: hl, cn, en, sub: sub2, num, date, year, items, meta, para, labels, index, dp: dateParts(date, times), custom };
}

/** the words for a slot (null = the slot is empty) */
export function slotText(c: Copy, slot: Slot, idx = 0, lit?: string): PT | null {
  switch (slot) {
    case 'title': return c.title;
    case 'title.cn': return c.cn ? pt(c.cn) : null;
    case 'title.en': return c.en ? { t: c.en, lang: 'en' } : null;
    case 'sub': return c.sub;
    case 'num': return c.num ? { t: c.num.v, lang: 'en' } : null;
    case 'num.unit': return c.num?.unit ? pt(c.num.unit) : null;
    case 'date': return c.date ? { t: c.date, lang: 'en' } : null;
    case 'year': return c.year ? { t: c.year, lang: 'en' } : null;
    case 'item': return c.items[idx]?.main ?? null;
    case 'item.note': return c.items[idx]?.note ?? null;
    case 'meta': return c.meta[idx] ?? null;
    case 'para': return c.para;
    case 'label': return c.labels[idx] ?? null;
    case 'lit': return lit ? pt(lit) : null;
  }
}

/** the hierarchy signature the course starts from: how many levels of copy exist, which scripts, numbers */
export function levelsOf(c: Copy) {
  return {
    bilingual: !!(c.cn && c.en),
    hasNum: !!c.num || !!c.date,
    items: c.items.length,
    meta: c.meta.length,
    hasSub: !!c.sub,
    hasPara: !!c.para,
    titleLen: c.title.lang === 'zh' ? Array.from(c.title.t.replace(/\s/g, '')).length : c.title.t.split(/\s+/).length,
  };
}
