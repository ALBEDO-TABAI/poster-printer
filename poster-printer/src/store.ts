import { create } from 'zustand';
import { generate, DEFAULT_MODULES, type GenResult, type GenInput, type Picked, type Seeds, type Layer } from './engine/generate';
import { FIXED_PLACE, layerHint } from './engine/layers';
import { COMPONENTS, compSize, freeSlots, type PlacedComponent, type ColorRole } from './engine/components';
import { DEFAULT_PARAMS, SETTINGS_KEYS, DRAW_ONLY, RELAYOUT, REPICK_PALETTE, REPICK_TEXT, REMOVED_PARAMS, type Params } from './engine/params';
import { newSeed } from './engine/rng';
import type { LayerKey, ModeKey, Ratio, Scene } from './engine/types';
import type { FontSet, RoleKey, RoleFont, Lang } from './engine/typo';
import { BUILTIN_STYLES, type Style } from './data/styles';
import { TEXT_SETS, type CustomText } from './data/texts';
import type { ImageAsset } from './engine/gen/ctx';
import { withRoles, cleanEdits, normHex, ROLE_KEYS, type LibPalette, type Palette, type PalEdits } from './engine/color/palette';
import { canvasMeasurer } from './engine/text/measure';
import { ensureFontSet, loadFontManifest, shakeFonts } from './lib/fonts';
import { loadImages, loadPalettes } from './lib/assets';
import { applyEdits, type Edits, type NodeEdit } from './lib/edits';
import { loadUserImages, saveUserImages } from './lib/userImages';
import { Rng } from './engine/rng';

export interface Locks { text: boolean; color: boolean; image: boolean; images: boolean }
export interface PalFilter { src: 'all' | 'wada' | 'nice'; light: string; chroma: string; contrast: string; tag: string }
export interface Entry {
  id: string; ts: number; seeds: Seeds; decorSalt: string; ratio: Ratio; styleId: string; params: Params;
  modules: Record<LayerKey, boolean>; modes: ModeKey[]; fonts: FontSet; picked: Picked; edits: Edits; custom: CustomText | null; comp?: string; placed?: PlacedComponent[];
  /** phase 13: the params the engine honoured for this poster (pins + tweaks); absent on older entries = none */
  honor?: string[];
  /** phase 19: the user's own colours on this poster (palette editor); absent = none */
  palEdits?: PalEdits;
}
/** phase 19: a palette the user saved (源色 for future draws + the exact roles of the poster it came from) */
export interface MyPalette { id: string; name: string; colors: string[]; roles: PalEdits }
export interface CompPreset { id: string; name: string; type: string; text?: string; color: ColorRole; scale: number; rot?: number }
export interface SavedText { id: string; name: string; text: CustomText }
type Toast = { id: number; msg: string; kind?: 'ok' | 'warn'; group?: string; out?: boolean };

const LS = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } },
};

const measure = typeof document !== 'undefined' ? canvasMeasurer() : (null as never);
const newSeeds = (): Seeds => ({ layout: newSeed(), text: newSeed(), color: newSeed(), image: newSeed() });

export interface State {
  ready: boolean; loadMsg: string;
  lang: 'zh' | 'en'; theme: 'light' | 'dark';
  ratio: Ratio;
  styles: Style[]; styleId: string; styleTab: 'zh' | 'en' | 'mine'; dirty: boolean;
  params: Params; modules: Record<LayerKey, boolean>; modes: ModeKey[];
  /** phase 13: values locked for future draws (📌); a draw starts from the style + these */
  pins: Params;
  /** params the engine honours on the current poster (pins at draw time + keys touched since) */
  honor: string[];
  /** feedback for the last touched control: did the poster change? ('draws' = only future draws read it) */
  noEffect: { k: string; why: 'same' | 'draws' } | null;
  fonts: FontSet; fontCount: number;
  locks: Locks;
  seeds: Seeds; decorSalt: string;
  textSet: string; custom: CustomText | null; customOn: boolean; savedTexts: SavedText[];
  presetImages: ImageAsset[]; userImages: ImageAsset[]; imgCat: string; imgPick: string[];
  palettes: LibPalette[]; palFilter: PalFilter; pinnedPalette: string[] | null; baseColor: string;
  /** phase 19: the user's own colours on this poster (roles + block fills), and the ones kept for future draws */
  palEdits: PalEdits; palPins: PalEdits; myPalettes: MyPalette[];
  result: GenResult | null; scene: Scene | null; edits: Edits; selected: string | null; editingText: string | null;
  history: Entry[]; hIndex: number; favorites: Entry[];
  recording: boolean; recorded: Entry[]; replaying: boolean;
  toasts: Toast[];
  section: string; panel: string;
  view: 'poster' | 'deck';
  /** component slots */
  placed: PlacedComponent[]; compLib: CompPreset[]; showSlots: boolean; armed: { type: string; text?: string; color?: ColorRole; scale?: number; rot?: number } | null;
  addComponent(spec: { type: string; text?: string; color?: ColorRole; scale?: number; rot?: number }, at?: { x: number; y: number }): void;
  updatePlaced(id: string, patch: Partial<PlacedComponent>): void;
  removePlaced(id: string): void;
  clearPlaced(): void;
  saveCompPreset(p: Omit<CompPreset, 'id'>): void;
  deleteCompPreset(id: string): void;
  importCompLib(list: CompPreset[]): void;
  /** sidebar templates: per-template saved type size (%) */
  sbSizes: Record<string, number>;
  saveSidebarSize(tpl: string, v: number | null): void;
  // actions
  init(): Promise<void>;
  set<K extends keyof State>(k: K, v: State[K]): void;
  toast(msg: string, kind?: 'ok' | 'warn', group?: string): void;
  draw(): Promise<void>;
  regen(push?: boolean, extra?: Extra): Promise<void>;
  variant(kind: 'text' | 'decor' | 'color' | 'tendency' | 'structure' | 'image' | Layer): Promise<void>;
  go(delta: number): Promise<void>;
  restore(e: Entry, push?: boolean): Promise<void>;
  setParam(k: string, v: number | string | boolean): void;
  setParams(patch: Params): void;
  togglePin(k: string): void;
  clearPins(): void;
  resetParams(keys: string[] | 'all'): void;
  setRatio(r: Ratio): void;
  toggleModule(k: LayerKey): void;
  toggleMode(k: ModeKey): void;
  toggleLock(k: keyof Locks): void;
  pickStyle(id: string): void;
  shake(): Promise<void>;
  setRole(lang: Lang, role: RoleKey, patch: Partial<RoleFont>): void;
  copyBigToSmall(lang: Lang): void;
  saveStyleAs(name: string): void;
  updateStyle(): void;
  deleteStyle(id: string): void;
  importStyles(list: Style[]): void;
  edit(id: string, e: Partial<NodeEdit>, commit?: boolean): void;
  resetEdits(): void;
  favorite(): void;
  unfavorite(id: string): void;
  addUserImages(list: ImageAsset[]): Promise<void>;
  updateUserImage(id: string, patch: Partial<ImageAsset>): Promise<void>;
  removeUserImage(id: string): Promise<void>;
  setCustom(c: CustomText | null, on?: boolean): void;
  /** phase 19: set / clear the user's colours of this poster ('' removes one; null clears all). live = a drag frame */
  setPalEdits(patch: PalEdits | null, live?: boolean): void;
  togglePalPin(k: keyof PalEdits): void;
  /** the source colours roles are drawn from (null = back to the palette source setting); re-colours this poster */
  /** fresh: a whole palette was picked — the hand-set colours of this poster give way (pinned ones stay) */
  setSourceColors(colors: string[] | null, live?: boolean, fresh?: boolean): Promise<void>;
  savePalette(name?: string): MyPalette | null;
  deletePalette(id: string): void;
  applyPalette(p: MyPalette): Promise<void>;
  saveText(name: string): void;
}

let initStarted = false;
let regenTimer: ReturnType<typeof setTimeout> | null = null;
/* phase 14: live adjust scheduling. A burst of changes (a slider drag) renders at most one preview frame per animation
   frame (measure-only gates skipped, layout kept, so the frame equals the final render), then one full pass with gates,
   palette-fit report and the "no effect" check once the input has been quiet for SETTLE ms. Re-picks / re-layouts in a
   burst are merged so nothing a step asked for is lost. */
const SETTLE = 160;
let burst: Extra | null = null; let rafH = 0; let settleT: ReturnType<typeof setTimeout> | null = null;
const raf = (f: () => void) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(f) : (setTimeout(f, 16) as unknown as number));
function scheduleRegen(extra: Extra) {
  const b = burst ?? { base: useStore.getState().result?.scene };
  burst = { ...b, ...extra, ...(b.keepLayout === false ? { keepLayout: false } : {}), ...(b.keepPalette === false ? { keepPalette: false } : {}), ...(b.keepTexts === false ? { keepTexts: false } : {}) };
  if (!rafH) {
    // one preview per frame; a 40 ms timer stands in when frames are not delivered (background tab, occluded window)
    let done = false; let tH: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      if (done) return; done = true; rafH = 0; if (tH) clearTimeout(tH); const ex = burst ?? {};
      // a re-layout is not previewed per frame (its retries read the gates); it waits for the settle pass
      if (ex.keepLayout !== false) void useStore.getState().regen(false, { ...ex, preview: true });
    };
    rafH = raf(run); tH = setTimeout(run, 40);
  }
  if (settleT) clearTimeout(settleT);
  settleT = setTimeout(() => { settleT = null; const ex = burst ?? {}; burst = null; void useStore.getState().regen(false, ex); }, SETTLE);
}
let genToken = 0;

const styleById = (s: State, id: string) => s.styles.find((x) => x.id === id) ?? s.styles[0];
const entryOf = (s: State, r: GenResult): Entry => ({ honor: s.honor.length ? [...s.honor] : undefined,
  id: s.seeds.layout + '-' + Date.now().toString(36), ts: Date.now(), seeds: { ...s.seeds }, decorSalt: s.decorSalt, ratio: s.ratio, styleId: s.styleId,
  params: { ...s.params }, modules: { ...s.modules }, modes: [...s.modes], fonts: s.fonts, picked: r.picked, edits: {}, custom: s.customOn ? s.custom : null, comp: r.picked.comp, placed: s.placed.length ? s.placed : undefined,
  ...(Object.keys(s.palEdits).length ? { palEdits: { ...s.palEdits } } : {}),
});
/** phase 19: a palette carried into a new draw by the colour lock: its look, without the edit history of the old poster */
const plainPalette = (p: Palette): Palette => { if (!p.user) return p; const { user: _u, ...rest } = p; return rest; }; // eslint-disable-line @typescript-eslint/no-unused-vars


/** keepLayout: re-render the current poster with its plan, composition, idea, salt and attempt (the "adjust this poster" path) */
type Extra = Partial<{ keepPicked: Picked; keepTexts: boolean; keepPalette: boolean; /** phase 19: draw this poster's palette again from its source colours, even under the colour lock */ newPalette: boolean; keepImages: boolean; keepLayout: boolean; touch: string; preview: boolean; base: Scene; keepLayers: boolean; reroll: { layer: Layer; salt: string } }>;
const styleBase = (s: State): Params => ({ ...DEFAULT_PARAMS, ...styleById(s, s.styleId).params } as Params);
const settingsOf = (p: Params): Params => Object.fromEntries(SETTINGS_KEYS.filter((k) => p[k] !== undefined).map((k) => [k, p[k]]));
/** parameters a draw starts from: the style, the app settings and the pins */
export const drawParams = (s: State): Params => ({ ...styleBase(s), ...settingsOf(s.params), ...s.pins });
const sceneSig = (sc: Scene | null | undefined) => (sc ? JSON.stringify([sc.bg, sc.nodes, sc.tune, sc.texture]) : '');
/** taste selector candidates per fresh draw (phase 6) */
export const SELECT_K = 8;

export function buildInput(s: State, extra: Extra = {}, paramPatch: Params = {}): GenInput {
    const style = styleById(s, s.styleId);
    const allImages = [...s.presetImages, ...s.userImages];
    let pool = s.imgPick.length ? allImages.filter((a) => s.imgPick.includes(a.id)) : s.imgCat === 'all' ? allImages : allImages.filter((a) => a.category === s.imgCat);
    if (!pool.length) pool = allImages;
    const cur = s.result?.picked;
    const keep = extra.keepPicked;
    const lay = !keep && extra.keepLayout && cur ? cur : undefined;
    const lockedIds = keep ? keep.imageIds : s.locks.images && cur ? cur.imageIds : s.locks.image && cur ? cur.imageIds.slice(0, 1) : extra.keepImages && cur ? cur.imageIds : null;
    if (lockedIds) pool = [...allImages.filter((a) => lockedIds.includes(a.id)), ...pool.filter((a) => !lockedIds.includes(a.id))];
    const f = s.palFilter;
    return {
      seeds: s.seeds, ratio: s.ratio, style, params: { ...s.params, decorSalt: s.decorSalt, ...paramPatch }, modules: s.modules, modes: s.modes, fonts: s.fonts,
      images: s.modules.images ? pool : [], lockedImages: lockedIds,
      palettes: s.palettes,
      paletteFilter: (p) => (f.src === 'all' || p.src === f.src) && (f.light === 'any' || p.light === f.light) && (f.chroma === 'any' || p.chroma === f.chroma) && (f.contrast === 'any' || p.contrast === f.contrast) && (f.tag === 'any' || (p.tags || []).includes(f.tag)),
      pinnedPalette: s.pinnedPalette, baseColor: s.params.paletteSource === 'base' ? s.baseColor : null,
      lockedPalette: keep ? keep.palette : extra.newPalette ? null : extra.keepPalette && cur ? cur.palette : s.locks.color && cur ? plainPalette(cur.palette) : null,
      paletteEdits: s.palEdits,
      textSets: TEXT_SETS, custom: s.customOn ? s.custom : null,
      forceAttempt: keep ? keep.attempt ?? 0 : lay ? lay.attempt ?? 0 : undefined,
      lockedTexts: keep ? keep.texts : (s.locks.text || extra.keepTexts) && cur ? cur.texts : null,
      placed: s.placed, sidebarSizes: s.sbSizes, forceSidebar: String(s.params.sidebarTpl ?? 'auto') !== 'auto',
      measure,
      forceComp: keep?.comp ?? lay?.comp,
      forcePlan: keep?.plan ?? lay?.plan,
      forceIdea: keep?.idea ?? lay?.idea,
      forceKind: keep?.kind ?? lay?.kind,
      avoid: keep?.avoid ?? lay?.avoid,
      layoutSalt: keep ? keep.salt : lay ? lay.salt : undefined,
      // phase 17: the poster's layer streams (a poster made before phase 17 has none: null replays its single stream);
      // an adjustment that re-lays out keeps the layer salts it had
      layers: keep ? keep.layers ?? null : lay ? lay.layers ?? null : extra.keepLayers && cur?.layers ? cur.layers : undefined,
      reroll: extra.reroll && lay ? { ...extra.reroll, base: s.result?.scene ?? null } : undefined,
      select: keep || lay ? 0 : SELECT_K,
      honor: s.honor,
      recent: (lay || keep ? s.history.slice(Math.max(0, s.hIndex - 4), Math.max(0, s.hIndex)) : s.history.slice(-4)).map((e) => String(e.picked?.kind ?? e.comp ?? '')),
      recentIdeas: (lay || keep ? s.history.slice(Math.max(0, s.hIndex - 4), Math.max(0, s.hIndex)) : s.history.slice(-4)).map((e) => String(e.picked?.idea?.id ?? '')),
    };
}

/** Re-create the scene of a history/favourite entry (exact, using its stored picks). */
export function entryScene(e: Entry): Scene | null {
  const s = useStore.getState();
  const st: State = { ...s, honor: e.honor ?? [], seeds: e.seeds, decorSalt: e.decorSalt, ratio: e.ratio, styleId: e.styleId, params: e.params, modules: e.modules, modes: e.modes, fonts: e.fonts, customOn: !!e.custom, custom: e.custom, placed: e.placed ?? [], palEdits: e.palEdits ?? {} };
  try { return applyEdits(generate(buildInput(st, { keepPicked: e.picked })).scene, e.edits || {}); } catch { return null; }
}

/** Render a variation of the current poster synchronously (used for layout thumbnails). */
export function previewScene(paramPatch: Params, over: Partial<State> = {}): Scene | null {
  const s = { ...useStore.getState(), ...over };
  if (!s.result) return null;
  try { return generate({ ...buildInput(s, { keepPicked: s.result.picked }, paramPatch), preview: true }).scene; } catch { return null; }
}

export const useStore = create<State>((set, get) => ({
  ready: false, loadMsg: '',
  lang: LS.get('rea.lang', 'zh'), theme: LS.get('rea.theme', 'light'),
  ratio: '3:4',
  styles: [...BUILTIN_STYLES, ...LS.get<Style[]>('rea.styles.v1', [])], styleId: BUILTIN_STYLES[0].id, styleTab: 'zh', dirty: false,
  params: ({ ...DEFAULT_PARAMS, ...BUILTIN_STYLES[0].params } as Params), modules: { ...DEFAULT_MODULES }, modes: [],
  fonts: BUILTIN_STYLES[0].fonts, fontCount: 2, pins: {}, honor: [], noEffect: null,
  locks: { text: false, color: false, image: false, images: false },
  seeds: newSeeds(), decorSalt: '',
  textSet: 'auto', custom: null, customOn: false, savedTexts: LS.get('rea.texts.v1', []),
  presetImages: [], userImages: [], imgCat: 'all', imgPick: [],
  palettes: [], palFilter: { src: 'all', light: 'any', chroma: 'any', contrast: 'any', tag: 'any' }, pinnedPalette: null, baseColor: '#f1ede4',
  palEdits: {}, palPins: {}, myPalettes: LS.get('rea.myPalettes.v1', []),
  result: null, scene: null, edits: {}, selected: null, editingText: null,
  history: [], hIndex: -1, favorites: LS.get('rea.favs.v1', []),
  recording: false, recorded: [], replaying: false,
  toasts: [], section: 'global', panel: 'params',
  view: typeof location !== 'undefined' && new URLSearchParams(location.search).get('view') === 'deck' ? 'deck' : 'poster',
  placed: [], compLib: LS.get('rea.comps.v1', []), showSlots: false, armed: null,
  sbSizes: LS.get('rea.sbsizes.v1', {}),

  async init() {
    if (initStarted) return;
    initStarted = true;
    set({ loadMsg: 'fonts' });
    await loadFontManifest();
    set({ loadMsg: 'images' });
    const [presetImages, palettes, userImages] = await Promise.all([loadImages(), loadPalettes(), loadUserImages().catch(() => [])]);
    const zhStyles = get().styles.filter((s) => s.lib === 'zh');
    const first = zhStyles[new Rng(String(Date.now())).int(0, zhStyles.length - 1)] ?? get().styles[0];
    set({ presetImages, palettes, userImages, styleId: first.id, params: ({ ...DEFAULT_PARAMS, ...first.params } as Params), fonts: first.fonts, modes: first.modes ?? [], styleTab: first.lib === 'en' ? 'en' : 'zh' });
    // phase 13: params, pins and history survive a reload
    const sess = loadSession(get());
    if (sess) set(sess);
    await ensureFontSet(get().fonts);
    set({ loadMsg: '' });
    // palette handed over from the palette-draw page
    let handed: string[] | null = null;
    try { const pin = localStorage.getItem('rea.pinPalette'); if (pin) { localStorage.removeItem('rea.pinPalette'); handed = JSON.parse(pin); set({ pinnedPalette: handed }); setTimeout(() => get().toast(get().lang === 'zh' ? '已使用配色页的配色' : 'Palette from the palette page applied'), 400); } } catch { /* ignore */ }
    const cur = get().history[get().hIndex];
    if (cur) { try { await get().restore(cur); } catch { await get().regen(true); } } else await get().regen(true);
    // phase 19: the palette handed over from the palette page colours the poster on screen, not only the next draw
    if (handed?.length && cur) await get().setSourceColors(handed, false, true);
    set({ ready: true });
    useStore.subscribe((st, prev) => { if (SESSION_KEYS.some((k) => st[k] !== prev[k])) saveSessionSoon(); });
  },
  set(k, v) { set({ [k]: v } as Partial<State>); if (k === 'lang' || k === 'theme') LS.set('rea.' + k, v); },
  toast(msg, kind = 'ok', group) {
    // phase 14: one toast per message (or per group: e.g. every pin / unpin replaces the last), at most 3 on screen, each
    // re-armed when repeated; it leaves with an exit animation (out) before it is removed
    const id = Date.now() + Math.random();
    const same = (t: Toast) => !t.out && (t.msg === msg || (!!group && t.group === group));
    set((s) => ({ toasts: [...s.toasts.filter((t) => !same(t)), { id, msg, kind, group }].slice(-3) }));
    const ms = Math.min(4200, 2000 + msg.length * 40);
    setTimeout(() => set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, out: true } : t)) })), ms);
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ms + 240);
  },

  async draw() {
    const s = get();
    const seeds = newSeeds();
    let fonts = s.fonts;
    if (s.params.shakeOnDraw) fonts = shakeFonts(seeds.layout, s.fontCount).set;
    // phase 13: a draw starts from the style + settings + pins; tweaks of the last poster stay with that poster
    set({ seeds, decorSalt: '', fonts, edits: {}, selected: null, params: drawParams(s), honor: Object.keys(s.pins), noEffect: null, dirty: Object.keys(s.pins).length > 0 || Object.keys(s.palPins).length > 0, palEdits: { ...s.palPins } });
    await get().regen(true);
  },

  async regen(push = false, extra = {}) {
    const token = ++genToken;
    const s = get();
    await ensureFontSet(s.fonts);
    if (token !== genToken) return;
    // not pushed = adjust this poster: same plan / composition / salt / copy / pictures / palette unless the caller re-picks one
    const ex: Extra = push ? extra : { keepLayout: true, keepTexts: true, keepPalette: true, keepImages: true, keepLayers: true, ...extra };
    const res = generate({ ...buildInput(s, ex), ...(ex.preview ? { preview: true } : {}) });
    // phase 17: a layer re-roll that found nothing else to do leaves the poster (and the history) as it was
    const rr = res.scene.info.reroll as { layer: Layer; changed: boolean } | undefined;
    if (ex.reroll && rr && !rr.changed && sceneSig(res.scene) === sceneSig(s.result?.scene)) { get().toast(layerHint(s.lang, rr.layer, res.picked.comp), 'warn', 'reroll'); return; }
    // the selector's salt / route live only on the winner's picks: carry them over, so the next tweak and history restores
    // keep the very same layout stream (the phase 12 drift)
    const src = ex.keepPicked ?? (ex.keepLayout ? s.result?.picked : undefined);
    if (src) res.picked = { ...res.picked, salt: src.salt, taste: src.taste, route: src.route, strategy: src.strategy, mutation: src.mutation, ...(res.picked.idea || !src.idea ? {} : { idea: src.idea }) };
    if (extra.touch && !ex.preview) set({ noEffect: sceneSig(res.scene) === sceneSig(ex.base ?? s.result?.scene) ? { k: extra.touch, why: 'same' } : null });
    if (res.seeds && JSON.stringify(res.seeds) !== JSON.stringify(s.seeds)) set({ seeds: res.seeds }); // the selector's winner owns the seeds
    const edits = get().edits;
    const scene = applyEdits(res.scene, edits);
    const patch: Partial<State> = { result: res, scene };
    if (push) {
      const e = { ...entryOf(get(), res), edits };
      const hist = [...s.history.slice(0, s.hIndex + 1), e].slice(-200);
      patch.history = hist; patch.hIndex = hist.length - 1;
      if (s.recording) patch.recorded = [...s.recorded, e];
    } else if (s.hIndex >= 0) {
      const hist = [...s.history];
      hist[s.hIndex] = { ...entryOf(get(), res), id: hist[s.hIndex].id, ts: hist[s.hIndex].ts, edits };
      patch.history = hist;
    }
    set(patch);
  },

  async variant(kind) {
    const s = get();
    set({ edits: {}, selected: null });
    // phase 13: 换文字 / 换色 / 换图 / 换图形 keep the layout and re-pick only their own dimension; only 换结构 re-lays out
    const L = { keepLayout: true };
    if (kind === 'text') { set({ seeds: { ...s.seeds, text: newSeed() } }); return get().regen(true, { ...L, keepPalette: true, keepImages: true }); }
    if (kind === 'decor') { set({ decorSalt: newSeed(6) }); return get().regen(true, { ...L, keepPalette: true, keepImages: true, keepTexts: true }); }
    if (kind === 'color') { set({ seeds: { ...s.seeds, color: newSeed() } }); return get().regen(true, { ...L, keepTexts: true, keepImages: true }); }
    if (kind === 'image') {
      if (s.result && !s.result.picked.imageIds.length) get().toast(s.lang === 'zh' ? '这张是纯排版，没有图片可换' : 'Type-only poster: no picture to swap', 'warn');
      set({ seeds: { ...s.seeds, image: newSeed() } }); return get().regen(true, { ...L, keepTexts: true, keepPalette: true });
    }
    if (kind === 'structure') { set({ seeds: { ...s.seeds, layout: newSeed() } }); return get().regen(true, { keepTexts: true, keepPalette: true, keepImages: true }); }
    if (kind === 'grid' || kind === 'place' || kind === 'type') {
      // phase 17: 网格 / 图位 / 排字 re-roll one layer of the structure; the other two stay exactly where they are
      if (!s.result) return;
      if (kind === 'place' && FIXED_PLACE.has(s.result.picked.comp)) { get().toast(layerHint(s.lang, 'place', s.result.picked.comp), 'warn', 'reroll'); return; }
      if (!s.result.picked.layers) get().toast(s.lang === 'zh' ? '这张是旧版本的海报：先整体转成分层结构（重排一次），之后网格 / 图位 / 排字就能分开换了' : 'A poster from an earlier version: it is converted to layers once (one re-layout); after that grid / placement / type change separately', 'warn', 'reroll');
      return get().regen(true, { ...L, keepPalette: true, keepImages: true, keepTexts: true, reroll: { layer: kind, salt: newSeed(6) } });
    }
    if (kind === 'tendency') {
      // 换风格: another style of the same library; pins stay
      const lib = styleById(s, s.styleId).lib;
      const others = s.styles.filter((x) => x.lib === lib && x.id !== s.styleId);
      const st = others[Math.floor(Math.random() * others.length)] ?? styleById(s, s.styleId);
      set({ styleId: st.id, fonts: st.fonts, modes: st.modes ?? [] });
      set({ params: drawParams(get()), honor: Object.keys(s.pins), dirty: Object.keys(s.pins).length > 0 });
      const n = Object.keys(s.pins).length;
      get().toast((s.lang === 'zh' ? '换风格 · ' + st.name.zh : 'Style · ' + st.name.en) + (n ? (s.lang === 'zh' ? ` · 保留 ${n} 个锁定` : ` · ${n} pins kept`) : ''));
      return get().regen(true, { keepTexts: true, keepPalette: true, keepImages: true });
    }
  },

  async go(delta) {
    const s = get();
    const i = Math.max(0, Math.min(s.history.length - 1, s.hIndex + delta));
    if (i === s.hIndex) return;
    set({ hIndex: i });
    await get().restore(s.history[i]);
  },

  async restore(e, push = false) {
    set({ honor: e.honor ? [...e.honor] : [], noEffect: null, seeds: { ...e.seeds }, decorSalt: e.decorSalt, ratio: e.ratio, styleId: e.styleId, params: { ...e.params }, modules: { ...e.modules }, modes: [...e.modes], fonts: e.fonts, edits: { ...e.edits }, selected: null, custom: e.custom ?? get().custom, customOn: !!e.custom, placed: e.placed ?? [], palEdits: { ...(e.palEdits ?? {}) } });
    await get().regen(push, { keepPicked: e.picked });
  },

  setParam(k, v) { get().setParams({ [k]: v }); },
  setParams(patch) {
    // phase 18: pinning a page archetype or a text construction means the Construction composition
    if (((patch.archetype !== undefined && patch.archetype !== 'auto') || (patch.construction !== undefined && patch.construction !== 'auto')) && !('composition' in patch) && get().params.composition !== 'build') patch = { ...patch, composition: 'build' };
    const ks = Object.keys(patch);
    const live = ks.filter((k) => !SETTINGS_KEYS.includes(k));
    set((s) => {
      let pins = s.pins;
      // a pinned control keeps its pin in step; draw-only controls are pins by nature (nothing on screen reads them)
      for (const k of live) if ((DRAW_ONLY.includes(k) || k in pins) && pins[k] !== patch[k]) { if (pins === s.pins) pins = { ...s.pins }; pins[k] = patch[k]; }
      // phase 14: unchanged pins / honor keep their identity, so a slider drag does not re-render their subscribers
      const honor = live.every((k) => s.honor.includes(k)) ? s.honor : [...new Set([...s.honor, ...live])];
      return { params: { ...s.params, ...patch }, dirty: live.length ? true : s.dirty, honor, pins };
    });
    if (!live.length) return;
    const k = live[live.length - 1];
    if (live.every((x) => DRAW_ONLY.includes(x))) { set({ noEffect: { k, why: 'draws' } }); return; }
    const has = (L: string[]) => live.some((x) => L.includes(x));
    const extra: Extra = { touch: live.length === 1 ? k : 'preset', ...(has(RELAYOUT) ? { keepLayout: false } : {}), ...(has(REPICK_PALETTE) ? { keepPalette: false } : {}), ...(has(REPICK_TEXT) ? { keepTexts: false } : {}) };
    scheduleRegen(extra);
  },
  togglePin(k) {
    const s = get();
    const pins = { ...s.pins };
    if (k in pins) delete pins[k]; else pins[k] = s.params[k] ?? DEFAULT_PARAMS[k];
    set({ pins });
  },
  clearPins() { set({ pins: {}, palPins: {} }); },
  resetParams(keys) {
    const s = get();
    const base = styleBase(s);
    const ks = keys === 'all' ? Object.keys({ ...base, ...s.params }).filter((k) => !SETTINGS_KEYS.includes(k)) : keys;
    const params = { ...s.params }; const pins = { ...s.pins };
    for (const k of ks) { params[k] = base[k]; delete pins[k]; }
    const relayout = ks.some((k) => RELAYOUT.includes(k) && s.params[k] !== base[k]);
    const pal = ks.some((k) => REPICK_PALETTE.includes(k) && s.params[k] !== base[k]);
    const txt = ks.some((k) => REPICK_TEXT.includes(k) && s.params[k] !== base[k]);
    set({ params, pins, honor: keys === 'all' ? [] : s.honor.filter((k) => !ks.includes(k)), dirty: keys === 'all' ? false : s.dirty, noEffect: null });
    get().regen(false, { ...(relayout ? { keepLayout: false } : {}), ...(pal ? { keepPalette: false } : {}), ...(txt ? { keepTexts: false } : {}) });
  },
  setRatio(r) { set({ ratio: r, edits: {}, selected: null }); get().regen(false, { keepLayout: false }); },
  toggleModule(k) { set((s) => ({ modules: { ...s.modules, [k]: !s.modules[k] } })); get().regen(false, { touch: 'layer:' + k }); },
  toggleMode(k) {
    set((s) => {
      let modes = s.modes.includes(k) ? s.modes.filter((m) => m !== k) : [...s.modes, k];
      if (k === 'nice' && modes.includes('nice')) modes = modes.filter((m) => m !== 'wada');
      if (k === 'wada' && modes.includes('wada')) modes = modes.filter((m) => m !== 'nice');
      return { modes, dirty: true };
    });
    get().regen(false, { touch: 'mode:' + k, keepLayout: false, keepPalette: false });
  },
  toggleLock(k) { set((s) => ({ locks: { ...s.locks, [k]: !s.locks[k] } })); },
  pickStyle(id) {
    const s0 = get();
    const st = styleById(s0, id);
    // tweaks of this poster that are not pinned are dropped by a new style: say so; pins are kept
    const base = styleBase(s0);
    const lost = Object.keys(s0.params).filter((k) => !SETTINGS_KEYS.includes(k) && !(k in s0.pins) && s0.params[k] !== base[k]).length;
    const n = Object.keys(s0.pins).length;
    set({ styleId: st.id, fonts: st.fonts, modes: st.modes ?? [], edits: {}, selected: null, seeds: newSeeds(), decorSalt: '', palEdits: { ...s0.palPins } });
    set({ params: drawParams(get()), honor: Object.keys(s0.pins), dirty: n > 0, noEffect: null });
    if (lost || n) get().toast(s0.lang === 'zh' ? `已切换风格${lost ? ` · 本张 ${lost} 项调整已重置` : ''}${n ? ` · 保留 ${n} 个锁定` : ''}` : `Style changed${lost ? ` · ${lost} tweaks reset` : ''}${n ? ` · ${n} pins kept` : ''}`, lost ? 'warn' : 'ok');
    get().regen(true);
  },
  async shake() {
    const s = get();
    const r = shakeFonts(newSeed(), s.fontCount);
    set({ fonts: r.set, dirty: true });
    get().toast((s.lang === 'zh' ? '字体：' : 'Fonts: ') + r.names.join(' + '));
    await get().regen(false);
  },
  setRole(lang, role, patch) {
    set((s) => ({ fonts: { ...s.fonts, [lang]: { ...s.fonts[lang], [role]: { ...s.fonts[lang][role], ...patch } } }, dirty: true }));
    if (regenTimer) clearTimeout(regenTimer);
    regenTimer = setTimeout(() => get().regen(false), 40);
  },
  copyBigToSmall(lang) {
    set((s) => {
      const L = { ...s.fonts[lang] };
      for (const r of ['main', 'sub', 'note'] as const) L[`small.${r}`] = { ...L[`small.${r}`], family: L[`big.${r}`].family, weight: L[`big.${r}`].weight, italic: L[`big.${r}`].italic, case: L[`big.${r}`].case, tracking: L[`big.${r}`].tracking };
      return { fonts: { ...s.fonts, [lang]: L }, dirty: true };
    });
    get().regen(false);
  },
  saveStyleAs(name) {
    const s = get();
    const base = styleById(s, s.styleId);
    const st: Style = { id: 'u-' + Date.now().toString(36), name: { zh: name, en: name }, lib: 'mine' as never, fonts: s.fonts, params: { ...s.params }, comp: base.comp, modes: [...s.modes] };
    const styles = [...s.styles, st];
    set({ styles, styleId: st.id, dirty: false, styleTab: 'mine' });
    LS.set('rea.styles.v1', styles.filter((x) => !x.builtIn));
    get().toast(s.lang === 'zh' ? '已保存风格' : 'Style saved');
  },
  updateStyle() {
    const s = get();
    const cur = styleById(s, s.styleId);
    if (cur.builtIn) return get().saveStyleAs(cur.name[s.lang] + (s.lang === 'zh' ? ' · 改' : ' · edit'));
    const styles = s.styles.map((x) => (x.id === cur.id ? { ...x, fonts: s.fonts, params: { ...s.params }, modes: [...s.modes] } : x));
    set({ styles, dirty: false });
    LS.set('rea.styles.v1', styles.filter((x) => !x.builtIn));
    get().toast(s.lang === 'zh' ? '已更新风格' : 'Style updated');
  },
  deleteStyle(id) {
    const styles = get().styles.filter((x) => x.id !== id || x.builtIn);
    set({ styles });
    LS.set('rea.styles.v1', styles.filter((x) => !x.builtIn));
  },
  importStyles(list) {
    const ok = list.filter((x) => x && x.fonts && x.params && x.name).map((x) => ({ ...x, id: 'u-' + Math.random().toString(36).slice(2, 9), builtIn: false, lib: 'mine' as never }));
    const styles = [...get().styles, ...ok];
    set({ styles, styleTab: 'mine' });
    LS.set('rea.styles.v1', styles.filter((x) => !x.builtIn));
    get().toast((get().lang === 'zh' ? '导入风格 ' : 'Imported ') + ok.length);
  },
  edit(id, e, commit = true) {
    const s = get();
    const edits = { ...s.edits, [id]: { ...(s.edits[id] || {}), ...e } };
    const patch: Partial<State> = { edits, scene: s.result ? applyEdits(s.result.scene, edits) : s.scene };
    if (commit && s.hIndex >= 0) { const h = [...s.history]; h[s.hIndex] = { ...h[s.hIndex], edits }; patch.history = h; }
    set(patch);
  },
  resetEdits() { const s = get(); set({ edits: {}, scene: s.result?.scene ?? null }); },
  favorite() {
    const s = get();
    const e = s.history[s.hIndex];
    if (!e) return;
    if (s.favorites.some((f) => f.id === e.id)) return get().unfavorite(e.id);
    const favorites = [{ ...e, edits: s.edits }, ...s.favorites].slice(0, 120);
    set({ favorites });
    LS.set('rea.favs.v1', favorites);
    get().toast(s.lang === 'zh' ? '已收藏' : 'Saved to favorites');
  },
  unfavorite(id) { const favorites = get().favorites.filter((f) => f.id !== id); set({ favorites }); LS.set('rea.favs.v1', favorites); },
  async addUserImages(list) { const userImages = [...get().userImages, ...list]; set({ userImages }); await saveUserImages(userImages); },
  async updateUserImage(id, patch) { const userImages = get().userImages.map((a) => (a.id === id ? { ...a, ...patch } : a)); set({ userImages }); await saveUserImages(userImages); },
  async removeUserImage(id) { const userImages = get().userImages.filter((a) => a.id !== id); set({ userImages, imgPick: get().imgPick.filter((x) => x !== id) }); await saveUserImages(userImages); },
  setCustom(c, on = true) { set({ custom: c, customOn: on && !!c, edits: {} }); get().regen(false, { keepTexts: false }); },

  // ---- phase 19: the palette editor. The user's colours belong to this poster (like a tweak); a pin keeps one for
  // future draws. Element colours picked from a role follow that role to its new colour.
  setPalEdits(patch, live = false) {
    const s = get();
    let next: PalEdits = {};
    if (patch) { next = { ...s.palEdits }; for (const [k, v] of Object.entries(patch)) { if (v) next[k as keyof PalEdits] = v; else delete next[k as keyof PalEdits]; } next = cleanEdits(next); }
    const palPins = { ...s.palPins };
    for (const k of Object.keys(palPins) as (keyof PalEdits)[]) { if (next[k]) palPins[k] = next[k]; else if (patch === null || (patch && k in patch)) delete palPins[k]; }
    let edits = s.edits;
    const cur = s.result?.picked.palette;
    if (cur) {
      const after = withRoles(cur, next);
      const map = new Map<string, string>();
      for (const k of ROLE_KEYS) if (cur[k].toLowerCase() !== after[k].toLowerCase()) map.set(cur[k].toLowerCase(), after[k]);
      if (map.size) for (const [id, ed] of Object.entries(edits)) { const f = ed.fill?.toLowerCase(); if (f && map.has(f)) { if (edits === s.edits) edits = { ...s.edits }; edits[id] = { ...ed, fill: map.get(f) }; } }
    }
    set({ palEdits: next, palPins, edits, dirty: true });
    if (live) scheduleRegen({}); else void get().regen(false);
  },
  togglePalPin(k) {
    const s = get();
    const pal = s.result?.picked.palette;
    const palPins = { ...s.palPins };
    if (palPins[k]) delete palPins[k];
    else {
      const v = s.palEdits[k] ?? (/^f\d$/.test(k) ? pal?.fills[Number(k.slice(1))] : pal?.[k as (typeof ROLE_KEYS)[number]]);
      if (!v) return;
      palPins[k] = v;
    }
    set({ palPins });
  },
  async setSourceColors(colors, live = false, fresh = false) {
    const cols = (colors ?? []).map(normHex).filter((c): c is string => !!c).slice(0, 6);
    set({ pinnedPalette: cols.length ? cols : null, dirty: true, ...(fresh ? { palEdits: { ...get().palPins } } : {}) });
    if (live) { scheduleRegen({ keepPalette: false, newPalette: true }); return; }
    await get().regen(false, { keepPalette: false, newPalette: true });
  },
  savePalette(name) {
    const s = get();
    const pal = s.result?.picked.palette;
    if (!pal) return null;
    const colors = [...new Set([pal.bg, pal.ink, pal.accent, pal.alt, ...pal.fills].map((c) => c.toLowerCase()))].slice(0, 6);
    const roles = cleanEdits({ bg: pal.bg, ink: pal.ink, inkSoft: pal.inkSoft, accent: pal.accent, alt: pal.alt });
    const n = s.myPalettes.length + 1;
    const mp: MyPalette = { id: 'mp-' + Date.now().toString(36), name: name || (s.lang === 'zh' ? `我的配色 ${n}` : `My palette ${n}`), colors, roles };
    const myPalettes = [mp, ...s.myPalettes].slice(0, 120);
    set({ myPalettes }); LS.set('rea.myPalettes.v1', myPalettes);
    return mp;
  },
  deletePalette(id) { const myPalettes = get().myPalettes.filter((x) => x.id !== id); set({ myPalettes }); LS.set('rea.myPalettes.v1', myPalettes); },
  async applyPalette(mp) {
    // this poster takes the saved colours exactly; future draws draw their roles from the same source colours
    set({ pinnedPalette: [...mp.colors], palEdits: cleanEdits(mp.roles), dirty: true });
    await get().regen(false, { keepPalette: false, newPalette: true });
  },
  addComponent(spec, at) {
    const s = get();
    if (!s.scene) return;
    const scale = spec.scale ?? 1;
    const { w, h } = compSize(spec.type, scale, s.scene.w, s.scene.h);
    let pos = at ? { x: at.x - w / 2, y: at.y - h / 2 } : null;
    if (!pos) {
      const sc = s.scene;
      const others = s.placed.map((p) => { const z = compSize(p.type, p.scale, sc.w, sc.h); return { x: p.x * sc.w, y: p.y * sc.h, w: z.w, h: z.h }; });
      const sl = freeSlots(sc, w, h, others, 1)[0]; pos = sl ? { x: sl.x, y: sl.y } : { x: s.scene.w * 0.1, y: s.scene.h * 0.1 }; }
    const pc: PlacedComponent = { id: Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), type: spec.type, x: pos.x / s.scene.w, y: pos.y / s.scene.h, scale, salt: newSeed(4), color: spec.color ?? 'auto', rot: spec.rot, text: spec.text };
    set({ placed: [...s.placed, pc], selected: 'pc-' + pc.id });
    get().regen(false);
  },
  updatePlaced(id, patch) {
    set((s) => ({ placed: s.placed.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
    get().regen(false);
  },
  removePlaced(id) {
    set((s) => ({ placed: s.placed.filter((p) => p.id !== id), selected: s.selected === 'pc-' + id ? null : s.selected }));
    get().regen(false);
  },
  clearPlaced() { set({ placed: [], selected: null }); get().regen(false); },
  saveCompPreset(p) { const compLib = [{ ...p, id: 'c-' + Date.now().toString(36) }, ...get().compLib].slice(0, 200); set({ compLib }); LS.set('rea.comps.v1', compLib); },
  deleteCompPreset(id) { const compLib = get().compLib.filter((c) => c.id !== id); set({ compLib }); LS.set('rea.comps.v1', compLib); },
  importCompLib(list) {
    const ok = list.filter((c) => c && typeof c.type === 'string' && COMPONENTS.some((d) => d.id === c.type)).map((c) => ({ id: 'c-' + Math.random().toString(36).slice(2, 9), name: String(c.name || c.type).slice(0, 40), type: c.type, text: c.text ? String(c.text).slice(0, 60) : undefined, color: (['auto', 'accent', 'ink', 'plate'].includes(c.color) ? c.color : 'auto') as ColorRole, scale: Math.max(0.4, Math.min(3, Number(c.scale) || 1)), rot: Number(c.rot) || undefined }));
    const compLib = [...ok, ...get().compLib].slice(0, 200); set({ compLib }); LS.set('rea.comps.v1', compLib);
    get().toast((get().lang === 'zh' ? '导入组件 ' : 'Imported components ') + ok.length);
  },
  saveSidebarSize(tpl, v) {
    const sbSizes = { ...get().sbSizes };
    if (v == null) delete sbSizes[tpl]; else sbSizes[tpl] = v;
    set({ sbSizes }); LS.set('rea.sbsizes.v1', sbSizes);
    get().regen(false);
  },
  saveText(name) {
    const s = get();
    if (!s.custom) return;
    const savedTexts = [{ id: 't-' + Date.now().toString(36), name, text: s.custom }, ...s.savedTexts];
    set({ savedTexts }); LS.set('rea.texts.v1', savedTexts);
  },
}));

/* ---------- phase 13: session persistence (params + pins + history) ---------- */
const SESSION = 'rea.session.v1';
const SESSION_KEYS: (keyof State)[] = ['params', 'pins', 'palPins', 'honor', 'history', 'hIndex', 'styleId', 'ratio', 'modules', 'modes', 'fonts', 'locks', 'seeds', 'decorSalt'];
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const slim = (e: Entry): Entry => ({ ...e, picked: { ...e.picked, quality: undefined } });
export function saveSession() {
  const s = useStore.getState();
  const keep = 60;
  const from = Math.max(0, Math.min(s.hIndex - keep + 10, s.history.length - keep));
  const history = s.history.slice(from, from + keep).map(slim);
  LS.set(SESSION, { v: 1, params: s.params, pins: s.pins, palPins: s.palPins, honor: s.honor, history, hIndex: s.hIndex - from, styleId: s.styleId, ratio: s.ratio, modules: s.modules, modes: s.modes, fonts: s.fonts, locks: s.locks, seeds: s.seeds, decorSalt: s.decorSalt });
}
function saveSessionSoon() { if (saveTimer) clearTimeout(saveTimer); saveTimer = setTimeout(saveSession, 300); }
type Sess = Pick<State, 'params' | 'pins' | 'palPins' | 'honor' | 'history' | 'hIndex' | 'styleId' | 'ratio' | 'modules' | 'modes' | 'fonts' | 'locks' | 'seeds' | 'decorSalt'>;
function loadSession(s: State): Partial<State> | null {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('fresh')) return null;
  const x = LS.get<(Sess & { v: number }) | null>(SESSION, null);
  if (!x || x.v !== 1 || !s.styles.some((st) => st.id === x.styleId)) return null;
  const clean = (p: Params) => Object.fromEntries(Object.entries(p || {}).filter(([k]) => !REMOVED_PARAMS.includes(k))) as Params;
  const history = Array.isArray(x.history) ? x.history.filter((e) => e && e.picked && e.seeds) : [];
  return { params: { ...DEFAULT_PARAMS, ...clean(x.params) } as Params, pins: clean(x.pins), palPins: cleanEdits(x.palPins), honor: x.honor ?? [], history, hIndex: Math.min(history.length - 1, Math.max(-1, x.hIndex)), styleId: x.styleId, ratio: x.ratio ?? s.ratio, modules: { ...s.modules, ...x.modules }, modes: x.modes ?? [], fonts: x.fonts ?? s.fonts, locks: { ...s.locks, ...x.locks }, seeds: x.seeds ?? s.seeds, decorSalt: x.decorSalt ?? '', styleTab: styleById(s, x.styleId).lib === 'en' ? 'en' : styleById(s, x.styleId).lib === 'zh' ? 'zh' : 'mine' };
}

if (typeof window !== 'undefined') (window as unknown as { __rea: unknown }).__rea = useStore;
