// Filmstrip: this session's history and favourites as a horizontal glass strip under the poster.
import { useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { useT } from '../i18n';
import { Icon } from '../Icon';
import { LSeg } from '../controls';
import { useUI } from './ui';
import { EntryThumb, replay, toggleRecording } from './thumbs';

export function Film() {
  const t = useT();
  const film = useUI((u) => u.film);
  const tab = useUI((u) => u.filmTab);
  const history = useStore((s) => s.history);
  const favs = useStore((s) => s.favorites);
  const hIndex = useStore((s) => s.hIndex);
  const recording = useStore((s) => s.recording);
  const replaying = useStore((s) => s.replaying);
  const strip = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; s: number } | null>(null);
  const dragged = useRef(false);
  const list = tab === 'fav' ? favs : history;
  const curId = history[hIndex]?.id;
  const favIds = new Set(favs.map((f) => f.id));
  useEffect(() => {
    const el = strip.current; if (!el || !film) return;
    const c = el.querySelector('.fthumb.cur') as HTMLElement | null;
    if (c) requestAnimationFrame(() => { el.style.scrollBehavior = 'auto'; el.scrollLeft = c.offsetLeft - el.clientWidth / 2 + c.clientWidth / 2; el.style.scrollBehavior = ''; });
  }, [film, hIndex, tab, list.length]);
  useEffect(() => {
    const el = strip.current; if (!el) return;
    const w = (e: WheelEvent) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { el.scrollLeft += e.deltaY; e.preventDefault(); } };
    el.addEventListener('wheel', w, { passive: false }); return () => el.removeEventListener('wheel', w);
  }, [film]);
  const s = useStore.getState();
  return (
    <section className={'lg strong film' + (film ? ' open' : '')} id="film" data-refract="44" data-bevel="22" data-blur="8" data-ca=".06">
      {film && <>
        <div className="film-head">
          <LSeg id="seg-film" className="boxed sm" value={tab} options={[{ v: 'hist', l: t(`历史 ${history.length}`, `History ${history.length}`) }, { v: 'fav', l: t(`收藏 ${favs.length}`, `Favourites ${favs.length}`) }]} onChange={(v) => useUI.setState({ filmTab: v })} />
          <span className="sub">{t('点击回到任意一张 · ← → 逐张 · 拖动滚动', 'Click to revisit · ← → to step · drag to scroll')}</span><span className="grow" />
          <button className="text-btn press" data-qa="replay" style={{ height: 30, fontSize: 12 }} onClick={() => replay()}><Icon name={replaying ? 'square' : 'play'} size={14} />{replaying ? t('停止回放', 'Stop') : t('回放', 'Replay')}</button>
          <button className="text-btn press" style={{ height: 30, fontSize: 12, ...(recording ? { color: 'var(--bad)' } : {}) }} onClick={toggleRecording}><Icon name="circle-dot" size={14} />{recording ? t('停止录制', 'Stop') : t('录制', 'Record')}</button>
          <button className="icon-btn press" style={{ width: 30, height: 30 }} title={t('关闭', 'Close')} onClick={() => useUI.setState({ film: false })}><Icon name="x" size={15} /></button>
        </div>
        <div className="film-strip" id="film-strip" ref={strip}
          onPointerDown={(e) => { drag.current = { x: e.clientX, s: strip.current!.scrollLeft }; dragged.current = false; }}
          onPointerMove={(e) => { const d0 = drag.current; if (!d0) return; const d = e.clientX - d0.x; if (Math.abs(d) > 4) { dragged.current = true; strip.current!.style.scrollBehavior = 'auto'; strip.current!.scrollLeft = d0.s - d; } }}
          onPointerUp={() => { drag.current = null; strip.current!.style.scrollBehavior = ''; setTimeout(() => (dragged.current = false), 0); }}
          onPointerLeave={() => { drag.current = null; }}>
          {list.length === 0 && <span className="muted" style={{ padding: '20px 8px', fontSize: 12 }}>{tab === 'fav' ? t('还没有收藏 · 按 F 收藏当前海报', 'No favourites yet · press F') : t('还没有历史', 'No history yet')}</span>}
          {list.map((e, i) => (
            <button key={e.id} className={'fthumb' + (e.id === curId ? ' cur' : '')} data-id={e.id} style={{ aspectRatio: e.ratio.replace(':', '/') }}
              onClick={() => { if (dragged.current) return; if (tab === 'fav') { const j = history.findIndex((h) => h.id === e.id); if (j >= 0) { s.set('hIndex', j); s.restore(history[j]); } else s.restore(e, true); } else { s.set('hIndex', i); s.restore(e); } }}>
              <EntryThumb e={e} />
              <span className="n">{tab === 'fav' ? '♥' : String(i + 1).padStart(2, '0')}</span>
              {tab !== 'fav' && favIds.has(e.id) && <span className="h"><Icon name="heart" size={12} /></span>}
              {tab === 'fav' && <span className="x" title={t('取消收藏', 'Unfavourite')} onClick={(ev) => { ev.stopPropagation(); s.unfavorite(e.id); }}><Icon name="x" size={11} /></span>}
            </button>
          ))}
        </div>
      </>}
    </section>
  );
}
