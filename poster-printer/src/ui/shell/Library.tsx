// Libraries: a glass side panel on the left rail. The style library is new; the other tabs host the
// existing feature panels (restyled via legacy.css) so nothing from the old UI is lost.
import { useStore, previewScene } from '../../store';
import { DEFAULT_PARAMS } from '../../engine/params';
import { renderSVG } from '../../engine/render/svg';
import type { Style } from '../../data/styles';
import { useT } from '../i18n';
import { Icon } from '../Icon';
import { LSeg } from '../controls';
import { LayoutPanel } from '../panels/LayoutPanel';
import { ImagesPanel } from '../panels/ImagesPanel';
import { TextPanel } from '../panels/TextPanel';
import { FontsPanel } from '../panels/FontsPanel';
import { PalettePanel } from '../panels/PalettePanel';
import { HistoryPanel } from '../panels/HistoryPanel';
import { MorePanel } from '../panels/MorePanel';
import { CompPanel } from '../panels/CompPanel';
import { LIBS } from './Chrome';
import { useUI, useLinger } from './ui';
import { useIdleMap } from '../idle';
import { fitSvg } from './thumbs';
import * as A from './actions';

const panelProps = { 'data-refract': '64', 'data-bevel': '28', 'data-blur': '10', 'data-ca': '.05' };
export function Library() {
  const lib = useUI((u) => u.lib);
  const tab = useLinger(lib, 300, true);
  return <aside {...panelProps} className={'lg strong panel library' + (lib ? ' open' : '')} id="library" aria-hidden={!lib}>{tab && <LibraryBody tab={tab} />}</aside>;
}

function LibraryBody({ tab }: { tab: string }) {
  const t = useT();
  const styles = useStore((s) => s.styles);
  const favs = useStore((s) => s.favorites);
  const images = useStore((s) => s.presetImages.length + s.userImages.length);
  const palettes = useStore((s) => s.palettes);
  const def = LIBS.find((l) => l[0] === tab);
  const title = tab === 'saved' ? t('收藏与历史', 'Favourites & history') : tab === 'more' ? t('会话、录制与设置', 'Session & settings') : def ? t(def[2], def[3]) : tab;
  const counts: Record<string, string | number> = { styles: styles.length, images, saved: favs.length, palettes: (palettes as unknown as unknown[] | undefined)?.length ?? '' };
  return (
    <>
      <div className="p-head">
        <div><div className="eyebrow">{tab === 'more' ? t('工具', 'Tools') : t('素材库', 'Library')}{counts[tab] ? ` · ${counts[tab]}` : ''}</div><h2>{title}</h2></div><span className="grow" />
        <button className="icon-btn press" title={t('关闭', 'Close') + ' · Esc'} onClick={() => useUI.setState({ lib: null })}><Icon name="x" size={17} /></button>
      </div>
      <div className="p-body lib-body" data-lib-body={tab}>
        {tab === 'styles' && <StylesTab />}
        {tab === 'layout' && <LayoutPanel />}
        {tab === 'images' && <ImagesPanel />}
        {tab === 'text' && <TextPanel />}
        {tab === 'palettes' && <PalettePanel />}
        {tab === 'fonts' && <FontsPanel />}
        {tab === 'parts' && <CompPanel />}
        {tab === 'saved' && <HistoryPanel />}
        {tab === 'more' && <MorePanel />}
      </div>
    </>
  );
}

/* ---------- style library: real previews of the current poster in every style ---------- */
const styleCache = new Map<string, string>();
function StyleThumb({ st }: { st: Style }) {
  const rid = useStore((s) => s.history[s.hIndex]?.id ?? '');
  const key = rid + '|' + st.id + '|' + JSON.stringify(st.params).length;
  // phase 14: the shared idle queue (one style preview per idle slot)
  const svg = useIdleMap([st.id], key + '#', styleCache, () => { const sc = previewScene({}, { styleId: st.id, params: { ...DEFAULT_PARAMS, ...st.params } as never, fonts: st.fonts, modes: st.modes ?? [] }); return sc ? fitSvg(renderSVG(sc)) : ''; })[st.id] ?? '';
  const f = st.fonts[st.lib]['big.main'];
  return <span className="th">{svg ? <span className="svgth" dangerouslySetInnerHTML={{ __html: svg }} /> : <span className="spec" style={{ fontFamily: `'${f.family}'`, fontWeight: f.weight }}>{st.lib === 'zh' ? '字' : 'Aa'}</span>}</span>;
}
function StylesTab() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const styles = useStore((s) => s.styles);
  const styleId = useStore((s) => s.styleId);
  const tab = useStore((s) => s.styleTab);
  const dirty = useStore((s) => s.dirty);
  const s = useStore.getState();
  const list = styles.filter((x) => (tab === 'mine' ? !x.builtIn : x.lib === tab));
  return (<>
    <LSeg id="seg-styletab" className="boxed fill sm" style={{ marginBottom: 12 }} value={tab} options={[{ v: 'zh', l: t('中文风格', 'CJK') }, { v: 'en', l: t('英文风格', 'Latin') }, { v: 'mine', l: t(`我的 ${styles.filter((x) => !x.builtIn).length}`, `Mine ${styles.filter((x) => !x.builtIn).length}`) }]} onChange={(v) => s.set('styleTab', v)} />
    <div className="row" style={{ marginBottom: 14 }}>
      {dirty && <button className="btn press" style={{ flex: 1 }} onClick={() => { A.toast(t('已更新风格', 'Style updated')); s.updateStyle(); }}><Icon name="save" size={15} />{t('更新当前风格', 'Update style')}</button>}
      <button className="btn press" style={{ flex: 1 }} onClick={() => { const n = prompt(t('风格名称', 'Style name'), (styles.find((x) => x.id === styleId)?.name[lang] ?? '') + ' 2'); if (n) s.saveStyleAs(n); }}><Icon name="bookmark" size={15} />{t('另存为新风格', 'Save as new')}</button>
    </div>
    {list.length ? (
      <div className="style-grid">
        {list.map((x) => (
          <button key={x.id} className={'style-card press' + (x.id === styleId ? ' on' : '')} data-style={x.id} onClick={() => A.pickStyle(x.id)}>
            <StyleThumb st={x} />
            <span className="nm">{x.name[lang]}{x.id === styleId && dirty ? ' *' : ''}<small>{x.fonts[x.lib]['big.main'].family}</small></span>
            {!x.builtIn && <span className="del" title={t('删除', 'Delete')} onClick={(e) => { e.stopPropagation(); if (confirm(t('删除这个风格？', 'Delete this style?'))) s.deleteStyle(x.id); }}><Icon name="trash-2" size={12} /></span>}
          </button>
        ))}
      </div>
    ) : (
      <div style={{ padding: '40px 10px', textAlign: 'center' }}>
        <div className="serif" style={{ fontSize: 30, fontStyle: 'italic', color: 'var(--ink-3)' }}>{t('还没有自己的风格', 'No styles yet')}</div>
        <p className="hint">{t('调整后点上方“另存为新风格”，或在检查器底部保存。导入导出在 ⚙ 会话与设置。', 'Tweak, then “Save as new” above or in the inspector. Import/export lives under ⚙ Session & settings.')}</p>
      </div>
    )}
    <p className="hint" style={{ marginTop: 14 }}>{t('缩略图是当前海报在各风格下的样子（同一文字、配色与图片）。', 'Thumbnails show the current poster in each style (same copy, colours and images).')}</p>
  </>);
}
