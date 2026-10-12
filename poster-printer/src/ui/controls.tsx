// Shared controls in the glass design: section, scrub slider, liquid segmented control, switch, chips.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { ParamDef } from '../engine/params';
import { useStore } from '../store';
import G from './glass/glass';
import { pushUndo } from './shell/ui';

export function Card({ title, children, right, collapsible = false, open: open0 = true }: { title: ReactNode; children: ReactNode; right?: ReactNode; collapsible?: boolean; open?: boolean }) {
  const [open, setOpen] = useState(open0);
  return (
    <section className={'sec card' + (open ? '' : ' closed')}>
      <div className="sec-h" onClick={() => collapsible && setOpen(!open)} style={collapsible ? { cursor: 'pointer' } : undefined}>
        <h3>{title}</h3>
        <div className="act" onClick={(e) => e.stopPropagation()}>{right}</div>
        {collapsible && <span className="chev">{open ? '–' : '+'}</span>}
      </div>
      {open && <div className="card-body">{children}</div>}
    </section>
  );
}

const fmtNum = (v: number, step: number) => (step < 1 ? Number(v).toFixed(step < 0.5 ? 2 : 1) : String(Math.round(v)));

/** Scrub slider: drag anywhere on the track; label + value inside; double-click resets; arrows step; ⇧/⌥ drag = relative / fine. */
export function Scrub({ label, value, min, max, step = 1, unit = '', def, onChange, onStart, suffix, dataK, onHover }: {
  label: ReactNode; value: number; min: number; max: number; step?: number; unit?: string; def?: number; onChange: (v: number) => void; onStart?: () => void; suffix?: string; dataK?: string; onHover?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<null | { x: number; v0: number; moved: boolean }>(null);
  const [active, setActive] = useState(false);
  const span = max - min || 1;
  const clamp = (v: number) => Math.max(min, Math.min(max, +(Math.round(v / step) * step).toFixed(4)));
  const valAt = (x: number) => { const r = ref.current!.getBoundingClientRect(); const fr = Math.max(0, Math.min(1, (x - r.left) / r.width)); return clamp(min + fr * span); };
  const fr = ((value - min) / span) * 100;
  const mod = def !== undefined && value !== def;
  return (
    <div ref={ref} className={'scrub' + (mod ? ' mod' : '') + (active ? ' active' : '')} data-k={dataK} tabIndex={0} role="slider" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
      onPointerEnter={onHover}
      onPointerDown={(e) => { ref.current!.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, v0: value, moved: false }; setActive(true); onStart?.(); }}
      onPointerMove={(e) => {
        const d = drag.current; if (!d) return;
        if (!d.moved && Math.abs(e.clientX - d.x) > 2) { d.moved = true; document.body.classList.add('scrubbing'); }
        let v: number;
        if (e.shiftKey || e.altKey) { const r = ref.current!.getBoundingClientRect(); v = d.v0 + ((e.clientX - d.x) / r.width) * span * (e.altKey ? 0.1 : 1); v = clamp(v); }
        else v = valAt(e.clientX);
        if (v !== value) onChange(v);
      }}
      onPointerUp={(e) => { const d = drag.current; if (!d) return; if (!d.moved) { const v = valAt(e.clientX); if (v !== value) onChange(v); } drag.current = null; setActive(false); document.body.classList.remove('scrubbing'); }}
      onPointerCancel={() => { drag.current = null; setActive(false); document.body.classList.remove('scrubbing'); }}
      onDoubleClick={() => { if (def !== undefined) { onStart?.(); onChange(def); } }}
      onKeyDown={(e) => {
        const m = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); onStart?.(); onChange(clamp(value + step * m)); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); onStart?.(); onChange(clamp(value - step * m)); }
      }}>
      <div className="fill" style={{ width: fr + '%' }} />
      {def !== undefined && <span className="tick" style={{ left: ((def - min) / span) * 100 + '%' }} />}
      <span className="lab">{label}</span>
      <span className="val">{fmtNum(value, step)}{unit}{suffix ?? ''}</span>
    </div>
  );
}

/** Liquid segmented control: the thumb stretches toward the target, then the tail catches up. */
export function LSeg<T extends string>({ value, options, onChange, className = 'boxed fill sm', id, style }: {
  value: T; options: { v: T; l: ReactNode; title?: string }[]; onChange: (v: T) => void; className?: string; id?: string; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    const seg = ref.current; if (!seg) return;
    const btn = seg.querySelector(':scope > button.on');
    // phase 14: the first placement waits until the mount has been laid out by a frame (measuring inside the mount forced
    // a synchronous layout of the whole new panel: ~180 ms when the style library opened)
    if (first.current) { first.current = false; const h = requestAnimationFrame(() => setTimeout(() => G.place(seg, seg.querySelector(':scope > button.on'), false), 0)); return () => cancelAnimationFrame(h); }
    G.place(seg, btn, true);
  }, [value, options.length]);
  useEffect(() => {
    const seg = ref.current; if (!seg) return;
    const re = () => G.place(seg, seg.querySelector(':scope > button.on'), false);
    const ro = new ResizeObserver(re); ro.observe(seg);
    document.fonts?.ready.then(re);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={'seg ' + className} id={id} style={style}>
      <span className="seg-thumb" />
      {options.map((o) => <button key={o.v} data-v={o.v} title={o.title} className={o.v === value ? 'on' : ''} onClick={() => o.v !== value && onChange(o.v)}>{o.l}</button>)}
    </div>
  );
}

export function Range({ label, value, min, max, step = 1, unit = '', onChange, def }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void; def?: number }) {
  return <Scrub label={label} value={value} min={min} max={max} step={step} unit={unit} def={def} onChange={onChange} />;
}

export function Seg<T extends string>({ label, value, options, onChange, wrap }: { label?: string; value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; wrap?: boolean }) {
  const many = wrap || options.length > 4;
  return (
    <div className="ctl-col">
      {label && <span className="lab">{label}</span>}
      {many
        ? <div className="opt-grid">{options.map((o) => <button key={o.v} className={'opt' + (o.v === value ? ' on' : '')} title={o.l} onClick={() => onChange(o.v)}>{o.l}</button>)}</div>
        : <LSeg value={value} options={options} onChange={onChange} />}
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button className={'sw' + (on ? ' on' : '')} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}

export function Toggle({ label, value, onChange, mod }: { label: ReactNode; value: boolean; onChange: (v: boolean) => void; mod?: boolean }) {
  return (
    <div className={'ctl-row' + (mod ? ' mod' : '')}>
      <span className="lab">{label}</span>
      <Switch on={value} onChange={onChange} label={typeof label === 'string' ? label : undefined} />
    </div>
  );
}

/** A parameter control bound to the store (used by the libraries; the Advanced layer uses ParamCtl). */
export function ParamControl({ def }: { def: ParamDef }) {
  const lang = useStore((s) => s.lang);
  const v = useStore((s) => s.params[def.key]);
  const setParam = useStore((s) => s.setParam);
  const label = lang === 'zh' ? def.zh : def.en;
  const set = (x: number | string | boolean) => setParam(def.key, x);
  if (def.type === 'range') return <Scrub dataK={def.key} label={label} value={Number(v ?? def.def)} min={def.min} max={def.max} step={def.step} unit={def.unit} def={def.def} onStart={() => pushUndo(label)} onChange={set} />;
  if (def.type === 'bool') return <Toggle label={label} value={Boolean(v ?? def.def)} mod={Boolean(v ?? def.def) !== def.def} onChange={(x) => { pushUndo(label); set(x); }} />;
  return <Seg label={label} value={String(v ?? def.def)} options={def.options.map((o) => ({ v: o.v, l: lang === 'zh' ? o.zh : o.en }))} onChange={(x) => { pushUndo(label); set(x); }} />;
}

export function Chip({ on, children, onClick, title }: { on?: boolean; children: ReactNode; onClick?: () => void; title?: string }) {
  return <button className={'chipt chip' + (on ? ' on' : '')} onClick={onClick} title={title}>{children}</button>;
}
