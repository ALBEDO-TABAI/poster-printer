import { useEffect, useState } from 'react';
// UI-only state for the glass shell (panels, sheets, advanced navigation) + a snapshot undo stack.
// The generator state lives in ../../store; nothing here changes engine behaviour.
import { create } from 'zustand';
import { useStore, type State } from '../../store';

export type Sheet = null | 'export' | 'cmdk' | 'keys';
export interface PosterRect { left: number; top: number; width: number; height: number; right: number; bottom: number }
export interface UIState {
  insp: boolean; adv: boolean; lib: string | null; film: boolean; sheet: Sheet;
  advIntent: string; advQuery: string; focus: string; expanded: Record<string, boolean>;
  filmTab: 'hist' | 'fav'; exportFmt: 'png' | 'jpg' | 'svg'; exportScale: number; cmdQ: string;
  reduceT: boolean; uiGrid: boolean; posterGrid: number; posterRect: PosterRect | null; selBottom: number;
  /** phase 14: the ratio a click asked for, shown by the segmented control before the engine has re-rendered */
  pendingRatio: string | null;
  canUndo: number; canRedo: number; imgEdit: string | null; frame: { w: number; h: number };
  set(p: Partial<UIState>): void;
}
export const useUI = create<UIState>((set) => ({
  insp: false, adv: false, lib: null, film: false, sheet: null,
  advIntent: 'layout', advQuery: '', focus: 'margin', expanded: {},
  filmTab: 'hist', exportFmt: 'png', exportScale: 2, cmdQ: '',
  reduceT: false, uiGrid: false, posterGrid: 0, posterRect: null, selBottom: 0,
  pendingRatio: null, canUndo: 0, canRedo: 0, imgEdit: null, frame: { w: 0, h: 0 },
  set: (p) => set(p),
}));
if (typeof window !== 'undefined') (window as unknown as { __ui: unknown }).__ui = useUI;

/* ---------- undo / redo: snapshots of the editable generator state ---------- */
type Snap = { picked?: NonNullable<State['result']>['picked'] } & Pick<State, 'seeds' | 'decorSalt' | 'params' | 'pins' | 'honor' | 'modules' | 'modes' | 'locks' | 'ratio' | 'styleId' | 'fonts' | 'edits' | 'placed' | 'hIndex' | 'dirty'>;
const take = (): Snap => { const s = useStore.getState(); return { picked: s.result?.picked, seeds: s.seeds, decorSalt: s.decorSalt, params: s.params, pins: s.pins, honor: s.honor, modules: s.modules, modes: s.modes, locks: s.locks, ratio: s.ratio, styleId: s.styleId, fonts: s.fonts, edits: s.edits, placed: s.placed, hIndex: s.hIndex, dirty: s.dirty }; };
const undoStack: { label: string; s: Snap }[] = [];
const redoStack: { label: string; s: Snap }[] = [];
const sync = () => useUI.setState({ canUndo: undoStack.length, canRedo: redoStack.length });
export function pushUndo(label: string) {
  undoStack.push({ label, s: take() });
  if (undoStack.length > 200) undoStack.shift();
  redoStack.length = 0; sync();
}
async function apply(sn: Snap) {
  const s = useStore.getState();
  if (sn.hIndex !== s.hIndex && s.history[sn.hIndex]) {
    useStore.setState({ hIndex: sn.hIndex, locks: sn.locks, pins: sn.pins });
    await s.restore(s.history[sn.hIndex]);
    return;
  }
  useStore.setState({ seeds: sn.seeds, decorSalt: sn.decorSalt, params: sn.params, pins: sn.pins, honor: sn.honor, modules: sn.modules, modes: sn.modes, locks: sn.locks, ratio: sn.ratio, styleId: sn.styleId, fonts: sn.fonts, edits: sn.edits, placed: sn.placed, dirty: sn.dirty, selected: null });
  // exact undo: the poster's own picks (palette / copy / layout) come back, not a re-pick
  await s.regen(false, sn.picked && sn.ratio === s.ratio ? { keepPicked: sn.picked } : {});
  const st = useStore.getState();
  if (st.hIndex >= 0) { const h = [...st.history]; h[st.hIndex] = { ...h[st.hIndex], edits: sn.edits }; useStore.setState({ history: h }); }
}
export async function undo() {
  const u = undoStack.pop(); if (!u) return null;
  redoStack.push({ label: u.label, s: take() }); sync();
  await apply(u.s); return u.label;
}
export async function redo() {
  const r = redoStack.pop(); if (!r) return null;
  undoStack.push({ label: r.label, s: take() }); sync();
  await apply(r.s); return r.label;
}

/** phase 14: keep a panel's content mounted while its close animation plays (open/close symmetry: the glass never
 *  collapses empty). Returns the value to render: the live one while open, the last open one for `ms` after closing. */
export function useLinger<T>(v: T, ms = 300, defer = false): T {
  const [shown, setShown] = useState(defer ? (null as T) : v);
  useEffect(() => {
    if (v) {
      if (!defer) { setShown(v); return; }
      // deferred: the glass starts its entrance in the click's own frame; the content mounts on the next one
      let h2 = 0; const h = requestAnimationFrame(() => { h2 = window.setTimeout(() => setShown(v), 0); });
      return () => { cancelAnimationFrame(h); clearTimeout(h2); };
    }
    const h = setTimeout(() => setShown(v), ms);
    return () => clearTimeout(h);
  }, [v, ms, defer]);
  return defer ? shown : v || shown;
}
