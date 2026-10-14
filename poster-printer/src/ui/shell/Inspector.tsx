// Inspector (poster summary or the selected element) and the floating element toolbar.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { findNode } from '../../lib/edits';
import { wcag, apca } from '../../engine/color/contrast';
import { LAYERS } from '../../engine/types';
import { COMPONENTS, compDef as partDef, type ColorRole } from '../../engine/components';
import { LAYER_LABELS } from '../panels/ParamsPanel';
import { TEXT_SETS } from '../../data/texts';
import { useT } from '../i18n';
import { Icon } from '../Icon';
import { LSeg, Scrub, Switch } from '../controls';
import { ParamCtl } from './ParamCtl';
import { compLabel } from './Chrome';
import { ROLE_LABEL, roleOf } from '../Stage';
import { useUI, pushUndo, useLinger } from './ui';
import * as A from './actions';
import G from '../glass/glass';

const panelProps = { 'data-refract': '64', 'data-bevel': '28', 'data-blur': '10', 'data-ca': '.05' };

export function Inspector() {
  const insp = useUI((u) => u.insp);
  const adv = useUI((u) => u.adv);
  const selected = useStore((s) => s.selected);
  const open = insp && !adv;
  const mounted = useLinger(open, 300, true);
  return (
    <aside {...panelProps} className={'lg strong panel inspector' + (open ? ' open' : '')} id="inspector" aria-hidden={!open}>
      {mounted && (selected ? <ElementInspector id={selected} /> : <PosterInspector />)}
    </aside>
  );
}

function PosterInspector() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const result = useStore((s) => s.result);
  const hIndex = useStore((s) => s.hIndex);
  const style = useStore((s) => s.styles.find((x) => x.id === s.styleId));
  const locks = useStore((s) => s.locks);
  const fonts = useStore((s) => s.fonts);
  const modules = useStore((s) => s.modules);
  const seeds = useStore((s) => s.seeds);
  const dirty = useStore((s) => s.dirty);
  const textSet = useStore((s) => s.textSet);
  const paletteSource = useStore((s) => String(s.params.paletteSource));
  const s = useStore.getState();
  if (!result) return null;
  const pal = result.picked.palette;
  const sw = [pal.bg, pal.ink, pal.accent, pal.alt, ...pal.fills.slice(0, 2)].filter((c, i, a) => c && a.indexOf(c) === i).slice(0, 6);
  const ratio = wcag(pal.ink, pal.bg); const lc = Math.abs(apca(pal.ink, pal.bg));
  const big = fonts[lang]['big.main'], small = fonts[lang]['small.main'];
  const ts = TEXT_SETS.find((x) => x.id === textSet);
  const score = result.scene.info.score as number | undefined;
  const srcL: Record<string, [string, string]> = { image: ['图片提取', 'from image'], wada: ['和田配色', 'Wada'], nice: ['NICE', 'NICE'], base: ['指定底色', 'base colour'], auto: ['自动', 'auto'] };
  return (
    <>
      <div className="p-head"><div><div className="eyebrow">{t('本张海报', 'This poster')} · No.{String(hIndex + 1).padStart(3, '0')}</div></div><span className="grow" />
        <button className="icon-btn press" title={t('关闭', 'Close')} onClick={() => useUI.setState({ insp: false })}><Icon name="x" size={17} /></button></div>
      <div className="p-body">
        <div className="ins-title"><div className="name">{lang === 'zh' ? style?.name.zh : <em>{style?.name.en}</em>}{dirty && <span className="muted"> *</span>}</div>
          <div className="meta"><span className="tag">{compLabel(result.picked.comp, lang)}</span><span className="tag mono">{result.picked.grid.type}/{result.picked.grid.density}</span><span className="tag mono">{Math.max(1, Math.round(result.ms))}ms</span>{score != null && <span className="tag acc mono">{t('分', 'Q')} {score}</span>}</div></div>
        <div className="sec"><div className="sec-h"><h3>{t('配色', 'Palette')}</h3><div className="act">
          <button className={'icon-btn press' + (locks.color ? ' on' : '')} title={t('锁定配色', 'Lock colours')} onClick={() => A.toggleLock('color')}><Icon name={locks.color ? 'lock' : 'lock-open'} size={15} /></button>
          <button className="icon-btn press" title={t('换配色', 'New colours')} onClick={() => A.remix('color')}><Icon name="shuffle" size={15} /></button></div></div>
          <div className="swatches">{sw.map((c) => {
            // phase 19: a swatch opens the palette editor on that colour
            const k = (['bg', 'ink', 'accent', 'alt'] as const).find((r) => pal[r] === c) ?? `f${pal.fills.indexOf(c)}`;
            return <i key={c} style={{ background: c }} title={t('点按修改 · ', 'Click to edit · ') + c} data-pal={k} onClick={() => useUI.setState({ lib: 'palettes', palSel: k })}><span>{c}</span></i>;
          })}</div>
          <p className="hint mono">WCAG {ratio.toFixed(1)}:1 {ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA-L' : '—'} · APCA Lc {Math.round(lc)} · {t('色源 ', 'source ')}{(srcL[paletteSource] ?? [paletteSource, paletteSource])[lang === 'zh' ? 0 : 1]}</p></div>
        <div className="sec"><div className="sec-h"><h3>{t('字体搭配', 'Type pairing')}</h3><div className="act">
          <button className="icon-btn press" title={t('摇一组', 'Shake')} onClick={() => { pushUndo(t('字体', 'Fonts')); s.shake(); }}><Icon name="dice-5" size={15} /></button>
          <button className="icon-btn press" title={t('字体库', 'Font library')} onClick={() => A.openLib('fonts')}><Icon name="arrow-up-right" size={15} /></button></div></div>
          <div className="pairing"><span className="aa" style={{ fontFamily: `"${big.family}", var(--font-display)`, fontWeight: big.weight }}>{lang === 'zh' ? '字' : 'Aa'}</span><div><b>{big.family} · {big.weight}</b><span>{small.family} · {small.weight}</span></div></div></div>
        <div className="sec"><div className="sec-h"><h3>{t('感觉', 'Feel')}</h3><div className="act"><button className="icon-btn press" title={t('全部参数', 'All parameters')} onClick={() => useUI.setState({ adv: true })}><Icon name="arrow-up-right" size={15} /></button></div></div>
          <ParamCtl k="margin" /><ParamCtl k="titleScale" /><ParamCtl k="saturation" /><ParamCtl k="textureAmount" />
          <p className="hint">{t('拖动数值条调整 · 双击复位 · ⇧ 拖动相对调整。', 'Drag a bar to scrub · double-click resets · ⇧-drag for relative.')}</p></div>
        <div className="sec"><div className="sec-h"><h3>{t('图层', 'Layers')}</h3></div>
          <div className="layer-grid">{LAYERS.map((k) => <button key={k} className={'chipt press' + (modules[k] ? ' on' : '')} data-mod={k} onClick={() => A.toggleModule(k)}>{t(...LAYER_LABELS[k])}</button>)}</div></div>
        <div className="sec"><div className="sec-h"><h3>{t('种子与详情', 'Seed & details')}</h3><div className="act"><button className="icon-btn press" title={t('复制种子', 'Copy seed')} onClick={() => { navigator.clipboard?.writeText(JSON.stringify(seeds)).catch(() => {}); A.toast(t('已复制种子', 'Seed copied')); }}><Icon name="copy" size={15} /></button></div></div>
          <p className="hint mono" style={{ margin: 0 }}>seed {seeds.layout} · {seeds.text} · {seeds.color} · {seeds.image}<br />{t('文字组', 'text set')} {ts ? (lang === 'zh' ? ts.zh : ts.en) : t('全部随机', 'any')} · {result.scene.w}×{result.scene.h}</p></div>
      </div>
      <div className="p-foot"><button className="btn wide press" onClick={() => useUI.setState({ adv: true })}><Icon name="sliders-horizontal" size={15} />{t('高级调校', 'Advanced')}<kbd>A</kbd></button>
        <button className="btn solid press" onClick={() => s.updateStyle()}>{t('另存风格', 'Save style')}</button></div>
    </>
  );
}

function ElementInspector({ id }: { id: string }) {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const scene = useStore((s) => s.result?.scene);
  const ed = useStore((s) => s.edits[id]) || {};
  const locks = useStore((s) => s.locks);
  const placed = useStore((s) => s.placed);
  const pal = useStore((s) => s.result?.picked.palette);
  const images = useStore((s) => s.presetImages);
  const userImages = useStore((s) => s.userImages);
  const s = useStore.getState();
  const nd = scene && !id.startsWith('pc-') ? findNode(scene, id) : null;
  const pc = id.startsWith('pc-') ? placed.find((p) => 'pc-' + p.id === id) : undefined;
  const role = roleOf(id);
  const title = role && ROLE_LABEL[role] ? t(...ROLE_LABEL[role]) : nd?.kind === 'text' ? t('文字', 'Text') : t('图形', 'Shape');
  const [draft, setDraft] = useState('');
  useEffect(() => { if (nd?.kind === 'text') setDraft(ed.raw ?? nd.raw); }, [id, nd?.kind === 'text' ? ed.raw ?? nd.raw : '']);
  const deselect = () => useStore.setState({ selected: null });
  const resetEl = () => { pushUndo(t('还原', 'Reset')); const e = { ...s.edits }; delete e[id]; useStore.setState({ edits: e }); s.edit(id, {}, true); A.toast(t('已还原手动修改', 'Edits reverted')); };
  const savePart = () => { if (nd?.kind === 'text') { const raw = (ed.raw ?? nd.raw).replace(/\s+/g, ' ').slice(0, 60); s.saveCompPreset({ name: raw.slice(0, 16), type: 'label', text: raw, color: 'auto', scale: 1 }); A.toast(t('已存入我的组件', 'Saved to My parts')); } else if (pc) { s.saveCompPreset({ name: lang === 'zh' ? partDef(pc.type).zh : partDef(pc.type).en, type: pc.type, text: pc.text, color: pc.color, scale: pc.scale, rot: pc.rot }); A.toast(t('已存入我的组件', 'Saved to My parts')); } };
  const roles: [string, string, string, string | undefined][] = pal ? [['auto', '自动', 'Auto', undefined], ['ink', '墨色', 'Ink', pal.ink], ['accent', '强调', 'Accent', pal.accent], ['alt', '辅色', 'Alt', pal.alt], ['bg', '底色', 'Ground', pal.bg]] : [];
  const fillRole = roles.find((r) => r[3] && r[3] === ed.fill)?.[0] ?? 'auto';
  const asset = nd?.kind === 'image' ? [...images, ...userImages].find((a) => a.id === nd.imageId) : undefined;
  const credit = asset?.credit as { title?: string; artist?: string; license?: string } | undefined;
  return (
    <>
      <div className="p-head"><div><div className="eyebrow">{t('已选元素', 'Selection')}</div><h2>{title}</h2></div><span className="grow" />
        <button className="icon-btn press" title={t('取消选择', 'Deselect') + ' · Esc'} onClick={deselect}><Icon name="x" size={17} /></button></div>
      <div className="p-body">
        {nd?.kind === 'text' && <>
          <div className="sec" style={{ paddingTop: 2 }}>
            <label className="field"><span>{t('内容（可换行）', 'Content')}</span>
              <textarea className="inp" rows={Math.min(5, Math.max(2, draft.split('\n').length))} style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em' }} value={draft}
                onFocus={() => pushUndo(t('改字', 'Edit text'))} onChange={(e) => { setDraft(e.target.value); s.edit(id, { raw: e.target.value }, false); }} onBlur={() => s.edit(id, {}, true)} /></label>
            <div className="row"><button className="btn press" onClick={() => A.openLib('text')}><Icon name="sparkles" size={15} />{t('AI 文案', 'AI copy')}</button><button className="btn press" onClick={() => A.remix('text')}><Icon name="shuffle" size={15} />{t('换一组文案', 'New copy')}</button></div></div>
          <div className="sec"><div className="sec-h"><h3>{t('字体', 'Typeface')}</h3><div className="act"><button className="icon-btn press" title={t('摇一组', 'Shake')} onClick={() => { pushUndo(t('字体', 'Fonts')); s.shake(); }}><Icon name="dice-5" size={15} /></button><button className="icon-btn press" title={t('字体库', 'Font library')} onClick={() => A.openLib('fonts')}><Icon name="arrow-up-right" size={15} /></button></div></div>
            <div className="pairing" style={{ marginBottom: 8 }}><span className="aa" style={{ fontFamily: `"${nd.family}", var(--font-display)`, fontWeight: nd.weight }}>{/[\u4e00-\u9fa5]/.test(nd.raw) ? '字' : 'Aa'}</span><div><b>{nd.family} · {nd.weight}</b><span>{t('角色', 'role')} · {nd.role} · {Math.round(nd.size)}px</span></div></div>
            <Scrub label={t('字号', 'Size')} value={Math.round((ed.scale ?? 1) * 100)} min={40} max={300} unit="%" def={100} onStart={() => pushUndo(t('字号', 'Size'))} onChange={(v) => s.edit(id, { scale: v / 100 }, true)} /></div>
          <div className="sec"><div className="sec-h"><h3>{t('颜色角色', 'Colour role')}</h3></div>
            <LSeg value={fillRole} options={roles.map(([v, z, e, c]) => ({ v, l: <>{c && <i className="dotc" style={{ background: c }} />}{t(z, e)}</> }))} onChange={(v) => { pushUndo(t('颜色', 'Colour')); s.edit(id, { fill: roles.find((r) => r[0] === v)?.[3] }, true); }} /></div>
          <div className="sec"><div className="sec-h"><h3>{t('位置', 'Position')}</h3></div><p className="hint" style={{ margin: 0 }}>{t('在画布上拖动移动 · 吸附网格（⌥ 临时关闭）· 双击直接改字', 'Drag on canvas to move · snaps to grid (⌥ to bypass) · double-click to type')}</p>
            {(ed.dx || ed.dy) ? <p className="hint mono">Δ {Math.round(ed.dx || 0)}, {Math.round(ed.dy || 0)} px</p> : null}</div>
        </>}
        {nd?.kind === 'image' && <>
          <div className="sec" style={{ paddingTop: 2 }}>
            <div className="img-prev" style={{ backgroundImage: `url("${nd.src}")`, backgroundPosition: `${(ed.fx ?? nd.fx) * 100}% ${(ed.fy ?? nd.fy) * 100}%` }} />
            <p className="hint">{credit ? [credit.title, credit.artist, credit.license].filter(Boolean).join(' · ') : asset?.title ?? nd.imageId}{asset?.user ? t(' · 我的上传', ' · my upload') : ''}</p>
            <div className="row" style={{ marginTop: 8 }}><button className="btn press" onClick={() => useUI.setState({ imgEdit: id })}><Icon name="crop" size={15} />{t('取景', 'Reframe')}</button><button className="btn press" onClick={() => A.remix('image')}><Icon name="refresh-cw" size={15} />{t('换图', 'Replace')}</button><button className="btn press" onClick={() => A.openLib('images')}><Icon name="scissors" size={15} />{t('抠图', 'Cut out')}</button></div></div>
          <div className="sec"><div className="sec-h"><h3>{t('取景', 'Framing')}</h3></div>
            <Scrub label={t('缩放', 'Zoom')} value={+(ed.zoom ?? nd.zoom).toFixed(2)} min={1} max={4} step={0.01} unit="×" def={nd.zoom} onStart={() => pushUndo(t('缩放', 'Zoom'))} onChange={(v) => s.edit(id, { zoom: v }, true)} />
            <div className="two"><Scrub label={t('焦点 X', 'Focus X')} value={Math.round((ed.fx ?? nd.fx) * 100)} min={0} max={100} unit="%" onStart={() => pushUndo(t('焦点', 'Focus'))} onChange={(v) => s.edit(id, { fx: v / 100 }, true)} />
              <Scrub label={t('焦点 Y', 'Focus Y')} value={Math.round((ed.fy ?? nd.fy) * 100)} min={0} max={100} unit="%" onStart={() => pushUndo(t('焦点', 'Focus'))} onChange={(v) => s.edit(id, { fy: v / 100 }, true)} /></div></div>
          <div className="sec"><div className="sec-h"><h3>{t('处理（全部图片）', 'Treatment (all images)')}</h3></div><ParamCtl k="legibility" /><ParamCtl k="imgSat" /><ParamCtl k="imgContrast" /><ParamCtl k="maskKind" compact /></div>
          <div className="sec"><div className="ctl-row"><span className="lab">{t('锁定此图（抽卡时保留）', 'Keep on draw')}</span><Switch on={locks.image} onChange={() => A.toggleLock('image')} /></div></div>
        </>}
        {pc && <>
          <div className="sec" style={{ paddingTop: 2 }}><p className="hint" style={{ marginTop: 0 }}>{t('组件跨抽卡保留位置；颜色与文案随海报自动适配。', 'Parts keep their spot across draws; colour and copy adapt.')}</p>
            <Scrub label={t('大小', 'Scale')} value={+pc.scale.toFixed(2)} min={0.4} max={3} step={0.01} unit="×" def={1} onStart={() => pushUndo(t('大小', 'Scale'))} onChange={(v) => s.updatePlaced(pc.id, { scale: v })} />
            <Scrub label={t('旋转', 'Rotate')} value={Math.round(pc.rot ?? 0)} min={-45} max={45} unit="°" def={0} onStart={() => pushUndo(t('旋转', 'Rotate'))} onChange={(v) => s.updatePlaced(pc.id, { rot: v })} />
            {pc.text !== undefined && <label className="field"><span>{t('文字', 'Text')}</span><input className="inp" value={pc.text ?? ''} onChange={(e) => s.updatePlaced(pc.id, { text: e.target.value })} /></label>}</div>
          <div className="sec"><div className="sec-h"><h3>{t('颜色角色', 'Colour role')}</h3></div>
            <LSeg value={pc.color} options={(['auto', 'accent', 'ink', 'plate'] as ColorRole[]).map((v) => ({ v, l: { auto: t('自动', 'Auto'), accent: t('强调', 'Accent'), ink: t('墨色', 'Ink'), plate: t('底板', 'Plate') }[v] }))} onChange={(v) => s.updatePlaced(pc.id, { color: v })} /></div>
          <div className="sec"><p className="hint" style={{ margin: 0 }}>{t('拖动自由摆放 · 滚轮缩放 · Delete 移除', 'Drag to place · wheel to scale · Delete to remove')}</p></div>
        </>}
        {!pc && nd && nd.kind !== 'text' && nd.kind !== 'image' && <div className="sec"><p className="hint" style={{ margin: 0 }}>{t('图形元素：拖动移动，Delete 隐藏。图形的数量与样式在「高级调校 › 细节」。', 'Graphic element: drag to move, Delete to hide. Counts and styles live in Advanced › Details.')}</p>
          <button className="btn press" style={{ marginTop: 12 }} onClick={() => useUI.setState({ adv: true, advIntent: 'details' })}><Icon name="shapes" size={15} />{t('细节参数', 'Detail parameters')}</button></div>}
        {!pc && !nd && <div className="sec"><p className="hint">{t('该元素已不在当前海报中。', 'This element is no longer on the poster.')}</p></div>}
      </div>
      <div className="p-foot"><button className="btn press" onClick={A.hideSelected}><Icon name={pc ? 'trash-2' : 'eye-off'} size={15} />{pc ? t('移除', 'Remove') : t('隐藏', 'Hide')}</button>
        {!pc && <button className="btn press" onClick={resetEl}><Icon name="rotate-ccw" size={15} />{t('还原', 'Reset')}</button>}<span className="grow" />
        {(nd?.kind === 'text' || pc) && <button className="btn solid press" onClick={savePart}><Icon name="bookmark" size={15} />{t('存为组件', 'Save as part')}</button>}</div>
    </>
  );
}

/* floating toolbar under the selection */
export function CtxBar() {
  const t = useT();
  const selected = useStore((s) => s.selected);
  const scene = useStore((s) => s.scene);
  const editingText = useStore((s) => s.editingText);
  const locks = useStore((s) => s.locks);
  const imgEdit = useUI((u) => u.imgEdit);
  const posterRect = useUI((u) => u.posterRect);
  const insp = useUI((u) => u.insp);
  const adv = useUI((u) => u.adv);
  const lib = useUI((u) => u.lib);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [anim, setAnim] = useState(0);
  const role = roleOf(selected);
  const show = !!selected && !editingText && !!role;
  useEffect(() => { if (show) setAnim((a) => a + 1); }, [selected]);
  useLayoutEffect(() => {
    if (!show) { useUI.setState({ selBottom: 0 }); return; }
    const raf = requestAnimationFrame(() => {
      const sel = document.getElementById('sel'); if (!sel) return;
      const r = sel.getBoundingClientRect();
      const dockTop = innerHeight - 24 - 64 - 8, below = r.bottom + 12 + 48 < dockTop;
      // keep the toolbar in the visible canvas: between the open panels / rails, centred on the visible part of the selection
      const edge = (sel: string, side: 'left' | 'right') => [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect()).filter((b) => b.width > 0).map((b) => b[side]);
      const L = Math.max(0, ...edge('.rail-l, #library.open', 'right')) + 12;
      const R = Math.min(innerWidth, ...edge('.rail-r, #inspector.open, #advanced.open', 'left')) - 12;
      const half = (ref.current?.offsetWidth || 300) / 2;
      const cx = (Math.max(r.left, L) + Math.min(r.right, R)) / 2;
      setPos({ left: Math.max(L + half, Math.min(R - half, cx)), top: below ? r.bottom + 12 : Math.max(96, r.top - 60) });
      useUI.setState({ selBottom: r.bottom + 62 });
      const pr = useUI.getState().posterRect; if (pr && ref.current) setTimeout(() => ref.current && G.adapt(ref.current, pr), 0);
    });
    return () => cancelAnimationFrame(raf);
  }, [show, selected, scene, posterRect, insp, adv, lib]);
  const s = useStore.getState();
  const openInsp = () => useUI.setState({ insp: true, adv: false });
  return (
    <div ref={ref} key={anim} className={'lg adaptive ctxbar' + (show && pos ? ' show' : '')} id="ctxbar" data-refract="40" data-bevel="22" data-mat="clear" data-ca=".1" style={pos ? { left: pos.left, top: pos.top } : undefined}>
      {show && (role === 'image' ? <>
        <button className={'text-btn' + (imgEdit ? ' on' : '')} data-cx="crop" onClick={() => useUI.setState({ imgEdit: imgEdit ? null : selected })}><Icon name="crop" size={15} />{t('取景', 'Reframe')}</button>
        <button className="icon-btn" title={t('换图', 'Replace')} onClick={() => A.remix('image')}><Icon name="refresh-cw" size={17} /></button>
        <button className="icon-btn" title={t('图片库 · 抠图', 'Images · cut-out')} onClick={() => A.openLib('images')}><Icon name="scissors" size={17} /></button>
        <button className="icon-btn" title={t('锁定此图', 'Lock image')} onClick={() => A.toggleLock('image')}><Icon name={locks.image ? 'lock' : 'lock-open'} size={17} /></button>
        <span className="vsep" />
        <button className="icon-btn" title={t('检查器', 'Inspector')} onClick={openInsp}><Icon name="panel-right" size={17} /></button>
        <button className="icon-btn" data-cx="hide" title={t('隐藏', 'Hide') + ' · Del'} onClick={A.hideSelected}><Icon name="eye-off" size={17} /></button>
      </> : role === 'part' ? <>
        <button className="text-btn" data-cx="edit" onClick={openInsp}><Icon name="sliders-horizontal" size={15} />{t('调整', 'Adjust')}</button>
        <button className="icon-btn" title={t('组件库', 'Parts')} onClick={() => A.openLib('parts')}><Icon name="sticker" size={17} /></button>
        <span className="vsep" />
        <button className="icon-btn" data-cx="hide" title={t('移除', 'Remove') + ' · Del'} onClick={A.hideSelected}><Icon name="trash-2" size={17} /></button>
      </> : <>
        {findNode(scene!, selected!)?.kind === 'text' && <button className="text-btn" data-cx="edit" onClick={() => useStore.setState({ editingText: selected })}><Icon name="text-cursor-input" size={15} />{t('编辑', 'Edit')}</button>}
        <button className="icon-btn" title={t('字体', 'Font')} onClick={() => A.openLib('fonts')}><Icon name="a-large-small" size={17} /></button>
        <button className="icon-btn" title={t('颜色与大小', 'Colour & size')} onClick={openInsp}><Icon name="droplet" size={17} /></button>
        <button className="icon-btn" title={t('AI 文案', 'AI copy')} onClick={() => A.openLib('text')}><Icon name="sparkles" size={17} /></button>
        <span className="vsep" />
        <button className="icon-btn" title={t('存为组件', 'Save as part')} onClick={() => { const nd = findNode(scene!, selected!); if (nd?.kind === 'text') { const raw = nd.raw.replace(/\s+/g, ' ').slice(0, 60); s.saveCompPreset({ name: raw.slice(0, 16), type: 'label', text: raw, color: 'auto', scale: 1 }); A.toast(t('已存入我的组件', 'Saved to My parts')); } }}><Icon name="bookmark" size={17} /></button>
        <button className="icon-btn" data-cx="hide" title={t('隐藏', 'Hide') + ' · Del'} onClick={A.hideSelected}><Icon name="eye-off" size={17} /></button>
      </>)}
    </div>
  );
}
export { COMPONENTS };
