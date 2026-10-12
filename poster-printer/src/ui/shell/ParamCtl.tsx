// A parameter control bound to the store, in the prototype's form (scrub / switch / liquid seg / option grid / composition cards).
import { memo, useEffect, useRef, useState } from 'react';
import { useStore, previewScene } from '../../store';
import { renderSVG } from '../../engine/render/svg';
import { LSeg, Scrub, Switch } from '../controls';
import { uiParam } from './ia';
import { Icon } from '../Icon';
import { useIdleMap } from '../idle';
import { DRAW_ONLY, RELAYOUT, REPICK_PALETTE, REPICK_TEXT } from '../../engine/params';
import { COMPOSERS } from '../../engine/gen/comps';
import { useUI, pushUndo } from './ui';
import * as A from './actions';

const fit = (svg: string) => svg.replace(/^<svg([^>]*?) width="[\d.]+" height="[\d.]+"/, '<svg$1 width="100%" height="100%" preserveAspectRatio="xMidYMid slice"');

/** how a control acts (phase 13): live on this poster, re-lays it out, re-picks one dimension, or only future draws */
export function scopeOf(k: string): 'relayout' | 'palette' | 'text' | 'draws' | 'classic' | 'live' {
  const d = uiParam(k);
  if (DRAW_ONLY.includes(k)) return 'draws';
  if (d?.tier === 3) return 'classic';
  if (RELAYOUT.includes(k)) return 'relayout';
  if (REPICK_PALETTE.includes(k)) return 'palette';
  if (REPICK_TEXT.includes(k)) return 'text';
  return 'live';
}
const SCOPE: Record<string, [string, string, string, string]> = {
  relayout: ['会重新排版', 'Re-lays out', '改动会重新排这张海报（文字、配色、图片保持）。', 'Re-lays out this poster (copy, palette and pictures stay).'],
  palette: ['只换配色', 'Palette only', '只重新配这张的颜色，版式、文字和图片不动。', 'Re-picks only this poster’s colours; layout, copy and pictures stay.'],
  text: ['只换文字', 'Copy only', '只重新选这张的文字，版式不动。', 'Re-picks only this poster’s copy; the layout stays.'],
  draws: ['下次抽卡', 'Next draws', '只在抽卡时读取，自动锁定到之后的抽卡；当前这张不变。', 'Read only when a draw is planned; pinned for future draws automatically. This poster does not change.'],
  classic: ['仅经典构图', 'Classic only', '只有 12 种经典构图（分割、满版、巨字、卡片……）读取它；当前多数构图不读取。', 'Read only by the 12 classic compositions (split, full-bleed, giant, cards…); most current compositions ignore it.'],
  live: ['', '', '即时作用于这张海报，版式不变。', 'Applies live to this poster; the layout stays.'],
};
const CLASSIC = new Set(Object.keys(COMPOSERS));

/** memoised (phase 14): every prop is a primitive and every store read is a narrow selector */
export const ParamCtl = memo(function ParamCtl({ k, compact, hover }: { k: string; compact?: boolean; hover?: boolean }) {
  const d = uiParam(k)!;
  const lang = useStore((s) => s.lang);
  const raw = useStore((s) => s.params[k]);
  const pinned = useStore((s) => k in s.pins);
  const fb = useStore((s) => (s.noEffect?.k === k ? s.noEffect.why : null));
  const comp = useStore((s) => s.result?.picked.comp ?? '');
  const ovKind = useStore((s) => ((s.scene?.info.overrides as { keys: string[]; kind: string }[] | undefined) ?? []).find((o) => o.keys.includes(k))?.kind ?? '');
  const ov = ovKind ? { kind: ovKind } : undefined;
  const [exp, setExp] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // phase 14: the ? explainer is a light popover — one at a time, closed by Esc (before the panel) or a click elsewhere
  useEffect(() => {
    if (!exp) return;
    const other = (e: Event) => { if ((e as CustomEvent).detail !== k) setExp(false); };
    const down = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setExp(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); setExp(false); } };
    window.dispatchEvent(new CustomEvent('pexp-open', { detail: k }));
    window.addEventListener('pexp-open', other); document.addEventListener('pointerdown', down, true); window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('pexp-open', other); document.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key, true); };
  }, [exp, k]);
  // "modified" and reset are relative to the current style's baseline (falls back to the engine default)
  const base = useStore((s) => s.styles.find((x) => x.id === s.styleId)?.params[k]) ?? d?.def;
  if (!d) return null;
  const v = raw ?? d.def;
  const zh = lang === 'zh';
  const name = zh ? d.pzh : d.pen;
  const mod = v !== base;
  const sc = scopeOf(k);
  const classicHere = sc === 'classic' && CLASSIC.has(comp);
  const tag = SCOPE[sc][zh ? 0 : 1];
  const onHover = hover ? () => { if (useUI.getState().focus !== k) useUI.setState({ focus: k }); } : undefined;
  const reset = () => { if (!mod && !pinned) return; pushUndo((zh ? '复位 ' : 'Reset ') + name); useStore.getState().resetParams([k]); };
  const lab = <>{name}{pinned && <span className="ppin" title={zh ? '已锁定到之后的抽卡' : 'Pinned for future draws'}><Icon name="pin" size={11} /></span>}{tag && <span className={'ptag ' + sc + (classicHere ? ' here' : '')}>{classicHere ? (zh ? '本张生效' : 'Active here') : tag}</span>}</>;
  let ctl: React.ReactNode;
  if (d.type === 'range') {
    ctl = <Scrub dataK={k} label={lab} value={Number(v)} min={d.min} max={d.max} step={d.step} unit={d.unit} def={Number(base)} onHover={onHover}
      suffix={(k === 'cols' || k === 'rows') && Number(v) === 0 ? (zh ? ' · 自动' : ' · auto') : ''}
      onStart={() => { pushUndo(name); useUI.setState({ focus: k }); }} onChange={(x) => A.setParam(k, x, false)} />;
  } else if (d.type === 'bool') ctl = <div className={'ctl-row' + (mod ? ' mod' : '')} data-k={k} onPointerEnter={onHover}><span className="lab" onDoubleClick={reset} title={zh ? '双击复位' : 'Double-click to reset'}>{lab}</span><Switch on={!!v} label={name} onChange={(x) => A.setParam(k, x)} /></div>;
  else if (k === 'composition') ctl = <CompPicker />;
  else {
    const opts = d.options.map((o) => ({ v: o.v, l: zh ? o.zh : o.en }));
    ctl = d.options.length <= 4 && !compact
      ? <div className={'ctl-col' + (mod ? ' mod' : '')} data-k={k} onPointerEnter={onHover}><span className="lab" onDoubleClick={reset} title={zh ? '双击复位' : 'Double-click to reset'}>{lab}</span><LSeg value={String(v)} options={opts} onChange={(x) => A.setParam(k, x)} /></div>
      : <div className={'ctl-col' + (mod ? ' mod' : '')} data-k={k} onPointerEnter={onHover}>
          <span className="lab" onDoubleClick={reset} title={zh ? '双击复位' : 'Double-click to reset'}>{lab}</span>
          <div className="opt-grid">{opts.map((o) => <button key={o.v} className={'opt' + (o.v === String(v) ? ' on' : '')} data-v={o.v} title={o.l} onClick={() => A.setParam(k, o.v)}>{o.l}</button>)}</div>
        </div>;
  }
  const fix = (on: boolean) => { pushUndo(zh ? '仍用我的颜色' : 'Keep my colours'); A.setParam('fitOverride', on, false); };
  return (
    <div ref={box} className={'pctl' + (pinned ? ' pinned' : '') + (mod ? ' mod' : '')} data-pk={k} data-scope={sc}>
      <div className="ptools">
        <button className={'pt press' + (exp ? ' on' : '')} data-act="help" title={zh ? '这个参数做什么' : 'What this does'} aria-expanded={exp} onClick={() => setExp(!exp)}><Icon name="circle-help" size={13} /></button>
        {(sc !== 'draws' || pinned) && <button className={'pt press' + (pinned ? ' on' : '')} data-act="pin" title={pinned ? (zh ? '解除锁定（之后的抽卡不再沿用）' : 'Unpin (future draws stop using it)') : (zh ? '锁定到之后的抽卡' : 'Pin for future draws')} onClick={() => A.togglePin(k)}><Icon name="pin" size={13} /></button>}
        {(mod || pinned) && <button className="pt press" data-act="reset" title={zh ? '复位到风格（双击控件也可以）' : 'Reset to the style (or double-click)'} onClick={reset}><Icon name="rotate-ccw" size={13} /></button>}
      </div>
      {ctl}
      {exp && <p className="pexp">{(zh ? d.hzh : d.hen) || name} <span className="muted">{SCOPE[sc][zh ? 2 : 3]}</span></p>}
      {fb === 'same' && <p className="pnote" data-note="same"><Icon name="info" size={12} />{zh ? '本张不受影响' : 'No effect on this poster'}{sc === 'classic' && !classicHere ? (zh ? ' · 当前构图不读取，换经典构图后生效' : ' · this composition ignores it; try a classic one') : ''}</p>}
      {fb === 'draws' && <p className="pnote" data-note="draws"><Icon name="pin" size={12} />{zh ? '已锁定到之后的抽卡 · 当前这张不变' : 'Pinned for future draws · this poster stays'}</p>}
      {ov && ov.kind === 'repaired' && <p className="pnote warn" data-note="override"><Icon name="info" size={12} />{zh ? '已为可读性调整' : 'Adjusted for legibility'} · <button className="plink" onClick={() => fix(true)}>{zh ? '仍用我的' : 'Use mine anyway'}</button></p>}
      {ov && ov.kind === 'kept' && <p className="pnote warn" data-note="kept"><Icon name="info" size={12} />{zh ? '按你的颜色保留（可读性偏低）' : 'Kept your colours (low legibility)'} · <button className="plink" onClick={() => fix(false)}>{zh ? '恢复修正' : 'Repair again'}</button></p>}
      {ov && ov.kind === 'warn' && <p className="pnote" data-note="warn"><Icon name="info" size={12} />{zh ? '与图片或文案不太搭，已按你的选择保留' : 'A loose fit for the picture or copy — kept as you chose'}</p>}
    </div>
  );
});

/* composition cards with live thumbnails of the current poster in each composition (computed when idle, cached per poster) */
const thumbCache = new Map<string, string>();
export function CompPicker({ value, onPick }: { value?: string; onPick?: (v: string) => void }) {
  const d = uiParam('composition')!;
  const lang = useStore((s) => s.lang);
  const cur = useStore((s) => String(s.params.composition));
  const result = useStore((s) => s.result);
  const entry = useStore((s) => s.history[s.hIndex]?.id ?? '');
  const key = entry + ':' + (result?.scene.w ?? 0) + 'x' + (result?.scene.h ?? 0);
  const v = value ?? cur;
  // phase 14: the shared idle queue (one composition per idle slot)
  useIdleMap(result && d.type === 'seg' ? d.options.filter((o) => o.v !== 'auto').map((o) => o.v) : [], key, thumbCache, (v) => { const sc = previewScene({ composition: v }); return sc ? fit(renderSVG(sc)) : ''; });
  if (d.type !== 'seg') return null;
  const pick = onPick ?? ((x: string) => A.setParam('composition', x));
  return (
    <div className="ctl-col" data-k="composition">
      <span className="lab">{lang === 'zh' ? d.pzh : d.pen}<span className="muted" style={{ fontWeight: 400, marginLeft: 'auto' }}>{d.options.length - 1} {lang === 'zh' ? '种手法' : 'moves'}</span></span>
      <div className="comp-grid">
        {d.options.map((o) => {
          const svg = thumbCache.get(key + o.v);
          return (
            <button key={o.v} className={'comp-card' + (o.v === v ? ' on' : '')} data-v={o.v} onClick={() => pick(o.v)}>
              <span className="th">{o.v === 'auto' ? <span className="auto">Auto</span> : svg ? <span className="svgth" dangerouslySetInnerHTML={{ __html: svg }} /> : <span className="auto">{(lang === 'zh' ? o.zh : o.en).slice(0, 2)}</span>}</span>
              {lang === 'zh' ? o.zh : o.en}
            </button>
          );
        })}
      </div>
    </div>
  );
}
