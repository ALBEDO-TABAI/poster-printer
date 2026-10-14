// Phase 19: a compact colour picker for the palette editor — a saturation / brightness field, a hue strip, a hex field
// and the screen eyedropper (Chromium). Dragging reports every frame through onInput; releasing (or Enter in the hex
// field, or a picked colour) reports once through onCommit. onStart fires before the first change of a gesture, so the
// caller can take one undo snapshot per drag.
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { useT } from './i18n';
import { normHex } from '../engine/color/palette';

type HSV = [number, number, number];
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
function hexToHsv(hex: string): HSV {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, mx ? d / mx : 0, mx];
}
function hsvToHex([h, s, v]: HSV): string {
  const f = (k: number) => { const x = (k + h / 60) % 6; return v - v * s * Math.max(0, Math.min(x, 4 - x, 1)); };
  return '#' + [f(5), f(3), f(1)].map((c) => Math.round(clamp(c) * 255).toString(16).padStart(2, '0')).join('');
}

export const hasEyeDropper = () => typeof window !== 'undefined' && 'EyeDropper' in window;
export async function pickFromScreen(): Promise<string | null> {
  try {
    const ED = (window as unknown as { EyeDropper: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper;
    const r = await new ED().open();
    return normHex(r.sRGBHex);
  } catch { return null; }
}

export function ColorPicker({ value, onInput, onCommit, onStart }: { value: string; onInput: (hex: string) => void; onCommit: (hex: string) => void; onStart?: () => void }) {
  const t = useT();
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(normHex(value) ?? '#888888'));
  const [draft, setDraft] = useState(value);
  const last = useRef(value);
  // follow outside changes (another swatch, undo, a picked suggestion) without losing the hue of greys
  useEffect(() => {
    const h = normHex(value);
    setDraft(value);
    if (!h || h === last.current) return;
    last.current = h;
    const n = hexToHsv(h);
    setHsv((o) => [n[1] < 0.01 || n[2] < 0.01 ? o[0] : n[0], n[1], n[2]]);
  }, [value]);
  const emit = (n: HSV, commit: boolean) => {
    setHsv(n);
    const hex = hsvToHex(n);
    last.current = hex; setDraft(hex);
    if (commit) onCommit(hex); else onInput(hex);
  };
  const drag = (el: HTMLElement, e: React.PointerEvent, at: (fx: number, fy: number) => HSV) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    onStart?.();
    const r = el.getBoundingClientRect();
    const pos = (ev: { clientX: number; clientY: number }) => at(clamp((ev.clientX - r.left) / r.width), clamp((ev.clientY - r.top) / r.height));
    let cur = pos(e);
    emit(cur, false);
    const move = (ev: PointerEvent) => { cur = pos(ev); emit(cur, false); };
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); emit(cur, true); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  };
  // keyboard: arrows move 1 % (⇧ 10 %); the change commits like a click
  const keys = (e: React.KeyboardEvent, f: (d: number, axis: 'x' | 'y') => HSV) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    const m: Record<string, [number, 'x' | 'y']> = { ArrowLeft: [-step, 'x'], ArrowRight: [step, 'x'], ArrowUp: [step, 'y'], ArrowDown: [-step, 'y'] };
    const k = m[e.key]; if (!k) return;
    e.preventDefault(); onStart?.(); emit(f(k[0], k[1]), true);
  };
  const [h, s, v] = hsv;
  const commitDraft = () => { const x = normHex(draft); if (x && x !== normHex(value) && x !== last.current) { onStart?.(); last.current = x; setHsv(hexToHsv(x)); onCommit(x); } else setDraft(value); };
  return (
    <div className="cpick">
      <div className="cp-sv" role="slider" tabIndex={0} aria-label={t('饱和度与明度', 'Saturation and brightness')} aria-valuetext={`${Math.round(s * 100)}% / ${Math.round(v * 100)}%`}
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h} 100% 50%))` }}
        onPointerDown={(e) => drag(e.currentTarget, e, (fx, fy) => [h, fx, 1 - fy])}
        onKeyDown={(e) => keys(e, (d, ax) => (ax === 'x' ? [h, clamp(s + d), v] : [h, s, clamp(v + d)]))}>
        <i style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: hsvToHex(hsv) }} />
      </div>
      <div className="cp-hue" role="slider" tabIndex={0} aria-label={t('色相', 'Hue')} aria-valuemin={0} aria-valuemax={360} aria-valuenow={Math.round(h)}
        onPointerDown={(e) => drag(e.currentTarget, e, (fx) => [fx * 359.9, s, v])}
        onKeyDown={(e) => keys(e, (d, ax) => [(h + (ax === 'x' ? d : -d) * 360 + 360) % 360, s, v])}>
        <i style={{ left: `${(h / 360) * 100}%`, background: `hsl(${h} 100% 50%)` }} />
      </div>
      <div className="cp-row">
        <span className="cp-chip" style={{ background: normHex(draft) ?? value }} />
        <input className={'inp mono cp-hex' + (normHex(draft) ? '' : ' bad')} value={draft} spellCheck={false} aria-label="HEX"
          onChange={(e) => setDraft(e.target.value)} onBlur={commitDraft} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitDraft(); (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') { setDraft(value); (e.target as HTMLInputElement).blur(); } }} />
        {hasEyeDropper() && <button className="icon-btn press" title={t('从屏幕取色（海报、照片都可以）', 'Pick a colour from the screen (the poster, a photo…)')} onClick={async () => { const x = await pickFromScreen(); if (x) { onStart?.(); last.current = x; setHsv(hexToHsv(x)); setDraft(x); onCommit(x); } }}><Icon name="pipette" size={15} /></button>}
        <button className="icon-btn press" title={t('复制色号', 'Copy hex')} onClick={() => navigator.clipboard?.writeText(normHex(draft) ?? value).catch(() => {})}><Icon name="copy" size={15} /></button>
      </div>
    </div>
  );
}
