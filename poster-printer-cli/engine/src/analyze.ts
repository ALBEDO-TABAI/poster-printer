// Content analyzer: turns the brief's real copy into structure the resolver can design with —
// information hierarchy, lists / timetables, numerals and dates usable as graphics, CJK / Latin mix and copy load.
import type { Brief, ProgramItem, Person } from './brief';

export type Lang = 'zh' | 'en';
export type Tier = 'hero' | 'secondary' | 'tertiary';
export interface Field { key: string; text: string; lang: Lang | 'mix'; chars: number; em: number; importance: number; tier: Tier; why: string }
export interface DateFact { y: number; m: number; d: number; hh?: number; mm?: number; weekday: number; iso: string; text: { zh: string; en: string; short: string } }
export interface Numeral { text: string; kind: 'day' | 'year' | 'time' | 'price' | 'percent' | 'edition' | 'count'; graphic: boolean; why: string }
export interface ListItem { time: string; title: string; who: string; note: string }
export interface Analysis {
  purpose: string;
  lang: { overall: 'zh' | 'en' | 'bilingual'; title: Lang | 'mix'; cjkShare: number; why: string };
  fields: Field[];
  hero: string;
  list: { kind: 'timetable' | 'lineup' | 'speakers' | 'none'; items: ListItem[]; timed: boolean; why: string };
  date: DateFact | null;
  dateEnd: DateFact | null;
  numerals: Numeral[];
  title: { text: string; han: number; latin: number; words: number; em: number; shape: 'glyph' | 'short' | 'medium' | 'long'; cjkShort: boolean };
  quote: { text: string; lang: Lang } | null;
  copy: { chars: number; load: 'light' | 'medium' | 'heavy'; fieldCount: number };
}

const HAN = /[\u3400-\u9fff\uf900-\ufaff]/g;
const LAT = /[A-Za-z0-9]/g;
export const hanCount = (s: string) => (s.match(HAN) || []).length;
export const latCount = (s: string) => (s.match(LAT) || []).length;
export function langOf(s: string): Lang | 'mix' {
  const h = hanCount(s), l = latCount(s);
  if (!h) return 'en';
  if (!l || h >= l * 0.6) return h >= l ? 'zh' : 'mix';
  return 'mix';
}
/** the language a text slot renders in (the engine knows zh / en only) */
export const slotLang = (s: string): Lang => (hanCount(s) > 0 ? 'zh' : 'en');
/** visual width in em: a hanzi is ~1em, a Latin glyph ~0.55em, a space ~0.3em */
export const emWidth = (s: string) => hanCount(s) + latCount(s) * 0.55 + (s.match(/\s/g) || []).length * 0.3 + (s.match(/[^\sA-Za-z0-9\u3400-\u9fff]/g) || []).length * 0.5;

const WD_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const WD_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MON_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const pad = (n: number) => String(n).padStart(2, '0');

export function parseDate(s?: string, fallbackYear?: number): DateFact | null {
  if (!s) return null;
  const t = s.trim();
  let y: number | undefined, m: number | undefined, d: number | undefined, hh: number | undefined, mm: number | undefined;
  let r = t.match(/(\d{4})[-./年](\d{1,2})[-./月](\d{1,2})日?(?:[T\s]+(\d{1,2})[:：.](\d{2}))?/);
  if (r) { y = +r[1]; m = +r[2]; d = +r[3]; if (r[4]) { hh = +r[4]; mm = +r[5]; } }
  else if ((r = t.match(/(\d{1,2})[./月](\d{1,2})日?(?:\D+(\d{1,2})[:：](\d{2}))?/))) { m = +r[1]; d = +r[2]; y = fallbackYear ?? new Date().getFullYear(); if (r[3]) { hh = +r[3]; mm = +r[4]; } }
  else {
    const mi = MON_EN.findIndex((x) => new RegExp('\\b' + x, 'i').test(t));
    const dn = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/); const yn = t.match(/\b(\d{4})\b/);
    if (mi >= 0 && dn) { m = mi + 1; d = +dn[1]; y = yn ? +yn[1] : fallbackYear ?? new Date().getFullYear(); }
  }
  if (!y || !m || !d || m > 12 || d > 31) return null;
  const tm = t.match(/(?:^|\D)(\d{1,2})[:：](\d{2})(?!\d)/);
  if (hh === undefined && tm) { hh = +tm[1]; mm = +tm[2]; }
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const time = hh !== undefined ? ` ${pad(hh)}:${pad(mm ?? 0)}` : '';
  return {
    y, m, d, hh, mm, weekday: wd, iso: `${y}-${pad(m)}-${pad(d)}${hh !== undefined ? `T${pad(hh)}:${pad(mm ?? 0)}` : ''}`,
    text: { zh: `${y}年${m}月${d}日 ${WD_ZH[wd]}${time}`, en: `${WD_EN[wd]} ${pad(d)} ${MON_EN[m - 1]} ${y}${time}`, short: `${y}.${pad(m)}.${pad(d)}` },
  };
}

const TIME_RE = /^\s*(\d{1,2}[:：.]\d{2}(?:\s*[-–~—]\s*\d{1,2}[:：.]\d{2})?)\s*[|·•\-–—:]?\s*/;
export function normItem(x: string | ProgramItem): ListItem {
  if (typeof x !== 'string') { const o = x as ProgramItem & Record<string, string | undefined>; return { time: (o.time ?? o.start ?? '').trim(), title: (o.title ?? o.act ?? o.name ?? o.artist ?? '').trim(), who: (o.who ?? o.by ?? o.speaker ?? '').trim(), note: (o.note ?? o.role ?? '').trim() }; }
  let s = x.trim(), time = '';
  const tm = s.match(TIME_RE);
  if (tm) { time = tm[1].replace('：', ':').replace(/\s+/g, ''); s = s.slice(tm[0].length); }
  const parts = s.split(/\s+[—–|]\s+|\s+-\s+|\s*·\s*/).map((p) => p.trim()).filter(Boolean);
  return { time, title: parts[0] ?? '', who: parts.slice(1, 2).join(''), note: parts.slice(2).join(' · ') };
}
export const normPerson = (p: string | Person): ListItem => typeof p === 'string'
  ? (() => { const [n, ...r] = p.split(/\s*[—–|,，、/]\s*|\s+-\s+/); return { time: '', title: n.trim(), who: '', note: r.join(' ').trim() }; })()
  : { time: p.time ?? '', title: p.name, who: '', note: p.role ?? '' };

const BASE_IMPORTANCE: Record<string, number> = { title: 1, title_alt: 0.72, subtitle: 0.7, slogan: 0.5, date: 0.62, time: 0.45, venue: 0.5, address: 0.25, city: 0.35, speakers: 0.55, program: 0.52, price: 0.35, ticket: 0.3, url: 0.25, qr_text: 0.15, organizers: 0.3, body: 0.32, edition: 0.32, hashtags: 0.15, credits: 0.12 };
const PURPOSE_BOOST: Record<string, Record<string, number>> = {
  event: { date: 0.12, venue: 0.08 }, music: { program: 0.18, date: 0.1, venue: 0.06, price: 0.05 }, talk: { speakers: 0.18, date: 0.1, venue: 0.05 },
  exhibition: { date: 0.08, venue: 0.12, organizers: 0.05 }, 'product-launch': { slogan: 0.2, date: 0.06, url: 0.08 }, sale: { price: 0.45, date: 0.12, slogan: 0.15 },
  announcement: { body: 0.2, date: 0.1 }, book: { organizers: 0.08, slogan: 0.12, body: 0.08 }, film: { date: 0.1, credits: 0.15, slogan: 0.12 }, personal: { body: 0.18, slogan: 0.15 },
};

export function analyze(b: Brief): Analysis {
  const c = b.content;
  const purpose = b.purpose ?? 'other';
  const date = parseDate(c.date);
  const dateEnd = parseDate(c.date_end, date?.y);
  // ---- language
  const all = [c.title, c.title_alt, c.subtitle, c.slogan, c.venue, c.body, ...(c.program ?? []).map((x) => (typeof x === 'string' ? x : `${x.title ?? ''} ${x.who ?? ''}`)), ...(c.speakers ?? []).map((x) => (typeof x === 'string' ? x : x.name))].filter(Boolean).join(' ');
  const h = hanCount(all), l = latCount(all);
  const cjkShare = h + l ? +(h / (h + l * 0.5)).toFixed(2) : 0;
  let overall: 'zh' | 'en' | 'bilingual' = c.language && c.language !== 'auto' ? c.language : cjkShare > 0.8 ? 'zh' : cjkShare < 0.12 ? 'en' : 'bilingual';
  if ((!c.language || c.language === 'auto') && c.title_alt && slotLang(c.title_alt) !== slotLang(c.title)) overall = 'bilingual';
  const langWhy = c.language && c.language !== 'auto' ? `language given as ${c.language}` : `CJK share ${Math.round(cjkShare * 100)}% of the copy${c.title_alt ? ', title has a translation' : ''} → ${overall}`;
  // ---- list
  const prog = (c.program ?? []).map(normItem).filter((x) => x.title || x.who);
  const spk = (c.speakers ?? []).map(normPerson).filter((x) => x.title);
  let list: Analysis['list'];
  if (prog.length) {
    const timed = prog.filter((x) => x.time).length >= Math.max(2, prog.length * 0.5);
    const kind = timed ? 'timetable' : 'lineup';
    list = { kind, items: prog, timed, why: `${prog.length} program items${timed ? ' with times → timetable' : ' without times → lineup'}` };
  } else if (spk.length) list = { kind: 'speakers', items: spk, timed: spk.some((x) => x.time), why: `${spk.length} speaker(s) → speaker list` };
  else list = { kind: 'none', items: [], timed: false, why: 'no program, lineup or speakers' };
  // ---- fields + hierarchy
  const fields: Field[] = [];
  const boost = PURPOSE_BOOST[purpose] ?? {};
  const add = (key: string, text: string | undefined, extraWhy = '') => {
    if (!text || !String(text).trim()) return;
    const t = String(text).trim();
    let imp = (BASE_IMPORTANCE[key] ?? 0.2) + (boost[key] ?? 0);
    // short copy reads as display type; long copy is reading text and sinks in the hierarchy
    const em = emWidth(t);
    if (key !== 'title' && em > 40) imp -= 0.1;
    if (key !== 'title' && em < 8 && imp > 0.4) imp += 0.04;
    if (b.constraints?.must_show?.includes(key)) imp = Math.max(imp, 0.62);
    imp = Math.min(1, Math.max(0.05, imp));
    fields.push({ key, text: t, lang: langOf(t), chars: [...t].length, em: +em.toFixed(1), importance: +imp.toFixed(2), tier: key === 'title' ? 'hero' : imp >= 0.6 ? 'secondary' : 'tertiary', why: `${key}: base ${BASE_IMPORTANCE[key] ?? 0.2}${boost[key] ? ` + ${boost[key]} (${purpose})` : ''}${extraWhy}` });
  };
  add('title', c.title); add('title_alt', c.title_alt); add('subtitle', c.subtitle); add('slogan', c.slogan);
  add('date', c.date ? (date ? (overall === 'zh' ? date.text.zh : date.text.en) : c.date) : undefined);
  add('time', c.time); add('venue', c.venue); add('address', c.address); add('city', c.city);
  if (list.kind === 'speakers') add('speakers', spk.map((x) => x.title).join(' / '));
  if (prog.length) add('program', prog.map((x) => [x.time, x.title, x.who].filter(Boolean).join(' ')).join(' / '));
  add('price', c.price); add('ticket', c.ticket); add('url', c.url); add('qr_text', c.qr_text);
  add('organizers', c.organizers?.join(' / ')); add('body', c.body); add('edition', c.edition); add('hashtags', c.hashtags?.join(' ')); add('credits', c.credits?.join(' / '));
  // context.priority (most important first) overrides the computed order: listed fields rise above the rest
  const pri = (b.context?.priority ?? []).filter((k) => fields.some((f) => f.key === k));
  pri.forEach((k, i) => { const f = fields.find((x) => x.key === k)!; if (k === 'title') return; f.importance = +Math.max(f.importance, 0.95 - i * 0.04).toFixed(2); f.tier = 'secondary'; f.why += ` · context.priority #${i + 1}`; });
  fields.sort((a, b2) => (pri.includes(a.key) && pri.includes(b2.key) ? pri.indexOf(a.key) - pri.indexOf(b2.key) : b2.importance - a.importance));
  if (pri.length) { const t = fields.findIndex((f) => f.key === 'title'); if (t > 0) fields.unshift(...fields.splice(t, 1)); }
  // ---- numerals usable as graphics
  const numerals: Numeral[] = [];
  if (date) {
    numerals.push({ text: pad(date.d), kind: 'day', graphic: true, why: `the event day (${date.iso}) can carry a calendar cell or a giant numeral` });
    numerals.push({ text: String(date.y), kind: 'year', graphic: false, why: 'real year replaces invented years' });
  }
  if (c.edition) { const n = c.edition.match(/\d+/); if (n) numerals.push({ text: pad(+n[0]), kind: 'edition', graphic: true, why: `edition "${c.edition}"` }); }
  if (c.price) { const p = c.price.match(/(\d+)\s*%/) ?? c.price.match(/[¥$€£]?\s?(\d{1,4})/); if (p) numerals.push({ text: c.price.includes('%') ? p[1] + '%' : p[1], kind: c.price.includes('%') ? 'percent' : 'price', graphic: purpose === 'sale', why: `price "${c.price}"` }); }
  if (list.timed) numerals.push({ text: list.items.find((x) => x.time)!.time, kind: 'time', graphic: false, why: 'program times fill the timetable column' });
  if (list.items.length >= 3) numerals.push({ text: String(list.items.length), kind: 'count', graphic: false, why: `${list.items.length} items` });
  // ---- title shape
  const tt = c.title.trim();
  const han = hanCount(tt), lat = latCount(tt), words = tt.split(/\s+/).filter(Boolean).length, em = emWidth(tt);
  const cjkShort = han > 0 && lat === 0 && han <= 4;
  const shape = em <= 2.2 ? 'glyph' : em <= 7 ? 'short' : em <= 16 ? 'medium' : 'long';
  // ---- quote-like copy
  const qsrc = [c.slogan, c.body].find((x) => x && /[“”「」"『』]/.test(x)) ?? (purpose === 'personal' || purpose === 'book' ? c.slogan ?? (c.body && emWidth(c.body) < 46 ? c.body : undefined) : undefined);
  const quote = qsrc ? { text: qsrc.trim(), lang: slotLang(qsrc) } : null;
  const chars = fields.reduce((a, f) => a + f.chars, 0);
  return {
    purpose, lang: { overall, title: langOf(tt), cjkShare, why: langWhy }, fields, hero: 'title', list, date, dateEnd, numerals,
    title: { text: tt, han, latin: lat, words, em: +em.toFixed(1), shape, cjkShort }, quote,
    copy: { chars, load: chars < 70 ? 'light' : chars < 220 ? 'medium' : 'heavy', fieldCount: fields.length },
  };
}
