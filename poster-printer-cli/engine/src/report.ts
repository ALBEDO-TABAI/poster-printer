// Evaluation report: CORRECTNESS gates (pass / fail / n/a, measured) kept apart from AESTHETIC dimensions.
// Every issue carries dimension + region (bbox in poster px) + evidence + impact + a concrete fix.
// Scores here are relative, model- and heuristic-based; they need human calibration (see SKILL.md).
import type { Scene, SceneNode, TextNode, ImageNode } from '@rea/engine/types';
import { imageDrawRect } from '@rea/engine/render/svg';
import type { Entry } from './core';
import { DEFAULT_PARAMS } from '@rea/engine/params';
import { designAudit } from '@rea/engine/gen/audit';
import { gates as measureGates } from '@rea/engine/aesthetic/gates';
import { harmonyScore } from '@rea/engine/color/harmony';
import type { ImageAsset } from '@rea/engine/gen/ctx';
import type { Brief, BriefContext } from './brief';
import { analyze, parseDate, normItem, normPerson, hanCount, type DateFact } from './analyze';

export type Status = 'pass' | 'fail' | 'n/a';
export type Impact = 'legibility' | 'finding-info' | 'expression' | 'craft';
export type Box = [number, number, number, number];
export interface Issue { id: string; gate?: string; dimension: string; blocking: boolean; region: Box | null; evidence: string; impact: Impact[]; fix: { command: string | null; why: string } }
export interface Pixels { w: number; h: number; data: Uint8Array | Uint8ClampedArray }

// ───────────────────────────────────────── display condition
const PRINT_MM: Record<string, [number, number]> = { A0: [841, 1189], A1: [594, 841], A2: [420, 594], A3: [297, 420], A4: [210, 297], A5: [148, 210] };
const PRINT_DIST: Record<string, number> = { A0: 2, A1: 1.5, A2: 1, A3: 0.7, A4: 0.5, A5: 0.4 };
export interface DisplayModel { kind: string; cssPerPx: number; minInfoCss: number; heroOnly: boolean; note: string }
/** CSS px per poster px at the target display. Print uses the CSS reference pixel: 0.2646 mm seen from 0.71 m. */
export function displayModel(d: BriefContext['display'] | undefined, W: number, H: number): DisplayModel {
  const kind = d?.kind ?? 'screen';
  if (kind === 'phone-thumbnail') { const w = d?.width_px ?? 180; return { kind, cssPerPx: w / W, minInfoCss: 12, heroOnly: true, note: `phone feed thumbnail ${w} CSS px wide: only the title must read (≥12 CSS px)` }; }
  if (kind === 'phone') { const s = d?.width_px ? d.width_px / W : Math.min(390 / W, 760 / H); return { kind, cssPerPx: s, minInfoCss: 9, heroOnly: false, note: `phone full screen (fit 390×760 CSS px${d?.width_px ? `, width ${d.width_px}` : ''}), info text ≥ 9 CSS px` }; }
  if (kind === 'print') {
    const ps = (d?.print_size ?? 'A2').toUpperCase();
    let mm = PRINT_MM[ps]; let dist = d?.viewing_distance_m ?? PRINT_DIST[ps] ?? 1;
    if (!mm) { const m = ps.match(/([\d.]+)\s*[X×]\s*([\d.]+)/); mm = m ? [+m[1], +m[2]] : PRINT_MM.A2; if (!d?.viewing_distance_m) dist = Math.max(0.5, Math.max(...mm) / 600); }
    const mmPerPx = Math.max(...mm) / Math.max(W, H);
    return { kind, cssPerPx: (mmPerPx / 0.2646) * (0.71 / dist), minInfoCss: 9, heroOnly: false, note: `print ${ps} (${Math.min(...mm)}×${Math.max(...mm)} mm) seen from ${dist} m; sizes as CSS-px equivalents (0.2646 mm at 0.71 m), info text ≥ 9` };
  }
  const s = d?.width_px ? d.width_px / W : Math.min(1920 / W, 1000 / H);
  return { kind: 'screen', cssPerPx: s, minInfoCss: 9, heroOnly: false, note: `full screen (fit 1920×1000 CSS px${d?.width_px ? `, width ${d.width_px}` : ''}), info text ≥ 9 CSS px` };
}

// ───────────────────────────────────────── helpers
const r1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (v: number, a = 0, b = 10) => Math.max(a, Math.min(b, v));
const boxOf = (t: TextNode): Box => [Math.round(t.box.x), Math.round(t.box.y), Math.round(t.box.w), Math.round(t.box.h)];
const inter = (a: TextNode['box'], b: { x: number; y: number; w: number; h: number }) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const norm = (s: string) => s.normalize('NFKC').replace(/[\s\u200b]+/g, '').replace(/[·•・]/g, '·').replace(/[—–-]/g, '-').toLowerCase();
const normCase = (s: string) => s.normalize('NFKC').replace(/[\s\u200b]+/g, '').replace(/[·•・]/g, '·').replace(/[—–-]/g, '-');
const hex = (c: string) => /^#[0-9a-f]{6}$/i.test(c) ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : /^#[0-9a-f]{3}$/i.test(c) ? [1, 2, 3].map((i) => parseInt(c[i] + c[i], 16)) : null;
const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const relLum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const lineText = (t: TextNode) => t.lines.map((l) => l.text).join('\n');
function flatten(ns: SceneNode[], out: SceneNode[] = []): SceneNode[] { for (const n of ns) { if (n.kind === 'group') flatten(n.children, out); else out.push(n); } return out; }
const isDecorative = (t: TextNode) => t.role === 'anchor' || t.role === 'glyph' || (t.opacity ?? 1) < 0.5 || t.layer === 'zones' || t.layer === 'shapes' || t.layer === 'noise' || t.layer === 'texture' || !!t.clip || t.fill === 'none' || String(t.fill).startsWith('lg(');

const START_BAN = new Set([...'，。、；：？！）》」』】〕〉〗’”…‥—～·％‰,.;:?!)]}、ーぁぃぅぇぉっゃゅょァィゥェォッャュョ']);
const END_BAN = new Set([...'（《「『【〔〈〖‘“([{']);

// ───────────────────────────────────────── expected content
interface Expect { field: string; label: string; required: boolean; variants: string[]; kind: 'text' | 'date' | 'time' }
const pad = (n: number) => String(n).padStart(2, '0');
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
function dateVariants(d: DateFact): string[] {
  const { y, m, d: dd } = d;
  return [`${y}.${pad(m)}.${pad(dd)}`, `${y}-${pad(m)}-${pad(dd)}`, `${y}/${pad(m)}/${pad(dd)}`, `${y}年${m}月${dd}日`, `${m}月${dd}日`, `${pad(m)}.${pad(dd)}`, `${m}.${dd}`, `${pad(m)}/${pad(dd)}`, `${pad(dd)} ${MON[m - 1]}`, `${dd} ${MON[m - 1]}`, `${MON[m - 1]} ${pad(dd)}`, `${MON[m - 1]} ${dd}`, `${MON[m - 1]}. ${dd}`];
}
export function expectedContent(brief: Brief): Expect[] {
  const a = analyze(brief); const c = brief.content;
  const bil = a.lang.overall === 'bilingual';
  const pri = (brief.context?.priority ?? []).filter((k) => k in c);
  const req = new Set<string>(pri.length ? pri.slice(0, 4) : ['title', ...(bil && c.title_alt ? ['title_alt'] : []), ...(c.date ? ['date'] : []), ...(c.venue ? ['venue'] : [])]);
  req.add('title'); for (const k of brief.constraints?.must_show ?? []) req.add(k);
  const out: Expect[] = [];
  const T = (field: string, s: string | undefined, label = field) => { if (s && s.trim()) out.push({ field, label, required: req.has(field), variants: [s.trim()], kind: 'text' }); };
  T('title', c.title); T('title_alt', c.title_alt); T('subtitle', c.subtitle); T('slogan', c.slogan);
  const d = parseDate(c.date);
  if (c.date) {
    out.push({ field: 'date', label: 'date', required: req.has('date'), variants: d ? dateVariants(d) : [c.date], kind: 'date' });
    if (d?.hh !== undefined) out.push({ field: 'date', label: 'date (time)', required: req.has('date') || req.has('time'), variants: [`${pad(d.hh)}:${pad(d.mm ?? 0)}`, `${d.hh}:${pad(d.mm ?? 0)}`], kind: 'time' });
  }
  if (c.date_end) { const e = parseDate(c.date_end, d?.y); out.push({ field: 'date_end', label: 'date_end', required: req.has('date_end') || (req.has('date') && !!e), variants: e ? dateVariants(e) : [c.date_end], kind: 'date' }); }
  T('time', c.time); T('venue', c.venue); T('address', c.address); T('city', c.city); T('price', c.price); T('ticket', c.ticket); T('url', c.url); T('edition', c.edition);
  (c.program ?? []).map(normItem).forEach((it, i) => { if (it.title) out.push({ field: 'program', label: `program[${i}] ${it.title}`, required: req.has('program'), variants: [it.title], kind: 'text' }); if (it.time) out.push({ field: 'program', label: `program[${i}] time`, required: req.has('program'), variants: [it.time], kind: 'time' }); });
  (c.speakers ?? []).map(normPerson).forEach((it, i) => { if (it.title) out.push({ field: 'speakers', label: `speakers[${i}] ${it.title}`, required: req.has('speakers'), variants: [it.title], kind: 'text' }); });
  (c.organizers ?? []).forEach((o, i) => T('organizers', o, `organizers[${i}]`));
  (c.hashtags ?? []).forEach((o, i) => T('hashtags', o, `hashtags[${i}]`));
  T('body', c.body);
  return out;
}

// ───────────────────────────────────────── slots (for --text fixes)
function slotMap(e: Entry): { slot: string; text: string }[] {
  const t = (e.picked as any)?.texts; if (!t) return [];
  const out: { slot: string; text: string }[] = [];
  for (const k of ['headline', 'sub', 'note']) if (t[k]?.t) out.push({ slot: k, text: t[k].t });
  (t.groups ?? []).forEach((g: any, i: number) => { for (const k of ['main', 'sub', 'note']) if (g?.[k]?.t) out.push({ slot: `groups.${i}.${k}`, text: g[k].t }); });
  for (const k of ['prose', 'meta', 'words']) (t[k] ?? []).forEach((x: any, i: number) => { if (x?.t) out.push({ slot: `${k}.${i}`, text: x.t }); });
  return out;
}
const q = (s: string) => JSON.stringify(s);

// ───────────────────────────────────────── contrast (pixel-sampled)
function sampleContrast(t: TextNode, px: Pixels | null, W: number, H: number): { ratio: number | null; typical?: number; overImage?: boolean; why?: string } {
  if (!px) return { ratio: null, why: 'no raster available' };
  const f = hex(String(t.fill)); if (!f) return { ratio: null, why: `fill ${t.fill} is not a flat colour` };
  const sx = px.w / W;
  const x0 = Math.max(0, Math.floor(t.box.x * sx)), y0 = Math.max(0, Math.floor(t.box.y * sx));
  const x1 = Math.min(px.w, Math.ceil((t.box.x + t.box.w) * sx)), y1 = Math.min(px.h, Math.ceil((t.box.y + t.box.h) * sx));
  if (x1 - x0 < 2 || y1 - y0 < 2) return { ratio: null, why: 'text box outside the canvas' };
  const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 6000)));
  const bg: number[][] = [];
  for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) {
    const i = (y * px.w + x) * 4; const r = px.data[i], g = px.data[i + 1], b = px.data[i + 2];
    if (Math.hypot(r - f[0], g - f[1], b - f[2]) < 60) continue;
    bg.push([r, g, b]);
  }
  if (bg.length < 12) return { ratio: null, why: 'no background visible inside the text box' };
  const op = t.opacity ?? 1;
  const med = [0, 1, 2].map((k) => bg.map((p) => p[k]).sort((a, b) => a - b)[bg.length >> 1]);
  const ink = op < 0.95 ? f.map((v, k) => v * op + med[k] * (1 - op)) : f;
  const Lf = relLum(ink[0], ink[1], ink[2]);
  const rs = bg.map((p) => ratio(relLum(p[0], p[1], p[2]), Lf)).sort((a, b) => a - b);
  // drop the 35 % of samples closest to the ink (anti-aliased glyph edges), take the next as the worst case
  const worst = rs[Math.floor(rs.length * 0.35)]; const typical = rs[rs.length >> 1];
  return { ratio: Math.round(worst * 100) / 100, typical: Math.round(typical * 100) / 100, overImage: rs[rs.length - 1] / rs[0] > 1.8 };
}

// ───────────────────────────────────────── main
export interface EvalArgs { scene: Scene; entry: Entry; brief?: Brief | null; pixels?: Pixels | null; images: ImageAsset[]; summary?: { taste: number; penalty: number; score: number } }
export function evaluate(a: EvalArgs) {
  const { scene: sc, entry: e } = a; const W = sc.w, H = sc.h;
  const P = { ...DEFAULT_PARAMS, ...e.params } as Record<string, any>;
  const disp = displayModel(a.brief?.context?.display, W, H);
  const all = flatten(sc.nodes);
  const texts = all.filter((n): n is TextNode => n.kind === 'text' && !!n.raw && !!n.lines?.length && n.layer !== 'noise' && n.layer !== 'texture');
  const content = texts.filter((t) => !isDecorative(t));
  const slots = slotMap(e);
  const slotOf = (t: TextNode) => slots.find((s) => norm(s.text) === norm(t.raw))?.slot ?? slots.find((s) => norm(t.raw).includes(norm(s.text)) && s.text.length > 1)?.slot;
  const issues: Issue[] = []; let nIssue = 0;
  const add = (x: Omit<Issue, 'id'>) => { issues.push({ id: `i${++nIssue}`, ...x }); };
  const largeCss = (t: TextNode) => { const css = t.size * disp.cssPerPx; return css >= 24 || (css >= 18.66 && t.weight >= 700); };
  const scaleKey = (t: TextNode) => (t.role.startsWith('big') ? 'titleScale' : t.layer === 'sidebar' ? 'sidebarFont' : t.layer === 'ornament' ? null : 'smallScale');

  // ── per-node render validity: inside canvas, not clipped, not truncated, not overlapped / covered
  const order = new Map(all.map((n, i) => [n, i] as [SceneNode, number]));
  const validity = new Map<TextNode, { ok: boolean; problems: string[] }>();
  for (const t of texts) {
    const p: string[] = []; const b = t.box; const m = t.size * 0.08;
    if (b.x < -m || b.y < -m || b.x + b.w > W + m || b.y + b.h > H + m) p.push(`clipped by the canvas edge (box ${boxOf(t).join(',')} in ${W}×${H})`);
    if (t.clip?.type === 'rect') { const c = t.clip; if (inter(b, c) < b.w * b.h * 0.97) p.push('clipped by its mask'); }
    if (norm(lineText(t)) !== norm(t.raw) && norm(t.raw).length > norm(lineText(t)).length) p.push(`truncated: drawn "${lineText(t).replace(/\n/g, ' ')}" of "${t.raw.replace(/\n/g, ' ')}"`);
    if (/…|\.\.\.$/.test(lineText(t)) && !/…|\.\.\./.test(t.raw)) p.push('ellipsis added (text cut)');
    if (!isDecorative(t)) {
      for (const o of content) if (o !== t && order.get(o)! > order.get(t)! && inter(b, o.box) > Math.min(b.w * b.h, o.box.w * o.box.h) * 0.12) p.push(`overlapped by "${o.raw.slice(0, 24)}" (${Math.round((inter(b, o.box) / Math.min(b.w * b.h, o.box.w * o.box.h)) * 100)}% of the smaller box)`);
      for (const o of all) if (order.get(o)! > order.get(t)! && (o.kind === 'image' || (o.kind === 'rect' && o.fill !== 'none' && (o.opacity ?? 1) > 0.8 && o.layer !== 'texture' && o.layer !== 'noise')) && inter(b, o as any) > b.w * b.h * 0.25) p.push(`covered by a later ${o.kind} (${Math.round((inter(b, o as any) / (b.w * b.h)) * 100)}% of the text box)`);
    }
    validity.set(t, { ok: !p.length, problems: p });
  }

  // ── content gate
  const exp = a.brief ? expectedContent(a.brief) : slots.filter((s) => s.slot === 'headline').map((s) => ({ field: 'headline', label: 'headline', required: true, variants: [s.text], kind: 'text' as const }));
  const contentItems: any[] = []; const reqNodes = new Set<TextNode>(); const optFails = new Map<string, { labels: string[]; region: Box | null; why: string; fix: Issue['fix']; impact: Impact[] }>();
  for (const x of exp) {
    let best: { t: TextNode; how: string } | null = null; const bad: { t: TextNode; problems: string[] }[] = []; let partial: TextNode | null = null;
    for (const v of x.variants) {
      for (const t of texts) {
        const drawn = lineText(t);
        const hit = normCase(drawn).includes(normCase(v)) ? 'verbatim' : norm(drawn).includes(norm(v)) ? 'verbatim (case changed by the style)' : null;
        if (!hit) { if (!partial && norm(t.raw).includes(norm(v))) partial = t; continue; }  // in the intended string but not in the drawn lines → truncated
        const val = validity.get(t)!;
        if (val.ok && (!best || t.size > best.t.size)) best = { t, how: x.kind === 'text' ? hit : `as "${v}"` };
        else if (!val.ok) bad.push({ t, problems: val.problems });
      }
      if (best) break;
    }
    const item: any = { field: x.field, label: x.label, required: x.required, expected: x.variants[0] };
    if (best) {
      Object.assign(item, { status: 'pass', rendered: best.how, region: boxOf(best.t), size_px: r1(best.t.size), css_px: r1(best.t.size * disp.cssPerPx), slot: slotOf(best.t) ?? null });
      if (x.required) reqNodes.add(best.t);
    } else {
      const why = bad.length ? bad[0].problems.join('; ') : partial ? `only partly drawn: "${lineText(partial).replace(/\n/g, ' ')}"` : 'not drawn anywhere';
      Object.assign(item, { status: 'fail', evidence: why, region: bad[0] ? boxOf(bad[0].t) : partial ? boxOf(partial) : null });
      const slot = (slots.find((s) => x.variants.some((v) => norm(s.text) === norm(v))) ?? slots.find((s) => s.slot.startsWith('meta.') && x.variants.some((v) => norm(s.text).includes(norm(v)))) ?? slots.find((s) => x.variants.some((v) => norm(s.text).includes(norm(v)))))?.slot;
      let fix: Issue['fix'];
      if (bad.length && bad[0].problems.some((p) => p.startsWith('clipped'))) { const t = bad[0].t; const k = scaleKey(t); fix = k ? { command: `refine --set ${k}=${Math.max(40, Math.round(Number(P[k]) * 0.85))}`, why: 'smaller type keeps it inside the canvas' } : { command: `refine --set margin=${Number(P.margin) + 2}`, why: 'wider margin' }; }
      else if (bad.length && bad[0].problems.some((p) => p.startsWith('overlapped') || p.startsWith('covered'))) fix = { command: `refine --set collisionFix=true --set margin=${Math.min(12, Number(P.margin ?? 4.5) + 1.5)}`, why: 'collision avoidance plus more space' };
      else if (bad.length || partial) fix = { command: `refine --set maxLineWidth=100 --set ${scaleKey((bad[0]?.t ?? partial)!) ?? 'smallScale'}=${Math.max(50, Math.round(Number(P[scaleKey((bad[0]?.t ?? partial)!) ?? 'smallScale']) * 0.85))}`, why: 'more line width and smaller type so the whole string fits' };
      else if (slot?.startsWith('groups.') && Number(P.smallGroups) < +slot.split('.')[1] + 1) fix = { command: `refine --set smallGroups=${Math.min(6, Math.max(Number(P.smallGroups), +slot.split('.')[1] + 1))}`, why: `the copy is in slot ${slot}, which this layout does not show` };
      else if (slot?.startsWith('meta.') && Number(P.metaCount) < +slot.split('.')[1] + 1) fix = { command: `refine --set metaCount=${Math.min(8, Math.max(Number(P.metaCount), +slot.split('.')[1] + 1))}`, why: `the copy is in slot ${slot}, which this layout does not show` };
      else if (slot?.startsWith('prose.')) fix = { command: `refine --set proseCount=${Math.min(6, +slot.split('.')[1] + 1)}`, why: `the copy is in slot ${slot}` };
      else if (slot) fix = { command: 'variations --vary structure -n 6', why: `this composition does not draw slot ${slot}; another structure may` };
      else fix = { command: `refine --text meta.0=${q(x.variants[0])} --set metaCount=${Math.max(1, Number(P.metaCount))}`, why: 'the text is in no slot; put it into a meta label' };
      if (!x.required) { const g = optFails.get(x.field) ?? { labels: [] as string[], region: item.region as Box | null, why, fix, impact: (bad.length ? ['finding-info', 'legibility'] : ['finding-info']) as Impact[] }; g.labels.push(x.label); optFails.set(x.field, g); contentItems.push(item); continue; }
      add({ gate: 'content', dimension: `content: ${x.label}`, blocking: x.required, region: item.region, evidence: `expected ${q(x.variants[0])}${x.kind === 'date' ? ' (any date format)' : ''}: ${why}`, impact: ['finding-info', ...(bad.length ? ['legibility' as Impact] : [])], fix });
    }
    contentItems.push(item);
  }

  for (const [field, g] of optFails) add({ gate: 'content', dimension: `content (optional): ${field}`, blocking: false, region: g.region, evidence: `${g.labels.length} item(s) not shown: ${g.labels.join('; ')} (${g.why})`, impact: g.impact, fix: g.fix });

  // ── minimum rendered size (required fields, at the target display)
  const sizeItems: any[] = [];
  for (const it of contentItems) {
    if (it.status !== 'pass') continue;
    const isHero = it.field === 'title' || it.field === 'headline';
    if (disp.heroOnly && !isHero) { sizeItems.push({ label: it.label, status: 'n/a', why: 'not expected to read at thumbnail size' }); continue; }
    if (!it.required) continue;
    const ok = it.css_px >= disp.minInfoCss;
    sizeItems.push({ label: it.label, status: ok ? 'pass' : 'fail', css_px: it.css_px, min_css_px: disp.minInfoCss, region: it.region });
    if (!ok) {
      const t = [...reqNodes].find((n) => boxOf(n).join() === it.region.join());
      const k = t ? scaleKey(t) : 'smallScale';
      const need = Math.ceil(Number(P[k ?? 'smallScale']) * (disp.minInfoCss / it.css_px));
      add({ gate: 'min_size', dimension: `text size: ${it.label}`, blocking: true, region: it.region, evidence: `${it.size_px} px on the poster = ${it.css_px} CSS px at ${disp.kind} (needs ≥ ${disp.minInfoCss})`, impact: ['legibility', 'finding-info'],
        fix: k ? { command: need <= 200 ? `refine --set ${k}=${need}` : `refine --set ${k}=200`, why: need <= 200 ? `scales this text to ≥ ${disp.minInfoCss} CSS px` : `even ${k}=200 is not enough at ${disp.kind}; move the field into a larger slot or choose a larger display` } : { command: `refine --text meta.0=${q(it.expected)}`, why: 'footer kit text is fixed-size; show the field in a meta label' } });
    }
  }

  // ── checked text contrast (WCAG 2.2 thresholds; pixel-sampled worst case)
  const conItems: any[] = [];
  for (const t of texts) {
    if (isDecorative(t)) continue;
    const c = sampleContrast(t, a.pixels ?? null, W, H);
    const large = largeCss(t); const need = large ? 3 : 4.5;
    const required = reqNodes.has(t);
    if (c.ratio === null) { conItems.push({ text: t.raw.slice(0, 40), status: 'n/a', why: c.why, region: boxOf(t) }); continue; }
    const ok = c.ratio >= need;
    conItems.push({ text: t.raw.slice(0, 40), status: ok ? 'pass' : 'fail', ratio: c.ratio, typical: c.typical, threshold: need, large, required, region: boxOf(t) });
    if (!ok) add({ gate: 'contrast', dimension: `text contrast: "${t.raw.slice(0, 24).replace(/\n/g, ' ')}"`, blocking: required, region: boxOf(t), evidence: `${c.ratio}:1 worst-case (typical ${c.typical}:1) vs ${need}:1 for ${large ? 'large' : 'normal'} text at ${disp.kind}`, impact: ['legibility'],
      fix: c.overImage ? { command: 'refine --set legibility=100 --set busyScrim=true', why: 'scrim / stronger separation over the uneven background; if the next audit still fails: variations --vary layout' } : { command: `refine --set minContrast=${Math.min(7, Math.max(Number(P.minContrast) + 1.5, need + 0.5))}`, why: 'the engine picks inks that meet this contrast' } });
  }

  // ── CJK typesetting (W3C CLREQ): prohibited line starts / ends, single-character last line, CJK–Latin spacing
  const cjk: Record<string, any[]> = { line_start: [], line_end: [], single_char_last_line: [], cjk_latin_spacing: [] };
  let anyCjk = false;
  for (const t of texts) {
    if (!hanCount(t.raw) || isDecorative(t)) continue;
    anyCjk = true; const L = t.lines.map((l) => l.text); const slot = slotOf(t);
    L.forEach((l, i) => {
      const s = l.trim(); if (!s) return;
      if (i > 0 && START_BAN.has(s[0])) cjk.line_start.push({ text: t.raw.slice(0, 30), line: i + 1, char: s[0], region: boxOf(t), slot });
      if (i < L.length - 1 && END_BAN.has(s[s.length - 1])) cjk.line_end.push({ text: t.raw.slice(0, 30), line: i + 1, char: s[s.length - 1], region: boxOf(t), slot });
      const sp = s.match(/[\u3400-\u9fff][A-Za-z]|[A-Za-z][\u3400-\u9fff]/g); if (sp) cjk.cjk_latin_spacing.push({ text: s.slice(0, 30), pairs: sp, region: boxOf(t), slot });
    });
    if (L.length >= 2) { const last = L[L.length - 1].trim().replace(/[\p{P}\s]/gu, ''); const prev = L[L.length - 2].trim(); if ([...last].length === 1 && hanCount(last) === 1 && [...prev].length >= 4) cjk.single_char_last_line.push({ text: t.raw.slice(0, 30), last, region: boxOf(t), slot }); }
  }
  for (const x of cjk.line_start) add({ gate: 'cjk', dimension: 'CJK line start (CLREQ)', blocking: true, region: x.region, evidence: `line ${x.line} of "${x.text}" starts with "${x.char}"`, impact: ['craft', 'legibility'], fix: { command: `refine --set maxLineWidth=${Math.max(30, Number(P.maxLineWidth) - 6)}`, why: 're-wrap; or set an explicit break with --text ' + (x.slot ?? 'SLOT') + '="…\\n…"' } });
  for (const x of cjk.line_end) add({ gate: 'cjk', dimension: 'CJK line end (CLREQ)', blocking: true, region: x.region, evidence: `line ${x.line} of "${x.text}" ends with "${x.char}"`, impact: ['craft', 'legibility'], fix: { command: `refine --set maxLineWidth=${Math.max(30, Number(P.maxLineWidth) - 6)}`, why: 're-wrap so the opening bracket moves to the next line' } });
  for (const x of cjk.single_char_last_line) add({ gate: 'cjk', dimension: 'CJK single-character last line (CLREQ)', blocking: false, region: x.region, evidence: `"${x.text}" ends with a lone "${x.last}" on its last line`, impact: ['craft'], fix: { command: `refine --set maxLineWidth=${Math.max(30, Number(P.maxLineWidth) - 5)}`, why: 'narrower measure pulls a second character down' } });
  for (const x of cjk.cjk_latin_spacing) { const fixed = x.slot ? (slots.find((s) => s.slot === x.slot)?.text ?? '').replace(/([\u3400-\u9fff])([A-Za-z])/g, '$1 $2').replace(/([A-Za-z])([\u3400-\u9fff])/g, '$1 $2') : null; add({ gate: 'cjk', dimension: 'CJK–Latin spacing (CLREQ)', blocking: false, region: x.region, evidence: `no space between Han and Latin in "${x.text}" (${x.pairs.join(' ')})`, impact: ['craft'], fix: { command: fixed && x.slot ? `refine --text ${x.slot}=${q(fixed)}` : null, why: 'CLREQ asks for about a quarter-em between Han and Latin; a space approximates it' } }); }

  // ── pictures gate (phase 16): every picture the brief gives is drawn and visible; heavy crops and cut subjects warn
  const picItems: { id: string; status: Status; required: boolean; visible_share: number; crop_loss: number | null; subject_visible: number | null; region: Box | null; why?: string }[] = [];
  {
    const asked = a.brief?.style?.imagery?.ids?.slice(0, 8) ?? [];
    const drawn = all.filter((n): n is ImageNode => n.kind === 'image' && !n.cutout);
    const ids = [...new Set([...asked, ...(e.picked.imageIds ?? [])])];
    for (const id of ids) {
      const required = asked.includes(id);
      const nodes = drawn.filter((n) => n.imageId === id);
      const asset = a.images.find((x) => x.id === id);
      if (!nodes.length) {
        if (required) { picItems.push({ id, status: 'fail', required, visible_share: 0, crop_loss: null, subject_visible: null, region: null, why: 'not drawn' }); add({ gate: 'images', dimension: `picture: ${id}`, blocking: true, region: null, evidence: `picture ${id} is not drawn on the poster`, impact: ['finding-info', 'expression'], fix: { command: 'refine --set composition=modular --set gridLayout=auto', why: 'the grid compositions lay out every given picture; most others show only the first' } }); }
        continue;
      }
      const big = nodes.reduce((m, n) => (n.w * n.h > m.w * m.h ? n : m), nodes[0]);
      const vis = Math.max(0, Math.min(W, big.x + big.w) - Math.max(0, big.x)) * Math.max(0, Math.min(H, big.y + big.h) - Math.max(0, big.y)) / (W * H);
      const ar = asset ? asset.w / asset.h : big.iw / big.ih, s = big.w / Math.max(1, big.h);
      const loss = 1 - Math.min(ar, s) / Math.max(ar, s);
      let subjVis: number | null = null;
      if (asset?.subject) {
        const dr = imageDrawRect(big); const sj = asset.subject;
        const sb = { x: dr.x + sj.x * dr.w, y: dr.y + sj.y * dr.h, w: sj.w * dr.w, h: sj.h * dr.h };
        subjVis = sb.w * sb.h > 0 ? inter(sb, { x: big.x, y: big.y, w: big.w, h: big.h }) / (sb.w * sb.h) : null;
      }
      const tooSmall = vis < 0.012;
      const status: Status = tooSmall && required ? 'fail' : 'pass';
      picItems.push({ id, status, required, visible_share: +vis.toFixed(3), crop_loss: +loss.toFixed(2), subject_visible: subjVis === null ? null : +subjVis.toFixed(2), region: [Math.round(big.x), Math.round(big.y), Math.round(big.w), Math.round(big.h)], ...(tooSmall ? { why: 'too small to read' } : {}) });
      if (tooSmall && required) add({ gate: 'images', dimension: `picture: ${id}`, blocking: true, region: [Math.round(big.x), Math.round(big.y), Math.round(big.w), Math.round(big.h)], evidence: `picture ${id} covers ${(vis * 100).toFixed(1)}% of the poster`, impact: ['finding-info'], fix: { command: 'refine --set gridLayout=blocks', why: 'modules give every picture a readable size' } });
      if (loss > 0.4) add({ gate: 'images', dimension: `picture crop: ${id}`, blocking: false, region: [Math.round(big.x), Math.round(big.y), Math.round(big.w), Math.round(big.h)], evidence: `${Math.round(loss * 100)}% of picture ${id} is cropped away (picture ${ar.toFixed(2)}, frame ${s.toFixed(2)})`, impact: ['expression'], fix: { command: 'refine --set composition=bleedgrid --set gridLayout=mosaic', why: 'the bleed grid keeps every picture at its own proportion' } });
      if (subjVis !== null && subjVis < 0.85) add({ gate: 'images', dimension: `picture subject: ${id}`, blocking: false, region: [Math.round(big.x), Math.round(big.y), Math.round(big.w), Math.round(big.h)], evidence: `only ${Math.round(subjVis * 100)}% of the subject of ${id} is in frame`, impact: ['expression', 'craft'], fix: { command: 'variations --vary layout -n 6', why: 'another layout gives this picture a span closer to its proportion' } });
    }
  }

  // ── gate summary
  const st = (items: any[], blockingOnly = false): Status => (!items.length ? 'n/a' : items.some((i) => i.status === 'fail' && (!blockingOnly || i.required !== false)) ? 'fail' : items.every((i) => i.status === 'n/a') ? 'n/a' : 'pass');
  const gatesOut = {
    content: { status: st(contentItems.filter((i) => i.required)), optional_status: st(contentItems.filter((i) => !i.required)), items: contentItems },
    min_size: { status: st(sizeItems), display: disp.note, items: sizeItems },
    contrast: { status: st(conItems.filter((i) => i.required)), all_text_status: st(conItems), label: 'checked text contrast (WCAG 2.2 thresholds 4.5:1 / 3:1 large; pixel-sampled worst case); not a WCAG compliance claim', items: conItems },
    cjk: anyCjk ? {
      line_start: { status: cjk.line_start.length ? 'fail' : 'pass', items: cjk.line_start }, line_end: { status: cjk.line_end.length ? 'fail' : 'pass', items: cjk.line_end },
      single_char_last_line: { status: cjk.single_char_last_line.length ? 'fail' : 'pass', blocking: false, items: cjk.single_char_last_line },
      cjk_latin_spacing: { status: cjk.cjk_latin_spacing.length ? 'fail' : 'pass', blocking: false, items: cjk.cjk_latin_spacing },
    } : { status: 'n/a', why: 'no Chinese text' },
    glyphs: { status: 'n/a', why: 'checked by the CLI against the font files' } as any,
    images: picItems.length ? { status: st(picItems.filter((i) => i.required)), all_status: st(picItems), items: picItems } : { status: 'n/a' as Status, why: 'no pictures' },
  };
  const blocking = issues.filter((i) => i.blocking);

  // ── aesthetic dimensions (separate from correctness; 0–10, null = not judged)
  const imgs = a.images;
  const A = designAudit({ nodes: sc.nodes, W, H, palette: sc.palette, images: imgs, comp: String(sc.info?.comp ?? '') } as Parameters<typeof designAudit>[0]);
  const G = measureGates(sc, new Map(imgs.map((x) => [x.id, x as any])));
  const overlaps = issues.filter((i) => /overlapped|covered/.test(i.evidence)).length;
  // hierarchy vs information priority: are the required fields drawn in priority order of size?
  const pr = contentItems.filter((i) => i.status === 'pass' && i.required && i.kind !== 'time');
  let prioAgree: number | null = null;
  if (pr.length >= 3) { let ok = 0, n = 0; for (let i = 0; i < pr.length; i++) for (let j = i + 1; j < pr.length; j++) { n++; if (pr[i].size_px >= pr[j].size_px * 0.98) ok++; } prioAgree = r1((ok / n) * 10); }
  const focal = A.focalRatio > 0 ? clamp((10 * Math.log(A.focalRatio)) / Math.log(5)) : null;
  const hierarchy = prioAgree === null ? focal : focal === null ? prioAgree : (focal * 0.6 + prioAgree * 0.4);
  const alignment = A.blocks >= 2 ? clamp(A.align * 10) : null;
  const clarity = clamp(10 - 1.5 * Math.max(0, A.blocks - 5) - 2 * A.busy - Math.max(0, A.sizes - 4) - 1.5 * overlaps);
  const orderV = clamp(10 - 1.2 * G.nearMiss);
  const mean = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null); return v.length ? r1(v.reduce((s, x) => s + x, 0) / v.length) : null; };
  const tension = clamp(5 * Math.min(1, Math.log(Math.max(1, A.focalRatio)) / Math.log(6)) + 5 * Math.min(1, G.centroid / 0.25));
  const harm = harmonyScore(sc.palette).score;
  const colorF = { harmony: r1(clamp(harm * 10)), palette_discipline: r1(clamp(10 - 2.5 * Math.max(0, G.hueFam - 3))), tone_structure: r1(clamp(10 - Math.abs(G.toneBand - 0.62) * 22)), hero_separation: r1(clamp(G.heroDL / 5)) };
  const gp = Number((sc.info?.gates as any)?.penalty ?? 0);
  const cjkDef = cjk.line_start.length + cjk.line_end.length + cjk.single_char_last_line.length;
  const craftF = { engine_gates: r1(clamp(10 - 8 * gp)), collisions: r1(clamp(10 - 2.5 * overlaps)), subject_protection: r1(clamp(10 - 4 * A.subject)), cjk_typesetting: anyCjk ? r1(clamp(10 - 2 * cjkDef - 0.5 * cjk.cjk_latin_spacing.length)) : null, thumbnail_read: G.thumbOK ? 10 : r1(clamp(G.thumbCap * 1.2)) };
  const aesthetic = {
    note: 'relative, model/heuristic-based scores (0–10); not comparable across briefs without human calibration; null = not judged',
    overall: { value: a.summary?.taste ?? null, taste: a.summary?.taste ?? null, gate_penalty: a.summary?.penalty ?? null, score: a.summary?.score ?? null, basis: 'learned taste selector (1–10, trained on one rater so far) minus engine gate penalty' },
    classical: { value: mean([orderV, clarity, alignment, hierarchy]), order: r1(orderV), clarity: r1(clarity), alignment: alignment === null ? null : r1(alignment), hierarchy: hierarchy === null ? null : r1(hierarchy),
      basis: `near-miss edges ${G.nearMiss}; ${A.blocks} text blocks, ${A.sizes} sizes, ${A.busy} busy blocks, ${overlaps} collisions; ${Math.round(A.align * 100)}% blocks aligned; focal ratio ${r1(A.focalRatio)}${prioAgree !== null ? `, priority order kept ${prioAgree}/10` : ''}` },
    expressive: { value: r1(tension), tension: r1(tension), idea: null, idea_assigned: (sc.info?.idea as string) ?? null, originality: null,
      basis: `tension = scale contrast (focal ratio ${r1(A.focalRatio)}) + asymmetry (centroid offset ${r1(G.centroid * 100) / 100}); idea and originality need a human eye (null)` },
    color: { value: mean(Object.values(colorF)), ...colorF, basis: `harmony ${r1(harm * 100) / 100}, ${G.hueFam} hue families, largest tone band ${Math.round(G.toneBand * 100)}%, headline ΔL ${Math.round(G.heroDL)}` },
    craft: { value: mean(Object.values(craftF)), ...craftF, basis: `engine soft-gate penalty ${gp}, ${overlaps} collisions, subject overlap ${r1(A.subject)}, ${cjkDef} CJK defects, thumbnail cap ${r1(G.thumbCap)} px` },
  };
  // aesthetic observations become (non-blocking) issues too, when a concrete lever exists
  if (alignment !== null && alignment < 5) add({ dimension: 'classical: alignment', blocking: false, region: null, evidence: `${Math.round(A.align * 100)}% of text blocks share an edge or axis`, impact: ['craft'], fix: { command: 'refine --set gridStrength=2 --set align=lr', why: 'stronger grid and one alignment' } });
  if (focal !== null && focal < 4) add({ dimension: 'classical: hierarchy', blocking: false, region: null, evidence: `largest / next text size = ${r1(A.focalRatio)}×`, impact: ['finding-info', 'expression'], fix: { command: `refine --set titleScale=${Math.min(200, Math.round(Number(P.titleScale) * 1.25))}`, why: 'a clearer hero' } });
  if (prioAgree !== null && prioAgree < 6) add({ dimension: 'classical: priority order', blocking: false, region: null, evidence: `required fields drawn out of priority order (${prioAgree}/10 pairs in order): ${pr.map((i) => `${i.field} ${i.size_px}px`).join(', ')}`, impact: ['finding-info'], fix: { command: 'variations --vary structure -n 6', why: 'another structure may place the priority fields larger' } });
  if (G.hueFam > 4) add({ dimension: 'color: palette discipline', blocking: false, region: null, evidence: `${G.hueFam} hue families`, impact: ['craft', 'expression'], fix: { command: 'variations --vary color -n 6', why: 'fewer hue families' } });

  return {
    display: disp,
    gates: gatesOut,
    gates_passed: blocking.length === 0,
    blocking_failures: blocking.map((i) => i.dimension),
    advisory_failures: issues.filter((i) => !i.blocking && i.gate).map((i) => i.dimension),
    aesthetic,
    issues,
  };
}
export type Report = ReturnType<typeof evaluate>;
