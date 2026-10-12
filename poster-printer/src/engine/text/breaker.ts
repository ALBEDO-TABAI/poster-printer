// CJK-aware line breaking with basic kinsoku (禁则) rules.
export const CJK_RE = /[\u2e80-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;
const NO_START = new Set('，。、；：？！）」』》〉】〕…—·・％,.;:?!)]}%”’'.split(''));
const NO_END = new Set('（「『《〈【〔“‘([{'.split(''));

export const hasCJK = (s: string) => CJK_RE.test(s);
export const isCJKChar = (c: string) => CJK_RE.test(c);

/** Break text into unbreakable tokens; each token carries whether a space precedes it. */
export function tokenize(text: string): { t: string; sp: boolean }[] {
  const out: { t: string; sp: boolean }[] = [];
  let buf = '';
  let pendingSpace = false;
  const flush = () => { if (buf) { out.push({ t: buf, sp: pendingSpace }); pendingSpace = false; buf = ''; } };
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === ' ' || c === '\t') { flush(); pendingSpace = out.length > 0; continue; }
    if (isCJKChar(c)) {
      if (NO_START.has(c)) {
        // attach to previous token
        if (buf) { buf += c; continue; }
        if (out.length && !pendingSpace) { out[out.length - 1].t += c; continue; }
        buf += c; continue;
      }
      flush();
      buf = c;
      if (NO_END.has(c)) continue; // keep buf open: next char attaches
      // look ahead: closing punct attaches
      continue;
    }
    // latin / digit / other
    if (buf && isCJKChar(Array.from(buf).pop()!) && !NO_END.has(Array.from(buf).pop()!)) flush();
    buf += c;
  }
  flush();
  // merge tokens where NO_END char ended a token
  const merged: { t: string; sp: boolean }[] = [];
  for (const tk of out) {
    const prev = merged[merged.length - 1];
    if (prev && NO_END.has(Array.from(prev.t).pop()!) && !tk.sp) prev.t += tk.t;
    else if (prev && NO_START.has(Array.from(tk.t)[0]) && !tk.sp) prev.t += tk.t;
    else merged.push({ ...tk });
  }
  return bindNumbers(protect(merged));
}

/** separators that must end a line, never start one (' · ', ' / ', ' — ') */
const SEPS = new Set(['·', '・', '/', '|', '—', '–', '-', '×', '•']);
/**
 * Phase 8: short closed units are unbreakable. A run of tokens written without spaces that holds ≤ 4 Han characters
 * and ≤ 8 characters in all is a name, a venue, a date or a price (林知远, 西岸滨江, 10月18日, ¥899起) and never
 * splits; longer Han runs (titles, prose) keep breaking per character. A lone separator joins the line before it.
 */
function protect(toks: { t: string; sp: boolean }[]): { t: string; sp: boolean }[] {
  const words: { t: string; sp: boolean }[][] = [];
  for (const tk of toks) { if (!words.length || tk.sp) words.push([tk]); else words[words.length - 1].push(tk); }
  const out: { t: string; sp: boolean }[] = [];
  for (const w of words) {
    const txt = w.map((x) => x.t).join('');
    const ch = Array.from(txt);
    const han = ch.filter((c) => /[\u3400-\u9fff\uf900-\ufaff]/.test(c)).length;
    if (w.length === 1 && SEPS.has(txt) && out.length) { out[out.length - 1].t += ' ' + txt; continue; }
    if (w.length > 1 && han >= 1 && han <= 4 && ch.length <= 8) out.push({ t: txt, sp: w[0].sp });
    else out.push(...w);
  }
  // segments between separators (Talk · Lin Zhiyuan · Hall B): a short Latin segment is one unit (a name, a room)
  if (!out.some((t) => SEPS.has(t.t.slice(-1)) && t.t.endsWith(' ' + t.t.slice(-1)))) return out;
  const res: { t: string; sp: boolean }[] = [];
  let seg: { t: string; sp: boolean }[] = [];
  const flushSeg = () => {
    const txt = seg.map((x, i) => (i && x.sp ? ' ' : '') + x.t).join('');
    if (seg.length > 1 && seg.length <= 3 && txt.length <= 18 && !/[\u3400-\u9fff]/.test(txt)) res.push({ t: txt, sp: seg[0].sp });
    else res.push(...seg);
    seg = [];
  };
  for (const t of out) { seg.push(t); if (SEPS.has(t.t.slice(-1)) && t.t.endsWith(' ' + t.t.slice(-1))) flushSeg(); }
  flushSeg();
  return res;
}

/** a number group: 01, 2026, 7:30, 03.14, 2/6, 18%, ¥899 */
export const NUM_GROUP = /^[#№¥$€£]?[\d０-９][\d０-９.,:：/%°]*$/;
/**
 * Phase 12: a short number never starts a line on its own. "Track 01", "No. 7", "Sheet 2/6", "03.14 — 06.30": the
 * number is bound to the word (or the separator + number) before it, so the breaker cannot strand it.
 */
function bindNumbers(toks: { t: string; sp: boolean }[]): { t: string; sp: boolean }[] {
  const out: { t: string; sp: boolean }[] = [];
  for (const tk of toks) {
    const prev = out[out.length - 1];
    if (prev && tk.sp && NUM_GROUP.test(tk.t) && Array.from(tk.t).length <= 6 && Array.from(prev.t).length <= 14) { prev.t += ' ' + tk.t; continue; }
    // a one- or two-letter word (Side B, Exit B) and a short unit after a number (3 Min, 7 PM, 30 km) ride along too
    if (prev && tk.sp && /^[A-Za-z]{1,2}[.]?$/.test(tk.t) && !/^(a|I|an|of|to|in|on|at|by|or|as|is|my)$/i.test(tk.t) && Array.from(prev.t).length <= 14) { prev.t += ' ' + tk.t; continue; }
    if (prev && tk.sp && /(^|\s)[\d０-９][\d０-９.,:：/%°]*$/.test(prev.t) && /^[A-Za-z]{1,4}[.]?$/.test(tk.t) && Array.from(prev.t).length <= 12) { prev.t += ' ' + tk.t; continue; }
    out.push({ ...tk });
  }
  return out;
}

export type WidthFn = (s: string) => number;

const HAN_RE = /[\u3400-\u9fff\uf900-\ufaff]/g;
/**
 * Phase 12: is this block's last line a widow / orphan? A lone number group, a final line with < 2 Han characters, or
 * a final single short Latin word (≤ 5 letters, or narrower than 35 % of the widest line). Explicit line breaks are the
 * author's and never count.
 */
export function widowKind(lines: string[], lang: 'zh' | 'en', width?: WidthFn): 'number' | 'zh-short' | 'en-short' | null {
  if (lines.length < 2) return null;
  for (const l of lines) if (NUM_GROUP.test(l.trim())) return 'number';
  const s = lines[lines.length - 1].trim();
  const han = (s.match(HAN_RE) || []).length;
  if (lang === 'zh' && han > 0 && han < 2 && Array.from(s.replace(/[\s\u2005]/g, '')).length <= 2) return 'zh-short';
  if (lang === 'en' && !/\s/.test(s) && /^[A-Za-z’'\-]+[.,!?]?$/.test(s)) {
    // a one-word-per-line stack (Print / Room) is balanced, not widowed; it only counts when the last word is a stub
    const stack = lines.every((l) => !/\s/.test(l.trim()));
    const wm = width ? Math.max(...lines.map(width)) : 0;
    if (!stack && s.length <= 5) return 'en-short';
    if (width && width(s) < (stack ? 0.35 : 0.4) * wm) return 'en-short';
  }
  return null;
}

/** CJK punctuation allowed to hang past the right edge of the measure (ぶら下げ / 标点悬挂). */
export const HANGING = new Set('，。、,.'.split(''));
/** Full-width punctuation whose glyph carries half an em of built-in space (compressible). */
export const COMPRESSIBLE_OPEN = new Set('（「『《〈【〔“‘'.split(''));
export const COMPRESSIBLE_CLOSE = new Set('，。、；：）」』》〉】〕”’'.split(''));

const joinToks = (toks: { t: string; sp: boolean }[]) => toks.map((t, i) => (i > 0 && t.sp ? ' ' : '') + t.t).join('');
/** width of a line, letting one trailing CJK comma/full stop hang outside the measure */
function fitWidth(line: string, width: WidthFn, hang: boolean) {
  const last = line[line.length - 1];
  return hang && last && HANGING.has(last) && isCJKChar(last) ? width(line.slice(0, -1)) : width(line);
}
const isWidow = (toks: { t: string; sp: boolean }[]) => toks.length === 1 && (isCJKChar(toks[0].t[0]) ? Array.from(toks[0].t).filter((c) => !NO_START.has(c)).length <= 1 : true);

/** Greedy line fill. Explicit \n respected. Hanging punctuation and widow/orphan avoidance (opt-out via opts). */
/** effective CJK characters of a line (punctuation does not count) */
const cjkCount = (toks: { t: string }[]) => toks.reduce((s, t) => s + Array.from(t.t).filter((c) => isCJKChar(c) && !NO_START.has(c) && !NO_END.has(c)).length, 0);

export function breakLines(text: string, maxW: number, width: WidthFn, opts: { hang?: boolean; widows?: boolean; minLast?: number } = {}): string[] {
  const hang = opts.hang !== false, widows = opts.widows !== false;
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    const toks = tokenize(para);
    const tl: { t: string; sp: boolean }[][] = [];
    let cur: { t: string; sp: boolean }[] = [];
    for (const tk of toks) {
      const cand = [...cur, tk];
      if (!cur.length || fitWidth(joinToks(cand), width, hang) <= maxW) cur = cand;
      else { tl.push(cur); cur = [tk]; }
    }
    tl.push(cur);
    // widow: a lone word (or single CJK character) on the last line pulls the previous line's last token down
    if (widows && tl.length >= 2) {
      const last = tl[tl.length - 1], prev = tl[tl.length - 2];
      if (isWidow(last) && prev.length >= 3) {
        const moved = [prev[prev.length - 1], ...last];
        if (fitWidth(joinToks(moved), width, hang) <= maxW) { tl[tl.length - 2] = prev.slice(0, -1); tl[tl.length - 1] = moved; }
      }
      // CJK orphans (SPEC §15.7): the last line keeps ≥ minLast characters (3 for headlines and quotes, 2 for body)
      const minLast = opts.minLast ?? 2;
      for (let guard = 0; guard < 4; guard++) {
        const L = tl[tl.length - 1], P = tl[tl.length - 2];
        const lc = cjkCount(L);
        if (!lc || lc >= minLast || P.length < 2 || cjkCount(P.slice(0, -1)) < minLast) break;
        const moved = [P[P.length - 1], ...L];
        if (fitWidth(joinToks(moved), width, hang) > maxW) break;
        tl[tl.length - 2] = P.slice(0, -1); tl[tl.length - 1] = moved;
      }
    }
    for (const l of tl) lines.push(joinToks(l));
  }
  return lines;
}

/** Balanced breaking: same line count as greedy but minimize the longest line. */
export function breakBalanced(text: string, maxW: number, width: WidthFn, opts: { minLast?: number } = {}): string[] {
  const greedy = breakLines(text, maxW, width, opts);
  if (greedy.length <= 1) return greedy;
  let lo = 0, hi = maxW, best = greedy;
  const n = greedy.length;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const ls = breakLines(text, mid, width, opts);
    if (ls.length <= n && ls.every((l) => width(l) <= maxW)) { best = ls; hi = mid; } else lo = mid;
  }
  return best;
}

/** One phrase per line where possible: split on words, then group to reach a target count. */
export function breakWords(text: string, targetLines: number, width: WidthFn): string[] {
  if (text.includes('\n')) return text.split('\n');
  const toks = tokenize(text);
  if (toks.length <= targetLines) return toks.map((t) => t.t);
  // optimal partition into exactly `targetLines` lines minimising the widest line (DP over token boundaries)
  const n = toks.length, k = targetLines;
  const join = (a: number, b: number) => toks.slice(a, b).map((t, i) => (i > 0 && t.sp ? ' ' : '') + t.t).join('');
  const wcache = new Map<number, number>();
  const lw = (a: number, b: number) => { const key = a * 1000 + b; let v = wcache.get(key); if (v === undefined) { v = width(join(a, b)); wcache.set(key, v); } return v; };
  const best: number[][] = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(Infinity));
  const cut: number[][] = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(0));
  best[0][0] = 0;
  for (let l = 1; l <= k; l++) for (let j = l; j <= n; j++) for (let i = l - 1; i < j; i++) {
    const v = Math.max(best[l - 1][i], lw(i, j));
    if (v < best[l][j]) { best[l][j] = v; cut[l][j] = i; }
  }
  const lines: string[] = [];
  let j = n;
  for (let l = k; l >= 1; l--) { const i = cut[l][j]; lines.unshift(join(i, j)); j = i; }
  return lines;
}

/** 1/4 em between Han and Latin letters / digits that touch (SPEC §15.6); existing spaces are kept. */
export const HAN_LATIN_GAP = '\u2005';
export function spaceHanLatin(s: string): string {
  return s.replace(/([\u3400-\u9fff])(?=[A-Za-z0-9])/g, `$1${HAN_LATIN_GAP}`).replace(/([A-Za-z0-9%])(?=[\u3400-\u9fff])/g, `$1${HAN_LATIN_GAP}`);
}
