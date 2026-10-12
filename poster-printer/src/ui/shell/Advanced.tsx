// Advanced layer: every engine parameter, organised by intent → group → tier (UX_REDESIGN.md §7), plus layers & modes.
import { useStore } from '../../store';
import { LAYERS, MODES } from '../../engine/types';
import { SECTION_LABELS, DEFAULT_PARAMS } from '../../engine/params';
import { LAYER_LABELS, MODE_LABELS } from '../panels/ParamsPanel';
import { useT } from '../i18n';
import { Icon } from '../Icon';
import { LSeg, Switch } from '../controls';
import { ParamCtl } from './ParamCtl';
import { INTENTS, GROUPS, PRESETS, UIPARAMS, uiParam, type UIParam } from './ia';
import { schematic } from './schematic';
import { useUI, pushUndo, useLinger } from './ui';
import * as A from './actions';

const OUTPUT = { id: 'output', zh: '导出与录制', en: 'Output', icon: 'download', dzh: '导出倍率、内嵌字体与录制回放', den: 'Export scale, embedded fonts and replay' };
const intentOf = (id: string) => INTENTS.find((i) => i.id === id) || OUTPUT;
const panelProps = { 'data-refract': '64', 'data-bevel': '28', 'data-blur': '10', 'data-ca': '.05' };

export function Advanced() {
  const adv = useUI((u) => u.adv);
  const mounted = useLinger(adv, 300, true);
  return <aside {...panelProps} className={'lg strong panel advanced' + (adv ? ' open' : '')} id="advanced" aria-hidden={!adv}>{mounted && <AdvancedBody />}</aside>;
}

const N1 = UIPARAMS.filter((p) => p.tier === 1).length, N2 = UIPARAMS.filter((p) => p.tier === 2).length;
function AdvancedBody() {
  const t = useT();
  const q = useUI((u) => u.advQuery);
  const s = useStore.getState();
  return (
    <>
      <div className="p-head" style={{ paddingBottom: 12 }}>
        <div><div className="eyebrow">{t('高级调校 · 调这一张', 'Advanced · this poster')}</div><h2>{t(`${N1} 个常用 · ${N2} 个更多`, `${N1} essentials · ${N2} more`)}</h2></div><span className="grow" />
        <button className="btn sm press" id="btn-reset-all" title={t('本张调整与全部锁定都回到当前风格 · ⌘Z 可撤销', 'This poster’s tweaks and all pins back to the style · ⌘Z undoes')} onClick={() => A.resetAll()}><Icon name="rotate-ccw" size={14} />{t('全部还原为风格', 'Reset to style')}</button>
        <button className="icon-btn press" title={t('关闭', 'Close') + ' · Esc'} onClick={() => useUI.setState({ adv: false })}><Icon name="x" size={17} /></button>
      </div>
      <ScopeNote />
      <div style={{ padding: '0 16px 8px', display: 'flex', gap: 8 }}>
        <label className="search-field"><Icon name="search" size={16} /><input id="adv-q" placeholder={t('搜索参数：留白、margin、纹理…', 'Search: whitespace, margin, grain…')} value={q} onChange={(e) => useUI.setState({ advQuery: e.target.value })} /></label>
      </div>
      <div className="adv-wrap"><AdvNav /><div className="adv-main" id="adv-main"><AdvMain /></div></div>
    </>
  );
}

/** the two scopes, said once: sliders adjust this poster; 📌 carries a value into future draws */
function ScopeNote() {
  const t = useT();
  const n = useStore((s) => Object.keys(s.pins).length);
  return <p className="scope-note" id="scope-note"><Icon name="sliders" size={13} />{t('拖动 = 只调这一张（版式不变）', 'Drag = adjust this poster (layout stays)')}<span className="dot" /><Icon name="pin" size={13} />{t('图钉 = 锁定到之后的抽卡', 'Pin = keep for future draws')}{n > 0 && <b className="mono"> · {n}</b>}</p>;
}

function AdvNav() {
  const t = useT();
  const intent = useUI((u) => u.advIntent);
  const q = useUI((u) => u.advQuery);
  // phase 14: subscribe to the modified-count per intent (a string), not to every params change — a slider drag no longer re-renders the nav
  const sig = useStore((s) => { const spx: Record<string, unknown> = s.styles.find((x) => x.id === s.styleId)?.params ?? {}; return INTENTS.map((it) => UIPARAMS.filter((p) => p.intent === it.id && p.tier > 0 && s.params[p.key] !== undefined && s.params[p.key] !== (spx[p.key] ?? p.def)).length).join(','); });
  const counts = sig.split(',').map(Number);
  const modCount = (id: string) => counts[INTENTS.findIndex((it) => it.id === id)] ?? 0;
  const pick = (id: string) => {
    const first = UIPARAMS.find((p) => p.intent === id && p.tier === 1 && p.type === 'range') || UIPARAMS.find((p) => p.intent === id);
    useUI.setState({ advIntent: id, advQuery: '', ...(first ? { focus: first.key } : {}) });
    const m = document.getElementById('adv-main'); if (m) m.scrollTop = 0;
  };
  const btn = (id: string, icn: string, label: string, extra: React.ReactNode) => <button key={id} data-intent={id} className={intent === id && !q ? 'on' : ''} onClick={() => pick(id)}><Icon name={icn} size={17} />{label}{extra}</button>;
  return (
    <nav className="adv-nav" id="adv-nav">
      {INTENTS.map((it) => { const m = modCount(it.id), n = UIPARAMS.filter((p) => p.intent === it.id && (p.tier === 1 || p.tier === 2)).length; return btn(it.id, it.icon, t(it.zh, it.en), m ? <span className="m">{m}</span> : <span className="n">{n}</span>); })}
      <span className="nsep" />
      {btn('layers', 'layers', t('图层与模式', 'Layers & modes'), <span className="n">{LAYERS.length + MODES.length}</span>)}
    </nav>
  );
}

function PreviewCard() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const focus = useUI((u) => u.focus);
  const d = uiParam(focus) || UIPARAMS[0];
  const v = useStore((s) => s.params[d.key] ?? d.def);
  const fmt = (x: unknown) => d.type === 'range' ? `${x}${d.unit ?? ''}` : d.type === 'bool' ? (x ? 'on' : 'off') : String(x);
  return (
    <div className="lg preview-card thin" id="pvcard">
      <div className="pv" dangerouslySetInnerHTML={{ __html: schematic(d, v) }} />
      <div><div className="eyebrow">{t('这个参数做什么', 'What this does')}</div><b>{lang === 'zh' ? d.pzh : d.pen}</b><p>{(lang === 'zh' ? d.hzh : d.hen) || (lang === 'zh' ? d.zh : d.en)}</p>
        <div className="legacy mono">{t('原位置', 'Was')}: {SECTION_LABELS[d.section][lang === 'zh' ? 0 : 1]} › {lang === 'zh' ? d.zh : d.en} · {t('默认', 'default')} {fmt(d.def)}</div></div>
    </div>
  );
}

function AdvMain() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const intentId = useUI((u) => u.advIntent);
  // phase 14: only the modified keys of this intent and the matching preset are subscribed (strings), not the params object
  const modSig = useStore((s) => { const spx: Record<string, unknown> = s.styles.find((x) => x.id === s.styleId)?.params ?? {}; return UIPARAMS.filter((p) => p.intent === intentId && p.tier > 0 && s.params[p.key] !== undefined && s.params[p.key] !== (spx[p.key] ?? p.def)).map((p) => p.key).join(','); });
  const presetOn = useStore((s) => (PRESETS[intentId] || []).findIndex((pr) => Object.entries(pr.p).every(([k, v]) => (s.params[k] ?? uiParam(k)?.def) === v)));
  const modSet = new Set(modSig ? modSig.split(',') : []);
  const q0 = useUI((u) => u.advQuery);
  const expanded = useUI((u) => u.expanded);
  const q = q0.trim().toLowerCase();
  if (q) {
    const hits = UIPARAMS.filter((p) => p.tier > 0 && [p.pzh, p.pen, p.zh, p.en, p.key, p.hzh, p.hen].join(' ').toLowerCase().includes(q));
    if (hits[0] && useUI.getState().focus !== hits[0].key && !hits.some((h) => h.key === useUI.getState().focus)) queueMicrotask(() => useUI.setState({ focus: hits[0].key }));
    return (<>
      <PreviewCard />
      <div className="grp"><div className="grp-h"><h4>{hits.length} {t('个结果', 'results')}</h4></div>
        {hits.map((p) => <div key={p.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><span className="tag" style={{ marginTop: 4, flex: 'none', width: 52, justifyContent: 'center' }}>{t(intentOf(p.intent).zh, intentOf(p.intent).en)}</span><div style={{ flex: 1, minWidth: 0 }}><ParamCtl k={p.key} hover /></div></div>)}
        {!hits.length && <p className="hint">{t('没有匹配的参数。试试「网格」「grain」「对比」。', 'No matching parameter. Try “grid”, “grain”, “contrast”.')}</p>}</div>
    </>);
  }
  if (intentId === 'layers') return <LayersPane />;
  const it = intentOf(intentId);
  const all = UIPARAMS.filter((p) => p.intent === it.id && p.tier > 0);
  const defs = all.filter((p) => p.tier <= 2);
  const classic = all.filter((p) => p.tier === 3);
  const groups = [...new Set(defs.map((p) => p.group))];
  const presets = PRESETS[it.id] || [];
  const on = presetOn;
  const applyPreset = (i: number) => {
    const p = presets[i]; pushUndo(t('预设 ', 'Preset ') + t(p.zh, p.en));
    useStore.getState().setParams(p.p);
    A.toast(t('已应用预设 · ', 'Preset · ') + t(p.zh, p.en));
    if (it.id === 'layout') A.showPosterGrid();
  };
  const ctl = (p: UIParam) => <ParamCtl key={p.key} k={p.key} hover />;
  return (<>
    <div className="adv-intro"><h3>{t(it.zh, it.en)}<span>{lang === 'zh' ? it.en : ''}</span></h3><p>{lang === 'zh' ? it.dzh : it.den}</p></div>
    {presets.length > 0 && <div style={{ marginBottom: 16 }}><span className="lbl">{t('一键预设', 'Presets')}</span>
      <LSeg id="seg-preset" className="boxed fill" value={on >= 0 ? String(on) : '-1'} options={presets.map((p, i) => ({ v: String(i), l: t(p.zh, p.en) }))} onChange={(v) => applyPreset(Number(v))} /></div>}
    <PreviewCard />
    {groups.map((g) => {
      const gd = defs.filter((p) => p.group === g); const t2 = gd.filter((p) => p.tier === 2); const open = expanded[g];
      const t1 = gd.filter((p) => p.tier === 1);
      const shown = open || !t1.length ? gd : t1;
      const modK = gd.filter((p) => modSet.has(p.key)).map((p) => p.key);
      const hidden = gd.length - shown.length;
      const ranges = shown.filter((p) => p.type === 'range');
      return (
        <div className="grp" key={g}>
          <div className="grp-h"><h4>{t(...(GROUPS[g] ?? [g, g]))}</h4>{modK.length > 0 && <button className="more" data-greset={g} title={t('这一组复位到风格', 'Reset this group to the style')} onClick={() => A.resetGroup(modK, t(...(GROUPS[g] ?? [g, g])))}><Icon name="rotate-ccw" size={12} />{t('复位', 'Reset')} {modK.length}</button>}{(hidden > 0 || open) && t2.length > 0 && <button className="more" data-g={g} onClick={() => useUI.setState({ expanded: { ...expanded, [g]: !open } })}>{open ? t('收起', 'Less') : t(`更多 ${hidden}`, `${hidden} more`)}<Icon name={open ? 'chevron-up' : 'chevron-down'} size={13} /></button>}</div>
          {shown.filter((p) => p.type === 'seg').map(ctl)}
          <div className={ranges.length > 2 ? 'two' : ''}>{ranges.map(ctl)}</div>
          {shown.filter((p) => p.type === 'bool').map(ctl)}
        </div>
      );
    })}
    {classic.length > 0 && <div className="grp classic" data-classic={it.id}>
      <div className="grp-h"><h4>{t('仅经典构图', 'Classic compositions only')} · {classic.length}</h4><button className="more" data-g={'classic.' + it.id} onClick={() => useUI.setState({ expanded: { ...expanded, ['classic.' + it.id]: !expanded['classic.' + it.id] } })}>{expanded['classic.' + it.id] ? t('收起', 'Less') : t('展开', 'Show')}<Icon name={expanded['classic.' + it.id] ? 'chevron-up' : 'chevron-down'} size={13} /></button></div>
      <p className="hint">{t('这些参数只被 12 种经典构图（分割、满版、巨字、卡片、扇形……）读取。当前构图若不读取，会显示「本张不受影响」。', 'Only the 12 classic compositions (split, full-bleed, giant, cards, fan…) read these. If this composition ignores one, it says so.')}</p>
      {expanded['classic.' + it.id] && classic.map(ctl)}
    </div>}
    {it.id === 'output' && <div className="grp"><div className="row"><button className="btn acc press" onClick={() => A.openSheet('export')}><Icon name="download" size={15} />{t('打开导出面板', 'Open export sheet')}</button><button className="btn press" onClick={() => A.openLib('more')}><Icon name="circle-dot" size={15} />{t('会话与录制', 'Session & recording')}</button></div></div>}
    <p className="hint" style={{ padding: '12px 2px' }}>{t('改动只作用于这一张：版式、文字、图片不动，标「会重新排版」的除外。想让之后的抽卡也用这个值，点图钉。双击控件复位，⌘Z 撤销（含锁定）。', 'Changes apply to this poster only: layout, copy and pictures stay unless a control says “Re-lays out”. Pin it to carry a value into future draws. Double-click resets, ⌘Z undoes (pins too).')}</p>
  </>);
}

/** audit (phase A): drawn / read only by the 12 classic compositions */
const CLASSIC_LAYERS = ['curves', 'shapes', 'sidebar', 'noise', 'band'];
const CLASSIC_MODES = ['card', 'clash', 'brushImage', 'brushMask', 'bandMask'];
function LayersPane() {
  const t = useT();
  const noEff = useStore((s) => (s.noEffect?.why === 'same' ? s.noEffect.k : null));
  const lang = useStore((s) => s.lang);
  const modules = useStore((s) => s.modules);
  const modes = useStore((s) => s.modes);
  return (<>
    <div className="adv-intro"><h3>{t('图层与模式', 'Layers & modes')}<span>{lang === 'zh' ? 'Layers' : ''}</span></h3><p>{t('图层决定画什么；模式决定这一抽的“玩法”。', 'Layers decide what is drawn; modes change how a draw plays.')}</p></div>
    <div className="grp"><div className="grp-h"><h4>{t('图层', 'Layers')} · {LAYERS.length}</h4></div>
      <div className="layer-grid">{LAYERS.map((k) => <button key={k} className={'chipt press' + (modules[k] ? ' on' : '')} data-mod={k} title={CLASSIC_LAYERS.includes(k) ? t('仅经典构图绘制这一层', 'Only classic compositions draw this layer') : ''} onClick={() => A.toggleModule(k)}>{t(...LAYER_LABELS[k])}{CLASSIC_LAYERS.includes(k) && <span className="ptag classic">{t('经典', 'Classic')}</span>}</button>)}</div>
      {noEff && noEff.startsWith('layer:') && <p className="pnote" data-note="same"><Icon name="info" size={12} />{t('本张不受影响 · 当前构图没有这一层', 'No effect on this poster · this composition has no such layer')}</p>}</div>
    <div className="grp"><div className="grp-h"><h4>{t('生成模式', 'Modes')} · {MODES.length}</h4></div>
      {MODES.map((k) => { const [z, e, dz, de] = MODE_LABELS[k]; return (
        <div className="ctl-row" key={k} data-mode={k}><span className="lab" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}><span>{t(z, e)}{CLASSIC_MODES.includes(k) && <span className="ptag classic">{t('仅经典构图', 'Classic only')}</span>}{noEff === 'mode:' + k && <span className="ptag same">{t('本张不受影响', 'No effect here')}</span>}</span><small className="muted" style={{ fontWeight: 400, fontSize: 11 }}>{t(dz, de)}</small></span><Switch on={modes.includes(k)} label={t(z, e)} onChange={() => A.toggleMode(k)} /></div>
      ); })}</div>
  </>);
}
