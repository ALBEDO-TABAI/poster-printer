import { useIdleMap } from '../idle';
const layoutCache = new Map<string, string>();
import { useStore, previewScene } from '../../store';
import { Card, Chip, Range } from '../controls';
import { useT } from '../i18n';
import { PARAMS } from '../../engine/params';
import { renderSVG } from '../../engine/render/svg';
import { ICONS, iconPath } from '../../engine/gen/decor';
import { SIDEBAR_TEMPLATES } from '../../engine/gen/sidebar';
import { Toggle } from '../controls';

const compDef = PARAMS.find((p) => p.key === 'composition')!;
const gridDef = PARAMS.find((p) => p.key === 'gridType')!;
const densDef = PARAMS.find((p) => p.key === 'density')!;
const ICON_NAMES: Record<string, [string, string]> = {
  asterisk: ['星号', 'Asterisk'], globe: ['地球', 'Globe'], gridCircle: ['网格圆', 'Grid circle'], crossCircle: ['交叉圆', 'Cross circle'], diamond: ['菱形', 'Diamond'], sunburst: ['日芒', 'Sunburst'], target: ['靶心', 'Target'],
  squareGrid: ['九宫', 'Nine grid'], registration: ['套准线', 'Registration'], barcode: ['条码', 'Barcode'], star4: ['四角星', 'Sparkle'], arrows: ['箭头', 'Arrows'], halfDisc: ['半圆', 'Half disc'], waves: ['波纹', 'Waves'],
};

export function LayoutPanel() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const result = useStore((s) => s.result);
  const params = useStore((s) => s.params);
  const s = useStore.getState();
  const comp = String(params.composition);
  // phase 14: rendered one per idle slot (it used to render all compositions synchronously on open: a 300–600 ms block)
  const ids = result && compDef.type === 'seg' ? compDef.options.filter((o) => o.v !== 'auto').map((o) => o.v) : [];
  const key = (useStore.getState().history[useStore.getState().hIndex]?.id ?? '') + ':' + (result?.scene.w ?? 0) + 'x' + (result?.scene.h ?? 0) + ':' + (result?.picked.palette.bg ?? '') + ':';
  const svgs = useIdleMap(ids, 'lp:' + key, layoutCache, (v) => { const sc = previewScene({ composition: v }); return sc ? renderSVG(sc).replace(/^<svg([^>]*?) width="[\d.]+" height="[\d.]+"/, '<svg$1 width="100%" height="100%"') : ''; });
  const thumbs = compDef.type === 'seg' ? compDef.options.filter((o) => o.v !== 'auto' && result).map((o) => ({ v: o.v, l: lang === 'zh' ? o.zh : o.en, svg: svgs[o.v] ?? '' })) : [];
  const ornSet = String(params.ornamentSet ?? '').split(',').filter(Boolean);
  const toggleOrn = (k: string) => {
    const cur = ornSet.length ? ornSet : [...ICONS];
    const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
    s.setParam('ornamentSet', next.length === ICONS.length ? '' : next.join(','));
  };
  return (
    <div className="panel-scroll">
      <Card title={t('版式库', 'Layout library')} right={<button className={'mini' + (comp === 'auto' ? ' on' : '')} onClick={() => s.setParam('composition', 'auto')}>{t('自动', 'Auto')}</button>}>
        <p className="hint">{t('同一组文字、配色与图片，在不同构图下的样子。点击锁定构图。', 'Same text, colours and images across compositions. Click to lock one.')}</p>
        <div className="layout-grid">
          {thumbs.map((x) => (
            <button key={x.v} className={'layout-item' + (comp === x.v ? ' on' : '') + (result?.picked.comp === x.v ? ' cur' : '')} onClick={() => s.setParam('composition', comp === x.v ? 'auto' : x.v)}>
              <span className="lt-svg" dangerouslySetInnerHTML={{ __html: x.svg }} />
              <span className="lt-name">{x.l}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card title={t('网格', 'Grid')}>
        {[gridDef, densDef].map((d) => d.type === 'seg' && (
          <div key={d.key} className="filter-row"><span className="mini-label">{lang === 'zh' ? d.zh : d.en}</span>
            <div className="chips">{d.options.map((o) => <Chip key={o.v} on={String(params[d.key]) === o.v} onClick={() => s.setParam(d.key, o.v)}>{lang === 'zh' ? o.zh : o.en}</Chip>)}</div>
          </div>
        ))}
        <div className="info-line">{result ? `${result.picked.grid.type} / ${result.picked.grid.density} · ${result.picked.grid.nc}×${result.picked.grid.nr}` : ''}</div>
      </Card>
      <SidebarCard />
      <Card title={t('装饰库', 'Ornament library')}>
        <div className="orn-grid">
          {ICONS.map((k) => {
            const ic = iconPath(k, 20, 20, 26);
            const on = !ornSet.length || ornSet.includes(k);
            return (
              <button key={k} className={'orn' + (on ? ' on' : '')} onClick={() => toggleOrn(k)} title={ICON_NAMES[k][lang === 'zh' ? 0 : 1]}>
                <svg viewBox="0 0 40 40" width="34" height="34"><path d={ic.d} fill={ic.fill ? 'currentColor' : 'none'} stroke={ic.fill ? 'none' : 'currentColor'} strokeWidth={1.4} /></svg>
              </button>
            );
          })}
        </div>
        <Range label={t('装饰数量', 'Ornaments')} value={Number(params.ornaments)} min={0} max={4} onChange={(v) => s.setParam('ornaments', v)} />
        <Range label={t('装饰尺寸', 'Ornament size')} value={Number(params.ornamentSize)} min={50} max={200} unit="%" onChange={(v) => s.setParam('ornamentSize', v)} />
      </Card>
    </div>
  );
}

/** Sidebar template library with per-template type-size memory. */
function SidebarCard() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const params = useStore((s) => s.params);
  const sizes = useStore((s) => s.sbSizes);
  const modules = useStore((s) => s.modules);
  const cur = useStore((s) => s.result?.picked.sidebar);
  const s = useStore.getState();
  const sel = String(params.sidebarTpl);
  const target = sel !== 'auto' ? sel : cur;
  const size = target && sizes[target] != null ? sizes[target] : Number(params.sidebarFont);
  const name = (id?: string) => { const d = SIDEBAR_TEMPLATES.find((x) => x.id === id); return d ? (lang === 'zh' ? d.zh : d.en) : '—'; };
  return (
    <Card title={t('边栏模板', 'Sidebar templates')} right={<span className="muted">{SIDEBAR_TEMPLATES.length}</span>}>
      <Toggle label={t('启用边栏', 'Sidebar on')} value={modules.sidebar} onChange={() => s.toggleModule('sidebar')} />
      <div className="sb-grid">
        <button className={'sb-item' + (sel === 'auto' ? ' on' : '')} onClick={() => s.setParam('sidebarTpl', 'auto')}>{t('自动', 'Auto')}<small>{t('随机模板', 'any')}</small></button>
        {SIDEBAR_TEMPLATES.map((d) => (
          <button key={d.id} className={'sb-item' + (sel === d.id ? ' on' : '') + (cur === d.id ? ' cur' : '')} onClick={() => s.setParam('sidebarTpl', d.id)} title={cur === d.id ? t('当前海报使用中', 'In use on this poster') : ''}>
            {lang === 'zh' ? d.zh : d.en}{sizes[d.id] != null && <small>{sizes[d.id]}%</small>}
          </button>
        ))}
      </div>
      <p className="hint">{cur ? t('当前海报：', 'This poster: ') + name(cur) : t('当前海报没有边栏（版式不支持或本次未抽中）。', 'No sidebar on this poster (composition does not support it, or not drawn).')}</p>
      {target && <>
        <Range label={t('「', '“') + name(target) + t('」字号', '” type size')} value={size} min={60} max={160} unit="%" def={100}
          onChange={(v) => s.saveSidebarSize(target, v)} />
        <div className="row gap">
          <button className="mini" disabled={sizes[target] == null} onClick={() => s.saveSidebarSize(target, null)}>{t('恢复默认字号', 'Reset size')}</button>
          <button className="mini" disabled={!cur} onClick={() => { s.toggleModule('sidebar'); s.toast(t('已删除当前边栏（可在上方重新启用）', 'Sidebar removed (re-enable above)')); }}>{t('删除当前边栏', 'Remove sidebar')}</button>
        </div>
        <p className="hint">{t('字号按模板分别保存在本浏览器，下次抽到同一模板会自动沿用。', 'Sizes are saved per template in this browser and reused whenever that template is drawn.')}</p>
      </>}
    </Card>
  );
}
