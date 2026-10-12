import { Rng } from './rng';
import type { Params } from './params';
import { DEFAULT_PARAMS } from './params';
import { canvasSize, type Ratio, type Scene, type LayerKey, type ModeKey, LAYERS } from './types';
import { paletteFit } from './color/fit';
import { buildPalette, type Palette, type LibPalette, type ColorMode } from './color/palette';
import type { Measurer } from './text/measure';
import type { FontSet } from './typo';
import type { TextSet, CustomText } from '../data/texts';
import type { Style, Comp } from '../data/styles';
import { COMPS } from '../data/styles';
import { makeGrid, shrinkGrid, padGrid, RESTRAINT, RESTRAINT_MARGIN } from './gen/grid';
import { Ctx, type ImageAsset } from './gen/ctx';
import { pickTexts, type PickedTexts } from './gen/pick';
import { COMPOSERS, applyModes } from './gen/comps';
import { COMPOSERS_V3, stickersFor } from './gen/comps3';
import { COMPOSERS_V2, meanImageDetail } from './gen/comps2';
import { applyExtras } from './gen/kit';
import { drawPlan, type DrawPlan } from './gen/plan';
import { v2Weights, PROBATION, archOf } from './gen/sampler';
import { tasteScore } from './aesthetic/score';
import { COMPOSERS_V4 } from './gen/comps4';
import { COMPOSERS_V5 } from './gen/comps5';
import { COMPOSERS_V8 } from './p8/grammar';
import { parseMutation, diagnose, cellOf, cellKey, type Mutation } from './p8/search';
import { problemOf, retrieve } from '../data/recipes';
import { contentRelevance, contentMiss } from './p8/relevance';
import { sampleIdea, IDEAS, type IdeaPick } from './gen/ideas';
import { gates, gatePenalty, type GateAsset } from './aesthetic/gates';
import { geoGates, safeArea } from './aesthetic/geo';
import { balanceOf, pairWeights } from './aesthetic/balance';
import { ittenPalette, type Itten } from './color/itten';
import { monoPalette, clashPalette, commitTone, fieldHue } from './color/strategy';
import { sidebar } from './gen/sidebar';
import { maskShape } from './gen/comps';
import type { SceneNode, ImageNode, LineNode, PathNode, CircleNode, RectNode } from './types';
import { mix } from './color/convert';
import { relLum, wcag } from './color/contrast';
import { polish, type QualityReport } from './gen/quality';
import { demud, boostAccent, harmonyScore } from './color/harmony';
import { direct } from './gen/direction';
import { gridSnapLines } from '../lib/snap';
import { frameLines } from './gen/frame';
/** grid snap lines plus the proportional anchors (dynamic-symmetry eyes, canon block): placement aids, never score terms */
const withFrame = (s: { xs: number[]; ys: number[] }, W: number, H: number) => { const f = frameLines(W, H); const m = (a: number[], b: number[]) => [...new Set([...a, ...b])].sort((x, y) => x - y); return { xs: m(s.xs, f.xs), ys: m(s.ys, f.ys) }; };
import { addComponents, type PlacedComponent } from './components';

export interface Seeds { layout: string; text: string; color: string; image: string }
export interface GenInput {
  seeds: Seeds;
  ratio: Ratio;
  style: Style;
  params: Params;
  modules: Record<LayerKey, boolean>;
  modes: ModeKey[];
  fonts: FontSet;
  images: ImageAsset[]; // candidate pool
  lockedImages?: string[] | null;
  palettes: LibPalette[];
  paletteFilter?: (p: LibPalette) => boolean;
  pinnedPalette?: string[] | null;
  /** compositions of the most recent draws in this session (newest last): the auto sampler down-weights them so consecutive draws feel fresh */
  recent?: string[];
  /** re-create a stored draw exactly: use this composition when composition is auto */
  forceComp?: Comp;
  lockedPalette?: Palette | null;
  baseColor?: string | null;
  textSets: TextSet[];
  custom?: CustomText | null;
  lockedTexts?: PickedTexts | null;
  measure: Measurer;
  /** reuse a known redraw attempt (history restore / slider tweaks keep the same layout) */
  forceAttempt?: number;
  /** phase 14: a live slider-drag preview frame. The measuring-only passes (64 px raster gates, geometric gate report,
   *  optical-balance report) are skipped; everything that moves a node (safe-area nudge, weight pairing, polish) still runs,
   *  so the frame is identical to the full render — the full pass follows when the drag settles. */
  preview?: boolean;
  /** replay: the art-direction plan stored with an entry (locks change the plan's inputs, so it is not re-derived) */
  forcePlan?: DrawPlan;
  /** phase 7: replay / selector candidates keep the idea of the draw */
  forceIdea?: IdeaPick;
  /** ideas of the most recent draws (newest last) for the entropy-aware idea sampler */
  recentIdeas?: string[];
  /** ideas the sampler must not pick (the selector's challenger) */
  excludeIdeas?: string[];
  /** shared count of extra attempts the selector's candidates may still spend (deterministic: counts, not ms) */
  retryBudget?: { n: number };
  /** compositions the sampler must not pick (the selector's rejections) */
  excludeComps?: string[];
  /** salt for the layout stream: selector candidates share seeds and plan but differ in layout draws */
  layoutSalt?: string;
  /** taste selector: number of candidates for a fresh auto draw (0/1 = off) */
  select?: number;
  /** phase 11: selector mode override ('light' default, 'taste' = learned ranking) */
  selectMode?: 'light' | 'taste';
  /** phase 8 search (strategy routes + semantic mutations + MAP-Elites archive); default on with select > 1 */
  search?: boolean;
  /** per-template saved sidebar type sizes (%) */
  sidebarSizes?: Record<string, number>;
  /** always add the sidebar when the composition allows it */
  forceSidebar?: boolean;
  /** user-placed components (overlaid after layout) */
  placed?: PlacedComponent[];
  /** phase 13: params the user chose explicitly (pins + tweaks of this poster). The engine's plan, tone strategy and
   *  idea contrast never override them; palette fit only warns, unless a hard legibility failure (repaired, reported
   *  in scene.info.overrides; `fitOverride` keeps the user's colours anyway). Absent = phase 12 behaviour. */
  honor?: string[];
  /** @deprecated ignored since phase 7: retries are counted (qualityTries), never timed, so replays are exact on any machine */
  budgetMs?: number;
}
export interface Picked { texts: PickedTexts; palette: Palette; imageIds: string[]; comp: Comp; grid: { type: string; density: string; nc: number; nr: number }; sidebar?: string; attempt?: number; quality?: QualityReport; plan?: DrawPlan; salt?: string; taste?: number; idea?: IdeaPick; /** phase 8: search route (p7 or an exemplar recipe id), the strategy's semantics name, and the mutation applied */ route?: string; strategy?: string; mutation?: string }
export interface GenResult { scene: Scene; picked: Picked; ms: number; attempts?: number; /** phase 8: MAP-Elites archive of the search (one elite per lead × density × stability cell) */ archive?: ArchiveEntry[]; /** the seeds of the winning candidate (the selector may re-draw picture / colour seeds) */ seeds?: GenInput['seeds'] }

export interface ArchiveEntry { cell: string; comp: string; route: string; salt: string; score: number; taste: number; seeds: GenInput['seeds']; idea?: IdeaPick; mutation?: string }

export const DEFAULT_MODULES: Record<LayerKey, boolean> = Object.fromEntries(LAYERS.map((l) => [l, true])) as Record<LayerKey, boolean>;

const ALL_COMPOSERS: Record<Comp, (ctx: Ctx) => void> = { ...COMPOSERS, ...COMPOSERS_V2, ...COMPOSERS_V3, ...COMPOSERS_V4, ...COMPOSERS_V5, ...COMPOSERS_V8 };
/** the idea a hand-picked composition most naturally realises (for replays and manual composition choice) */
const ideaForComp = (c: string) => { const best = [...IDEAS].sort((a, b) => (b.realisers[c] ?? 0) - (a.realisers[c] ?? 0))[0]; return best?.realisers[c] ? best.id : undefined; };
// phase 5: compositions that rate ≥ 7.5 lead; legacy layouts that averaged below 7 are kept for explicit choice only
const V3_IMG_W: Record<string, number> = { layered: 0, split: 0, checker: 0, fullbleed: 0.1, giant: 0.15, partition: 0, cards: 0, fan: 0, typefill: 0, swiss: 0, centered: 0, bands: 0, ghost: 0, bento: 0.3, veil: 0.1, mosaic: 0.25, inset: 0, edge: 1.3, typo: 0, cover: 1.6, index: 0, echo: 0.7, knockout: 1.0, vertical: 1.6, quote: 1.3, ring: 1.6 };
const V3_TYPE_W: Record<string, number> = { layered: 0, typo: 0.8, edge: 1.2, swiss: 0, centered: 0, giant: 0.15, cover: 0.8, index: 0.3, echo: 1.0, knockout: 1.4, vertical: 1.5, quote: 0.6, ring: 1.5 };
const TIER_W: Record<string, number> = { photo: 3, illus: 1.6, museum: 0.7, proc: 0, gen: 3 };

/** phase 13: the treatments a user explicitly asked for, applied to every composition (only for honoured keys, so
 *  default draws and replays without `honor` are unchanged): duotone chance, cut shape, corner radius, line weight. */
function userTreat(ctx: Ctx, honor: Set<string>, p: Params, pal: Palette, seed: string) {
  const images: ImageNode[] = []; const strokes: (LineNode | PathNode | CircleNode | RectNode)[] = [];
  const walk = (ns: SceneNode[]) => { for (const n of ns) { if (n.kind === 'group') walk(n.children); else if (n.kind === 'image') images.push(n); else if ((n.kind === 'line' || n.kind === 'path' || n.kind === 'circle' || n.kind === 'rect') && n.sw && n.layer !== 'bg') strokes.push(n); } };
  walk(ctx.nodes);
  for (const n of images) {
    if (n.cutout) continue;
    const r = new Rng(`${seed}|treat|${n.id}`);
    if (honor.has('duotone')) {
      const on = r.chance(Number(p.duotone) / 100);
      if (on && !n.filter?.duotone && !n.halftone) n.filter = { ...(n.filter ?? {}), duotone: [mix(pal.dark, pal.accent, 0.3), pal.light] };
      else if (!on && n.filter?.duotone && Number(p.duotone) === 0) { const { duotone: _d, ...rest } = n.filter; void _d; n.filter = rest; }
    }
    const kind = honor.has('maskKind') ? String(p.maskKind) : 'auto';
    const frame = { x: n.x, y: n.y, w: n.w, h: n.h };
    if (kind !== 'auto' && kind !== 'grid' && kind !== 'random') { const c = kind === 'rect' ? undefined : maskShape(ctx, kind, frame); n.clip = c; }
    else if (honor.has('cornerRadius') && (!n.clip || (n.clip.type === 'rect'))) { const rx = (Number(p.cornerRadius) * ctx.u) / 12; n.clip = rx > 0 ? { type: 'rect', ...frame, rx } : undefined; }
  }
  if (honor.has('lineWeight')) { const k = Number(p.lineWeight); for (const n of strokes) n.sw = (n.sw ?? 1) * k; }
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function generateOne(inp: GenInput): GenResult {
  const t0 = now();
  const [W, H] = canvasSize(inp.ratio);
  const modes = new Set(inp.modes);
  const p: Params = { ...DEFAULT_PARAMS, ...inp.params };
  if (modes.has('experimental')) p.colorMode = 'experimental';
  if (modes.has('nice')) p.paletteSource = 'nice';
  if (modes.has('wada')) p.paletteSource = 'wada';
  // phase 8: a semantic mutation travels in the layout salt (µH / µI / µC / µM), so replays are exact
  const mut = parseMutation(inp.layoutSalt);
  if (mut === 'H') { p.titleScale = Number(p.titleScale) * 1.18; p.smallScale = Number(p.smallScale) * 0.92; }
  if (mut === 'C') p.imageZoom = Number(p.imageZoom) * 1.3;
  if (mut === 'I') (p as Params & { p8flip?: number }).p8flip = 1;
  const rI = new Rng(inp.seeds.image);
  const rC = new Rng(inp.seeds.color);
  const rT = new Rng(inp.seeds.text);

  // ---- art direction plan (v2): one committed idea per draw, from its own stream
  const userTex = String(p.texture);
  const styleTex = inp.style.params?.texture as string | undefined;
  const plan: DrawPlan = inp.forcePlan ? { ...inp.forcePlan, kit: [...inp.forcePlan.kit] } : drawPlan(inp.seeds.layout, p, {
    modes,
    canDropImages: String(p.composition) === 'auto' && !inp.lockedImages?.length && !inp.images.some((a) => a.user),
    retro: !!styleTex && styleTex !== 'none' && styleTex !== 'auto',
    paletteFree: !inp.lockedPalette && !inp.pinnedPalette?.length && String(p.paletteSource) !== 'base' && String(p.colorMode) === 'normal',
  });

  // ---- phase 13: user choices win over the plan
  const honor = new Set(inp.honor ?? []);
  const colorHonored = (['bgPref', 'soft', 'paletteSource'] as const).filter((k) => honor.has(k) && !(k === 'bgPref' && String(p.bgPref) === 'auto') && !(k === 'soft' && !p.soft));
  if (plan.v2) {
    if (colorHonored.includes('bgPref')) plan.tone = ({ light: 'light', dark: 'dark', color: 'sat' } as const)[String(p.bgPref) as 'light'] ?? plan.tone;
    if (colorHonored.length) plan.palette = 'source';
    if (honor.has('imageCount') && Number(p.imageCount) > 0 && !inp.lockedImages) plan.typeOnly = false;
  }
  const overrides: { keys: string[]; kind: 'repaired' | 'warn' | 'kept'; fails: string[] }[] = [];
  const plan0: DrawPlan = { ...plan, kit: [...plan.kit] };

  // ---- phase 8: with real copy the picture is chosen for the content (words of the copy against the picture's title
  // and category; CN copy through a small concept map). Random draws are unchanged.
  const texts0 = inp.lockedTexts ?? pickTexts(new Rng(inp.seeds.text), inp.textSets, Number(p.englishBias), (p.textSet as string) || undefined, inp.custom);
  const relW = texts0.custom || texts0.facts ? contentRelevance(texts0) : null;
  // ---- images
  const count = Number(p.imageCount);
  let images: ImageAsset[] = [];
  const lockedNone = !!inp.lockedImages && !inp.lockedImages.length && !inp.forcePlan; // locked set of a type-only poster
  if (inp.lockedImages?.length) images = inp.lockedImages.map((id) => inp.images.find((a) => a.id === id)).filter(Boolean) as ImageAsset[];
  if (images.length && images.length < count && inp.images.length > images.length) {
    images = [...images, ...rI.sample(inp.images.filter((a) => !images.includes(a)), count - images.length)];
  } else if (!images.length && count > 0 && inp.images.length) {
    const pool = modes.has('layered') ? [...inp.images.filter((a) => a.cutout), ...inp.images.filter((a) => !a.cutout)] : inp.images;
    let first: ImageAsset;
    if (modes.has('layered') && pool[0]?.cutout) first = rI.pick(pool.filter((a) => a.cutout));
    else if (plan.v2) {
      // contemporary photos first; museum paintings and procedural abstracts are an occasional accent
      const w = pool.map((a) => (a.user ? 6 : TIER_W[a.tier ?? 'photo'] ?? 1) * (relW ? relW(a) : 1));
      let r = rI.next() * w.reduce((s, v) => s + v, 0);
      first = pool[pool.length - 1];
      for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) { first = pool[i]; break; } }
    } else first = rI.pick(pool);
    images = [first, ...rI.sample(inp.images.filter((a) => a !== first), Math.max(0, count - 1))];
  }
  // long formats (16:9, 21:9) read empty as pure type: when a picture is available they keep it
  if (plan.v2 && plan.typeOnly && W / H > 1.5 && images.length) plan.typeOnly = false;
  if (lockedNone) images = [];
  if (plan.typeOnly) images = [];

  // ---- texts (own stream; drawn before the idea because the idea depends on the script of the headline)
  const texts = inp.lockedTexts ?? pickTexts(rT, inp.textSets, Number(p.englishBias), (p.textSet as string) || undefined, inp.custom);

  let ittenOn = false;
  // ---- phase 7: the idea comes first; hero, palette contrast, frame and the licensed break follow from it
  const ideaParam = String(p.idea ?? 'auto');
  const autoComp = String(p.composition) === 'auto';
  let idea: IdeaPick | null = null;
  let ideaW: Record<string, number> | null = null;
  if (plan.v2 && ideaParam !== 'off') {
    const zh = texts.headline.lang === 'zh';
    const hasImg = images.length > 0 && inp.modules.images && !plan.typeOnly;
    const hasCut = hasImg && images.some((a) => a.cutout && a.subject);
    const baseW = v2Weights({ plan, images, imagesOn: inp.modules.images, modes, W, H, zh, styleComp: inp.style.comp as Record<string, number> | undefined, recent: inp.recent, exclude: inp.excludeComps });
    const forceId = inp.forceIdea?.id ?? (ideaParam !== 'auto' ? ideaParam : undefined) ?? (inp.forceComp ? ideaForComp(inp.forceComp) : !autoComp ? ideaForComp(String(p.composition)) : undefined);
    const sI = inp.forceIdea
      ? { idea: IDEAS.find((I) => I.id === inp.forceIdea!.id)!, w: Object.fromEntries(Object.entries(IDEAS.find((I) => I.id === inp.forceIdea!.id)!.realisers).map(([c, r]) => [c, (baseW[c] ?? 0) * r])) }
      : sampleIdea(new Rng(inp.seeds.layout + '|idea'), baseW, { hasImg, hasCut, zh, wide: W / H > 1.5, recent: inp.recentIdeas, exclude: inp.excludeIdeas, force: forceId });
    if (sI) {
      ideaW = Object.values(sI.w).some((v) => v > 0) ? sI.w : null;
      const contrast = (inp.lockedPalette && inp.forceIdea?.contrast) || new Rng(inp.seeds.color + '|itten').weighted<Itten>(sI.idea.contrasts as Record<Itten, number>);
      idea = { id: sI.idea.id, contrast, frame: sI.idea.frame, brk: sI.idea.brk };
    }
  }

  // ---- palette
  let palette: Palette;
  let paletteFitInfo: Record<string, unknown> | undefined;
  if (inp.lockedPalette) palette = inp.lockedPalette;
  else {
    let src: string[] = [];
    let source = String(p.paletteSource);
    if (inp.pinnedPalette?.length) { src = inp.pinnedPalette; source = 'pinned'; }
    else if (source === 'image' && images[0]?.palette?.length) src = images[0].palette;
    else if (source === 'wada' || source === 'nice' || (source === 'image' && !images.length)) {
      const s = source === 'image' ? 'wada' : source;
      let pool = inp.palettes.filter((x) => x.src === s);
      if (inp.paletteFilter) { const f = pool.filter(inp.paletteFilter); if (f.length) pool = f; }
      const pk = rC.pick(pool.length ? pool : inp.palettes);
      src = pk?.colors ?? [];
      source = `${s}:${pk?.id}`;
    } else if (source === 'base') src = [inp.baseColor ?? '#f2efe9', ...(images[0]?.palette ?? [])];
    const fromImage = source === 'image';
    if (fromImage) src = src.map(demud); // image palettes: no muddy mid browns / olives
    const opts = { soft: Boolean(p.soft), source, baseBg: source === 'base' ? inp.baseColor ?? undefined : undefined, bgPref: String(p.bgPref) as 'auto' };
    const finish = (pl: Palette) => {
      if (!fromImage || String(p.colorMode) === 'experimental') return pl;
      const acc = boostAccent(pl.accent, pl.bg);
      return { ...pl, accent: acc, fills: pl.fills.map((f) => (f === pl.accent ? acc : f)) };
    };
    // harmony gate: draw a few role assignments from the same source colours and keep the most harmonious (OKLCH)
    let best = finish(buildPalette(src, String(p.colorMode) as ColorMode, rC, opts));
    let bh = harmonyScore(best).score;
    const pinnedBg = source === 'base' || source === 'pinned';
    for (let k = 1; k <= 3 && bh < 0.78 && !pinnedBg; k++) {
      const cand = finish(buildPalette(src, String(p.colorMode) as ColorMode, new Rng(`${inp.seeds.color}~h${k}`), opts));
      const h = harmonyScore(cand).score;
      if (h > bh + 0.03) { best = cand; bh = h; }
    }
    palette = best;
    // v2 palette strategy: single-hue field / deliberate clash / committed tonal key
    if (plan.v2 && !inp.pinnedPalette?.length && source !== 'base' && String(p.colorMode) === 'normal' && !colorHonored.length) {
      const rV = new Rng(inp.seeds.color + '|v2');
      if (plan.palette === 'mono') palette = monoPalette(fieldHue(src, rV), plan.tone, rV, src);
      else if (plan.palette === 'clash') palette = clashPalette(fieldHue(src, rV), rV, src);
      else palette = commitTone(palette, plan.tone, rV);
      // phase 7: the idea's dominant Itten contrast replaces the palette strategy (hue from the hero picture / source)
      if (idea && idea.contrast !== 'none' && (modes.has('experimental') || modes.has('random'))) idea.contrast = 'none'; // the mode's own palette wins
      if (idea && plan.palette !== 'source' && (honor.has('monoShare') || honor.has('clashShare'))) idea.contrast = 'none'; // phase 13: the asked-for palette strategy wins
      if (idea && idea.contrast !== 'none') ittenOn = true;
      if (idea && idea.contrast !== 'none') palette = ittenPalette(idea.contrast as Itten, fieldHue(src, new Rng(inp.seeds.color + '|hue')), new Rng(inp.seeds.color + '|itten2'), src);
    } else if (idea) idea.contrast = 'none';
    // ---- phase 11: palette fit (picture, copy mood, display face, known-ugly combinations). A failing palette is
    // redrawn: first from the picture's own colours, then from fresh library draws; the best fit is kept.
    if (p.paletteFit !== false && !inp.pinnedPalette?.length && source !== 'base' && String(p.colorMode) !== 'experimental') {
      const lang = texts0.headline.lang === 'zh' ? 'zh' : 'en';
      const disp = inp.fonts?.[lang]?.['big.main'];
      const copy = [texts0.headline.t, texts0.sub.t, ...texts0.groups.map((g) => g.main.t), ...texts0.meta.map((m) => m.t)].join(' ');
      const fitOf = (pl: Palette) => paletteFit({ palette: pl, image: images[0] ?? null, display: disp ? { family: disp.family, weight: disp.weight } : undefined, copy });
      let fit = fitOf(palette);
      const fit0 = fit;
      // the user's colour choice: only a hard legibility failure is repaired (and reported); soft misfits are warnings
      const hard = (f: typeof fit) => f.fails.includes('muddy-low-contrast') || wcag(palette.ink, palette.bg) < 3;
      const repair = colorHonored.length ? hard(fit) && !p.fitOverride : fit.fails.length > 0;
      if (colorHonored.length && fit.fails.length && !repair) overrides.push({ keys: [...colorHonored], kind: p.fitOverride && hard(fit) ? 'kept' : 'warn', fails: [...fit.fails] });
      if (repair) {
        const cands: Palette[] = [];
        if (images[0]?.palette?.length) for (let k = 0; k < 2; k++) cands.push(((pl: Palette) => { const acc = boostAccent(pl.accent, pl.bg); return { ...pl, accent: acc, fills: pl.fills.map((f) => (f === pl.accent ? acc : f)) }; })(buildPalette(images[0].palette.map(demud), 'normal' as ColorMode, new Rng(`${inp.seeds.color}~fit${k}`), { ...opts, source: 'image' })));
        const lib = inp.palettes.filter((x) => x.src === 'wada' || x.src === 'nice');
        for (let k = 0; k < 4 && lib.length; k++) { const rk = new Rng(`${inp.seeds.color}~fitlib${k}`); cands.push(buildPalette(rk.pick(lib).colors, 'normal' as ColorMode, rk, opts)); }
        for (const c of cands) { const f2 = fitOf(c); if (f2.fails.length < fit.fails.length || (f2.fails.length === fit.fails.length && f2.score > fit.score + 0.05)) { palette = c; fit = f2; } }
      }
      if (colorHonored.length && repair && fit !== fit0) overrides.push({ keys: [...colorHonored], kind: 'repaired', fails: [...fit0.fails] });
      paletteFitInfo = { score: fit.score, fails: fit.fails, notes: fit.notes, repaired: fit !== fit0 ? fit0.fails : undefined };
    }
  }


  if (idea && inp.lockedPalette && !inp.forceIdea) idea.contrast = 'none';
  else if (idea && !inp.lockedPalette && !ittenOn) idea.contrast = 'none'; // the label names the contrast only when it built the palette

  // ---- surface: flat by default; grain only when the plan (or an explicit user choice) asks for it
  let tex: { kind: string; amount: number } | null = null;
  if (inp.modules.texture) {
    const amt = Number(p.textureAmount) / 100;
    if (!plan.v2) tex = userTex === 'none' ? null : { kind: userTex === 'auto' ? 'grain' : userTex, amount: amt };
    else if (userTex === 'auto') tex = plan.grain > 0 ? { kind: 'grain', amount: plan.grain } : null;
    else if (userTex !== 'none' && userTex === styleTex) tex = plan.grain > 0 ? { kind: userTex, amount: amt * 0.8 } : null; // a style's paper/riso is a preference
    else if (userTex !== 'none') tex = { kind: userTex, amount: amt };
    // phase 13: an explicit amount is honoured (auto texture = grain at that amount)
    if (honor.has('textureAmount') && userTex !== 'none') tex = amt > 0 ? { kind: tex?.kind ?? (userTex === 'auto' ? 'grain' : userTex), amount: amt } : null;
  }

  const attemptOnce = (attempt: number) => {
    const lseed = inp.seeds.layout + (inp.layoutSalt ?? '').replace(/µ[A-Z]/g, ''); // a mutation keeps the structure's layout stream
    const rL = new Rng(attempt ? `${lseed}~${attempt}` : lseed);
    const pp: Params = attempt ? { ...p, decorSalt: `${p.decorSalt ?? ''}~${attempt}` } : p;
  // ---- grid & composition
    const grid = makeGrid(rL, W, H, p);
    let comp = String(p.composition) as Comp | 'auto';
    if (comp === 'auto') {
      let w: Record<string, number> = { split: 3, checker: 2, fullbleed: 2, giant: 1.5, partition: 1, cards: 1, fan: 0.8, typefill: 1, swiss: 1.5, centered: 1.5, layered: 0, bands: 1.5, ...(inp.style.comp || {}) };
      if (plan.v2) {
        // phase 6: archetype-first, entropy-aware sampler (gen/sampler.ts)
        w = ideaW ?? v2Weights({ plan, images, imagesOn: inp.modules.images, modes, W, H, zh: texts.headline.lang === 'zh', styleComp: inp.style.comp as Record<string, number> | undefined, recent: inp.recent, exclude: inp.excludeComps });
      } else {
        if (grid.type === 'curve') w.fan += 5;
        if (grid.type === 'image') { w.checker += 2; w.split += 2; }
        if (modes.has('card')) { w.giant += 5; w.cards += 4; }
        if (modes.has('clash')) w.partition += 8;
        if (modes.has('random')) w.checker += 5;
        if (modes.has('experimental')) { w.partition += 2; w.giant += 2; w.typefill += 2; }
        if (modes.has('layered')) w.layered += 10;
        if (modes.has('bandMask')) w.bands += 8;
        if (modes.has('brushMask') || modes.has('brushImage')) { w.fullbleed += 4; w.split += 2; }
        if (!images.length || !inp.modules.images) { w.checker = 0; w.fullbleed = 0; w.layered = 0; w.typefill *= 0.3; w.swiss += 3; w.centered += 2; w.giant += 1; }
        if (!images.some((a) => a.cutout)) w.layered = 0;
      }
      comp = rL.weighted<Comp>(COMPS.map((c) => [c, w[c] ?? 0]));
      if (inp.forceComp) comp = inp.forceComp;
    }
    // phase 15: restraint keeps its breathing room unless the margin was set by hand
    if (RESTRAINT.has(comp) && !honor.has('margin')) padGrid(grid, Math.round(Math.min(W, H) * RESTRAINT_MARGIN));
    const ctx = new Ctx(rL, grid, pp, palette, inp.fonts, texts, images, inp.measure, inp.modules, modes);
    ctx.comp = comp;
    ctx.plan = plan;
    ctx.idea = idea;
    // background
    ctx.add({ kind: 'rect', id: 'bg', layer: 'bg', x: 0, y: 0, w: W, h: H, fill: inp.modules.bg ? palette.bg : '#ffffff' });

    // sidebar module (compatible compositions)
    let sbTpl: string | undefined;
    const sbOK = ['split', 'swiss', 'centered', 'bands', 'cards', 'fan', 'typefill'].includes(comp) && inp.modules.sidebar && W >= H * 0.7;
    let sbRect = null as null | { x: number; y: number; w: number; h: number };
    if (sbOK && (rL.chance(0.55) || inp.forceSidebar)) {
      const side = String(p.sidebarSide) === 'auto' ? (rL.chance(0.6) ? 'left' : 'right') : String(p.sidebarSide);
      const sw = (W * Number(p.sidebarWidth)) / 100;
      const C = grid.content;
      const gap = ctx.u * 2.5;
      if (side === 'left') { sbRect = { x: C.x, y: C.y, w: sw, h: C.h }; shrinkGrid(grid, C.x + sw + gap, C.x + C.w); grid.noBleed = { l: true }; }
      else { sbRect = { x: C.x + C.w - sw, y: C.y, w: sw, h: C.h }; shrinkGrid(grid, C.x, C.x + C.w - sw - gap); grid.noBleed = { r: true }; }
    }
    ALL_COMPOSERS[comp](ctx);
    applyModes(ctx, comp);
    if (sbRect) {
      const r = sbRect;
      if (r.x < grid.content.x) r.w -= 0; // left
      sbTpl = sidebar(ctx, r.x < grid.content.x ? r : { ...r, x: r.x }, palette.bg, String(p.sidebarTpl), inp.sidebarSizes);
    }

    const own = !!(ctx as { sem?: unknown }).sem; // phase 8 strategies decide their own ornament and direction
    if (!own) applyExtras(ctx);
    if (plan.v2 && ctx.on('ornament') && ['veil', 'mosaic', 'inset', 'knockout', 'bento', 'index'].includes(comp) && ctx.rd.chance(0.14)) stickersFor(ctx);
    if (honor.size) userTreat(ctx, honor, pp, palette, inp.seeds.image);
    const scene: Scene = {
      w: W, h: H, bg: inp.modules.bg ? palette.bg : '#ffffff', nodes: ctx.nodes, palette,
      tune: p.tuneOn ? { contrast: Number(p.contrast) / 100, saturation: Number(p.saturation) / 100, brightness: Number(p.brightness) / 100 } : undefined,
      texture: tex ? { kind: tex.kind, amount: tex.amount, color: relLum(palette.bg) > 0.3 ? mix(palette.ink, palette.bg, 0.3) : mix(palette.light, palette.bg, 0.4) } : undefined,
      info: { comp, ...(idea ? { idea } : {}), grid: `${grid.type}/${grid.density} ${grid.nc}×${grid.nr}`, snap: withFrame(gridSnapLines(grid), W, H), ...(plan.v2 ? { plan: { typeOnly: plan.typeOnly, tone: plan.tone, palette: plan.palette, grain: plan.grain, kit: plan.kit, script: plan.script, geometry: plan.geometry, material: plan.material } } : {}) },
    };
    const sem = (ctx as { sem?: unknown }).sem;
    if (paletteFitInfo) scene.info.paletteFit = paletteFitInfo;
    if (overrides.length) scene.info.overrides = overrides;
    if (sem) scene.info.sem = sem; // phase 8: roles, info groups, relations, crops, variables and declared breaks
    const direction = p.artDirection === false || own ? undefined : direct(ctx, comp, { allowDrop: !inp.custom });
    if (direction) scene.info.direction = direction;
    const quality = p.collisionFix === false ? undefined : polish(ctx);
    if (quality) scene.info.score = Math.round(quality.score);
    if (inp.placed?.length) addComponents(ctx, inp.placed, scene.bg);
    scene.nodes = ctx.nodes;
    // phase 7 hard gates (aesthetic/gates.ts): measured on a 64 px raster of the scene graph
    const g = inp.preview ? { fails: [] as string[], soft: [] as string[] } as unknown as ReturnType<typeof gates> : gates(scene, gateAssets);
    if (!inp.preview) scene.info.gates = { fails: g.fails, soft: g.soft, penalty: Math.round(gatePenalty(g) * 1000) / 1000 };
    // phase 11: strict geometric gates on the measured text boxes (collisions, bleed, edge / panel padding), after a
    // safe-area nudge of small text that sits a hair too close to the edge
    let geo = { fails: [] as { kind: string; a: string; b?: string }[], soft: [] as unknown[] };
    if (p.geoGate !== false) {
      safeArea(scene);
      if (!inp.preview) geo = geoGates(scene);
      if (!inp.preview) scene.info.geo = { fails: geo.fails.map((f) => `${f.kind}:${f.a}${f.b ? '/' + f.b : ''}`), soft: geo.soft.length };
    }
    // phase 12: weight-jump rule (heavy display → hairline reading text goes to 400 at the same measure) and the
    // optical balance (centre of visual mass; a heavy block floating off-centre is "lopsided" unless anchored)
    if (p.balance !== false) {
      const paired = pairWeights(scene, inp.measure);
      if (!inp.preview) scene.info.balance = { ...balanceOf(scene, inp.measure), paired };
    }
    return { scene, comp, grid, sbTpl, quality, g, geo };
  };
  const gateAssets = new Map<string, GateAsset>(images.map((a) => [a.id, a] as [string, GateAsset]));
  const gate = p.qualityGate !== false;
  const maxTries = gate ? Math.max(0, Number(p.qualityTries ?? 5)) : 0;
  const minScore = Number(p.qualityMin ?? 78);
  let best = attemptOnce(inp.forceAttempt ?? 0);
  let bestAttempt = inp.forceAttempt ?? 0;
  let tries = 1;
  if (inp.forceAttempt === undefined) {
    // a draw is retried while its quality score is low or a hard gate fails (counted attempts: replays are exact)
    const key = (r: typeof best) => (r.quality?.score ?? 100) - 30 * r.g.fails.length - 3 * r.g.soft.length - 40 * r.geo.fails.length;
    const budget = inp.retryBudget;
    for (let a = 1; a <= maxTries && (!budget || budget.n > 0) && ((best.quality?.score ?? 100) < minScore || (gate && a <= 3 && best.g.fails.length > 0) || (gate && a <= 6 && best.geo.fails.length > 0)); a++) {
      const r = attemptOnce(a); tries++;
      if (budget) budget.n--;
      if (key(r) > key(best)) { best = r; bestAttempt = a; }
    }
  }
  const { scene, comp, grid, sbTpl, quality } = best;
  const ms = now() - t0;
  return { scene, picked: { texts, palette, imageIds: images.map((a) => a.id), comp, grid: { type: grid.type, density: grid.density, nc: grid.nc, nr: grid.nr }, sidebar: sbTpl, attempt: bestAttempt, quality, plan: plan0, ...(idea ? { idea } : {}) }, ms, attempts: tries };
}

/**
 * Generate a poster. Fresh auto draws go through the taste selector: the sampler commits to one composition, K
 * candidates of it (same copy, images, palette and plan; different layout draws) are scored by the learned taste model
 * and the best is kept. A composition on probation, or a weak best, gets one alternative composition as a challenger.
 * The winner's salt, composition and plan are stored in `picked`, so replays are exact.
 */
/** selector knobs (tuned in phase 6 by simulation + by-eye rounds) */
export const SELECT = { accept: 7.0, alts: 1, retries: 12, /** phase 11: 'light' = gates filter, then a nearly random pick among the survivors (taste only a small weight / tie-break), the default until the user's A/B data arrives; 'taste' = the learned taste ranking of phases 6–10 */ mode: 'light' as 'light' | 'taste', tasteW: 0.15, /** phase 12: cost of an unanchored lopsided candidate (optical balance) */ lopW: 1.5 };
/** phase 8 search budget (counted candidates, never ms) */
/** compositions a search route may force: the phase 8 strategies (the P7
 *  recipes stay in the bank as structural knowledge; forcing them concentrated the archetype mix) */
const ROUTE_OK = new Set<string>(['typeled', 'interleave', 'programme', 'exhibit', 'zoned']);
export const SEARCH = { routes: 2, perRoute: 2, mutate: 2, margin: 0.25, /** the type-led family is already the sampler's largest: a route into it needs a larger win */ ggMargin: 0.2, /** rank cost of a fully dropped content list (real copy only) */ missW: 1.2, /** phase 9: a picture generated with declared text zones was planned for its layout: the zoned route gets this prior */ zonedBonus: 0.5 };

export function generate(inp: GenInput): GenResult {
  const K = Math.floor(inp.select ?? 0);
  const auto = String({ ...DEFAULT_PARAMS, ...inp.params }.composition) === 'auto';
  if (K <= 1 || !auto || inp.forceComp || inp.forceAttempt !== undefined) return generateOne(inp);
  const t0 = now();
  let n = 0;
  // all candidates share one retry budget, so a draw's worst case stays bounded (replays pass forceAttempt)
  const retryBudget = { n: SELECT.retries };
  const run = (salt: string, extra: Partial<GenInput>) => {
    const r = generateOne({ ...inp, ...extra, layoutSalt: salt, retryBudget });
    const taste = tasteScore(r.scene);
    r.picked.salt = salt; r.picked.taste = taste; n++;
    r.seeds = extra.seeds ?? inp.seeds;
    // rank = learned taste − gate penalty (hard rules cost half a point)
    // phase 8: with real copy, a candidate that drops the given items / meta (or stacks Latin letters) pays for it
    const miss = contentMiss(r.scene, r.picked.texts);
    const gp = Number((r.scene.info.gates as { penalty?: number } | undefined)?.penalty ?? 0);
    const geoF = ((r.scene.info.geo as { fails?: string[] } | undefined)?.fails ?? []).length;
    const fitF = ((r.scene.info.paletteFit as { fails?: string[] } | undefined)?.fails ?? []).length;
    const lop = (r.scene.info.balance as { lopsided?: boolean } | undefined)?.lopsided ? 1 : 0;
    // light mode: hard costs (gates, geometry, palette fit, dropped content) filter; among survivors a seeded uniform draw
    // decides, the taste score only nudges it
    const light = (inp.selectMode ?? SELECT.mode) === 'light';
    const s = light ? -3 * geoF - gp - 2 * fitF - SELECT.lopW * lop - SEARCH.missW * miss + SELECT.tasteW * taste + new Rng(`${inp.seeds.layout}|pick|${salt}`).next()
      : taste - gp - 3 * geoF - 2 * fitF - SELECT.lopW * lop - SEARCH.missW * miss;
    return { r, s };
  };
  const first = run('', {});
  const plan = first.r.picked.plan;
  const comp = first.r.picked.comp;
  const idea = first.r.picked.idea;
  let best = first;
  // candidates differ in layout draws; every other one also re-draws the picture and, later, the colour source
  // a cut-out subject is part of the composition's idea, so object and cover keep their picture
  const keepImg = (c: string) => c === 'object' || c === 'cover';
  const vary = (k: number, c: string) => ({ ...inp.seeds, image: k % 2 && !keepImg(c) ? `${inp.seeds.image}#${k}` : inp.seeds.image, color: k >= 4 && k % 2 === 0 ? `${inp.seeds.color}#${k}` : inp.seeds.color });
  for (let k = 1; k < K; k++) {
    const c = run(`#${k}`, { forceComp: comp, forcePlan: plan, forceIdea: idea, seeds: vary(k, comp) });
    if (c.s > best.s) best = c;
  }
  // a weak best (or a composition on probation) gets up to SELECT.alts challenger compositions, drawn by the same
  // entropy-aware sampler (recency includes the compositions already tried), each with K/2 layout variants
  const tried = [comp];
  const lightSel = (inp.selectMode ?? SELECT.mode) === 'light';
  for (let a = 0; a < (lightSel ? 0 : SELECT.alts) && best.s < (PROBATION.has(best.r.picked.comp) ? SELECT.accept + 0.3 : SELECT.accept); a++) {
    const alt = run(`#x${a ? a : ''}`, { forcePlan: plan, excludeComps: [...tried], recent: [...(inp.recent ?? []), ...tried], excludeIdeas: idea ? [idea.id] : undefined, recentIdeas: [...(inp.recentIdeas ?? []), ...(idea ? [idea.id] : [])] });
    const ac = alt.r.picked.comp; tried.push(ac);
    let b2 = alt;
    for (let k = 1; k < Math.ceil(K / 2); k++) {
      const c = run(`#x${a ? a : ''}${k}`, { forceComp: ac, forcePlan: plan, forceIdea: alt.r.picked.idea, seeds: vary(k, ac) });
      if (c.s > b2.s) b2 = c;
    }
    if (b2.s > best.s + (PROBATION.has(ac) ? 0.25 : 0)) best = b2;
  }
  if (inp.search === false || !plan?.v2 || lightSel) return { ...best.r, ms: now() - t0, attempts: n }; // light: no strategy routes (they re-impose the selector's taste)

  // ---- phase 8 search: strategy routes chosen by exemplar retrieval → elites per route → semantic mutations of
  // the best elites → MAP-Elites archive. The P7 winner stays in the pool (no regression by the selector's own
  // measure). Deterministic counted budget: ≤ ROUTES × PER_ROUTE + MUTATE candidates.
  best.r.picked.route = 'p7';
  const pool: { r: GenResult; s: number; route: string }[] = [{ ...best, route: 'p7' }];
  const img0 = inp.images.find((a) => a.id === first.r.picked.imageIds[0]) ?? null;
  const problem = problemOf(first.r.picked.texts, img0 && !plan.typeOnly ? img0 : null, img0?.w, img0?.h);
  const routes: { comp: Comp; id: string }[] = [];
  const hasCutP = !!img0?.cutout;
  const realCopy = !!first.r.picked.texts.custom;
  const recentA = (inp.recent ?? []).map((c) => archOf(c, hasCutP));
  // session diversity: an archetype seen in the last draws costs rank (the sampler's recency rule, applied to routes)
  const recPen = (c: string) => { if (realCopy) return 0; const a = archOf(c, hasCutP); const k = recentA.slice(-4).reverse().indexOf(a); return k < 0 ? 0 : k < 2 ? 0.45 : 0.2; };
  // phase 9: a picture generated with declared text zones always gets the zoned route (its layout was planned)
  const zonedP = !!img0?.zones?.length && !plan.typeOnly;
  if (zonedP && (best.r.picked.comp as string) !== 'zoned') routes.push({ comp: 'zoned' as Comp, id: 'zones' });
  for (const { recipe } of retrieve(problem, 6)) {
    const c = recipe.route as Comp;
    if (routes.length >= SEARCH.routes + (zonedP ? 1 : 0) || c === best.r.picked.comp || routes.some((x) => x.comp === c) || !(c in ALL_COMPOSERS)) continue;
    if (inp.excludeComps?.includes(c) || !ROUTE_OK.has(c)) continue;
    // diversity: a route never repeats the archetype of the last six draws
    if (!realCopy && recentA.slice(-6).includes(archOf(c, hasCutP))) continue; // real copy: content fit outranks session variety
    routes.push({ comp: c, id: recipe.id });
  }
  for (const [ri, rt] of routes.entries()) {
    let e: { r: GenResult; s: number } | null = null;
    for (let k = 0; k < SEARCH.perRoute; k++) {
      const c = run(`#r${ri}${k}`, { forceComp: rt.comp, forcePlan: plan, seeds: vary(k, rt.comp) });
      c.r.picked.route = rt.id;
      if (!e || c.s > e.s) e = c;
    }
    if (e) pool.push({ ...e, route: rt.id });
  }
  // semantic mutations of the best elites, each tied to the design problem it shows
  const elites = [...pool].sort((a, b) => b.s - a.s).slice(0, SEARCH.mutate);
  for (const el of elites) {
    const pk = el.r.picked;
    const m: Mutation = diagnose(el.r.scene, pk.comp);
    const seeds = el.r.seeds ?? inp.seeds;
    const c = run(`${pk.salt ?? ''}µ${m}`, { forceComp: pk.comp, forcePlan: pk.plan, forceIdea: pk.idea, seeds: m === 'M' ? { ...seeds, color: `${seeds.color}#µ` } : seeds });
    c.r.picked.route = el.route; c.r.picked.mutation = m;
    pool.push({ ...c, route: el.route });
  }
  // MAP-Elites archive over lead × density × stability
  const archive = new Map<string, ArchiveEntry>();
  for (const x of pool) {
    const key = cellKey(cellOf(x.r.scene));
    const cur = archive.get(key);
    if (!cur || x.s > cur.score) archive.set(key, { cell: key, comp: x.r.picked.comp, route: x.route, salt: x.r.picked.salt ?? '', score: Math.round(x.s * 1000) / 1000, taste: x.r.picked.taste ?? 0, seeds: x.r.seeds ?? inp.seeds, ...(x.r.picked.idea ? { idea: x.r.picked.idea } : {}), ...(x.r.picked.mutation ? { mutation: x.r.picked.mutation } : {}) });
  }
  // keep the P7 winner unless a route / mutation beats it by a margin (after the session-diversity cost)
  const adj = (x: { r: GenResult; s: number; route: string }) => x.s + (x.route === 'zones' ? SEARCH.zonedBonus : 0) - ((x.route === 'p7' && !x.r.picked.mutation) || x.route === 'zones' ? 0 : recPen(x.r.picked.comp) + SEARCH.margin + (x.route !== 'p7' && archOf(x.r.picked.comp, hasCutP) === 'GG' ? SEARCH.ggMargin : 0));
  const win = pool.reduce((a, b) => (adj(b) > adj(a) ? b : a));
  const sem = win.r.scene.info.sem as { strategy?: string } | undefined;
  if (sem?.strategy) win.r.picked.strategy = sem.strategy;
  return { ...win.r, ms: now() - t0, attempts: n, archive: [...archive.values()].sort((a, b) => b.score - a.score) };
}
