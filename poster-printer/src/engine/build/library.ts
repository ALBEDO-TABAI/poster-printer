// Phase 18: the construction library (构成库). Each entry is a text-group construction from the reference study
// (findings/titles.md, covers.md, micro.md, wangzhihong.md, the PSD measurements), written as a generator: it reads the
// copy (how long the title is, which scripts and numbers exist) and the type stream, and returns the tree. Sizes are
// multiples of the smallest text A; measured ratios: display CN : EN cap 3.4–4.5 (font size ≈ 0.3×), title : sub
// 1.8–3.6, title : description 1.8–3.4, promo hero : body 4.8–10; gaps ≈ 0.5–1.2× the small text; display leading
// 0.95–1.05; contrast is either extreme (4–8×) or near-flat (1.3–2.5×), the ~2× middle looks generic.
import type { Construction, GNode, TextLeaf, MarkLeaf, BoxNode, GenIn, Slot } from './types';
import { pickBreak, type BreakShape } from './lines';
import type { Copy } from './copy';

// ---- builders
const T = (slot: Slot, k: number, o: Partial<TextLeaf> = {}): TextLeaf => ({ t: 'text', slot, k, ...o });
const lit = (text: string, k: number, of: Slot | undefined, o: Partial<TextLeaf> = {}): TextLeaf => ({ t: 'text', slot: 'lit', lit: text, k, of, ...o });
const M = (m: MarkLeaf['m'], k: number, o: Partial<MarkLeaf> = {}): MarkLeaf => ({ t: 'mark', m, k, ...o });
const col = (kids: (GNode | null | false | undefined)[], o: Partial<BoxNode> = {}): BoxNode => ({ t: 'box', dir: 'col', al: 'start', gap: 0.45, kids: kids.filter(Boolean) as GNode[], ...o });
const row = (kids: (GNode | null | false | undefined)[], o: Partial<BoxNode> = {}): BoxNode => ({ t: 'box', dir: 'row', al: 'start', gap: 0.7, kids: kids.filter(Boolean) as GNode[], ...o });

// ---- copy helpers
const han = (s: string) => /[㐀-鿿]/.test(s);
const nChars = (s: string) => (han(s) ? Array.from(s.replace(/\s/g, '')).length : s.length);
/** the title's lines for a break shape the text supports */
function titleLines(g: GenIn, allow?: BreakShape[], src?: string): string[] { return pickBreak(g.r, src ?? g.copy.title.t, allow).lines; }
/** the second script: the Latin line under a Han title, or the Han line under a Latin title */
function second(c: Copy): { t: string; slot: Slot } | null {
  if (c.title.lang === 'zh' && c.en) return { t: c.en, slot: 'title.en' };
  if (c.title.lang === 'en' && c.cn) return { t: c.cn, slot: 'title.cn' };
  return null;
}
const titleW = (g: GenIn) => g.r.weighted({ bold: 2, black: 1.2, medium: 0.6 }) as TextLeaf['w'];
/** title lines as leaves (each its own line so fillers and steps can attach) */
const lineLeaves = (lines: string[], k: number, o: Partial<TextLeaf> = {}) => lines.map((l) => lit(l, k, 'title', { lead: 0.95, ...o }));
/** one unit of the group gets the spot colour, about a third of the time */
const accentPick = (g: GenIn) => (g.r.chance(0.32) ? g.r.pick(['last', 'num', 'en']) : null);

function filler(g: GenIn, h: number): GNode | null {
  // close the rectangle at the open end of a short line: circled numeral, #N raised half a line, a locked micro stack, a pill
  const c = g.copy;
  const s2 = second(c);
  void s2; // the second-script line is the construction's own; the filler never repeats it
  const k = g.r.weighted({ circle: c.index || c.num ? 0.35 : 0, hash: c.index ? 0.25 : 0, stack: (c.date || c.year) ? 0.3 : 0, dot: 0.15 }) as string;
  const idx = (c.index ?? c.num?.v ?? '').replace(/^(No\.?|Vol\.?|#)\s?/i, '');
  if (k === 'circle' && idx) return row([lit(idx.slice(0, 3), h * 0.45, 'num', { w: 'bold', track: -20 })], { frame: { f: 'circle', pad: 0.2, accent: g.r.chance(0.5) } });
  if (k === 'hash' && idx) return lit('#' + idx.slice(0, 3), h * 0.92, undefined, { w: 'bold', dy: -h * 0.45, accent: g.r.chance(0.4), track: -30 });
  if (k === 'stack') {
    const parts = [c.year, c.date && c.date !== c.year ? c.date : null].filter(Boolean) as string[];
    if (parts.length) return col(parts.map((p) => lit(p, 1, undefined, { w: 'bold', case: 'upper', max: 16 })), { gap: 0.08, lock: true });
  }
  return M('dot', h * 0.32, { accent: true });
}

// ---------------------------------------------------------------- the library
export const LIBRARY: Construction[] = [
  {
    // 单边: flush stack — EN tag / title (短长) / sub / rule / description
    id: 'flush-stack', zh: '单边', en: 'Flush stack', needs: ['title'], shape: 'square', tags: ['plain', 'cover'], wt: 1.6,
    gen: (g) => {
      const c = g.copy, s2 = second(c), acc = accentPick(g);
      const lines = titleLines(g);
      const k = g.r.pick([3.2, 3.6, 4.2]);
      const enAt = s2 ? (g.r.chance(0.3) ? 'top' : 'below') : null; // the second-script line has one place
      return col([
        enAt === 'top' ? lit(s2!.t, k * 0.32, s2!.slot, { w: 'bold', case: 'upper', track: 60, max: 28, accent: acc === 'en' }) : null,
        col(lineLeaves(lines, k, { w: titleW(g), track: -30 }).map((l, i, a) => (acc === 'last' && i === a.length - 1 ? { ...l, accent: true } : l)), { gap: 0.02 * k }),
        enAt === 'below' ? lit(s2!.t, k * 0.42, s2!.slot, { w: 'medium', max: 40, accent: acc === 'en' }) : null,
        c.sub ? T('sub', k * 0.38, { opt: true, wrap: 26, max: 60 }) : null,
        g.r.chance(0.55) ? M('rule', 0.06, { len: 'fill' }) : null,
        T('meta', 1, { idx: 0, opt: true, max: 40 }),
      ], { gap: 0.8 });
    },
  },
  {
    // 居中: centred stack with alternating widths (vase / diamond), separator dash or dot
    id: 'centred-stack', zh: '居中', en: 'Centred stack', needs: ['title'], shape: 'square', tags: ['center'], wt: 1.3,
    gen: (g) => {
      const c = g.copy, s2 = second(c);
      const lines = titleLines(g, ['one', 'short-long', 'mid-long']);
      const k = g.r.pick([3.2, 3.8, 4.4]);
      const tag = s2 && s2.slot === 'title.en' ? lit(s2.t, 1.1, s2.slot, { case: 'upper', track: 140, w: 'medium', max: 26 }) : c.index ? lit(c.index, 1.1, undefined, { track: 100, w: 'medium' }) : null;
      const sep = g.r.weighted({ dash: 2, dot: 1.2, none: 0.8 });
      return col([
        tag,
        col(lineLeaves(lines, k, { w: titleW(g), track: -20 }), { gap: 0.02 * k, al: 'center' }),
        sep === 'dash' ? M('rule', 0.1, { len: 2.4, accent: true }) : sep === 'dot' ? M('dot', 0.7, { accent: true }) : null,
        T('sub', 1.35, { opt: true, wrap: 24, max: 56 }),
        T('meta', 1, { idx: 0, opt: true, max: 36 }),
      ], { gap: 0.9, al: 'center' });
    },
  },
  {
    // 两端: the justified brick — every line one width; sizes fall out of character count; short Han lines letterspaced
    id: 'justified-brick', zh: '两端齐', en: 'Justified brick', needs: ['title'], shape: 'square', tags: ['justify', 'promo'], wt: 1.2,
    gen: (g) => {
      const c = g.copy, s2 = second(c);
      const hero = c.title.t.length <= 14 || han(c.title.t) ? [c.title.t] : titleLines(g, ['equal', 'balanced']);
      const k = 6;
      const kids: GNode[] = [];
      if (c.index && g.r.chance(0.5)) kids.push(lit(c.index, 1.2, undefined, { fit: 'track', case: 'upper', w: 'medium' }));
      kids.push(...hero.map((l) => lit(l, k, 'title', { w: g.r.chance(0.7) ? 'black' : 'bold', track: -20, lead: 0.92 })));
      const rules = g.r.chance(0.5);
      if (rules) kids.push(M('rule', 0.1, { len: 'fill' }));
      if (s2) kids.push(lit(s2.t, 1.6, s2.slot, han(s2.t) ? { fit: 'track', w: 'bold' } : { fit: 'width', case: 'upper', w: 'bold', track: 0 }));
      if (c.sub && nChars(c.sub.t) <= 24) kids.push(T('sub', 1.2, han(c.sub.t) ? { fit: 'track' } : { fit: 'width' }));
      if (rules && (c.date || c.meta[0])) kids.push(M('rule', 0.1, { len: 'fill' }));
      if (c.date) kids.push(T('date', 1.2, { fit: 'width', w: 'medium' }));
      else if (c.meta[0] && nChars(c.meta[0].t) <= 30) kids.push(T('meta', 1, { idx: 0, fit: han(c.meta[0].t) ? 'track' : 'width' }));
      return col(kids, { gap: 0.5 });
    },
  },
  {
    // 中英等宽: a short Han title with its Latin line justified to the same width (字体搭配 / FORMAT DESIGN)
    id: 'cn-en-justify', zh: '中英等宽', en: 'CN / EN justified', needs: ['title.cn', 'title.en'], shape: 'square', tags: ['center', 'justify'], wt: 1.4,
    gen: (g) => {
      const c = g.copy;
      if (nChars(c.cn!) > 6 && !c.cn!.includes('\n')) return null;
      const al = g.r.pick(['start', 'center'] as const);
      return col([
        lit(c.cn!, 3.2, 'title.cn', { w: titleW(g), track: 0 }),
        lit(c.en!, 1.4, 'title.en', { fit: 'width', case: g.r.chance(0.7) ? 'upper' : undefined, w: 'medium', track: 0 }),
        T('sub', 1, { opt: true, wrap: 20, max: 44 }),
      ], { gap: 0.35, al });
    },
  },
  {
    // 二层级: title over a block of small lines, ratio ≈ 2.7, gap = the small text's own height (KASHIWA SATO)
    id: 'two-level', zh: '二层级', en: 'Two levels', needs: ['title'], shape: 'square', tags: ['plain', 'swiss'], wt: 1.3,
    gen: (g) => {
      const c = g.copy, s2 = second(c);
      const lines = titleLines(g, ['one', 'short-long', 'equal']);
      const small: GNode[] = [];
      if (s2) small.push(lit(s2.t, 1, s2.slot, { w: 'medium', max: 32 }));
      if (c.sub) small.push(T('sub', 1, { max: 36 }));
      if (c.meta[0]) small.push(T('meta', 1, { idx: 0, max: 36 }));
      if (!small.length) return null;
      return col([col(lineLeaves(lines, 2.7, { w: 'bold', lead: 0.9, track: 10 }), { gap: 0 }), col(small, { gap: 0.1 })], { gap: 0.75 });
    },
  },
  {
    // 西文展示叠: a Latin display stack justified to one width, heights 1 : 0.42 : 0.19, the Han line under it at 0.4–0.6×
    id: 'display-en', zh: '西文叠', en: 'Display EN stack', needs: ['title.en'], shape: 'square', tags: ['cover', 'justify'], wt: 1,
    gen: (g) => {
      const c = g.copy;
      const words = c.en!.split(/\s+/);
      if (words.length < 2 || c.en!.length > 34) return null;
      const lines = titleLines(g, ['short-long', 'balanced'], c.en!);
      const kids: GNode[] = lines.map((l, i) => lit(l.toUpperCase(), i === 0 ? 6 : 6 * 0.42, 'title.en', { fit: i === 0 ? undefined : 'width', w: 'black', track: -10, lead: 0.92 }));
      if (c.cn && c.cn !== c.en) kids.push(lit(c.cn, 1.8, 'title.cn', { w: 'bold' }));
      kids.push(T('sub', 1, { opt: true, max: 40 }));
      return col(kids, { gap: 0.3 });
    },
  },
  {
    // 小大中: kicker / title / EN (magazine cover main group)
    id: 'kicker-title', zh: '小大中', en: 'Kicker-title-EN', needs: ['title'], shape: 'square', tags: ['cover'], wt: 1.2,
    gen: (g) => {
      const c = g.copy, s2 = second(c);
      const kicker = c.meta[0] ?? (c.sub && nChars(c.sub.t) <= 16 ? c.sub : null);
      const lines = titleLines(g, ['one', 'short-long']);
      const k = g.r.pick([3, 3.5]);
      return col([
        kicker ? lit(kicker.t, k * 0.38, kicker === c.sub ? 'sub' : 'meta', { w: 'medium', max: 22 }) : null,
        col(lineLeaves(lines, k, { w: 'black', track: -30 }), { gap: 0 }),
        s2 ? lit(s2.t, k * 0.32, s2.slot, { w: 'medium', italic: true, accent: true, max: 40 }) : null,
      ], { gap: 0.55 });
    },
  },
  {
    // 色块底部: Han title 2 lines (短长 / 长短) + EN 2 lines at 0.3×, a circled numeral (or a ring) closes the short line
    id: 'badge-close', zh: '闭合矩形', en: 'Closed rectangle', needs: ['title'], shape: 'square', tags: ['cover', 'promo'], wt: 1.3,
    gen: (g) => {
      const c = g.copy;
      const pb = pickBreak(g.r, c.title.t, ['short-long', 'long-short']);
      if (pb.lines.length !== 2) return null;
      const k = 4;
      const short = nChars(pb.lines[0]) < nChars(pb.lines[1]) ? 0 : 1;
      const f = filler(g, k);
      const lineRows: GNode[] = pb.lines.map((l, i) => (i === short && f ? row([lit(l, k, 'title', { w: 'black', track: -30 }), f], { gap: 0.4 * k, al: 'start' }) : lit(l, k, 'title', { w: 'black', track: -30 })));
      const s2 = second(c);
      return col([col(lineRows, { gap: 0.06 * k }), s2 ? lit(s2.t, k * 0.3, s2.slot, { w: 'bold', wrap: 30, max: 48 }) : T('sub', 1.2, { opt: true, wrap: 22, max: 48 })], { gap: 0.9 });
    },
  },
  {
    // 错位阶梯: lines stepped by 1–3 characters, the void after the short first line holds a micro stack or #N
    id: 'staircase', zh: '阶梯', en: 'Staircase', needs: ['title'], shape: 'wide', tags: ['rhythm'], wt: 1,
    gen: (g) => {
      const c = g.copy;
      const pb = pickBreak(g.r, c.title.t, ['short-long', 'equal', 'mid-long', 'balanced']);
      if (pb.lines.length < 2) return null;
      const k = 3.4, step = g.r.pick([1.2, 1.8, 2.4]) * k;
      const lines = pb.lines.map((l, i) => ({ ...lit(l, k, 'title', { w: titleW(g), track: -20 }), } as TextLeaf));
      const kids: GNode[] = lines.map((l, i) => (i === 0 ? row([l, filler(g, k)], { gap: 0.5 * k }) : { ...col([l]), dx: (i * step) / 1 }));
      const s2 = second(c);
      if (s2) kids.push({ ...col([lit(s2.t, 1.1, s2.slot, { w: 'medium', italic: true, max: 36 })]), dx: 0 });
      return col(kids, { gap: 0.05 * k });
    },
  },
  {
    // 数字锚: a giant number (thin or black, never medium) with a stack locked to its cap height
    id: 'number-lock', zh: '数字锚', en: 'Number + locked stack', needs: ['num'], shape: 'wide', tags: ['number'], wt: 1.4,
    gen: (g) => {
      const c = g.copy;
      const w = g.r.chance(0.5) ? 'black' : 'light';
      const stack: GNode[] = [lit(c.title.t, 1.6, 'title', { w: 'bold', lines: 2 })];
      const s2 = second(c);
      if (s2) stack.push(lit(s2.t, 1, s2.slot, { w: 'medium', case: 'upper', max: 26 }));
      else if (c.sub) stack.push(T('sub', 1, { max: 26 }));
      if (c.num?.unit) stack.unshift(T('num.unit', 1, { w: 'bold' }));
      const divider = g.r.chance(0.5);
      return row([T('num', 6, { w, track: -40, accent: g.r.chance(0.4) }), divider ? M('vrule', 4.2) : null, col(stack, { gap: 0.15, lock: true })], { gap: 0.8, al: 'start' });
    },
  },
  {
    // 时间组: date inline with micro year / weekday, or stacked with an arrow between
    id: 'date-group', zh: '时间组', en: 'Date group', needs: ['date'], shape: 'wide', tags: ['number'], wt: 1.2,
    gen: (g) => {
      const c = g.copy, d = c.dp;
      if (!d) return null;
      const big = 4.2;
      const day = (m: string, dd: string, wd?: string) => row([lit(`${m}.${dd}`, big, 'date', { w: g.r.chance(0.5) ? 'black' : 'light', track: -40 }), wd ? lit(wd, big * 0.26, undefined, { w: 'bold', dy: 0 }) : null], { gap: 0.15, al: 'start' });
      const stacked = g.r.chance(0.4) && d.m2;
      const range = d.m2 ? (stacked ? col([day(d.m, d.d, d.wd), M('arrow', big * 0.3), day(d.m2!, d.d2!, d.wd2)], { gap: 0.3 }) : row([day(d.m, d.d, d.wd), M('arrow', big * 0.32), day(d.m2!, d.d2!, d.wd2)], { gap: 0.6, al: 'center' })) : day(d.m, d.d, d.wd);
      return col([
        d.y ? lit(d.y, 1.1, undefined, { w: 'bold', track: 40 }) : null,
        range,
        d.time ? lit(d.time, 1.6, undefined, { w: 'medium' }) : null,
        lit(c.title.t, 1.8, 'title', { w: 'bold', lines: 2 }),
      ], { gap: 0.4 });
    },
  },
  {
    // 价格: ¥ small at the top, the integer, decimals small; label stack locked to the numeral
    id: 'price', zh: '价格', en: 'Price lockup', needs: ['num'], shape: 'wide', tags: ['number', 'promo'], wt: 0.8,
    gen: (g) => {
      const c = g.copy;
      if (!c.num || !/^[¥￥$€]$/.test(c.num.unit)) return null;
      const [int, dec] = c.num.v.split('.');
      return row([
        lit(c.num.unit, 1.6, 'num', { w: 'bold' }),
        lit(int, 6, 'num', { w: 'black', track: -40, accent: true }),
        dec ? lit('.' + dec, 2.4, 'num', { w: 'black' }) : null,
        col([lit(c.title.t, 1.4, 'title', { w: 'bold', lines: 2 }), T('sub', 1, { opt: true, max: 18 })], { gap: 0.15, lock: true }),
      ], { gap: 0.25, al: 'start' });
    },
  },
  {
    // 竖排: vertical Han title, a secondary column 0.35–0.5× beginning 1–2 characters lower, a rotated Latin spine
    id: 'vertical', zh: '竖排', en: 'Vertical columns', needs: ['title'], shape: 'tall', tags: ['vertical'], wt: 1.2,
    gen: (g) => {
      const c = g.copy;
      const cn = c.title.lang === 'zh' ? c.title.t : c.cn;
      if (!cn || nChars(cn) > 9) return null;
      const k = 3.4;
      const secondCol = c.sub && han(c.sub.t) && nChars(c.sub.t) <= 14 ? lit(c.sub.t, k * 0.42, 'sub', { dir: 'v', w: 'medium', lead: 1.05, dy: k * 1.2 }) : null;
      const spine = c.en && c.title.lang === 'zh' ? lit(c.en, 1, 'title.en', { dir: 'rot', case: 'upper', track: 200, w: 'medium', max: 30 }) : null;
      return row([spine, secondCol, lit(cn, k, c.title.lang === 'zh' ? 'title' : 'title.cn', { dir: 'v', w: titleW(g), lead: 1.04 })], { gap: 0.6, al: 'start' });
    },
  },
  {
    // 扁横向: title with a side note top-aligned to its cap line (a band)
    id: 'side-note', zh: '扁横向', en: 'Title + side note', needs: ['title'], shape: 'band', tags: ['flat'], wt: 1.1,
    gen: (g) => {
      const c = g.copy, s2 = second(c);
      const note: GNode[] = [];
      if (s2) note.push(lit(s2.t, 1.2, s2.slot, { w: 'bold', case: 'upper', max: 28 }));
      if (c.sub) note.push(T('sub', 1, { max: 40, wrap: 15 }));
      if (c.meta[0]) note.push(T('meta', 1, { idx: 0, max: 30 }));
      if (!note.length) return null;
      return row([lit(c.title.t, 4, 'title', { w: titleW(g), track: -30 }), col(note, { gap: 0.25 })], { gap: 1.2, al: g.r.chance(0.7) ? 'start' : 'end' });
    },
  },
  {
    // 括号组: the title in brackets / 「」 corners, the Latin under it after a slash
    id: 'bracketed', zh: '括号组', en: 'Bracketed', needs: ['title'], shape: 'wide', tags: ['frame'], wt: 0.8,
    gen: (g) => {
      const c = g.copy, s2 = second(c);
      const f = g.r.weighted({ bracket: 2, paren: 1, corner: 0.8 }) as 'bracket' | 'paren' | 'corner';
      return col([
        lit(c.title.t, 3, 'title', { w: titleW(g), lines: 2, track: -20 }),
        s2 ? row([M('slash', 1), lit(s2.t, 1, s2.slot, { case: 'upper', w: 'bold', max: 28 })], { gap: 0.3, al: 'center' }) : T('sub', 1, { opt: true, max: 30 }),
      ], { gap: 0.4, frame: { f, pad: 0.9 } });
    },
  },
  {
    // 总分: the title, then a row of 2–4 parallel items split by hairlines
    id: 'general-specific', zh: '总分', en: 'Title + items row', needs: ['title', 'item'], shape: 'wide', tags: ['list'], wt: 1,
    gen: (g) => {
      const c = g.copy;
      const items = c.items.slice(0, 4);
      if (items.length < 2) return null;
      const cells: GNode[] = [];
      items.forEach((it, i) => {
        if (i) cells.push(M('vrule', 2.6));
        cells.push(col([lit(it.main.t, 1.25, 'item', { idx: i, w: 'bold', max: 14 }), it.note ? lit(it.note.t, 1, 'item.note', { idx: i, max: 18 }) : null], { gap: 0.2 }));
      });
      const al = g.r.pick(['start', 'center'] as const);
      return col([lit(c.title.t, 3.4, 'title', { w: titleW(g), lines: 2, track: -20 }), T('sub', 1.3, { opt: true, max: 40 }), row(cells, { gap: 1, al: 'start' })], { gap: 1.1, al });
    },
  },
  {
    // 印章格: one Han character per filled circle in a 2×2 grid (playful), mono words around it
    id: 'stamp-grid', zh: '印章格', en: 'Stamp grid', needs: ['title'], shape: 'square', tags: ['playful'], wt: 0.5,
    gen: (g) => {
      const c = g.copy;
      const chars = Array.from(c.title.t.replace(/\s/g, ''));
      if (!han(c.title.t) || chars.length !== 4) return null;
      const disc = (ch: string) => row([lit(ch, 3, 'title', { w: 'bold' })], { frame: { f: 'disc', pad: 0.3, accent: true } });
      const s2 = second(c);
      return col([row([disc(chars[0]), disc(chars[1])], { gap: 0 }), row([disc(chars[2]), disc(chars[3])], { gap: 0 }), s2 ? lit(s2.t, 1, s2.slot, { case: 'upper', track: 120, max: 30 }) : null], { gap: 0.2 });
    },
  },
  {
    // 单轴: EN kicker → short dash → title → paragraph, one left edge
    id: 'single-axis', zh: '单轴', en: 'Single axis', needs: ['title'], shape: 'tall', tags: ['plain', 'swiss'], wt: 1,
    gen: (g) => {
      const c = g.copy, s2 = second(c);
      const lines = titleLines(g, ['one', 'short-long']);
      return col([
        s2 ? lit(s2.t, 1.2, s2.slot, { case: 'upper', w: 'medium', track: 40, wrap: 12, max: 40 }) : c.index ? lit(c.index, 1.2, undefined, { w: 'medium' }) : null,
        M('rule', 0.12, { len: 2.4, accent: true }),
        col(lineLeaves(lines, 3.4, { w: titleW(g), track: -20 }), { gap: 0 }),
        T('sub', 1.2, { opt: true, wrap: 16, max: 80 }),
      ], { gap: 0.9 });
    },
  },
  {
    // 拉丁短长: Latin in two lines, short then long, the long line justified; the Han echo after the short line
    id: 'latin-short-long', zh: '西文短长', en: 'Latin short-long', needs: ['title.en'], shape: 'wide', tags: ['latin'], wt: 1,
    gen: (g) => {
      const c = g.copy;
      const pb = pickBreak(g.r, c.en!, ['short-long']);
      if (pb.lines.length !== 2) return null;
      const lower = g.r.chance(0.6);
      const f = (s: string) => (lower ? s.toLowerCase() : s);
      return col([
        row([lit(f(pb.lines[0]), 5, 'title.en', { w: g.r.chance(0.5) ? 'regular' : 'bold', track: -20 }), c.cn && c.cn !== c.en ? lit(c.cn, 1.6, 'title.cn', { w: 'medium' }) : null], { gap: 1.2, al: 'base' }),
        lit(f(pb.lines[1]), 5, 'title.en', { fit: 'width', w: 'bold', track: -20 }),
        T('sub', 1, { opt: true, max: 40 }),
      ], { gap: 0.25 });
    },
  },
  // ---------------------------------------------------------------- from the designer's construction boards (constructions.md)
  {
    // T05 小大小夹心: EN caps label / tiny tagline / the TITLE in the accent / tiny credit / a separator glyph / tiny 2-line para
    id: 'sandwich', zh: '小大小夹心', en: 'Small-BIG-small', needs: ['title'], shape: 'square', tags: ['center', 'promo'], wt: 1,
    gen: (g) => {
      const c = g.copy, s2 = second(c);
      const tail = c.sub ?? c.meta[0] ?? null;
      return col([
        s2 ? lit(s2.t, 2.4, s2.slot, { case: 'upper', w: 'bold', max: 26 }) : c.index ? lit(c.index, 2.4, undefined, { w: 'bold' }) : null,
        c.year ? lit(c.year, 1, undefined, { track: 200, w: 'medium' }) : null,
        col(lineLeaves(titleLines(g, ['one', 'short-long']), 7, { w: 'black', track: -30, accent: g.r.chance(0.5) }), { gap: 0, al: 'center' }),
        tail ? lit(tail.t, 1, tail === c.sub ? 'sub' : 'meta', { case: 'upper', track: 120, w: 'medium', max: 30 }) : null,
        M(g.r.pick(['times', 'star'] as const), 2.2, { accent: true }),
        c.items[0] ? lit(c.items.slice(0, 2).map((i) => i.main.t).join(' · '), 1, undefined, { wrap: 18, max: 60 }) : null,
      ], { gap: 0.7, al: 'center' });
    },
  },
  {
    // T07 双线夹心: rule / title / rule / a spaced line stretched to the title's width (/ rule)
    id: 'rule-sandwich', zh: '双线夹心', en: 'Rule sandwich', needs: ['title'], shape: 'wide', tags: ['frame', 'justify'], wt: 1.1,
    gen: (g) => {
      const c = g.copy, s2 = second(c);
      const thick = g.r.chance(0.5) ? 0.3 : 0.08;
      const spaced = s2 ?? (c.sub ? { t: c.sub.t, slot: 'sub' as Slot } : null);
      return col([
        M('rule', thick, { len: 'fill' }),
        lit(c.title.t, 4.4, 'title', { w: titleW(g), track: -30, lines: 2 }),
        M('rule', thick, { len: 'fill' }),
        spaced && nChars(spaced.t) <= 22 ? lit(spaced.t, 1.3, spaced.slot, { fit: 'track', case: 'upper', w: 'medium' }) : null,
        c.date ? row([T('date', 1, { w: 'medium' }), M('rule', 0.06, { len: 'fill' }), T('meta', 1, { idx: 0, opt: true, max: 20 })], { fill: true, gap: 0.5, al: 'center' }) : null,
      ], { gap: 0.45 });
    },
  },
  {
    // T08 大数字主体: eyebrow / kicker / the NUMERAL (accent, tight) / sub / ↓ / —— label ——, centred
    id: 'numeral-hero', zh: '大数字主体', en: 'Numeral hero', needs: ['num'], shape: 'square', tags: ['number', 'promo'], wt: 1.1,
    gen: (g) => {
      const c = g.copy;
      return col([
        c.index ? lit(c.index, 1.2, undefined, { case: 'upper', track: 300, w: 'medium' }) : null,
        lit(c.title.t, 2.4, 'title', { w: 'bold', lines: 2 }),
        row([T('num', 9, { w: g.r.chance(0.5) ? 'black' : 'light', track: -40, accent: true }), c.num?.unit ? T('num.unit', 2.2, { w: 'bold' }) : null], { gap: 0.2, al: 'start' }),
        T('sub', 1.2, { opt: true, max: 30 }),
        M('arrow', 1.2),
        T('meta', 1, { idx: 0, opt: true, max: 24 }),
      ], { gap: 0.6, al: 'center' });
    },
  },
  {
    // T09 等高侧栏: a short BIG word with a 2–3 line stack locked to its cap height; an under-row as wide as both
    id: 'side-lock', zh: '等高侧栏', en: 'Cap-locked side stack', needs: ['title'], shape: 'wide', tags: ['plain', 'cover'], wt: 1.4,
    gen: (g) => {
      const c = g.copy, s2 = second(c);
      if (nChars(c.title.t) > (han(c.title.t) ? 4 : 9)) return null;
      const stack: GNode[] = [];
      if (s2) stack.push(lit(s2.t, 1.6, s2.slot, { w: 'bold', case: han(s2.t) ? undefined : 'upper', max: 22 }));
      if (c.sub) stack.push(T('sub', 1, { max: 26 }));
      if (c.date || c.year) stack.push(lit((c.date ?? c.year)!, 1, undefined, { w: 'medium' }));
      if (stack.length < 2) return null;
      const under = c.meta[0] ? T('meta', 1, { idx: 0, max: 40, fit: han(c.meta[0].t) ? 'track' : 'width' }) : null;
      return col([row([lit(c.title.t, 6, 'title', { w: 'black', track: -40 }), col(stack, { gap: 0.25, lock: true })], { gap: 1, al: 'start' }), under], { gap: 0.8 });
    },
  },
  {
    // T10 左右护翼: a centre title with small wings at both outer edges, locked to its cap height
    id: 'flank', zh: '左右护翼', en: 'Flanked centre', needs: ['title'], shape: 'band', tags: ['center', 'flat'], wt: 0.9,
    gen: (g) => {
      const c = g.copy, s2 = second(c);
      if (nChars(c.title.t) > (han(c.title.t) ? 6 : 14)) return null;
      const left = [c.year ? lit(c.year, 1.2, undefined, { w: 'bold' }) : null, c.date ? T('date', 1) : c.index ? lit(c.index, 1, undefined) : null].filter(Boolean) as GNode[];
      const right = [s2 ? lit(s2.t, 1.2, s2.slot, { w: 'bold', case: 'upper', max: 18 }) : null, c.meta[0] ? T('meta', 1, { idx: 0, max: 18 }) : null].filter(Boolean) as GNode[];
      if (!left.length || !right.length) return null;
      return row([col(left, { gap: 0.2, lock: true }), lit(c.title.t, 5, 'title', { w: titleW(g), track: -30 }), col(right, { gap: 0.2, lock: true, al: 'end' })], { gap: 1.1, al: 'start' });
    },
  },
  {
    // T11 两端双栏: the title block flush-left, a Latin / info block flush-right, shared top and bottom lines
    id: 'two-col', zh: '两端双栏', en: 'Two columns, both ends', needs: ['title'], shape: 'wide', tags: ['justify', 'flat'], wt: 1,
    gen: (g) => {
      const c = g.copy, s2 = second(c);
      const L = col([col(lineLeaves(titleLines(g, ['short-long', 'long-short', 'equal', 'balanced']), 3.6, { w: titleW(g), track: -30 }), { gap: 0 }), T('meta', 1, { idx: 0, opt: true, max: 26 })], { gap: 0.6 });
      const R = col([s2 ? lit(s2.t, 1.6, s2.slot, { w: 'bold', wrap: 9, max: 30, case: han(s2.t) ? undefined : 'upper' }) : null, T('sub', 1, { opt: true, wrap: 12, max: 48 }), c.date ? T('date', 1, { w: 'medium' }) : null], { gap: 0.5, al: 'end' });
      if (!R.kids.length) return null;
      return row([L, R], { gap: 3, al: 'start' });
    },
  },
  {
    // T12 中轴分栏: Han lines flush-right | a rule | Latin lines flush-left, shared baselines
    id: 'spine-split', zh: '中轴分栏', en: 'Spine split', needs: ['title.cn', 'title.en'], shape: 'square', tags: ['swiss'], wt: 0.9,
    gen: (g) => {
      const c = g.copy;
      const cl = pickBreak(g.r, c.cn!, ['short-long', 'equal', 'long-short']).lines;
      const el = c.en!.split(/\s+/);
      const en: string[] = []; const n = cl.length;
      for (let i = 0; i < n; i++) en.push(el.slice(Math.floor((i * el.length) / n), Math.floor(((i + 1) * el.length) / n)).join(' ') || '·');
      return row([col(cl.map((l) => lit(l, 3, 'title.cn', { w: 'bold', lead: 1 })), { gap: 0.15, al: 'end' }), M('vrule', 3 * n + 0.15 * (n - 1)), col(en.map((l) => lit(l, 3, 'title.en', { w: 'medium', lead: 1 })), { gap: 0.15, al: 'start' })], { gap: 0.6, al: 'start' });
    },
  },
  {
    // T14 标题段落同行: a one-line title with a small paragraph beside it, as tall as its cap
    id: 'title-para', zh: '标题段落同行', en: 'Title + paragraph', needs: ['title'], shape: 'band', tags: ['flat'], wt: 0.9,
    gen: (g) => {
      const c = g.copy;
      const p = c.para ?? c.sub;
      if (!p || nChars(p.t) < 18) return null;
      return row([lit(c.title.t, 5, 'title', { w: titleW(g), track: -30 }), col([lit(p.t, 1, c.para ? 'para' : 'sub', { wrap: 14, max: 120, w: 'medium', lead: 1.15 })], { lock: true })], { gap: 1.2, al: 'start' });
    },
  },
  {
    // T15 等宽下挂行: the title sets the width, a row of 2–3 cells spans it exactly underneath
    id: 'under-row', zh: '等宽下挂行', en: 'Justified under-row', needs: ['title'], shape: 'wide', tags: ['justify', 'swiss'], wt: 1.2,
    gen: (g) => {
      const c = g.copy, s2 = second(c);
      const cells: GNode[] = [];
      if (s2) cells.push(lit(s2.t, 1.2, s2.slot, { w: 'bold', wrap: 9, max: 26, case: han(s2.t) ? undefined : 'upper' }));
      if (c.date) cells.push(T('date', 1.2, { w: 'medium' }));
      if (c.meta[0]) cells.push(T('meta', 1, { idx: 0, wrap: 10, max: 30 }));
      else if (c.sub) cells.push(T('sub', 1, { wrap: 10, max: 36 }));
      if (cells.length < 2) return null;
      const sep = g.r.chance(0.5);
      const withSep: GNode[] = [];
      cells.forEach((x, i) => { if (i && sep) withSep.push(M('vrule', 2.2)); withSep.push(x); });
      return col([lit(c.title.t, 6, 'title', { w: titleW(g), track: -35, lines: 2, lead: 0.9 }), row(withSep, { fill: true, gap: 0.6, al: 'start' })], { gap: 0.35 });
    },
  },
  {
    // T16 票据框: corner labels / rule / the content row / rule / corner labels
    id: 'ticket', zh: '票据框', en: 'Ticket frame', needs: ['title'], shape: 'wide', tags: ['frame', 'number'], wt: 0.9,
    gen: (g) => {
      const c = g.copy, s2 = second(c);
      const topL = c.index ?? c.year, topR = c.date ?? c.meta[0]?.t;
      if (!topL || !topR) return null;
      return col([
        row([lit(topL, 1, undefined, { w: 'medium', case: 'upper' }), lit(topR, 1, topR === c.date ? 'date' : 'meta', { w: 'medium' })], { fill: true }),
        M('rule', 0.07, { len: 'fill' }),
        lit(c.title.t, 4.6, 'title', { w: titleW(g), track: -30, lines: 2 }),
        M('rule', 0.07, { len: 'fill' }),
        row([s2 ? lit(s2.t, 1, s2.slot, { case: 'upper', w: 'bold', max: 24 }) : T('sub', 1, { opt: true, max: 24 }), T('meta', 1, { idx: c.meta[0]?.t === topR ? 1 : 0, opt: true, max: 24 })], { fill: true }),
      ], { gap: 0.35 });
    },
  },
  {
    // T17 规线补齐: short rows reach the governing width with a rule
    id: 'rule-fill', zh: '规线补齐', en: 'Rule-filled rows', needs: ['title'], shape: 'wide', tags: ['rhythm', 'justify'], wt: 1,
    gen: (g) => {
      const c = g.copy, s2 = second(c);
      const top = c.year ?? c.index;
      return col([
        top ? row([lit(top, 1.4, undefined, { w: 'bold' }), M('rule', 0.1, { len: 'fill', accent: true })], { fill: true, gap: 0.5, al: 'center' }) : null,
        lit(c.title.t, 5, 'title', { w: titleW(g), track: -30 }),
        s2 ? row([M('rule', 0.1, { len: 'fill' }), lit(s2.t, 1.6, s2.slot, { italic: true, w: 'medium', max: 26 })], { fill: true, gap: 0.5, al: 'center' }) : T('sub', 1.2, { opt: true, max: 30 }),
      ], { gap: 0.4 });
    },
  },
  {
    // T31 拆字撑宽: the title's two halves pushed to the edges, a tiny line centred between them
    id: 'split-spread', zh: '拆字撑宽', en: 'Split spread', needs: ['title'], shape: 'band', tags: ['justify', 'flat'], wt: 0.7,
    gen: (g) => {
      const c = g.copy, s2 = second(c);
      const t = c.title.t.replace(/\s/g, '');
      if (!han(c.title.t) || ![2, 4].includes(Array.from(t).length) || !s2) return null;
      const h = Array.from(t).length / 2;
      return row([lit(Array.from(t).slice(0, h).join(''), 5, 'title', { w: 'black' }), lit(s2.t, 1, s2.slot, { case: 'upper', track: 300, w: 'medium', max: 22 }), lit(Array.from(t).slice(h).join(''), 5, 'title', { w: 'black' })], { gap: 1.4, al: 'center' });
    },
  },
  {
    // T32 单行串联: one line of items joined by separator glyphs, on one baseline
    id: 'inline-chain', zh: '单行串联', en: 'Inline chain', needs: ['title'], shape: 'band', tags: ['flat', 'rhythm'], wt: 0.8,
    gen: (g) => {
      const c = g.copy;
      const parts: GNode[] = [];
      const sep = (): GNode => M(g.r.pick(['times', 'dot', 'slash'] as const), 0.9, { accent: true });
      if (c.year) parts.push(lit(c.year, 2, undefined, { w: 'bold' }), sep());
      parts.push(lit(c.title.t, 2, 'title', { w: 'black' }));
      if (c.date) parts.push(sep(), T('date', 2, { w: 'bold' }));
      else if (c.meta[0] && nChars(c.meta[0].t) <= 10) parts.push(sep(), T('meta', 2, { idx: 0, w: 'bold' }));
      if (parts.length < 3) return null;
      return col([row(parts, { gap: 0.5, al: 'center' }), T('sub', 1, { opt: true, max: 40 })], { gap: 0.5 });
    },
  },
  {
    // T25 徽标压顶: an emblem (ring + dot) above a centred stack, a spaced line under it
    id: 'emblem', zh: '徽标压顶', en: 'Emblem over text', needs: ['title'], shape: 'square', tags: ['center'], wt: 0.8,
    gen: (g) => {
      const c = g.copy, s2 = second(c);
      return col([
        row([M('dot', 1.1, { accent: true })], { frame: { f: 'circle', pad: 1.4 } }),
        col(lineLeaves(titleLines(g, ['one', 'short-long', 'mid-long']), 4, { w: titleW(g), track: -25 }), { gap: 0, al: 'center' }),
        s2 ? lit(s2.t, 1, s2.slot, { case: 'upper', track: 260, w: 'medium', max: 24 }) : T('sub', 1.1, { opt: true, max: 30 }),
      ], { gap: 0.9, al: 'center' });
    },
  },
  {
    // T34 四角卫星: a big 2-line logotype with tiny satellites pinned to its four corners
    id: 'corner-sat', zh: '四角卫星', en: 'Corner satellites', needs: ['title'], shape: 'square', tags: ['cover'], wt: 0.9,
    gen: (g) => {
      const c = g.copy, s2 = second(c);
      const tl = c.year ?? c.index, tr = s2?.t, bl = c.meta[0]?.t, br = c.date ?? c.items[0]?.main.t;
      if ([tl, tr, bl, br].filter(Boolean).length < 3) return null;
      const tiny = (t: string | null | undefined, of?: Slot) => (t ? lit(t, 1, of, { w: 'medium', max: 22, case: han(t) ? undefined : 'upper' }) : M('dot', 0.8, { accent: true }));
      return col([
        row([tiny(tl), tiny(tr, s2?.slot)], { fill: true }),
        col(lineLeaves(titleLines(g, ['short-long', 'equal', 'balanced', 'one']), 6, { w: 'black', track: -35, lead: 0.9 }), { gap: 0 }),
        row([tiny(bl, 'meta'), tiny(br, c.date ? 'date' : 'item')], { fill: true }),
      ], { gap: 0.3 });
    },
  },
];

/** the construction's tree for this copy (static root, or generated) */
export function instantiate(c: Construction, g: GenIn): Construction | null {
  const root = c.gen ? c.gen(g) : c.root;
  return root ? { ...c, root } : null;
}
export const byId = (id: string) => LIBRARY.find((c) => c.id === id);
