// Brief resolver: analysis → generator inputs. Deterministic and explainable: every choice carries a reason.
import { BUILTIN_STYLES, type Style } from '@rea/data/styles';
import { DEFAULT_PARAMS, type Params } from '@rea/engine/params';
import { PAIRINGS } from '@rea/data/pairings';
import { expandRecipe, type FontSet } from '@rea/engine/typo';
import type { PickedTexts, PT } from '@rea/engine/gen/pick';
import type { CustomText } from '@rea/data/texts';
import { analyze, slotLang, emWidth, type Analysis, type ListItem } from './analyze';
import { validateBrief, type Brief, IDEA_IDS, type Issue } from './brief';
import { STYLE_TAGS, STYLE_RISKY } from './styletags';
import { displayModel } from './report';
import { canvasSize, type Ratio } from '@rea/engine/types';
import type { ImageAsset } from '@rea/engine/gen/ctx';
import { analyseSet, recommendLayouts, type SetInfo, type LayoutRec } from './layouts';

export interface Reason { field: string; value: unknown; why: string }
export interface PaletteSpec { source: string; filter: { src?: string; light?: string[]; chroma?: string[]; contrast?: string[]; tags?: string[]; hue?: 'warm' | 'cool' | 'neutral' } | null; pinned: string[] | null }
export interface ImageSpec { categories: string[] | null; ids: string[] | null; cutoutOnly: boolean }
export interface PlanPatch { tone?: 'dark' | 'light' | 'sat'; script?: boolean; material?: 'none'; typeOnly?: boolean; grain?: number }
export interface Direction { planPatch: PlanPatch; id: string; styleId: string; idea: string; composition: string; fonts: FontSet | null; fontsLabel: string; params: Params; modes: string[]; score: number; reasons: string[] }
export interface Resolved {
  analysis: Analysis; texts: PickedTexts; custom: CustomText;
  styles: { id: string; name: string; score: number; reasons: string[] }[];
  ideas: { id: string; score: number; comp: string; reasons: string[] }[];
  directions: Direction[];
  palette: PaletteSpec & { reasons: string[] };
  images: ImageSpec & { reasons: string[] };
  /** phase 16: the picture set and the grid layouts that can carry it (best first, with reasons) */
  layouts: { set: SetInfo | null; recommendations: LayoutRec[]; multi: boolean };
  format: { ratio: string; count: number; minScore: number; formats: string[]; scale: number };
  seed: string; reasons: Reason[]; warnings: Issue[];
}

const IMG_IDEAS = new Set(['substitution', 'occlusion', 'reveal', 'specimen', 'immersion']);
const hash = (s: string) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36).toUpperCase(); };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** keep separators off line starts (CLREQ): the app's breaker splits at plain spaces only, so a no-break space
 *  before " · " / " | " / " / " / " — " glues the separator to the preceding word; the text stays the same when read */
export const glue = (t: string) => t.replace(/ ([·・|/—–]) /g, '\u00a0$1 ');
const P = (t: string, fallback: 'zh' | 'en' = 'en'): PT => ({ t: glue(t), lang: t ? slotLang(t) : fallback });
const pad2 = (n: number) => String(n).padStart(2, '0');

function densityOf(b: Brief): 'airy' | 'balanced' | 'packed' {
  const d = b.style?.density;
  if (typeof d === 'number') return d <= 2 ? 'airy' : d >= 4 ? 'packed' : 'balanced';
  if (d) return d;
  const m = b.style?.mood ?? [];
  if (m.some((x) => ['calm', 'minimal', 'elegant'].includes(x))) return 'airy';
  if (m.some((x) => ['loud', 'raw'].includes(x))) return 'packed';
  return 'balanced';
}

/** the copy model: the real content placed into the generator's text slots; unused slots stay empty */
export function buildTexts(a: Analysis, b: Brief, density: string): { texts: PickedTexts; custom: CustomText; used: Record<string, number>; reasons: Reason[] } {
  const c = b.content; const zh = a.lang.overall === 'zh'; const fb: 'zh' | 'en' = a.lang.overall === 'en' ? 'en' : 'zh';
  const reasons: Reason[] = [];
  const headline = P(c.title.trim(), fb);
  reasons.push({ field: 'texts.headline', value: headline.t, why: 'the title is the hero field' });
  // secondary line: a translated title pairs with the title (bilingual), otherwise the subtitle, otherwise the slogan
  const subSrc = a.lang.overall === 'bilingual' && c.title_alt ? 'title_alt' : c.subtitle ? 'subtitle' : c.title_alt ? 'title_alt' : c.slogan ? 'slogan' : '';
  const subText = subSrc ? String((c as unknown as Record<string, unknown>)[subSrc]).trim() : '';
  if (subSrc) reasons.push({ field: 'texts.sub', value: subText, why: subSrc === 'title_alt' ? 'bilingual: the translated title is paired with the title' : `${subSrc} is the strongest secondary line` });
  const d = a.date;
  const dateLine = d ? (zh ? `${d.m}月${d.d}日 ${['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.weekday]}${d.hh !== undefined ? ' ' + pad2(d.hh) + ':' + pad2(d.mm ?? 0) : ''}` : `${['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.weekday]} ${d.y}.${pad2(d.m)}.${pad2(d.d)}${d.hh !== undefined ? ' ' + pad2(d.hh) + ':' + pad2(d.mm ?? 0) : ''}`) : c.date ?? '';
  const dateRange = d && a.dateEnd ? `${d.y}.${pad2(d.m)}.${pad2(d.d)} — ${a.dateEnd.y !== d.y ? a.dateEnd.y + '.' : ''}${pad2(a.dateEnd.m)}.${pad2(a.dateEnd.d)}` : '';
  const when = dateRange || [dateLine, c.time && !(d && d.hh !== undefined) ? c.time : ''].filter(Boolean).join(' ');
  // note (2–3 line caption): the displaced subtitle, then when + where
  const noteLines = [subSrc !== 'subtitle' && c.subtitle ? c.subtitle : '', when, [c.venue, c.city && !(c.venue ?? '').includes(c.city) ? c.city : ''].filter(Boolean).join(' · ')].filter(Boolean).slice(0, 3);
  const note = P(noteLines.join('\n'), fb);
  if (note.t) reasons.push({ field: 'texts.note', value: note.t, why: 'caption block: when + where (the facts people look for after the title)' });
  // groups: the list (program / lineup / speakers) or the key facts
  type G = { main: PT; sub: PT; note: PT };
  let groups: G[] = []; const times: string[] = []; const values: string[] = [];
  const L = a.list;
  const labels = zh ? { when: '时间', where: '地点', price: '票价', org: '主办' } : { when: 'When', where: 'Where', price: 'Tickets', org: 'Presented by' };
  if (L.kind !== 'none') {
    const items = L.items.slice(0, 6);
    // main = the act / talk / name; sub = the time; note = who / role (the index composition draws the times from facts.times)
    groups = items.map((it: ListItem) => L.kind === 'speakers'
      ? { main: P(it.title), sub: P(it.time), note: P(it.note) }
      : { main: P(it.title || it.who), sub: P(it.time), note: P(it.title ? [it.who, it.note].filter(Boolean).join(' · ') : it.note) });
    items.forEach((it, i) => { times.push(it.time); values.push(it.time || pad2(i + 1)); });
    reasons.push({ field: 'texts.groups', value: items.map((x) => x.title).join(' / '), why: `${L.why}; ${items.length} of ${L.items.length} items fill the small groups${L.items.length > 6 ? ' (the rest goes to meta as "+N")' : ''}` });
  } else {
    const fact = (main: string, sub: string, lab: string) => { if (main) groups.push({ main: P(main), sub: P(sub), note: P(lab) }); };
    const e2 = a.dateEnd;
    if (d && e2) fact(`${pad2(d.m)}.${pad2(d.d)} — ${pad2(e2.m)}.${pad2(e2.d)}`, String(d.y) + (e2.y !== d.y ? ' — ' + e2.y : ''), labels.when);
    else if (d) fact(zh ? `${d.m}.${pad2(d.d)}` : `${pad2(d.m)}.${pad2(d.d)}`, [zh ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.weekday] : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.weekday], d.hh !== undefined ? `${pad2(d.hh)}:${pad2(d.mm ?? 0)}` : c.time ?? ''].filter(Boolean).join(' '), labels.when);
    else if (c.date) fact(c.date, c.time ?? '', labels.when);
    fact(c.venue ?? '', [c.address, c.city].filter(Boolean).join(' · '), labels.where);
    fact(c.price ?? '', c.ticket ?? '', labels.price);
    if (c.organizers?.length && c.organizers[0] !== c.venue) fact(c.organizers[0], c.organizers.slice(1).join(' / '), labels.org);
    if (groups.length) reasons.push({ field: 'texts.groups', value: groups.map((g) => g.main.t).join(' / '), why: 'no list in the content: the key facts (when / where / tickets / organizer) become the small groups' });
  }
  const nGroups = groups.length;
  while (groups.length < 6) groups.push({ main: P('', fb), sub: P('', fb), note: P('', fb) });
  // prose: a quote first, then body paragraphs, then an unused slogan
  const prose: PT[] = [];
  if (a.quote) prose.push(P(a.quote.text));
  for (const para of (c.body ?? '').split(/\n\s*\n|\n/).map((x) => x.trim()).filter(Boolean)) if (!prose.some((p) => p.t === para)) prose.push(P(para));
  if (c.slogan && subSrc !== 'slogan' && !prose.some((p) => p.t === c.slogan)) prose.push(P(c.slogan));
  const nProse = Math.min(6, prose.length);
  if (nProse) reasons.push({ field: 'texts.prose', value: prose.slice(0, 2).map((p) => p.t.slice(0, 40)).join(' | '), why: 'body copy / slogan go to the prose blocks' });
  while (prose.length < 6) prose.push(P('', fb));
  // meta: short labels, by importance
  const meta: string[] = []; const metaKey: string[] = [];
  const pushM = (s?: string, key = '') => { if (s && s.trim() && emWidth(s) <= 30 && !meta.includes(s.trim())) { meta.push(s.trim()); metaKey.push(key); } };
  if (d) pushM(dateRange || `${d.y}.${pad2(d.m)}.${pad2(d.d)}`, 'date'); else pushM(c.date, 'date');
  pushM(d && d.hh !== undefined ? `${pad2(d.hh)}:${pad2(d.mm ?? 0)}` : c.time, 'time');
  pushM(c.venue, 'venue'); pushM(c.city, 'city'); pushM(c.price, 'price'); pushM(c.ticket, 'ticket'); pushM(c.url, 'url'); pushM(c.edition, 'edition');
  c.organizers?.forEach((o) => pushM(o, 'organizers'));
  if (L.items.length > 6) pushM(zh ? `另有 ${L.items.length - 6} 项` : `+${L.items.length - 6} more`, 'program');
  c.hashtags?.forEach((h) => pushM(h.startsWith('#') ? h : '#' + h, 'hashtags'));
  pushM(c.qr_text, 'qr_text');
  // speakers named in the priority: their names also become meta labels, so layouts without a list still show them
  if (L.kind === 'speakers' && (b.context?.priority ?? []).slice(0, 4).includes('speakers')) L.items.forEach((x) => pushM(x.title, 'speakers'));
  // context.priority first: the fields that must be found go into the meta labels every layout shows
  const pri = b.context?.priority ?? [];
  if (pri.length) {
    const rank = (k: string) => { const i = pri.indexOf(k === 'time' ? 'date' : k); return i < 0 ? 99 : i; };
    const ord = meta.map((m, i) => ({ m, k: metaKey[i], i })).sort((x, y) => rank(x.k) - rank(y.k) || x.i - y.i);
    meta.splice(0, meta.length, ...ord.map((o) => o.m));
  }
  const reqKeys = pri.length ? pri.slice(0, 4).map((k) => k) : ['date', 'venue'];
  const metaReq = metaKey.filter((k) => reqKeys.includes(k === 'time' ? 'date' : k)).length;
  const nMeta = Math.min(8, meta.length);
  if (nMeta) reasons.push({ field: 'texts.meta', value: meta.slice(0, 8).join(' | '), why: 'short facts become the meta labels (date, time, venue, price, url, organizers)' });
  const metaPT = meta.slice(0, 10).map((m) => P(m));
  while (metaPT.length < 10) metaPT.push(P('', fb));
  // words: Latin display words from the content (title / translation / purpose)
  const PURPOSE_WORD: Record<string, string> = { talk: 'TALK', exhibition: 'EXHIBITION', music: 'LIVE', 'product-launch': 'LAUNCH', sale: 'SALE', film: 'FILM', book: 'BOOK', event: 'EVENT', announcement: 'NOTICE' };
  const latin = [c.title, c.title_alt].filter((x): x is string => !!x && slotLang(x) === 'en').join(' ').split(/[\s/·|,]+/).map((w) => w.replace(/[^A-Za-z0-9&'-]/g, '')).filter((w) => w.length >= 3);
  const words = [...new Set([...latin.map((w) => w.toUpperCase()), PURPOSE_WORD[a.purpose] ?? ''].filter(Boolean))].slice(0, 4).map((w) => P(w, 'en'));
  while (words.length < 4) words.push(P('', 'en'));
  // glyph: the first hanzi / initial of the title, or the event day
  const firstHan = Array.from(c.title).find((ch) => /[\u3400-\u9fff]/.test(ch));
  const glyph = firstHan ?? (c.title.trim()[0] ?? 'P').toUpperCase();
  // facts: real numerals replace the generator's invented ones
  const facts: PickedTexts['facts'] = {};
  if (d) { facts.date = { y: d.y, m: d.m, d: d.d }; facts.year = String(d.y); }
  if (c.edition) facts.issue = c.edition.toUpperCase().slice(0, 14);
  else facts.issue = d ? `${d.y}.${pad2(d.m)}` : '';
  const num = a.numerals.find((n) => n.graphic && n.text.length <= 3);
  if (num) facts.numeral = num.text;
  // script signature / lettering only from real copy (a short Latin organizer name), otherwise none
  const org = (c.organizers ?? []).find((o) => slotLang(o) === 'en' && emWidth(o) <= 14);
  facts.signature = org ?? '';
  // cover masthead: the title when it is short, else its longest word / the first hanzi pair
  const mwords = c.title.trim().split(/\s+/).filter((w) => /^[A-Za-z][A-Za-z'&-]{2,8}$/.test(w));
  facts.masthead = emWidth(c.title.trim()) <= 6.5 ? c.title.trim().toUpperCase() : slotLang(c.title) === 'zh' ? Array.from(c.title.replace(/[^\u3400-\u9fff]/g, '')).slice(0, 2).join('') : (mwords.sort((x, y) => y.length - x.length)[0] ?? c.title.trim().split(/\s+/)[0]).toUpperCase();
  // round sticker: a true short word (free entry / live / open / new / edition), never an invented one
  const free = /free|免费|免票/i.test(`${c.price ?? ''} ${c.ticket ?? ''}`);
  const STICK: Record<string, [string, string]> = { music: ['LIVE', ''], exhibition: [zh ? '展览' : 'OPEN', ''], 'product-launch': ['NEW', ''], talk: [zh ? '讲座' : 'TALK', ''], film: ['FILM', ''], sale: ['SALE', ''], book: [zh ? '新书' : 'BOOK', ''] };
  const st: [string, string] = free ? [zh ? '免费' : 'FREE', ''] : STICK[a.purpose] ?? [(c.edition ?? '').slice(0, 8), ''];
  st[1] = d ? `${pad2(d.m)}.${pad2(d.d)}` : (c.edition ?? '').slice(0, 10);
  facts.sticker = st;
  if (L.kind !== 'none') { facts.times = [...times, ...Array(Math.max(0, 7 - times.length)).fill('')]; facts.values = [...values, ...Array(Math.max(0, 7 - values.length)).fill('')]; }
  reasons.push({ field: 'texts.facts', value: facts, why: 'real year / edition / date / numerals replace the invented "NO. 12", years, calendar days and index times' });
  const texts: PickedTexts = { set: 'custom', headline, sub: P(subText, fb), note, groups, prose, meta: metaPT, words, glyph, facts };
  // the app's custom-copy record (keeps the art direction from dropping real information; mirrors the slots)
  const custom: CustomText = { headline: headline.t, sub: subText, small: groups.slice(0, nGroups).map((g) => g.main.t), note: groups.slice(0, nGroups).map((g) => g.note.t), prose: prose[0]?.t ?? '', meta: meta.slice(0, 8) };
  void density;
  return { texts, custom, used: { groups: nGroups, prose: nProse, meta: nMeta, metaReq }, reasons };
}

function rankStyles(a: Analysis, b: Brief): Resolved['styles'] {
  const st = b.style ?? {};
  const mood = st.mood ?? []; const era = st.era; const voice = st.typography?.voice; const dens = densityOf(b);
  const want = new Set(st.styles ?? []);
  for (const r of st.references ?? []) if (r.kind === 'style-id') want.add(r.value);
  const avoid = new Set(st.avoid ?? []);
  const lang = a.lang.overall;
  const out = BUILTIN_STYLES.map((s: Style) => {
    const tg = STYLE_TAGS[s.id]; const why: string[] = []; let sc = 0;
    if (!tg) return { id: s.id, name: s.name.en, score: -99, reasons: ['no tags'] };
    if (want.has(s.id)) { sc += 12; why.push('requested in the brief'); }
    if (avoid.has(s.id)) { sc -= 20; why.push('avoided in the brief'); }
    // phase 11: brush / calligraphy and old-style hanzi styles are opt-in (only when the brief names them)
    if (s.optIn && !want.has(s.id)) { sc -= 6; why.push('(opt-in style: brush / old-style hanzi)'); }
    // library: zh styles carry CJK display faces; en styles pair Latin display type with a quiet CJK face
    if (lang === 'zh') { if (s.lib === 'zh') { sc += 2.5; why.push('zh library for Chinese copy'); } }
    else if (lang === 'en') { if (s.lib === 'en') { sc += 2.5; why.push('en library for English copy'); } }
    else { if (s.id === 'zh-bilingual') { sc += 2; why.push('built for bilingual copy'); } if (a.lang.title === 'zh' ? s.lib === 'zh' : s.lib === 'en') { sc += 1.5; why.push(`title is ${a.lang.title === 'zh' ? 'Chinese' : 'Latin'}`); } }
    const mm = mood.filter((m) => tg.mood.includes(m)); if (mm.length) { sc += mm.length * 1.6; why.push('mood ' + mm.join('+')); }
    if (era && tg.era.includes(era)) { sc += 2; why.push('era ' + era); }
    if (voice && voice !== 'mixed') { if (tg.voice === voice) { sc += 1.8; why.push('voice ' + voice); } else if (lang === 'zh' && tg.cjk && ((voice === 'serif' && tg.cjk === 'song') || (voice === 'sans' && tg.cjk === 'hei'))) { sc += 1.2; why.push('CJK face matches ' + voice); } }
    if (tg.density === dens) { sc += 1; why.push('density ' + dens); } else if ((tg.density === 'airy' && dens === 'packed') || (tg.density === 'packed' && dens === 'airy')) sc -= 1;
    // content fit
    if (a.list.items.length >= 4 && tg.density === 'airy') { sc -= 0.8; why.push('(long list in an airy style)'); }
    if (a.title.shape === 'long' && (tg.voice === 'display' || tg.voice === 'brush')) { sc -= 1.2; why.push('(long title in a display face)'); }
    if (a.title.cjkShort && (tg.voice === 'brush' || tg.cjk === 'song' || tg.cjk === 'hei')) { sc += 0.6; why.push('short Chinese title suits a strong CJK face'); }
    if (STYLE_RISKY.has(s.id) && !want.has(s.id) && !mood.includes('loud') && !mood.includes('raw')) sc -= 3;
    if (b.purpose === 'sale' && tg.mood.includes('bold')) { sc += 1; why.push('sale wants bold type'); }
    if ((b.purpose === 'exhibition' || b.purpose === 'book') && tg.mood.some((m) => m === 'elegant' || m === 'literary')) { sc += 0.8; why.push(`${b.purpose}: literary / elegant faces`); }
    if (b.purpose === 'talk' && tg.mood.some((m) => m === 'editorial' || m === 'technical')) { sc += 0.6; why.push('talk: editorial / technical faces'); }
    return { id: s.id, name: s.name.en, score: +sc.toFixed(2), reasons: why };
  });
  return out.sort((x, y) => y.score - x.score || x.id.localeCompare(y.id));
}

function rankIdeas(a: Analysis, b: Brief, imgOn: boolean, cutouts: boolean): Resolved['ideas'] {
  const S: Record<string, { s: number; why: string[]; comp: string }> = Object.fromEntries(IDEA_IDS.map((i) => [i, { s: 0, why: [] as string[], comp: 'auto' }]));
  const add = (id: string, v: number, why: string, comp?: string) => { S[id].s += v; S[id].why.push(why); if (comp) S[id].comp = comp; };
  const m = b.style?.mood ?? []; const p = a.purpose;
  add('scale', 1, 'baseline: big type'); add('split', 0.8, 'baseline'); add('tension', 0.8, 'baseline');
  if (a.list.items.length >= 3) add('data', 3.5, `${a.list.items.length}-item ${a.list.kind} → an index / programme table shows it`, 'index');
  else if (a.date && a.dateEnd && (Date.UTC(a.dateEnd.y, a.dateEnd.m - 1, a.dateEnd.d) - Date.UTC(a.date.y, a.date.m - 1, a.date.d)) / 864e5 > 6) S.data.why.push(`a ${Math.round((Date.UTC(a.dateEnd.y, a.dateEnd.m - 1, a.dateEnd.d) - Date.UTC(a.date.y, a.date.m - 1, a.date.d)) / 864e5)}-day run is a period, not a day: no calendar`);
  else if (a.date && ['event', 'talk', 'music', 'exhibition', 'film', 'sale', 'product-launch'].includes(p)) add('data', 3, `a real date (${a.date.iso}) → the calendar cell is the image`, 'calendar');
  if (a.title.cjkShort) add('hanzi', 4, `short Chinese title (${a.title.han} hanzi) → the hanzi itself becomes the picture`, 'hanzi');
  else if (a.lang.title === 'zh' && a.title.han <= 8) add('hanzi', 1.8, 'Chinese title ≤ 8 hanzi → vertical / hanzi set');
  if (a.quote) add('voice', 3.2, `quote-like copy ("${a.quote.text.slice(0, 18)}…") → quote composition`, 'quote');
  const use = b.style?.imagery?.use;
  if (use === 'hero' || use === 'full-bleed') { add('immersion', 3, `imagery: ${use}`); add('reveal', 1.2, 'picture as hero'); add('specimen', 0.8, 'picture as hero'); }
  if (use === 'accent') { add('substitution', 0.8, 'imagery accent'); add('reveal', 0.8, 'imagery accent'); }
  if (m.includes('calm') || m.includes('minimal')) add('emptiness', 2.5, 'calm / minimal → emptiness (ma)');
  if (m.includes('elegant')) add('emptiness', 1.2, 'elegant → space');
  if (m.includes('bold') || m.includes('loud')) { add('scale', 2.2, 'bold → scale contrast'); add('tension', 1.4, 'bold → tension'); }
  if (m.includes('playful')) { add('orbit', 2, 'playful → orbit'); add('anomaly', 1.5, 'playful → one anomaly'); }
  if (m.includes('technical')) { add('data', 1, 'technical → data'); add('split', 0.8, 'technical → split'); }
  if (p === 'exhibition') { add('emptiness', 1, 'exhibition → quiet space'); if (imgOn) add('reveal', 1, 'exhibition → a window on the work'); }
  if (p === 'product-launch') { add('occlusion', 2, 'product → subject in front of the title'); add('scale', 1, 'product → scale'); }
  if (p === 'sale') add('scale', 3, 'sale → the number is the image');
  if (p === 'music') { add('tension', 1, 'music night → energy'); add('orbit', 0.6, 'music → rhythm'); }
  if (a.title.shape === 'long') { add('scale', -0.8, 'long title: giant type is risky'); add('hanzi', -2, 'long title'); }
  for (const id of b.style?.ideas ?? []) add(id, 10, 'requested in the brief');
  const avoid = new Set([...(b.constraints?.avoid_ideas ?? [])]);
  const out: Resolved['ideas'] = [];
  for (const [id, v] of Object.entries(S)) {
    // feasibility (a forced idea bypasses the engine's own checks, so the resolver guarantees them)
    if (avoid.has(id)) continue;
    if (id === 'hanzi' && a.lang.title !== 'zh') continue;
    if (IMG_IDEAS.has(id) && !imgOn) continue;
    if (id === 'occlusion' && !cutouts) continue;
    if (v.s <= 0) continue;
    out.push({ id, score: +v.s.toFixed(2), comp: v.comp, reasons: v.why });
  }
  return out.sort((x, y) => y.score - x.score || x.id.localeCompare(y.id));
}

function titleScale(a: Analysis, b: Brief, dens: string): { v: number; why: string } {
  const em = a.title.em;
  let v = em <= 3 ? 150 : em <= 6 ? 130 : em <= 10 ? 112 : em <= 16 ? 100 : em <= 24 ? 88 : 76;
  const parts = [`title ≈ ${em} em wide → ${v}`];
  const sec = a.fields.filter((f) => f.tier === 'secondary').length;
  if (sec >= 3) { v -= 8; parts.push(`${sec} secondary fields compete → −8`); }
  if (a.list.items.length >= 4) { v -= 6; parts.push('long list needs room → −6'); }
  const m = b.style?.mood ?? [];
  if (m.includes('bold') || m.includes('loud')) { v += 12; parts.push('bold → +12'); }
  if (dens === 'airy' || m.includes('minimal')) { v -= 10; parts.push('airy / minimal → −10'); }
  return { v: clamp(Math.round(v), 50, 180), why: parts.join(', ') };
}

export function resolveBrief(b: Brief, env: { cutoutIds: Set<string>; imageCats: Record<string, number>; userImageIds?: string[]; assets?: ImageAsset[] }): Resolved {
  const { errors, warnings } = validateBrief(b);
  if (errors.length) throw Object.assign(new Error('invalid brief: ' + errors.map((e) => `${e.path}: ${e.msg}`).join('; ')), { code: 2, issues: errors });
  const a = analyze(b);
  const reasons: Reason[] = [];
  const dens = densityOf(b);
  reasons.push({ field: 'density', value: dens, why: b.style?.density !== undefined ? 'given' : 'derived from mood' });
  const R = (field: string, value: unknown, why: string) => reasons.push({ field, value, why });
  R('language', a.lang.overall, a.lang.why);
  R('hierarchy', a.fields.map((f) => `${f.tier}:${f.key}`).join(' > '), 'importance = field base + purpose boost − length penalty');
  // ---- copy
  const T = buildTexts(a, b, dens);
  reasons.push(...T.reasons);
  // ---- images
  const im = b.style?.imagery ?? {};
  const use = im.use ?? 'accent';
  const imgOn = use !== 'none';
  const catOK = (im.subject ?? []).filter((x) => env.imageCats[x]);
  const badCats = (im.subject ?? []).filter((x) => !env.imageCats[x]);
  if (badCats.length) warnings.push({ path: 'style.imagery.subject', msg: `unknown image categories ${badCats.join(', ')} (known: ${Object.keys(env.imageCats).join(', ')})` });
  // pictures given by id (the CLI turns imagery.files into user-image ids before resolving): order = importance
  const known = new Set((env.assets ?? []).map((a) => a.id));
  const givenIds = (im.ids ?? []).filter((id) => !env.assets || known.has(id)).slice(0, 8);
  for (const id of (im.ids ?? []).filter((id) => env.assets && !known.has(id))) warnings.push({ path: 'style.imagery.ids', msg: `unknown picture id "${id}" (add it with \`images add\`, or list ids with \`images list\`)` });
  if (im.files?.length && !im.ids?.length) warnings.push({ path: 'style.imagery.files', msg: 'files are added by the CLI (generate / brief resolve); the engine only sees ids' });
  const images: Resolved['images'] = { categories: catOK.length ? catOK : null, ids: imgOn && givenIds.length ? givenIds : null, cutoutOnly: false, reasons: [] };
  images.reasons.push(imgOn ? `imagery ${use}${catOK.length ? ' from ' + catOK.join(', ') : ''}${images.ids ? ', ids ' + images.ids.join(', ') + ' (first = hero)' : ''}` : 'type only (imagery: none)');
  const cutouts = imgOn && (images.ids ? images.ids.some((i) => env.cutoutIds.has(i)) : true);
  // ---- ranked styles / ideas
  const styles = rankStyles(a, b);
  const ideas = rankIdeas(a, b, imgOn, cutouts);
  // ---- params shared by all directions
  const ts = titleScale(a, b, dens);
  R('titleScale', ts.v, ts.why + ' (multiplied by the style\'s own title scale)');
  const base: Record<string, string | number | boolean> = {};
  base.smallGroups = clamp(dens === 'airy' && a.list.kind === 'none' ? Math.min(T.used.groups, 2) : T.used.groups, 0, 6);
  R('smallGroups', base.smallGroups, a.list.kind !== 'none' ? `show the ${a.list.kind} (${T.used.groups} items)` : `${T.used.groups} key facts${dens === 'airy' ? ', airy → at most 2' : ''}`);
  base.metaCount = clamp(Math.max(T.used.metaReq ?? 0, dens === 'airy' ? Math.min(T.used.meta, 3) : dens === 'packed' ? T.used.meta : Math.min(T.used.meta, 6)), 0, 8);
  R('metaCount', base.metaCount, `${T.used.meta} real meta labels, density ${dens}${T.used.metaReq ? `, at least the ${T.used.metaReq} required (priority) facts` : ''}`);
  base.proseCount = clamp(dens === 'airy' ? Math.min(T.used.prose, 1) : Math.min(T.used.prose, 2), 0, 6);
  R('proseCount', base.proseCount, T.used.prose ? `${T.used.prose} prose blocks in the content` : 'no body copy → no prose blocks (no filler text)');
  base.smallScale = a.list.items.length >= 5 ? 90 : a.copy.load === 'light' ? 110 : 100;
  R('smallScale', base.smallScale, a.list.items.length >= 5 ? 'long list → smaller secondary type' : `copy load ${a.copy.load}`);
  {
    // display condition: small info text (~10 px at smallScale 100) must reach the minimum CSS size at the target display
    const [cw, ch] = canvasSize(((b.format?.ratio ?? '3:4') as Ratio));
    const dm = displayModel(b.context?.display, cw, ch);
    if (!dm.heroOnly) {
      const need = Math.min(200, Math.ceil((dm.minInfoCss / dm.cssPerPx / 10) * 100));
      if (need > base.smallScale) { base.smallScale = need; R('smallScale', need, `${dm.note}: small text needs ≥ ${Math.ceil(dm.minInfoCss / dm.cssPerPx)} poster px${need >= 200 ? ' (capped at 200: small slots cannot reach it, keep key facts in large slots)' : ''}`); }
    }
  }
  base.blockBudget = dens === 'airy' ? 6 : dens === 'packed' ? 11 : 8;
  base.decorBudget = dens === 'airy' ? 1 : dens === 'packed' ? 4 : 2;
  base.ornaments = dens === 'airy' ? 1 : dens === 'packed' ? 3 : 2;
  R('blockBudget/decorBudget', [base.blockBudget, base.decorBudget], `density ${dens}${a.copy.load === 'heavy' ? ', heavy copy' : ''}`);
  // ---- phase 16: several pictures → the Swiss grid compositions, the layout chosen from the picture set and the copy
  const nPics = images.ids ? images.ids.length : imgOn ? Math.max(1, Math.min(8, im.count ?? 1)) : 0;
  const assetsById = new Map((env.assets ?? []).map((x) => [x.id, x] as [string, ImageAsset]));
  const set = images.ids ? analyseSet(images.ids.map((id) => assetsById.get(id)!).filter(Boolean)) : null;
  const synth: SetInfo = set ?? { n: nPics, pics: [], orientations: {}, spread: 0.2, series: false, busy: 0.35, note: `${nPics} catalogue picture${nPics > 1 ? 's' : ''} (not chosen yet)` };
  const askedLayout = im.layout ?? 'auto';
  const recs = imgOn && askedLayout !== 'single' ? recommendLayouts(synth, { ratio: b.format?.ratio ?? '3:4', density: dens, mood: b.style?.mood ?? [], listItems: a.list.items.length, heavyCopy: a.copy.load === 'heavy', use, asked: askedLayout }) : [];
  const multi = nPics >= 2 && askedLayout !== 'single';
  if (set) R('pictures', set.note, 'picture-set analysis (count, proportions, series, busyness)');
  if (recs.length) R('layouts', recs.slice(0, 3).map((r) => `${r.composition}/${r.layout} ${r.score}`).join(', '), multi ? 'several pictures: the Swiss grid compositions lay them all out' : 'one picture: the grid layouts are offered next to the single-picture compositions');
  base.imageCount = nPics;
  base.typeOnlyShare = imgOn ? (use === 'accent' ? 15 : 0) : 60;
  base.imageShare = use === 'full-bleed' ? 85 : use === 'hero' ? 70 : 55;
  R('imageCount/typeOnlyShare/imageShare', [base.imageCount, base.typeOnlyShare, base.imageShare], `imagery ${use}`);
  const col = b.style?.color ?? {};
  const bg = col.background ?? (col.lightness === 'dark' ? 'dark' : col.lightness === 'light' ? 'light' : undefined);
  if (bg) { base.bgPref = bg; R('bgPref', bg, 'color.background / lightness'); }
  const m = b.style?.mood ?? [];
  if (b.style?.era && ['80s', '90s', 'y2k'].includes(b.style.era) || m.includes('loud')) { base.colorMode = 'experimental'; R('colorMode', 'experimental', 'loud mood / 80s–y2k era'); }
  const tex = b.style?.texture;
  if (tex && tex !== 'auto') { base.texture = tex === 'flat' ? 'none' : tex; R('texture', base.texture, 'texture given'); }
  if (b.style?.typography?.case === 'upper') base.case = 'upper';
  base.englishBias = a.lang.overall === 'zh' ? 20 : a.lang.overall === 'en' ? 90 : 50;
  // ---- palette
  const pal: Resolved['palette'] = { source: 'image', filter: null, pinned: null, reasons: [] };
  const f: NonNullable<PaletteSpec['filter']> = {};
  if (col.lightness === 'light') f.light = ['bright', 'luminous']; else if (col.lightness === 'dark') f.light = ['dark', 'calm'];
  if (col.chroma === 'muted' || col.chroma === 'mono') f.chroma = ['soft', 'mid']; else if (col.chroma === 'rich') f.chroma = ['rich']; else if (col.chroma === 'neon') { f.chroma = ['rich']; f.tags = ['pop']; }
  if (col.contrast === 'gentle') f.contrast = ['gentle', 'clear']; else if (col.contrast === 'strong') f.contrast = ['strong'];
  if (col.palette_tags?.length) f.tags = [...(f.tags ?? []), ...col.palette_tags];
  if (col.temperature) f.hue = col.temperature;
  if (Object.keys(f).length) {
    const retro = m.includes('retro') || m.includes('traditional') || (f.tags ?? []).includes('vintage');
    pal.source = retro ? 'wada' : 'nice'; f.src = pal.source; pal.filter = f;
    base.paletteSource = pal.source;
    pal.reasons.push(`color intent → library palettes (${pal.source}${retro ? ': Wada, traditional / vintage' : ''}) filtered by ${JSON.stringify(f)}`);
  } else pal.reasons.push('no color intent → palette from the picture (the app default)');
  if (col.must_include?.length) { pal.pinned = col.must_include.slice(0, 5); pal.reasons.push(`must include ${pal.pinned.join(', ')} → pinned palette`); }
  if (col.chroma === 'mono') { base.saturation = 35; pal.reasons.push('mono → saturation 35'); }
  // ---- art-direction plan: the brief decides what the plan would otherwise roll (tone, lettering, material, type-only)
  const planPatch: PlanPatch = {};
  if (bg && bg !== 'auto') planPatch.tone = bg === 'color' ? 'sat' : bg;
  if (!m.some((x) => ['playful', 'warm', 'retro'].includes(x))) planPatch.script = false;
  if (m.some((x) => ['calm', 'minimal', 'elegant', 'luxurious'].includes(x)) || dens === 'airy') planPatch.material = 'none';
  if (use === 'none') planPatch.typeOnly = true; else if (use === 'hero' || use === 'full-bleed' || images.ids || nPics >= 2) planPatch.typeOnly = false;
  if (tex === 'flat') planPatch.grain = 0;
  R('plan', planPatch, 'the plan normally rolls tone / script lettering / torn-stamp material / type-only per draw; the brief fixes them');
  // ---- fonts
  const ty = b.style?.typography ?? {};
  const voiceMood: Record<string, string> = { serif: 'literary', sans: 'swiss', mono: 'technical', display: 'poster', round: 'geometric', script: 'literary', brush: 'literary' };
  const fmood = ty.mood ?? (ty.voice && ty.voice !== 'mixed' ? voiceMood[ty.voice] : undefined);
  // ---- format
  const fmt = b.format ?? {};
  const format = { ratio: fmt.ratio ?? (b.purpose === 'music' || b.purpose === 'event' ? '3:4' : '3:4'), count: fmt.count ?? 6, minScore: fmt.min_score ?? 0, formats: fmt.formats ?? ['png', 'json'], scale: fmt.scale ?? 1 };
  const seed = b.constraints?.seed ?? 'B' + hash(JSON.stringify(b.content));
  // ---- directions: top styles × top ideas, interleaved so neighbours differ in both
  const topS = styles.filter((s) => s.score > -5).slice(0, 4);
  const topI = ideas.slice(0, 4);
  const directions: Direction[] = [];
  const nDir = Math.max(format.count, 6);
  for (let k = 0; k < nDir; k++) {
    const s = topS[k % topS.length]; const I = topI[(k + Math.floor(k / topS.length)) % topI.length];
    const style = BUILTIN_STYLES.find((x) => x.id === s.id)!;
    const why: string[] = [`style ${s.id}: ${s.reasons.join(', ') || 'neutral'}`];
    const params = { ...DEFAULT_PARAMS, ...style.params, ...base } as Params;
    params.titleScale = clamp(Math.round(Number(style.params.titleScale ?? 100) * ts.v / 100), 40, 200);
    // explicit compositions where the content decides the form (selector off): every other direction for data / hanzi / voice
    let composition = 'auto'; let idea = I ? I.id : 'auto';
    if (I && I.comp !== 'auto' && (k % 2 === 0 || I.id === 'data')) composition = I.comp;
    if (composition === 'calendar' && !a.date) composition = 'auto';
    // phase 16: several pictures → every direction is a grid layout (the others would show only the first picture);
    // one picture → every other direction tries a grid layout next to the idea-led ones
    const topRecs = recs.filter((r) => r.score >= (recs[0]?.score ?? 0) - 2.5).slice(0, 3);
    const rec = topRecs.length && (multi || (nPics === 1 && k % 2 === 1)) ? topRecs[(k + Math.floor(k / Math.max(1, topS.length))) % topRecs.length] : null;
    if (rec) composition = rec.composition;
    params.composition = composition; params.idea = composition === 'auto' ? idea : 'auto';
    if (rec) params.gridLayout = rec.layout;
    if (composition !== 'auto') idea = '(from composition)';
    if (rec) why.push(`layout ${rec.composition}/${rec.layout} (score ${rec.score}): ${rec.reasons.slice(0, 3).join('; ')}`);
    else why.push(I ? `idea ${I.id} (${I.reasons.join('; ')})${composition !== 'auto' ? ` → composition ${composition}` : ''}` : 'idea auto');
    let fonts: FontSet | null = null; let fontsLabel = `style fonts (${style.fonts.en['big.main'].family} / ${style.fonts.zh['big.main'].family})`;
    const tg = STYLE_TAGS[s.id];
    if (fmood && !(ty.voice && tg?.voice === ty.voice && !ty.mood)) {
      const cands = PAIRINGS.filter((pp) => pp.mood === fmood);
      if (cands.length) {
        const pk = cands[parseInt(hash(seed + k), 36) % cands.length];
        fonts = expandRecipe(pk.recipe); fontsLabel = `pairing ${pk.id} (${fmood}): ${pk.recipe.display[0]} + ${pk.recipe.text[0]} / ${pk.recipe.zhDisplay[0]}`;
        why.push(`fonts: typography ${ty.mood ? 'mood ' + ty.mood : 'voice ' + ty.voice} → ${fontsLabel}`);
      }
    }
    directions.push({ planPatch, id: `d${k + 1}`, styleId: s.id, idea, composition, fonts, fontsLabel, params, modes: [...(style.modes ?? [])], score: +(s.score + (I?.score ?? 0)).toFixed(2), reasons: why });
  }
  return { analysis: a, texts: T.texts, custom: T.custom, styles: styles.slice(0, 8), ideas, directions, palette: pal, images, layouts: { set, recommendations: recs, multi }, format, seed, reasons, warnings };
}
