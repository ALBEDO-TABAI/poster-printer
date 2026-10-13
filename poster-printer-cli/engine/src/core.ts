// Backend-agnostic operations. The same code runs in headless Chrome (exact app parity) and in Node (approximate).
import { generate, DEFAULT_MODULES, type GenInput, type GenResult, type Picked, type Seeds, type Layer } from '@rea/engine/generate';
import { FIXED_PLACE } from '@rea/engine/layers';
import { BUILTIN_STYLES } from '@rea/data/styles';
import { TEXT_SETS } from '@rea/data/texts';
import { DEFAULT_PARAMS, PARAMS, REMOVED_PARAMS, type Params } from '@rea/engine/params';
import type { Measurer } from '@rea/engine/text/measure';
import type { Scene, Ratio } from '@rea/engine/types';
import type { FontSet } from '@rea/engine/typo';
import type { ImageAsset } from '@rea/engine/gen/ctx';
import type { LibPalette } from '@rea/engine/color/palette';
import { tasteScore } from '@rea/engine/aesthetic/score';
import { compSize, type PlacedComponent } from '@rea/engine/components';
import { drawPlan } from '@rea/engine/gen/plan';
import { resolveBrief, type Resolved, type Direction } from './resolve';
import type { Brief } from './brief';
import { evaluate, type Pixels, type Report } from './report';

export const APP_SLUG = 'ready-poster-printer';
export interface Entry {
  id: string; ts: number; seeds: Seeds; decorSalt: string; ratio: Ratio; styleId: string; params: Params;
  modules: Record<string, boolean>; modes: string[]; fonts: FontSet; picked: Picked; edits: Record<string, unknown>; custom: unknown; comp?: string; placed?: PlacedComponent[];
}
export interface PosterJSON { app: string; kind: 'poster'; version: 1; entry: Entry; x_cli?: Record<string, unknown> }
export interface Env {
  backend: 'chromium' | 'node';
  measure: Measurer;
  presetImages: ImageAsset[];
  userImages: ImageAsset[];
  palettes: LibPalette[];
  ensureFonts(fs: FontSet): Promise<void>;
  /** exportSVG semantics: embedded images, fonts optionally embedded */
  svg(scene: Scene, embedFonts: boolean): Promise<string>;
  /** PNG / JPEG bytes as base64 */
  raster(scene: Scene, scale: number, type: 'png' | 'jpeg'): Promise<string>;
  /** RGBA pixels at scale 1 (contrast sampling for the evaluation report) */
  pixels(scene: Scene): Promise<Pixels>;
}
export interface RenderOpts { formats?: string[]; scale?: number; embedFonts?: boolean }
export interface Rendered { svg?: string; svgPlain?: string; png?: string; jpeg?: string }

const styleById = (id: string) => BUILTIN_STYLES.find((s) => s.id === id) ?? BUILTIN_STYLES[0];
const sceneTaste = (sc: Scene) => +tasteScore(sc).toFixed(3);
const scenePenalty = (sc: Scene) => +Number((sc.info?.gates as { penalty?: number } | undefined)?.penalty ?? 0).toFixed(3);

/** the app's buildInput(state, { keepPicked }) for a restored entry, field for field (src/store.ts) */
export function replayInput(env: Env, e: Entry): GenInput {
  const keep = e.picked;
  const style = styleById(e.styleId);
  const lockedIds = keep.imageIds;
  // the app's pool is preset + the user's own images; a CLI user image only exists here when the poster uses it
  const all = [...env.presetImages, ...env.userImages.filter((a) => lockedIds.includes(a.id))];
  const pool = [...all.filter((a) => lockedIds.includes(a.id)), ...all.filter((a) => !lockedIds.includes(a.id))];
  return {
    seeds: e.seeds, ratio: e.ratio, style, params: { ...e.params, decorSalt: e.decorSalt }, modules: e.modules as GenInput['modules'], modes: e.modes as GenInput['modes'], fonts: e.fonts,
    images: e.modules.images ? pool : [], lockedImages: lockedIds,
    palettes: env.palettes, paletteFilter: () => true, pinnedPalette: null, baseColor: e.params.paletteSource === 'base' ? '#f1ede4' : null,
    lockedPalette: keep.palette, textSets: TEXT_SETS, custom: (e.custom ?? null) as GenInput['custom'],
    forceAttempt: keep.attempt ?? 0, lockedTexts: keep.texts, placed: e.placed ?? [], sidebarSizes: {}, forceSidebar: String(e.params.sidebarTpl ?? 'auto') !== 'auto',
    measure: env.measure, forceComp: keep.comp, forcePlan: keep.plan, forceIdea: keep.idea, layoutSalt: keep.salt, select: 0, recent: [], recentIdeas: [],
    // app phase 17: the poster's layered streams (absent = a poster made before phase 17: its single stream, replayed exactly)
    layers: keep.layers ?? null,
    // app phase 13: the params the app honoured for this poster (absent on older / CLI entries = none)
    honor: (e as Entry & { honor?: string[] }).honor ?? [],
  };
}

export async function replay(env: Env, e: Entry): Promise<GenResult> {
  await env.ensureFonts(e.fonts);
  return generate(replayInput(env, e));
}

export async function render(env: Env, scene: Scene, o: RenderOpts): Promise<Rendered> {
  const f = new Set(o.formats ?? ['png']);
  const out: Rendered = {};
  if (f.has('svg')) out.svg = await env.svg(scene, o.embedFonts !== false);
  if (f.has('png')) out.png = await env.raster(scene, o.scale ?? 1, 'png');
  if (f.has('jpeg') || f.has('jpg') || f.has('pdf')) out.jpeg = await env.raster(scene, o.scale ?? 1, 'jpeg');
  return out;
}

export function summarize(e: Entry, sc: Scene) {
  const p = e.picked;
  return {
    style: e.styleId, ratio: e.ratio, size: [sc.w, sc.h], comp: p.comp, layout: ((sc.info?.sem as { vars?: { typology?: { value?: string } } } | undefined)?.vars?.typology?.value) ?? null, idea: p.idea?.id ?? null, grid: String(sc.info?.grid ?? ''), attempt: p.attempt ?? 0, salt: p.salt ?? '',
    seeds: e.seeds, taste: sceneTaste(sc), penalty: scenePenalty(sc), score: +(sceneTaste(sc) - scenePenalty(sc)).toFixed(3), quality: sc.info?.score ?? null, gates: sc.info?.gates ?? null,
    palette: { bg: p.palette.bg, ink: p.palette.ink, accent: p.palette.accent }, images: p.imageIds,
    fonts: [...new Set([e.fonts.en['big.main'].family, e.fonts.en['big.sub'].family, e.fonts.zh['big.main'].family])],
  };
}

export function makeEntry(id: string, seeds: Seeds, ratio: string, styleId: string, params: Params, modes: string[], fonts: FontSet, picked: Picked, custom: unknown): Entry {
  const p = { ...params }; delete p.decorSalt;
  return { id, ts: Date.now(), seeds, decorSalt: '', ratio: ratio as Ratio, styleId, params: p, modules: { ...DEFAULT_MODULES }, modes, fonts, picked, edits: {}, custom, comp: picked.comp };
}
export const posterJSON = (entry: Entry, x?: Record<string, unknown>): PosterJSON => ({ app: APP_SLUG, kind: 'poster', version: 1, entry, ...(x ? { x_cli: x } : {}) });

// ---------------------------------------------------------------- brief → candidates
function hueOf(hex: string) {
  const n = parseInt(hex.slice(1), 16); const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const d = mx - mn; if (d < 0.08) return { h: -1, s: 0 };
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360;
  return { h, s: d / (1 - Math.abs(mx + mn - 1) || 1) };
}
export function paletteFilterFn(f: Resolved['palette']['filter']) {
  if (!f) return undefined;
  return (p: LibPalette) => {
    if (f.src && p.src !== f.src) return false;
    if (f.light && !f.light.includes(p.light)) return false;
    if (f.chroma && !f.chroma.includes(p.chroma)) return false;
    if (f.contrast && !f.contrast.includes(p.contrast)) return false;
    if (f.tags && !f.tags.some((t) => (p.tags ?? []).includes(t))) return false;
    if (f.hue) {
      const hs = p.colors.map(hueOf).filter((x) => x.h >= 0);
      if (!hs.length) return f.hue === 'neutral';
      const warm = hs.filter((x) => x.h < 75 || x.h >= 330).length / hs.length, cool = hs.filter((x) => x.h >= 160 && x.h < 290).length / hs.length;
      if (f.hue === 'warm' && warm < 0.6) return false;
      if (f.hue === 'cool' && cool < 0.6) return false;
      if (f.hue === 'neutral' && hs.reduce((a, x) => a + x.s, 0) / hs.length > 0.45) return false;
    }
    return true;
  };
}

export function resolveWith(env: Pick<Env, 'presetImages' | 'userImages'>, brief: Brief): Resolved {
  const cats: Record<string, number> = {};
  for (const a of [...env.presetImages, ...env.userImages]) { const k = String(a.category ?? 'other'); cats[k] = (cats[k] ?? 0) + 1; }
  return resolveBrief(brief, { cutoutIds: new Set(env.presetImages.filter((a) => a.cutout && a.subject).map((a) => a.id)), imageCats: cats, userImageIds: env.userImages.map((a) => a.id), assets: [...env.presetImages, ...env.userImages] });
}

function lum(hex: string) { const n = parseInt(hex.slice(1, 7), 16); const f = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); }
export const bgMatches = (bg: string, want: string) => (want === 'light' ? lum(bg) >= 0.42 : want === 'dark' ? lum(bg) <= 0.12 : true);
export interface Candidate { name: string; direction: string; poster: PosterJSON; summary: ReturnType<typeof summarize>; replayExact: boolean; reasons: string[]; rendered?: Rendered; ms: number; report: Report; flagged?: boolean; scene?: Scene }
export interface GenerateArgs { brief: Brief; count?: number; minScore?: number; maxTries?: number; select?: number; render?: RenderOpts; seed?: string; ratio?: string; directions?: string[]; /** fill up with gate-failing candidates (flagged) when too few pass; default true */ includeFlagged?: boolean }

function imagePool(env: Env, R: Resolved, d: Direction): { pool: ImageAsset[]; locked: string[] | null } {
  const all = [...env.presetImages, ...env.userImages];
  let pool = all;
  if (R.images.ids) return { pool: all, locked: R.images.ids.filter((id) => all.some((a) => a.id === id)) };
  if (R.images.categories) pool = all.filter((a) => R.images.categories!.includes(String(a.category)));
  if (d.params.idea === 'occlusion') pool = pool.filter((a) => a.cutout && a.subject);
  return { pool: pool.length ? pool : all, locked: null };
}

/** generate N candidates for a brief, ranked by taste − gate penalty; outputs are re-rendered by replay for app parity */
export async function generateCandidates(env: Env, args: GenerateArgs) {
  const R = resolveWith(env, args.brief);
  const count = args.count ?? R.format.count;
  const minScore = args.minScore ?? R.format.minScore;
  const maxTries = args.maxTries ?? Math.max(count * 3, count + 4);
  const seed = args.seed ?? R.seed;
  const ratio = (args.ratio ?? R.format.ratio) as Ratio;
  const dirs = args.directions?.length ? R.directions.filter((d) => args.directions!.includes(d.id) || args.directions!.includes(d.styleId)) : R.directions;
  if (!dirs.length) throw Object.assign(new Error('no direction matches ' + args.directions), { code: 2 });
  const kept: Candidate[] = []; const flagged: Candidate[] = []; const rejected: { name: string; direction: string; taste: number; score: number; comp: string }[] = [];
  const recent: string[] = [], recentIdeas: string[] = [];
  for (let k = 0; k < maxTries && kept.length < count; k++) {
    const t0 = Date.now();
    const d = dirs[k % dirs.length];
    const style = styleById(d.styleId);
    const fonts = d.fonts ?? style.fonts;
    await env.ensureFonts(fonts);
    const s = `${seed}-${k + 1}`;
    const seeds: Seeds = { layout: s + 'L', text: s + 'T', color: s + 'C', image: s + 'I' };
    const { pool, locked } = imagePool(env, R, d);
    // the plan generateOne would draw for these seeds, with the brief's fixed choices applied (stored, so replays keep it)
    const pp = { ...DEFAULT_PARAMS, ...d.params } as Params; const md = new Set(d.modes as GenInput['modes']);
    if (md.has('experimental')) pp.colorMode = 'experimental'; if (md.has('nice')) pp.paletteSource = 'nice'; if (md.has('wada')) pp.paletteSource = 'wada';
    const styleTex = style.params?.texture as string | undefined;
    const plan = drawPlan(seeds.layout, pp, { modes: md, canDropImages: String(pp.composition) === 'auto' && !locked?.length && !pool.some((a) => a.user), retro: !!styleTex && styleTex !== 'none' && styleTex !== 'auto', paletteFree: !R.palette.pinned?.length && String(pp.paletteSource) !== 'base' && String(pp.colorMode) === 'normal' });
    const forcePlan = plan.v2 ? { ...plan, ...d.planPatch, kit: plan.kit.filter((k) => k !== 'signature' || !!R.texts.facts?.signature) } : undefined;
    const inp: GenInput = {
      forcePlan,
      seeds, ratio, style, params: { ...d.params, decorSalt: '' }, modules: { ...DEFAULT_MODULES }, modes: d.modes as GenInput['modes'], fonts,
      images: pool, lockedImages: locked, palettes: env.palettes, paletteFilter: paletteFilterFn(R.palette.filter), pinnedPalette: R.palette.pinned,
      textSets: TEXT_SETS, custom: R.custom, lockedTexts: R.texts, measure: env.measure, select: args.select ?? 8,
      recent: recent.slice(-4), recentIdeas: recentIdeas.slice(-4),
    };
    let res = generate(inp);
    // background intent: the idea's Itten palette ignores bgPref, so re-roll the colour seed (bounded) until it matches
    const want = String(d.params.bgPref ?? 'auto');
    for (let j = 1; j <= 4 && !bgMatches(res.picked.palette.bg, want); j++) res = generate({ ...inp, seeds: { ...seeds, color: `${seeds.color}~${j}` } });
    const bgOk = bgMatches(res.picked.palette.bg, want);
    const picked: Picked = { ...res.picked };
        const entry = makeEntry(`${s}-${Date.now().toString(36)}`, res.seeds ?? seeds, ratio, d.styleId, d.params, d.modes, fonts, picked, R.custom);
    // the app re-creates a poster from its entry (replay); render that, so importing the JSON shows exactly this
    const rep = generate(replayInput(env, entry));
    const replayExact = JSON.stringify(rep.scene.nodes) === JSON.stringify(res.scene.nodes);
    entry.picked.taste = sceneTaste(rep.scene);
    const sum = summarize(entry, rep.scene);
    recent.push(sum.comp); recentIdeas.push(sum.idea ?? '');
    const name = `${d.styleId}-${s}`;
    if (!bgOk) sum.penalty = +(sum.penalty + 0.5).toFixed(3), sum.score = +(sum.taste - sum.penalty).toFixed(3);
    if (sum.taste < minScore) { rejected.push({ name, direction: d.id, taste: sum.taste, score: sum.score, comp: sum.comp }); continue; }
    const reasons = [...d.reasons, ...(want !== 'auto' ? [`background ${want}: ${bgOk ? 'matched' : 'NOT matched after 4 colour re-rolls (−0.5)'} (${res.picked.palette.bg})`] : []), `engine picked composition ${sum.comp}${sum.idea ? ' / idea ' + sum.idea : ''} (taste ${sum.taste.toFixed(2)} − penalty ${sum.penalty} = ${sum.score.toFixed(2)})`];
    // correctness gates first: a failed gate is never offset by the aesthetic score
    const report = evaluate({ scene: rep.scene, entry, brief: args.brief, pixels: await env.pixels(rep.scene), images: [...env.presetImages, ...env.userImages], summary: sum });
    const cand: Candidate = { name, direction: d.id, poster: posterJSON(entry, { direction: d.id, reasons, brief_seed: seed, summary: sum, brief: args.brief, gates_passed: report.gates_passed, blocking_failures: report.blocking_failures }), summary: sum, replayExact, reasons, ms: 0, report };
    if (!report.gates_passed) { cand.scene = rep.scene; cand.ms = Date.now() - t0; flagged.push(cand); continue; }
    if (args.render) cand.rendered = await render(env, rep.scene, args.render);
    cand.ms = Date.now() - t0;
    kept.push(cand);
  }
  kept.sort((a, b) => b.summary.score - a.summary.score);
  flagged.sort((a, b) => a.report.blocking_failures.length - b.report.blocking_failures.length || b.summary.score - a.summary.score);
  const fill = args.includeFlagged === false ? [] : flagged.slice(0, Math.max(0, count - kept.length));
  for (const c of fill) { c.flagged = true; if (args.render) c.rendered = await render(env, c.scene!, args.render); delete c.scene; kept.push(c); }
  const gateFailed = flagged.filter((c) => !fill.includes(c)).map((c) => ({ name: c.name, direction: c.direction, taste: c.summary.taste, comp: c.summary.comp, blocking_failures: c.report.blocking_failures }));
  return { resolved: R, candidates: kept, rejected, gateFailed, tries: kept.length + rejected.length + gateFailed.length, count, minScore };
}

// ---------------------------------------------------------------- iteration
export function setParams(params: Params, set: Record<string, string | number | boolean>) {
  const out = { ...params };
  for (const [k, raw] of Object.entries(set)) {
    // app phase 13 removed params the engine never read: old scripts still run, the value is dropped (and said so)
    if (REMOVED_PARAMS.includes(k)) { delete out[k]; console.warn(`note: param "${k}" was removed (it never changed the poster); ignored`); continue; }
    const spec = PARAMS.find((p) => p.key === k) as any;
    if (!spec) throw Object.assign(new Error(`unknown param "${k}" (see: ready-poster-printer catalog params)`), { code: 2 });
    let v: string | number | boolean = raw;
    if (spec.type === 'range') { v = Number(raw); if (!Number.isFinite(v)) throw Object.assign(new Error(`${k} must be a number`), { code: 2 }); v = Math.max(spec.min!, Math.min(spec.max!, v)); }
    else if (spec.type === 'bool') v = raw === true || raw === 'true' || raw === '1' || raw === 1;
    else { v = String(raw); if (spec.options && !spec.options.some((o) => o.v === v)) throw Object.assign(new Error(`${k} must be one of ${spec.options.map((o) => o.v).join('|')}`), { code: 2 }); }
    out[k] = v;
  }
  return out;
}

export interface RefineArgs { entry: Entry; set?: Record<string, string | number | boolean>; texts?: Record<string, string>; styleId?: string; ratio?: string; render?: RenderOpts }
/** like the app's slider tweak: keep the draw (salt / plan / idea / attempt / palette / copy / pictures), change params */
export async function refine(env: Env, a: RefineArgs) {
  const e: Entry = JSON.parse(JSON.stringify(a.entry));
  if (a.set) e.params = setParams(e.params, a.set);
  // phase 16: the grid compositions read these only when they were chosen explicitly (the app's `honor`); a refine is explicit
  const GRID_HONOR = ['margin', 'gutter', 'imageCount', 'cols', 'rows'];
  if (a.set) { const h = Object.keys(a.set).filter((k) => GRID_HONOR.includes(k)); if (h.length) (e as Entry & { honor?: string[] }).honor = [...new Set([...((e as Entry & { honor?: string[] }).honor ?? []), ...h])]; }
  if (a.styleId) { const st = styleById(a.styleId); if (st.id !== a.styleId) throw Object.assign(new Error('unknown style ' + a.styleId), { code: 2 }); e.styleId = st.id; e.fonts = st.fonts; e.params = { ...DEFAULT_PARAMS, ...st.params, ...pickContentParams(e.params) } as Params; e.modes = [...(st.modes ?? [])]; }
  if (a.ratio) e.ratio = a.ratio as Ratio;
  if (a.texts) {
    const T = e.picked.texts as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(a.texts)) {
      const m = k.match(/^(groups|prose|meta|words)\.(\d+)(?:\.(main|sub|note))?$/);
      const pt = { t: v, lang: /[\u3400-\u9fff]/.test(v) ? 'zh' : 'en' };
      if (['headline', 'sub', 'note'].includes(k)) T[k] = pt;
      else if (m && m[1] === 'groups' && m[3]) (T.groups as Record<string, unknown>[])[+m[2]][m[3]] = pt;
      else if (m && m[1] !== 'groups') (T[m[1]] as unknown[])[+m[2]] = pt;
      else throw Object.assign(new Error(`unknown text slot "${k}" (headline, sub, note, groups.N.main|sub|note, prose.N, meta.N, words.N)`), { code: 2 });
    }
  }
  // a changed composition / ratio can not reuse the stored layout: re-run the composition, keep copy, palette and pictures
  const comp = String(e.params.composition ?? 'auto');
  if ((a.set && 'composition' in a.set && comp !== 'auto') || a.ratio || a.styleId) {
    await env.ensureFonts(e.fonts);
    const inp = replayInput(env, e);
    const r = generate({ ...inp, forceComp: comp !== 'auto' ? (comp as GenInput['forceComp']) : undefined, forcePlan: e.picked.plan, forceIdea: comp !== 'auto' ? undefined : e.picked.idea, forceAttempt: undefined, layoutSalt: undefined, select: comp === 'auto' ? 8 : 0, layers: e.picked.layers ?? undefined });
    e.picked = { ...r.picked, salt: r.picked.salt ?? '' } as Picked; e.comp = r.picked.comp; if (r.seeds) e.seeds = r.seeds;
  }
  const rep = await replay(env, e);
  e.picked = { ...rep.picked, salt: e.picked.salt, taste: sceneTaste(rep.scene) } as Picked;
  e.comp = rep.picked.comp; e.id = e.id.replace(/~r\d+$/, '') + '~r' + Date.now().toString(36).slice(-4);
  const summary = summarize(e, rep.scene);
  return { entry: e, summary, rendered: a.render ? await render(env, rep.scene, a.render) : undefined };
}
const CONTENT_KEYS = ['smallGroups', 'metaCount', 'proseCount', 'imageCount', 'typeOnlyShare', 'imageShare', 'bgPref', 'margin', 'blockBudget', 'decorBudget', 'ornaments', 'smallScale', 'titleScale', 'composition', 'idea', 'paletteSource'];
const pickContentParams = (p: Params): Params => Object.fromEntries(Object.entries(p).filter(([k]) => CONTENT_KEYS.includes(k)));

export type Vary = 'layout' | 'color' | 'image' | 'structure' | 'decor' | 'tendency' | Layer;
const LAYER_VARY: Vary[] = ['grid', 'place', 'type'];
/** the app's variant buttons; copy always stays (content is real). grid / place / type re-roll one layer of the structure
 *  (app phase 17: 网格 / 图位 / 排字) and keep the other two exactly */
export async function variations(env: Env, a: { entry: Entry; vary: Vary; count: number; seed?: string; render?: RenderOpts }) {
  const out: any[] = [];
  for (let i = 0; i < a.count; i++) {
    const e: Entry = JSON.parse(JSON.stringify(a.entry));
    const tag = `${a.seed ?? 'v'}${i + 1}`;
    if (LAYER_VARY.includes(a.vary)) {
      await env.ensureFonts(e.fonts);
      const base = replayInput(env, e);
      const cur = generate(base);
      const r = generate({ ...base, reroll: { layer: a.vary as Layer, salt: tag, base: cur.scene } });
      const rr = r.scene.info.reroll as { changed?: boolean; kept?: boolean } | undefined;
      e.picked = { ...r.picked, salt: e.picked.salt, taste: sceneTaste(r.scene), ...(r.picked.idea || !e.picked.idea ? {} : { idea: e.picked.idea }) } as Picked;
      e.comp = r.picked.comp;
      e.id = `${e.id.split('~')[0]}~${a.vary}${i + 1}`;
      out.push({ entry: e, summary: { ...summarize(e, r.scene), layer: { vary: a.vary, changed: rr?.changed ?? true, picturesKept: rr?.kept ?? null, fixedPlacement: a.vary === 'place' && FIXED_PLACE.has(r.picked.comp) } }, rendered: a.render ? await render(env, r.scene, a.render) : undefined });
      continue;
    }
    let keepPal = true, keepImg = true;
    if (a.vary === 'color') { e.seeds = { ...e.seeds, color: e.seeds.color + '~' + tag }; keepPal = false; }
    if (a.vary === 'image') { e.seeds = { ...e.seeds, image: e.seeds.image + '~' + tag }; keepImg = false; }
    if (a.vary === 'layout' || a.vary === 'structure') e.seeds = { ...e.seeds, layout: e.seeds.layout + '~' + tag };
    if (a.vary === 'decor') e.decorSalt = tag;
    if (a.vary === 'tendency') {
      const lib = styleById(e.styleId).lib; const others = BUILTIN_STYLES.filter((s) => s.lib === lib && s.id !== e.styleId);
      const st = others[(i * 7 + tag.length) % others.length];
      e.styleId = st.id; e.fonts = st.fonts; e.modes = [...(st.modes ?? [])]; e.params = { ...DEFAULT_PARAMS, ...st.params, ...pickContentParams(e.params) } as Params;
    }
    await env.ensureFonts(e.fonts);
    const base = replayInput(env, e);
    const fresh = a.vary !== 'decor';
    const inp: GenInput = fresh
      ? { ...base, layers: undefined, forceAttempt: undefined, forceComp: undefined, forcePlan: a.vary === 'structure' || a.vary === 'tendency' ? undefined : e.picked.plan, forceIdea: undefined, layoutSalt: undefined, select: 8, lockedPalette: keepPal ? e.picked.palette : null, lockedImages: keepImg ? e.picked.imageIds : null, images: keepImg ? base.images : [...env.presetImages], params: { ...base.params, composition: a.vary === 'structure' || a.vary === 'tendency' ? 'auto' : base.params.composition } }
      : { ...base };
    const r = generate(inp);
    e.picked = { ...r.picked } as Picked; e.comp = r.picked.comp; if (r.seeds) e.seeds = r.seeds;
    const rep = generate(replayInput(env, e));
    e.picked.taste = sceneTaste(rep.scene);
    e.id = `${e.id.split('~')[0]}~${a.vary}${i + 1}`;
    out.push({ entry: e, summary: summarize(e, rep.scene), rendered: a.render ? await render(env, rep.scene, a.render) : undefined });
  }
  return out;
}

export async function audit(env: Env, e: Entry, brief?: Brief | null) {
  const rep = await replay(env, e);
  const sc = rep.scene;
  const sum = summarize(e, sc);
  const report = evaluate({ scene: sc, entry: e, brief, pixels: await env.pixels(sc), images: [...env.presetImages, ...env.userImages], summary: sum });
  const texts: { role: string; text: string; size: number; family: string }[] = [];
  const walk = (ns: Scene['nodes']) => ns.forEach((n) => { if (n.kind === 'text' && n.raw) texts.push({ role: String(n.role), text: n.raw, size: Math.round(n.size), family: n.family }); if (n.kind === 'group') walk(n.children); });
  walk(sc.nodes);
  texts.sort((a, b) => b.size - a.size);
  return { summary: sum, brief_used: !!brief, ...report, engine: { quality: e.picked.quality ?? sc.info?.score, gates: sc.info?.gates, direction: sc.info?.direction, plan: sc.info?.plan }, textsBySize: texts.slice(0, 40) };
}

// ---------------------------------------------------------------- deck (src/deck/deck.ts renderDeck, CLI edition)
export async function deck(env: Env, a: { entry: Entry; pages: number; folio?: boolean; noRepeat?: boolean; seed?: string; render?: RenderOpts }) {
  const cover = a.entry; const n = Math.max(1, a.pages);
  await env.ensureFonts(cover.fonts);
  const used = new Set<string>(); const out: any[] = [];
  const coverRep = generate(replayInput(env, cover));
  const sc0 = coverRep.scene;
  for (let i = 0; i < n; i++) {
    const placed: PlacedComponent[] = [];
    if (a.folio !== false) {
      const z = compSize('folio', 1, sc0.w, sc0.h); const m = Math.min(sc0.w, sc0.h) * 0.025;
      placed.push({ id: 'folio', type: 'folio', x: (sc0.w - z.w - m) / sc0.w, y: (sc0.h - z.h - m * 0.6) / sc0.h, scale: 1, salt: 'f', color: 'auto', text: `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}` });
    }
    let r: GenResult; let e: Entry;
    if (i === 0) { e = { ...cover, placed }; r = generate(replayInput(env, e)); }
    else {
      const s = `${a.seed ?? cover.seeds.layout}-p${i + 1}`;
      const seeds = { layout: s + 'L', text: s + 'T', image: s + 'I', color: cover.seeds.color };
      const all = [...env.presetImages];
      const pool = a.noRepeat !== false ? all.filter((x) => !used.has(x.id)) : all;
      const params = { ...cover.params, composition: 'auto', idea: 'auto', gridType: cover.picked.grid.type, density: cover.picked.grid.density };
      const inp: GenInput = { ...replayInput(env, cover), seeds, params: { ...params, decorSalt: '' }, images: pool.length >= 3 ? pool : all, lockedImages: null, lockedPalette: cover.picked.palette, forceAttempt: undefined, forceComp: undefined, forcePlan: undefined, forceIdea: undefined, layoutSalt: undefined, select: 0, placed, lockedTexts: cover.picked.texts };
      r = generate(inp);
      e = makeEntry(`${cover.id}-p${i + 1}`, r.seeds ?? seeds, cover.ratio, cover.styleId, params, cover.modes, cover.fonts, r.picked, cover.custom);
      e.placed = placed;
      r = generate(replayInput(env, e));
    }
    r.picked.imageIds.forEach((x) => used.add(x));
    out.push({ entry: e, summary: summarize(e, r.scene), rendered: a.render ? await render(env, r.scene, a.render) : undefined });
  }
  return out;
}

export { DEFAULT_PARAMS };
