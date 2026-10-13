import { useMemo, useRef, useState } from 'react';
import { useStore, previewScene } from '../../store';
import { Card, Chip, Range, Seg, Toggle } from '../controls';
import { Icon } from '../Icon';
import { useT } from '../i18n';
import { COMPONENTS, compDef, compSize, type ColorRole, type PlacedComponent } from '../../engine/components';
import { renderSVG } from '../../engine/render/svg';
import { findNode, nodeBox } from '../../lib/edits';
import { download } from '../../lib/exporter';
import type { Scene, LayerKey } from '../../engine/types';
import { LAYERS } from '../../engine/types';

const crop = (sc: Scene, id: string) => {
  const nd = findNode(sc, id);
  const b = nd && nodeBox(nd);
  if (!nd || !b) return '';
  const pad = Math.max(b.w, b.h) * 0.12;
  const one: Scene = { ...sc, nodes: [nd], texture: undefined };
  return renderSVG(one).replace(/width="[\d.]+" height="[\d.]+" viewBox="[^"]+"/, `width="100%" height="100%" viewBox="${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}"`);
};

export function CompPanel() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const result = useStore((s) => s.result);
  const placed = useStore((s) => s.placed);
  const lib = useStore((s) => s.compLib);
  const armed = useStore((s) => s.armed);
  const showSlots = useStore((s) => s.showSlots);
  const selected = useStore((s) => s.selected);
  const scene = useStore((s) => s.scene);
  const s = useStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');

  // previews: every built-in component on an otherwise empty canvas in the current palette & fonts
  const previews = useMemo(() => {
    if (!result) return {} as Record<string, string>;
    const mods = Object.fromEntries(LAYERS.map((l) => [l, l === 'bg'])) as Record<LayerKey, boolean>;
    const items: PlacedComponent[] = COMPONENTS.map((c, i) => ({ id: 'pv' + i, type: c.id, x: 0.04 + (i % 3) * 0.32, y: 0.03 + Math.floor(i / 3) * 0.24, scale: 0.9, salt: 'pv', color: 'auto' }));
    const sc = previewScene({ texture: 'none' }, { modules: mods, placed: items, modes: [] });
    if (!sc) return {};
    return Object.fromEntries(COMPONENTS.map((c, i) => [c.id, crop(sc, 'pc-pv' + i)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.picked.palette, result?.picked.texts, s.fonts]);

  const nm = (id: string) => { const d = compDef(id); return lang === 'zh' ? d.zh : d.en; };
  const COLORS: { v: ColorRole; l: string }[] = [{ v: 'auto', l: t('自动', 'Auto') }, { v: 'accent', l: t('强调色', 'Accent') }, { v: 'ink', l: t('墨色', 'Ink') }, { v: 'plate', l: t('底板', 'Plate') }];
  const selPc = selected?.startsWith('pc-') ? placed.find((p) => 'pc-' + p.id === selected) : undefined;
  const selNode = selected && scene && !selected.startsWith('pc-') ? findNode(scene, selected) : null;

  const exportLib = () => download(new Blob([JSON.stringify({ kind: 'rea-components', version: 1, items: lib.map(({ id: _id, ...r }) => r) }, null, 2)], { type: 'application/json' }), 'ready-poster-printer-components.json');
  const importLib = async (f: File | undefined) => {
    if (!f) return;
    try { const j = JSON.parse(await f.text()); s.importCompLib(Array.isArray(j) ? j : j.items ?? []); } catch { s.toast(t('无法读取组件库文件', 'Cannot read component library'), 'warn'); }
  };

  return (
    <div className="panel-scroll">
      <Card title={t('组件库', 'Component library')} right={<span className="muted">{COMPONENTS.length + lib.length}</span>}>
        <div className="comp-grid">
          {COMPONENTS.map((c) => (
            <button key={c.id} className={'comp-item' + (armed && !('preset' in armed) && armed.type === c.id && !armed.text ? ' on' : '')} title={t('选择后点「放入空槽」或在画布空槽上点击', 'Select, then “Drop into free slot” or click a slot on the canvas')}
              onClick={() => s.set('armed', { type: c.id, color: armed?.color ?? 'auto', scale: armed?.scale ?? 1 })} onDoubleClick={() => s.addComponent({ type: c.id })}>
              <span className="comp-prev" dangerouslySetInnerHTML={{ __html: previews[c.id] || '' }} />
              <span className="comp-name">{nm(c.id)}</span>
            </button>
          ))}
        </div>
        {lib.length > 0 && <>
          <div className="sub-title">{t('我的组件', 'My components')}</div>
          <div className="chips">
            {lib.map((c) => (
              <Chip key={c.id} on={armed?.type === c.type && armed?.text === c.text} onClick={() => s.set('armed', { type: c.type, text: c.text, color: c.color, scale: c.scale, rot: c.rot })} title={nm(c.type)}>
                {c.name}<span className="x" onClick={(e) => { e.stopPropagation(); s.deleteCompPreset(c.id); }}>×</span>
              </Chip>
            ))}
          </div>
        </>}
        {armed && (
          <div className="armed">
            <div className="row between"><b>{nm(armed.type)}</b>{armed.text && <span className="muted">“{armed.text}”</span>}</div>
            <Seg label={t('颜色角色', 'Colour role')} value={armed.color ?? 'auto'} options={COLORS} onChange={(v) => s.set('armed', { ...armed, color: v })} />
            <Range label={t('尺寸', 'Size')} value={Math.round((armed.scale ?? 1) * 100)} min={40} max={300} unit="%" onChange={(v) => s.set('armed', { ...armed, scale: v / 100 })} def={100} />
            <Range label={t('旋转', 'Rotate')} value={armed.rot ?? 0} min={-30} max={30} unit="°" onChange={(v) => s.set('armed', { ...armed, rot: v || undefined })} def={0} />
          </div>
        )}
        <div className="row gap">
          <button className="pill primary" disabled={!armed} onClick={() => armed && s.addComponent(armed)}><Icon name="sparkle" size={14} />{t('放入空槽', 'Drop into free slot')}</button>
          <Toggle label={t('显示空槽', 'Show free slots')} value={showSlots} onChange={(v) => s.set('showSlots', v)} />
        </div>
        <p className="hint">{t('组件放置后可在画布上自由拖动、滚轮缩放；换抽时保留位置，颜色和文案随新海报自动适配。', 'Placed components can be dragged freely and scaled with the wheel; they keep their spot across draws while colour and copy adapt to each new poster.')}</p>
      </Card>

      <Card title={t('已放置', 'Placed') + ` · ${placed.length}`} right={placed.length ? <button className="mini" onClick={() => s.clearPlaced()}><Icon name="trash" size={13} />{t('清空', 'Clear')}</button> : undefined}>
        {!placed.length && <p className="hint">{t('还没有组件。选择一个组件并放入空槽。', 'No components yet. Pick one and drop it into a free slot.')}</p>}
        {placed.map((p) => (
          <div key={p.id} className={'placed-row' + (selected === 'pc-' + p.id ? ' on' : '')} onClick={() => s.set('selected', 'pc-' + p.id)}>
            <span>{nm(p.type)}{p.text ? ` · ${p.text}` : ''}</span>
            <span className="row">
              <button className="icon-btn" title={t('换文案/细节', 'Re-roll details')} onClick={(e) => { e.stopPropagation(); s.updatePlaced(p.id, { salt: Math.random().toString(36).slice(2, 6) }); }}><Icon name="dice" size={14} /></button>
              <button className="icon-btn" title={t('删除', 'Remove')} onClick={(e) => { e.stopPropagation(); s.removePlaced(p.id); }}><Icon name="trash" size={14} /></button>
            </span>
          </div>
        ))}
        {selPc && (
          <div className="armed">
            <Seg label={t('颜色角色', 'Colour role')} value={selPc.color} options={COLORS} onChange={(v) => s.updatePlaced(selPc.id, { color: v })} />
            <Range label={t('尺寸', 'Size')} value={Math.round(selPc.scale * 100)} min={40} max={300} unit="%" onChange={(v) => s.updatePlaced(selPc.id, { scale: v / 100 })} def={100} />
            <Range label={t('旋转', 'Rotate')} value={selPc.rot ?? 0} min={-30} max={30} unit="°" onChange={(v) => s.updatePlaced(selPc.id, { rot: v || undefined })} def={0} />
            <label className="field"><span>{t('固定文案（留空则随海报）', 'Fixed copy (empty = follow poster)')}</span>
              <input value={selPc.text ?? ''} maxLength={60} onChange={(e) => s.updatePlaced(selPc.id, { text: e.target.value || undefined })} /></label>
            <div className="row gap">
              <input className="grow" placeholder={t('组件名称', 'Component name')} value={name} onChange={(e) => setName(e.target.value)} />
              <button className="mini" onClick={() => { s.saveCompPreset({ name: name || nm(selPc.type), type: selPc.type, text: selPc.text, color: selPc.color, scale: selPc.scale, rot: selPc.rot }); setName(''); s.toast(t('已存入我的组件', 'Saved to My components')); }}>{t('存为组件', 'Save as component')}</button>
            </div>
          </div>
        )}
        {selNode?.kind === 'text' && (
          <button className="pill" onClick={() => { const raw = selNode.raw.replace(/\s+/g, ' ').slice(0, 60); s.saveCompPreset({ name: raw.slice(0, 16), type: 'label', text: raw, color: 'auto', scale: 1 }); s.toast(t('已把选中文字存为组件', 'Selected text saved as a component')); }}>
            <Icon name="text" size={14} />{t('把选中文字存为组件', 'Save selected text as component')}
          </button>
        )}
      </Card>

      <Card title={t('组件库文件', 'Library file')} open={false}>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { importLib(e.target.files?.[0]); e.target.value = ''; }} />
        <div className="row gap">
          <button className="mini" onClick={exportLib} disabled={!lib.length}><Icon name="export" size={13} />{t('导出 JSON', 'Export JSON')}</button>
          <button className="mini" onClick={() => fileRef.current?.click()}><Icon name="upload" size={13} />{t('导入 JSON', 'Import JSON')}</button>
        </div>
        <p className="hint">{t('组件尺寸参考：', 'Base sizes: ')}{COMPONENTS.map((c) => `${nm(c.id)} ${c.w}×${c.h}`).join(' · ')} {t('（单位 = 画布短边 1%）', '(unit = 1% of the short side)')}</p>
      </Card>
    </div>
  );
}
export { compSize };
