import { useEffect, useState } from 'react';
import { useStore, entryScene, type Entry } from '../../store';
import { Card, Seg } from '../controls';
import { Icon } from '../Icon';
import { useT } from '../i18n';
import { renderSVG } from '../../engine/render/svg';

const thumbCache = new Map<string, string>();
function Thumb({ e }: { e: Entry }) {
  const key = e.id + JSON.stringify(e.edits || {});
  const [svg, setSvg] = useState(thumbCache.get(key) || '');
  useEffect(() => {
    if (svg) return;
    const h = requestIdleCallback ? requestIdleCallback(() => {
      const sc = entryScene(e);
      const out = sc ? renderSVG(sc).replace(/^<svg([^>]*?) width="[\d.]+" height="[\d.]+"/, '<svg$1 width="100%" height="100%"') : '';
      thumbCache.set(key, out); setSvg(out);
    }) : 0;
    return () => { if (h) cancelIdleCallback(h); };
  }, [key]);
  return <span className="h-svg" style={{ aspectRatio: e.ratio.replace(':', '/') }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function HistoryPanel() {
  const t = useT();
  const history = useStore((s) => s.history);
  const hIndex = useStore((s) => s.hIndex);
  const favs = useStore((s) => s.favorites);
  const s = useStore.getState();
  const [tab, setTab] = useState<'fav' | 'hist'>('fav');
  const list = tab === 'fav' ? favs : [...history].reverse();
  return (
    <div className="panel-scroll">
      <Card title={t('收藏与历史', 'Favourites & history')} collapsible={false}>
        <Seg value={tab} options={[{ v: 'fav', l: t(`收藏 ${favs.length}`, `Favourites ${favs.length}`) }, { v: 'hist', l: t(`本次历史 ${history.length}`, `History ${history.length}`) }]} onChange={setTab} />
        <button className="pill" onClick={() => s.favorite()}><Icon name="heart" size={14} />{t('收藏当前', 'Favourite current')}</button>
        {list.length === 0 && <div className="empty">{tab === 'fav' ? t('还没有收藏。按 F 或点击上方按钮收藏喜欢的结果。', 'No favourites yet. Press F to keep a result.') : t('还没有历史。', 'No history yet.')}</div>}
        <div className="hist-grid">
          {list.slice(0, 60).map((e) => {
            const idx = history.indexOf(e);
            return (
              <div key={e.id} className={'hist-item' + (tab === 'hist' && idx === hIndex ? ' on' : '')} onClick={() => { if (tab === 'hist') { s.set('hIndex', idx); s.restore(e); } else s.restore(e, true); }}>
                <Thumb e={e} />
                <span className="h-meta">{new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {e.comp}</span>
                {tab === 'fav' && <button className="h-del" onClick={(ev) => { ev.stopPropagation(); s.unfavorite(e.id); }}><Icon name="x" size={12} /></button>}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
