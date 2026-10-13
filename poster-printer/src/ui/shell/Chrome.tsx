// Floating glass chrome: top caps, rails, dock, caption, toasts, brand mark.
import { useEffect, useRef, useState } from 'react';
import { uiParam } from './ia';
import { useStore } from '../../store';
import { useT } from '../i18n';
import { Icon } from '../Icon';
import { LSeg } from '../controls';
import { useUI } from './ui';
import * as A from './actions';
import { PARAMS } from '../../engine/params';
import { LAYERS, LAYER_INFO, FIXED_PLACE, layerHint } from '../../engine/layers';
import type { Layer } from '../../engine/generate';

export function BrandMark({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 28 28" aria-hidden="true">
      <rect x="1.5" y="2" width="25" height="16" rx="5.5" fill="currentColor" />
      <rect x="6.5" y="9.4" width="15" height="1.6" rx=".8" fill="var(--stage)" opacity=".9" />
      <rect x="8" y="11.6" width="12" height="15" rx="1.4" fill="var(--stage)" stroke="currentColor" strokeWidth="1.3" />
      <rect x="10" y="14" width="5" height="3.2" fill="var(--accent)" />
      <path d="M10 19.6h8M10 22h5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity=".55" />
      <circle cx="22" cy="5.6" r="1.35" fill="var(--accent)" />
    </svg>
  );
}
export const Wordmark = () => <span className="wordmark"><span className="wm-ready">Ready</span> Poster <i>Printer</i></span>;

const ratioGlyph = (r: string) => { const [a, b] = r.split(':').map(Number); const k = 12 / Math.max(a, b); return <i className="ratio-glyph" style={{ width: +(a * k).toFixed(1), height: +(b * k).toFixed(1) }} />; };

export function TopCaps() {
  const t = useT();
  const view = useStore((s) => s.view);
  const ratio = useStore((s) => s.ratio);
  const pendingRatio = useUI((u) => u.pendingRatio) as typeof ratio | null;
  const locks = useStore((s) => s.locks);
  const lang = useStore((s) => s.lang);
  const theme = useStore((s) => s.theme);
  const canUndo = useUI((u) => u.canUndo);
  const canRedo = useUI((u) => u.canRedo);
  return (
    <header className="top">
      <div className="lg cap" data-refract="28" data-mat="clear">
        <div className="brand"><BrandMark /><Wordmark /></div>
        <span className="vsep" />
        <LSeg id="seg-view" className="" value={view} onChange={(v) => A.setView(v as 'poster' | 'deck' | 'palette')}
          options={[{ v: 'poster', l: t('海报', 'Poster') }, { v: 'deck', l: t('多页', 'Deck') }, { v: 'palette', l: t('配色', 'Palettes') }]} />
      </div>
      <div className="lg cap center" data-refract="32" data-mat="clear" data-ca=".08" id="toolcap">
        <LSeg id="seg-ratio" className="" value={pendingRatio ?? ratio} onChange={(r) => A.setRatio(r)} options={A.RATIOS.map((r) => ({ v: r, l: <>{ratioGlyph(r)}<span className="mono">{r}</span></>, title: r }))} />
        {view === 'poster' && <>
          <span className="vsep" />
          {A.LOCKS.map(([k, i, z, e, kb]) => (
            <button key={k} className={'lock tip press' + (locks[k] ? ' on' : '')} data-lock={k} data-tip={`${t('锁定' + z, 'Lock ' + e.toLowerCase())} · ${kb}`} onClick={() => A.toggleLock(k)}>
              <Icon name={i} size={16} /><i className="lk"><Icon name={locks[k] ? 'lock' : 'lock-open'} size={9} /></i><span>{t(z, e)}</span>
            </button>
          ))}
          <span className="vsep" />
          <button className="icon-btn tip press" id="btn-undo" disabled={!canUndo} data-tip={`${t('撤销', 'Undo')} · ⌘Z`} onClick={() => A.undo()}><Icon name="undo-2" size={17} /></button>
          <button className="icon-btn tip press" id="btn-redo" disabled={!canRedo} data-tip={`${t('重做', 'Redo')} · ⇧⌘Z`} onClick={() => A.redo()}><Icon name="redo-2" size={17} /></button>
        </>}
      </div>
      <div className="grow" />
      <button className="lg cap text-btn search-btn hl press" id="btn-cmdk" data-refract="28" data-mat="clear" onClick={() => A.openSheet('cmdk')}>
        <span className="hl-glow" /><Icon name="search" size={16} /><span>{t('搜索命令与参数', 'Search…')}</span><kbd>⌘K</kbd>
      </button>
      <div className="lg cap" data-refract="28" data-mat="clear">
        <button className="icon-btn tip press" id="btn-lang" data-tip={`${t('English', '中文')} · ⇧L`} onClick={A.toggleLang}><span style={{ fontWeight: 600, fontSize: 12 }}>{lang === 'zh' ? 'EN' : '中'}</span></button>
        <button className="icon-btn tip press" id="btn-theme" data-tip={`${t('明暗', 'Appearance')} · ⇧D`} onClick={A.toggleTheme}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} /></button>
      </div>
      <button className="lg ink primary-btn press hl" id="btn-export" data-refract="30" data-ca=".06" onClick={() => A.openSheet('export')}>
        <span className="hl-glow" /><Icon name="download" size={17} /><span>{t('导出', 'Export')}</span>
      </button>
    </header>
  );
}

export const LIBS: [string, string, string, string][] = [
  ['styles', 'swatch-book', '风格', 'Styles'], ['layout', 'layout-template', '版式', 'Layouts'], ['images', 'image', '图片', 'Images'], ['text', 'type', '文字', 'Text'],
  ['palettes', 'palette', '配色', 'Palettes'], ['fonts', 'a-large-small', '字体', 'Fonts'], ['parts', 'sticker', '组件', 'Parts'],
];
export function Rails() {
  const t = useT();
  const lib = useUI((u) => u.lib);
  const insp = useUI((u) => u.insp);
  const adv = useUI((u) => u.adv);
  const film = useUI((u) => u.film);
  const advIntent = useUI((u) => u.advIntent);
  const view = useStore((s) => s.view);
  return (
    <>
      {view === 'poster' && <nav className="lg rail rail-l" data-refract="28" data-mat="clear" aria-label={t('素材库', 'Libraries')}>
        {LIBS.map(([k, i, z, e]) => <button key={k} className={'tip press' + (lib === k ? ' on' : '')} data-lib={k} data-tip={t(z, e)} onClick={() => A.openLib(k)}><Icon name={i} size={19} /></button>)}
        <span className="rsep" />
        <button className={'tip press' + (lib === 'saved' ? ' on' : '')} data-lib="saved" data-tip={t('收藏与历史', 'Favourites & history')} onClick={() => A.openLib('saved')}><Icon name="heart" size={19} /></button>
        <button className={'tip press' + (lib === 'more' ? ' on' : '')} data-lib="more" data-tip={t('会话、录制与设置', 'Session, recording & settings')} onClick={() => A.openLib('more')}><Icon name="settings-2" size={19} /></button>
      </nav>}
      <nav className="lg rail rail-r" data-refract="28" data-mat="clear" aria-label={t('调整', 'Adjust')}>
        <button className={'tip press' + ((insp || view === 'deck') && !adv ? ' on' : '')} id="r-insp" data-tip={`${t('检查器', 'Inspector')} · I`} onClick={() => A.togglePanel('insp')}><Icon name="panel-right" size={19} /></button>
        <button className={'tip press' + (adv && advIntent !== 'layers' ? ' on' : '')} id="r-adv" data-tip={`${t('高级调校', 'Advanced')} · A`} onClick={() => A.togglePanel('adv')}><Icon name="sliders-horizontal" size={19} /></button>
        <button className={'tip press' + (adv && advIntent === 'layers' ? ' on' : '')} id="r-layers" data-tip={`${t('图层与模式', 'Layers & modes')} · L`} onClick={A.openLayers}><Icon name="layers" size={19} /></button>
        <span className="rsep" />
        <button className={'tip press' + (film ? ' on' : '')} id="r-film" data-tip={`${t('历史胶片', 'History')} · H`} onClick={() => A.togglePanel('film')}><Icon name="film" size={19} /></button>
        <button className="tip press" id="r-keys" data-tip={`${t('快捷键', 'Shortcuts')} · ?`} onClick={() => A.openSheet('keys')}><Icon name="keyboard" size={19} /></button>
      </nav>
    </>
  );
}

export function Dock({ deck }: { deck?: { cur: number; n: number; prev: () => void; next: () => void; redraw: () => void } }) {
  const t = useT();
  const hIndex = useStore((s) => s.hIndex);
  const hLen = useStore((s) => s.history.length);
  const isFav = useStore((s) => !!s.history[s.hIndex] && s.favorites.some((f) => f.id === s.history[s.hIndex].id));
  const film = useUI((u) => u.film);
  const capProps = { 'data-refract': '36', 'data-bevel': '20', 'data-mat': 'clear', 'data-ca': '.1' };
  const ripple = (e: React.MouseEvent<HTMLButtonElement>) => {
    const b = e.currentTarget; const r = b.getBoundingClientRect(); const rp = document.createElement('span'); rp.className = 'ripple';
    const s = Math.max(r.width, r.height) * 2.2;
    Object.assign(rp.style, { width: s + 'px', height: s + 'px', left: (e.clientX ? e.clientX - r.left : r.width / 2) + 'px', top: (e.clientY ? e.clientY - r.top : r.height / 2) + 'px' });
    b.appendChild(rp); setTimeout(() => rp.remove(), 720);
  };
  return (
    <div className="dock" id="dock">
      <div className="lg cap adaptive" {...capProps}>
        <button className="icon-btn tip press" id="btn-prev" disabled={deck ? deck.cur <= 0 : hIndex <= 0} data-tip={`${t('上一张', 'Previous')} · ←`} onClick={() => (deck ? deck.prev() : A.go(-1))}><Icon name="chevron-left" size={20} /></button>
        <span className="hist-count mono" id="hist-count">{deck ? `${deck.cur + 1} / ${deck.n}` : `${hIndex + 1} / ${hLen}`}</span>
        <button className="icon-btn tip press" id="btn-next" disabled={deck ? deck.cur >= deck.n - 1 : hIndex >= hLen - 1} data-tip={`${t('下一张', 'Next')} · →`} onClick={() => (deck ? deck.next() : A.go(1))}><Icon name="chevron-right" size={20} /></button>
      </div>
      {!deck && <div className="lg cap adaptive" {...capProps}>
        {A.REMIX.slice(0, 3).map(([k, i, z, e]) => <button key={k} className="remix press hl" data-remix={k} title={t('换' + z, 'New ' + e.toLowerCase())} onClick={(e) => { if (e.detail <= 1) A.remix(k); }}><span className="hl-glow" /><Icon name={i} size={15} /><span className="rl">{t(z, e)}</span></button>)}
      </div>}
      <button className="lg ink draw press" id="btn-draw" data-qa="draw" data-refract="48" data-bevel="26" data-ca=".08" onClick={(e) => { if (e.detail > 1) return; ripple(e); if (deck) deck.redraw(); else A.draw(); }}>
        <span className="led" /><span>{deck ? t('重抽本页', 'Redraw page') : t('抽一张', 'Draw')}</span><span className="kbd">{t('空格', 'Space')}</span>
      </button>
      {!deck && <div className="lg cap adaptive" {...capProps}>
        {A.REMIX.slice(3).map(([k, i, z, e]) => k === 'structure' ? <StructureSplit key={k} icon={i} zh={z} en={e} /> : <button key={k} className="remix press hl" data-remix={k} title={t('换' + z, 'New ' + e.toLowerCase())} onClick={(e) => { if (e.detail <= 1) A.remix(k); }}><span className="hl-glow" /><Icon name={i} size={15} /><span className="rl">{t(z, e)}</span></button>)}
      </div>}
      {!deck && <LayerMenu />}
      {!deck && <div className="lg cap adaptive" {...capProps}>
        <button className={'icon-btn fav tip press' + (isFav ? ' on' : '')} id="btn-fav" data-tip={`${t('收藏', 'Favourite')} · F`} onClick={A.favorite}><Icon name="heart" size={19} /></button>
        <button className={'icon-btn tip press' + (film ? ' on' : '')} id="btn-film" data-tip={`${t('历史胶片', 'History')} · H`} onClick={() => A.togglePanel('film')}><Icon name="history" size={19} /></button>
      </div>}
    </div>
  );
}

/** phase 17: 结构 is a split button — the label re-lays out the whole structure (as before), the caret opens the layer menu */
function StructureSplit({ icon, zh, en }: { icon: string; zh: string; en: string }) {
  const t = useT();
  const open = useUI((u) => u.layerPop);
  return (
    <span className={'remix-split' + (open ? ' open' : '')} id="structure-split">
      <button className="remix press hl" data-remix="structure" title={t('换' + zh + '（整体重排）', 'New ' + en.toLowerCase() + ' (whole layout)')} onClick={(e) => { if (e.detail <= 1) A.remix('structure'); }}><span className="hl-glow" /><Icon name={icon} size={15} /><span className="rl">{t(zh, en)}</span></button>
      <button className="remix-caret press" data-qa="layer-menu" aria-haspopup="menu" aria-expanded={open} title={t('分层换：网格 / 图位 / 排字', 'By layer: grid / placement / type')} onClick={() => useUI.setState({ layerPop: !open })}><Icon name={open ? 'chevron-down' : 'chevron-up'} size={14} /></button>
    </span>
  );
}

/** phase 17: the layer menu. It stays open while you re-roll (try 排字 a few times in a row); Esc or a click outside closes it */
function LayerMenu() {
  const t = useT();
  const open = useUI((u) => u.layerPop);
  const comp = useStore((s) => s.result?.picked.comp ?? '');
  const legacy = useStore((s) => !!s.result && !s.result.picked.layers);
  const ref = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const b = document.getElementById('structure-split'), d = document.getElementById('dock');
      if (b && d) { const rb = b.getBoundingClientRect(), rd = d.getBoundingClientRect(); setX(rb.left - rd.left + rb.width / 2); }
    };
    place();
    const away = (e: PointerEvent) => { const tg = e.target as HTMLElement; if (!ref.current?.contains(tg) && !tg.closest?.('#structure-split')) useUI.setState({ layerPop: false }); };
    window.addEventListener('resize', place); document.addEventListener('pointerdown', away, true);
    document.body.classList.add('layer-pop-open');
    return () => { window.removeEventListener('resize', place); document.removeEventListener('pointerdown', away, true); document.body.classList.remove('layer-pop-open'); };
  }, [open]);
  if (!open) return null;
  const fixed = FIXED_PLACE.has(comp);
  const row = (k: Layer | 'structure', icon: string, zh: string, en: string, dzh: string, den: string, key: string | null, off = false, why = '') => (
    <button key={k} role="menuitem" className={'lp-row press' + (off ? ' off' : '')} data-layer={k === 'structure' ? undefined : k} data-qa={'layer-' + k} aria-disabled={off} title={off ? why : undefined}
      onClick={(e) => { if (e.detail > 1) return; if (off) { useStore.getState().toast(why, 'warn', 'reroll'); return; } if (k === 'structure') A.remix('structure'); else A.relayer(k); }}>
      <span className="lp-ic"><Icon name={icon} size={17} /></span>
      <span className="lp-tx"><b>{t(zh, en)}</b><small>{off ? why : t(dzh, den)}</small></span>
      {key && <kbd>{key}</kbd>}
    </button>
  );
  return (
    <div ref={ref} className="lg strong layer-pop" role="menu" aria-label={t('分层换结构', 'Re-roll a layer')} style={{ left: x }}>
      <div className="lp-head"><span>{t('分层换结构', 'Re-roll one layer')}</span><small>{legacy ? t('旧版海报：第一次会整体转换', 'Older poster: converts once') : t('其余两层保持不动', 'the other two stay put')}</small></div>
      {LAYERS.map((k) => { const L = LAYER_INFO[k]; const off = k === 'place' && fixed; return row(k, A.LAYER_ICON[k], L.zh, L.en, L.dzh, L.den, { grid: 'R', place: 'P', type: 'T' }[k], off, off ? layerHint(useStore.getState().lang, 'place', comp) : ''); })}
      <div className="lp-sep" />
      {row('structure', 'layout-grid', '整体结构', 'Whole structure', '网格、图位、排字一起重新布局', 'Grid, placement and type all re-laid out', null)}
    </div>
  );
}

/** phase 13: what future draws will keep — the pins, as chips attached under 抽一张 */
export function PinsBar() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const live = useStore((s) => s.pins);
  // phase 14: a removed chip stays for its exit animation (value frozen), then leaves
  const [gone, setGone] = useState<Record<string, unknown>>({});
  const prev = useRef(live);
  useEffect(() => {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(prev.current)) if (!(k in live)) out[k] = prev.current[k];
    prev.current = live;
    if (!Object.keys(out).length) return;
    setGone((g) => ({ ...g, ...out }));
    const h = setTimeout(() => setGone((g) => { const n = { ...g }; for (const k of Object.keys(out)) if (!(k in useStore.getState().pins)) delete n[k]; return n; }), 220);
    return () => clearTimeout(h);
  }, [live]);
  const pins = { ...gone, ...live } as typeof live;
  const ks = Object.keys(pins).filter((k) => k in live || k in gone);
  const nLive = Object.keys(live).length;
  useEffect(() => { document.body.classList.toggle('has-pins', nLive > 0); }, [nLive]);
  if (!ks.length) return null;
  const fmt = (k: string) => {
    const d = uiParam(k); const v = pins[k];
    if (!d) return `${k} ${String(v)}`;
    const name = lang === 'zh' ? d.pzh : d.pen;
    if (d.type === 'seg') { const o = d.options.find((x) => x.v === String(v)); return `${name} · ${o ? o[lang] : String(v)}`; }
    if (d.type === 'bool') return `${name} · ${v ? t('开', 'on') : t('关', 'off')}`;
    return `${name} ${v}${d.unit ?? ''}`;
  };
  return (
    <div className="pins-bar" id="pins-bar" data-n={ks.length}>
      <span className="pins-h"><Icon name="pin" size={12} />{t('之后的抽卡沿用', 'Future draws keep')}</span>
      {ks.map((k) => <button key={k} className={'lg pin-chip press' + (k in live ? '' : ' out')} data-pin={k} title={t('点按打开参数 · ✕ 解除', 'Open the control · ✕ to unpin')} onClick={() => A.openParam(k)}>{fmt(k)}<span className="x" role="button" aria-label={t('解除', 'Unpin')} onClick={(e) => { e.stopPropagation(); A.togglePin(k); }}><Icon name="x" size={11} /></span></button>)}
      {nLive > 0 && <button className="pin-clear press" id="btn-unpin-all" onClick={A.clearPins}><Icon name="x" size={11} />{t('全部解除', 'Unpin all')}</button>}
    </div>
  );
}

const compDef = PARAMS.find((p) => p.key === 'composition')!;
export const compLabel = (v: string, lang: 'zh' | 'en') => { const o = compDef.type === 'seg' ? compDef.options.find((x) => x.v === v) : undefined; return o ? o[lang] : v; };

export function Caption() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const result = useStore((s) => s.result);
  const hIndex = useStore((s) => s.hIndex);
  const styleName = useStore((s) => s.styles.find((x) => x.id === s.styleId)?.name[s.lang] ?? '');
  const dirty = useStore((s) => s.dirty);
  const recording = useStore((s) => s.recording);
  const editingText = useStore((s) => s.editingText);
  const imgEdit = useUI((u) => u.imgEdit);
  const editsN = useStore((s) => Object.keys(s.edits).length);
  if (!result) return <div className="caption mono" id="caption" />;
  const score = result.scene.info.score as number | undefined;
  return (
    <div className="caption mono" id="caption">
      <span className="led" /><b>No.{String(hIndex + 1).padStart(3, '0')}</b>
      <span className="dot" /><span>{styleName}{dirty ? ' *' : ''}</span>
      <span className="dot" /><span>{compLabel(result.picked.comp, lang)}</span>
      <span className="dot" /><span>{Math.max(1, Math.round(result.ms))} ms</span>
      {score != null && <><span className="dot" /><span>{t('版面分', 'score')} {score}</span></>}
      {recording && <><span className="dot" /><span style={{ color: 'var(--bad)' }}>● REC</span></>}
      {imgEdit ? <><span className="dot" /><span style={{ color: 'var(--accent)' }}>{t('取景：拖动平移 · 滚轮缩放 · Esc 退出', 'Reframe: drag · wheel to zoom · Esc')}</span></>
        : editingText ? <><span className="dot" /><span style={{ color: 'var(--accent)' }}>{t('编辑文字 · ⌘↵ 完成', 'Editing · ⌘↵ to finish')}</span></>
        : editsN > 0 ? <><span className="dot" /><button className="cap-link" onClick={() => useStore.getState().resetEdits()} title={t('撤销画布上的手动修改', 'Revert manual edits')}>{t(`手动修改 ${editsN} · 还原`, `${editsN} edits · reset`)}</button></> : null}
    </div>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return <div className="toasts" aria-live="polite">{toasts.map((x) => <div key={x.id} className={'toast lg strong ' + (x.kind || '') + (x.out ? ' out' : '')} role="status"><Icon name={x.kind === 'warn' ? 'info' : 'check'} size={15} /><span>{x.msg}</span></div>)}</div>;
}
