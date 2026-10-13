// Shell actions: thin wrappers over the generator store that add undo snapshots, toasts and panel state.
import { useStore, type Locks } from '../../store';
import type { Ratio } from '../../engine/types';
import { useUI, pushUndo, undo as undoFn, redo as redoFn } from './ui';
import { uiParam } from './ia';
import { doExport } from '../panels/MorePanel';
import G from '../glass/glass';
import type { Layer } from '../../engine/generate';
import { LAYER_INFO } from '../../engine/layers';

const S = () => useStore.getState();
const t = (zh: string, en: string) => (S().lang === 'zh' ? zh : en);
export const toast = (m: string) => S().toast(m);

export const REMIX: [kind: 'text' | 'color' | 'image' | 'structure' | 'decor' | 'tendency', icon: string, zh: string, en: string][] = [
  ['text', 'type', '文字', 'Text'], ['color', 'palette', '配色', 'Colour'], ['image', 'image', '图片', 'Image'],
  ['structure', 'layout-grid', '结构', 'Structure'], ['decor', 'shapes', '图形', 'Graphics'], ['tendency', 'wand-sparkles', '风格', 'Style'],
];
export const LOCKS: [keyof Locks, string, string, string, string][] = [['text', 'type', '文字', 'Text', '⇧1'], ['color', 'palette', '配色', 'Colour', '⇧2'], ['image', 'image', '主图', 'Image', '⇧3'], ['images', 'images', '全部图', 'All images', '⇧4']];
export const RATIOS: Ratio[] = ['3:4', '9:16', '1:1', '4:3', '16:9', '21:9'];

/* phase 14: a press is one action. The second click of a double-click (event.detail > 1) on 抽一张 / a remix button is
   ignored by the dock (Chrome.tsx), and a held key's auto-repeat by the keyboard handler; separate presses always count. */
const guard = () => true;
const release = <T,>(p: Promise<T>) => p;
/** run heavy work after the frame that shows the press has painted: input handling stays < 16 ms and the button,
 *  LED and ripple respond in the very next frame; the poster lands when the engine is done */
export const afterPaint = <T,>(f: () => Promise<T> | T) => new Promise<T>((res, rej) => requestAnimationFrame(() => setTimeout(() => { try { Promise.resolve(f()).then(res, rej); } catch (e) { rej(e); } }, 0)));
export function draw() {
  if (S().replaying || !guard()) return;
  pushUndo(t('抽一张', 'Draw'));
  document.getElementById('btn-draw')?.classList.add('busy');
  setTimeout(() => document.getElementById('btn-draw')?.classList.remove('busy'), 640);
  return release(afterPaint(() => S().draw()));
}
export function remix(kind: (typeof REMIX)[number][0]) {
  const r = REMIX.find((x) => x[0] === kind)!;
  if (!guard()) return;
  pushUndo(t('换' + r[2], 'New ' + r[3].toLowerCase()));
  document.querySelector(`[data-remix="${kind}"]`)?.classList.add('busy');
  return release(afterPaint(() => S().variant(kind))).finally(() => document.querySelector(`[data-remix="${kind}"]`)?.classList.remove('busy'));
}
/** phase 17: re-roll one layer of the structure — 网格 grid / 图位 placement / 排字 type — keeping the other two */
export const LAYER_ICON: Record<Layer, string> = { grid: 'grid-3x3', place: 'move', type: 'pilcrow' };
export function relayer(layer: Layer) {
  if (!guard() || S().replaying || !S().result) return;
  const L = LAYER_INFO[layer];
  pushUndo(t('换' + L.zh, 'New ' + L.en.toLowerCase()));
  const q = `[data-layer="${layer}"]`;
  document.querySelectorAll(q).forEach((b) => b.classList.add('busy'));
  return release(afterPaint(() => S().variant(layer))).finally(() => document.querySelectorAll(q).forEach((b) => b.classList.remove('busy')));
}
export const go = (d: number) => S().go(d);
export function setRatio(r: Ratio) { if (r === S().ratio) return; pushUndo(t('画幅 ', 'Ratio ') + r); useUI.setState({ pendingRatio: r }); return afterPaint(() => S().setRatio(r)).finally(() => { if (useUI.getState().pendingRatio === r) useUI.setState({ pendingRatio: null }); }); }
export function toggleLock(k: keyof Locks) {
  pushUndo(t('锁定', 'Lock')); S().toggleLock(k);
  const n = LOCKS.find((l) => l[0] === k)!; const on = S().locks[k];
  toast((on ? t('已锁定', 'Locked ') : t('已解锁', 'Unlocked ')) + t(n[2], n[3].toLowerCase()));
}
export const favorite = () => S().favorite();
export function setParam(k: string, v: number | string | boolean, undoable = true) {
  if (undoable) { const d = uiParam(k); pushUndo(d ? t(d.pzh, d.pen) : k); }
  S().setParam(k, v);
  if (useUI.getState().focus !== k) useUI.setState({ focus: k });
  if (['margin', 'cols', 'rows', 'gutter', 'baseline', 'gridStrength', 'gridOpacity', 'dashed', 'guides', 'gridType', 'density'].includes(k)) showPosterGrid();
}
export function togglePin(k: string) {
  const d = uiParam(k); const on = !(k in S().pins);
  pushUndo((on ? t('锁定 ', 'Pin ') : t('解除锁定 ', 'Unpin ')) + (d ? t(d.pzh, d.pen) : k));
  S().togglePin(k);
  // phase 14: the chip appearing / leaving under 抽一张 is the feedback; one replaceable toast, never a stack
  S().toast(on ? t(`已锁定「${d?.pzh ?? k}」到之后的抽卡`, `“${d?.pen ?? k}” pinned for future draws`) : t(`已解除锁定「${d?.pzh ?? k}」`, `“${d?.pen ?? k}” unpinned`), 'ok', 'pin');
}
export function clearPins() { const n = Object.keys(S().pins).length; if (!n) return; pushUndo(t('全部解除', 'Unpin all')); S().clearPins(); toast(t(`已解除 ${n} 个锁定`, `${n} pins cleared`)); }
export function resetAll() { pushUndo(t('全部还原为风格', 'Reset all to style')); S().resetParams('all'); S().clearPins(); toast(t('已全部还原为风格（锁定已解除）', 'All back to the style (pins cleared)')); }
export function resetGroup(keys: string[], label: string) { pushUndo(t('复位 ', 'Reset ') + label); S().resetParams(keys); }
export function toggleModule(k: Parameters<ReturnType<typeof S>['toggleModule']>[0]) { pushUndo(t('图层', 'Layer')); S().toggleModule(k); }
export function toggleMode(k: Parameters<ReturnType<typeof S>['toggleMode']>[0]) { pushUndo(t('模式', 'Mode')); S().toggleMode(k); }
export function pickStyle(id: string) { pushUndo(t('风格', 'Style')); S().pickStyle(id); }
export async function undo() { const l = await undoFn(); if (l) toast(t('撤销 · ', 'Undo · ') + l); }
export async function redo() { const l = await redoFn(); if (l) toast(t('重做 · ', 'Redo · ') + l); }

export function toggleTheme() { S().set('theme', S().theme === 'dark' ? 'light' : 'dark'); }
export function toggleLang() { S().set('lang', S().lang === 'zh' ? 'en' : 'zh'); }
export function setReduceT(v: boolean) { useUI.setState({ reduceT: v }); document.documentElement.classList.toggle('reduce-transparency', v); G.refreshAll(); }

let gridTimer: ReturnType<typeof setTimeout> | undefined;
export function showPosterGrid(keep = false) {
  clearTimeout(gridTimer);
  if (!useUI.getState().posterGrid) useUI.setState({ posterGrid: Date.now() });
  if (!keep) gridTimer = setTimeout(() => useUI.setState({ posterGrid: 0 }), 1400);
}
export function toggleUIGrid(on?: boolean) {
  const v = on ?? !useUI.getState().uiGrid;
  useUI.setState({ uiGrid: v });
  if (on === undefined) toast(v ? t('UI 网格：开 · 按 G 关闭', 'UI grid on · press G to hide') : t('UI 网格：关', 'UI grid off'));
}

/* phase 14: sheets remember who opened them and hand focus back on close */
let opener: HTMLElement | null = null;
export function openSheet(k: 'export' | 'cmdk' | 'keys') {
  const u = useUI.getState(); if (u.sheet === k) return;
  if (!u.sheet) { const a = document.activeElement as HTMLElement | null; opener = a && a !== document.body ? a : document.querySelector<HTMLElement>(k === 'cmdk' ? '#btn-cmdk' : k === 'export' ? '#btn-export' : '#r-keys'); }
  useUI.setState({ sheet: k });
}
/** the opener's centre, for the sheet's transform-origin (it grows out of the button that opened it) */
export function sheetOrigin(): { x: number; y: number } | null { if (!opener?.isConnected) return null; const r = opener.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
export function closeSheets() {
  if (!useUI.getState().sheet) return;
  useUI.setState({ sheet: null, cmdQ: '' });
  const o = opener; opener = null;
  if (o && o.isConnected) requestAnimationFrame(() => o.focus({ preventScroll: true }));
}
/** light panels (library, history film) close on a click in the empty canvas; work panels (inspector, advanced) stay */
export function dismissLight() { const u = useUI.getState(); if (u.lib || u.film) useUI.setState({ lib: null, film: false }); }
export function togglePanel(k: 'insp' | 'adv' | 'film') {
  const u = useUI.getState();
  // one right-hand panel: the inspector and 高级调校 replace each other (no hidden-but-open state behind the other)
  if (k === 'insp') useUI.setState(u.adv ? { adv: false, insp: true } : { insp: !u.insp });
  else if (k === 'adv') useUI.setState(u.adv ? { adv: false } : { adv: true, insp: false });
  else useUI.setState({ film: !u.film });
}
export function openLib(k: string) { const u = useUI.getState(); useUI.setState({ lib: u.lib === k ? null : k }); }
export function openLayers() { const u = useUI.getState(); if (u.adv && u.advIntent === 'layers') { useUI.setState({ adv: false }); return; } useUI.setState({ adv: true, insp: false, advIntent: 'layers', advQuery: '' }); }
export function openParam(k: string) {
  const d = uiParam(k); if (!d) return;
  const u = useUI.getState();
  useUI.setState({ adv: true, insp: false, advIntent: d.intent, advQuery: '', focus: k, expanded: d.tier === 2 ? { ...u.expanded, [d.group]: true } : d.tier === 3 ? { ...u.expanded, ['classic.' + d.intent]: true } : u.expanded });
  setTimeout(() => {
    const el = document.querySelector(`#adv-main [data-k="${k}"]`) as HTMLElement | null;
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.animate([{ boxShadow: '0 0 0 0 rgba(255,90,31,0)' }, { boxShadow: '0 0 0 4px rgba(255,90,31,.35)' }, { boxShadow: '0 0 0 0 rgba(255,90,31,0)' }], { duration: 1200, delay: 250 }); }
  }, 160);
}
export function setView(v: 'poster' | 'deck' | 'palette') {
  if (v === 'palette') { location.href = './color.html'; return; }
  window.history.pushState(null, '', v === 'deck' ? './?view=deck' : './');
  S().set('view', v);
}
export async function quickExport() { const u = useUI.getState(); await doExport(u.exportFmt === 'svg' ? 'png' : u.exportFmt, u.exportScale); }
export function hideSelected() {
  const s = S(); const id = s.selected; if (!id) return;
  pushUndo(t('隐藏', 'Hide'));
  if (id.startsWith('pc-')) s.removePlaced(id.slice(3));
  else { s.edit(id, { hidden: true }); useStore.setState({ selected: null }); }
  toast(t('已隐藏 · ⌘Z 撤销', 'Hidden · ⌘Z to undo'));
}
