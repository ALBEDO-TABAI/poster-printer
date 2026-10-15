import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { loadPalettes } from '../lib/assets';
import { loadFontManifest, ensureFont, fontFaceCss } from '../lib/fonts';
import { rasterizeSVG, download } from '../lib/exporter';
import { useLocalLang, useLocalTheme } from '../lib/lang';
import { newSeed, Rng } from '../engine/rng';
import { wcag, apca } from '../engine/color/contrast';
import type { LibPalette } from '../engine/color/palette';
import { renderCard, CARD_LAYOUTS, CARD_W, CARD_H, CARD_FONTS, type CardLayout } from './cards';
import { metaFor, describe, LIGHT, CHROMA, CONTRAST, MOOD } from './names';
import { BrandMark, Wordmark } from '../ui/shell/Chrome';
import { LSeg } from '../ui/controls';
import G from '../ui/glass/glass';
import { Icon } from '../ui/Icon';
import { APP_NAME } from '../config';

interface Draw { id: string; layout: CardLayout; salt: string }
interface Filter { src: string; light: string; chroma: string; contrast: string; tag: string }
const LSget = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const LSset = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const idxOf = (p: LibPalette) => Number(p.id.replace(/\D/g, '')) || 0;

export function ColorApp() {
  const [lang, setLang, t] = useLocalLang();
  const [theme, setTheme] = useLocalTheme();
  const [pals, setPals] = useState<LibPalette[]>([]);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<Filter>(() => LSget('rea.color.filter.v1', { src: 'all', light: 'any', chroma: 'any', contrast: 'any', tag: 'any' }));
  const [hist, setHist] = useState<Draw[]>(() => LSget('rea.color.hist.v1', []));
  const [hi, setHi] = useState<number>(() => LSget<Draw[]>('rea.color.hist.v1', []).length - 1);
  const [favs, setFavs] = useState<Draw[]>(() => LSget('rea.color.favs.v1', []));
  const [layoutLock, setLayoutLock] = useState<CardLayout | null>(() => LSget('rea.color.layout.v1', null));
  const [dock, setDock] = useState<'recent' | 'favs'>('recent');
  const [copied, setCopied] = useState<string | null>(null);
  const [anim, setAnim] = useState(0);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1800); };

  useEffect(() => { (async () => { await loadFontManifest(); await Promise.all(CARD_FONTS.map(ensureFont)); setPals(await loadPalettes()); setReady(true); })(); }, []);
  useEffect(() => { LSset('rea.color.filter.v1', filter); }, [filter]);
  useEffect(() => { LSset('rea.color.hist.v1', hist.slice(-60)); }, [hist]);
  useEffect(() => { LSset('rea.color.favs.v1', favs); }, [favs]);
  useEffect(() => { LSset('rea.color.layout.v1', layoutLock); }, [layoutLock]);
  useEffect(() => { document.title = `${t('配色抽卡', 'Palette Draw')} · ${APP_NAME}`; }, [lang]);

  const pool = useMemo(() => pals.filter((p) => (filter.src === 'all' || p.src === filter.src) && (filter.light === 'any' || p.light === filter.light) && (filter.chroma === 'any' || p.chroma === filter.chroma) && (filter.contrast === 'any' || p.contrast === filter.contrast) && (filter.tag === 'any' || p.tags.includes(filter.tag))), [pals, filter]);
  const byId = useMemo(() => new Map(pals.map((p) => [p.id, p])), [pals]);
  const cur = hist[hi];
  const pal = cur ? byId.get(cur.id) : undefined;

  const draw = useCallback(() => {
    if (!pool.length) { flash(t('当前筛选没有配色', 'No palettes match the filter')); return; }
    const r = new Rng(newSeed());
    let p = r.pick(pool);
    for (let k = 0; k < 4 && cur && p.id === cur.id && pool.length > 1; k++) p = r.pick(pool);
    const layout = layoutLock ?? r.pick(CARD_LAYOUTS).id;
    const d: Draw = { id: p.id, layout, salt: newSeed(4) };
    setHist((h) => { const nh = [...h.slice(0, hi + 1), d].slice(-60); setHi(nh.length - 1); return nh; });
    setAnim((a) => a + 1);
  }, [pool, layoutLock, hi, cur]);
  useEffect(() => { if (ready && !hist.length && pals.length) draw(); }, [ready]);
  const go = (d: number) => { const i = Math.max(0, Math.min(hist.length - 1, hi + d)); if (i !== hi) { setHi(i); setAnim((a) => a + 1); } };
  const setLayout = (l: CardLayout) => { if (!cur) return; setHist((h) => h.map((x, i) => (i === hi ? { ...x, layout: l } : x))); };

  const meta = pal ? metaFor(pal, idxOf(pal), cur!.salt) : null;
  const svg = pal && meta ? renderCard(cur!.layout, pal, meta) : '';

  const copy = async (s: string, key = s) => { try { await navigator.clipboard.writeText(s); } catch { /* insecure context */ const ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } setCopied(key); setTimeout(() => setCopied(null), 1200); };
  const exportAs = async (kind: 'png' | 'svg' | 'json' | 'css' | 'ase') => {
    if (!pal || !meta) return;
    const base = `ready-poster-printer-palette-${pal.id}-${cur!.layout}`;
    if (kind === 'png' || kind === 'svg') {
      const css = await fontFaceCss(CARD_FONTS);
      const full = renderCard(cur!.layout, pal, meta, { fontCss: css });
      if (kind === 'svg') download(full, base + '.svg');
      else download(await rasterizeSVG(full, CARD_W, CARD_H, 2), base + '.png');
    } else if (kind === 'json') download(JSON.stringify({ id: pal.id, source: pal.src, colors: pal.colors, names: pal.names ?? pal.colors.map((c) => describe(c).en), title: meta.title, titleEn: meta.titleEn, tags: meta.tagsEn }, null, 2), base + '.json');
    else if (kind === 'css') download(`/* ${meta.titleEn} — ${pal.id} */\n:root {\n${pal.colors.map((c, i) => `  --rea-${i + 1}: ${c};`).join('\n')}\n}\n`, base + '.css');
    flash(t('已导出', 'Exported'));
  };
  const toPoster = () => { if (!pal) return; localStorage.setItem('rea.pinPalette', JSON.stringify(pal.colors)); location.href = '/'; };
  const isFav = !!cur && favs.some((f) => f.id === cur.id);
  const toggleFav = () => { if (!cur) return; setFavs((f) => (isFav ? f.filter((x) => x.id !== cur.id) : [cur, ...f])); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea,select')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'Space') { e.preventDefault(); draw(); }
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key >= '1' && e.key <= '4') setLayout(CARD_LAYOUTS[Number(e.key) - 1].id);
      else if ((e.key === 'c' || e.key === 'C') && pal) copy(pal.colors.join(' '), 'all');
      else if (e.key === 'f' || e.key === 'F') toggleFav();
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });

  const chip = (key: keyof Filter, v: string, label: string) => <button key={v} className={'chipt press' + (filter[key] === v ? ' on' : '')} onClick={() => setFilter({ ...filter, [key]: v })}>{label}</button>;
  const L = (m: Record<string, [string, string]>) => Object.entries(m).map(([k, v]) => [k, lang === 'zh' ? v[0] : v[1]] as [string, string]);
  const dockList = dock === 'recent' ? [...hist].reverse().slice(0, 24) : favs;
  const stageRef = useRef<HTMLDivElement>(null);

  // ambient field: the palette, softly spread behind the glass (same idea as the poster editor's field)
  useEffect(() => {
    if (!pal) return;
    const W = 192, H = Math.max(2, Math.round(192 * innerHeight / innerWidth));
    const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d'); if (!ctx) return;
    const stage = getComputedStyle(document.documentElement).getPropertyValue('--stage').trim() || '#ebebee';
    ctx.fillStyle = stage; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = theme === 'dark' ? 0.42 : 0.5;
    if ('filter' in ctx) ctx.filter = 'blur(14px) saturate(1.4)';
    const n = pal.colors.length;
    pal.colors.forEach((col, i) => { ctx.fillStyle = col; const x = W * (0.32 + 0.36 * (i / Math.max(1, n - 1))); ctx.beginPath(); ctx.ellipse(x, H * (0.38 + 0.22 * Math.sin(i * 1.7)), W * 0.16, H * 0.3, 0, 0, Math.PI * 2); ctx.fill(); });
    const url = c.toDataURL('image/jpeg', 0.9);
    const au = document.querySelectorAll<HTMLImageElement>('.aura img'); if (au.length < 2) return;
    const on = au[0].classList.contains('on') ? 1 : 0; au[on].src = url; au[on].classList.add('on'); au[on ^ 1].classList.remove('on');
    G.setScene({ field: url });
  }, [pal, theme]);
  useEffect(() => { G.auto(); G.refract(); }, []);
  useEffect(() => { G.refreshAll(); }, [theme]);

  const panelProps = { 'data-refract': '64', 'data-bevel': '28', 'data-blur': '10', 'data-ca': '.05' };
  const capProps = { 'data-refract': '36', 'data-bevel': '20', 'data-mat': 'clear', 'data-ca': '.1' };
  return (
    <div className="capp">
      <div className="stage"><div className="aura"><img alt="" /><img alt="" /></div><div className="dots" /><div className="vignette" /></div>
      <header className="top">
        <div className="lg cap" data-refract="28" data-mat="clear">
          <a className="brand" href="./"><BrandMark /><Wordmark /></a>
          <span className="vsep" />
          <nav className="seg pagenav">
            <a href="./">{t('海报', 'Poster')}</a>
            <a href="./?view=deck">{t('多页', 'Deck')}</a>
            <a className="on" href="./color.html">{t('配色', 'Palettes')}</a>
          </nav>
        </div>
        <div className="lg cap center status-cap" data-refract="32" data-mat="clear"><span className="status mono">{ready ? `${t('配色库', 'Library')} ${pals.length} · ${t('当前池', 'pool')} ${pool.length}` : t('载入中…', 'Loading…')}</span></div>
        <div className="grow" />
        <div className="lg cap" data-refract="28" data-mat="clear">
          <button className="icon-btn tip press" data-tip={t('English', '中文')} onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}><span style={{ fontWeight: 600, fontSize: 12 }}>{lang === 'zh' ? 'EN' : '中'}</span></button>
          <button className="icon-btn tip press" data-tip={t('明暗', 'Appearance')} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}><Icon name={theme === 'light' ? 'moon' : 'sun'} size={17} /></button>
        </div>
      </header>
      <aside className="lg cdock" data-refract="36">
        <LSeg className="boxed fill sm" value={dock} options={[{ v: 'recent', l: t('最近', 'Recent') }, { v: 'favs', l: `${t('收藏', 'Saved')} ${favs.length || ''}` }]} onChange={(v) => setDock(v)} />
        <div className="dock-list">
          {dockList.map((d, i) => { const p = byId.get(d.id); if (!p) return null; const active = cur && d.id === cur.id && d.salt === cur.salt; return (
            <button key={d.id + d.salt + i} className={'dock-item' + (active ? ' on' : '')} title={p.id} onClick={() => { const at = hist.findIndex((h) => h === d); if (at >= 0) { setHi(at); } else { setHist((h) => { const nh = [...h, d]; setHi(nh.length - 1); return nh; }); } setAnim((a) => a + 1); }}>
              {p.colors.map((c) => <span key={c} style={{ background: c }} />)}
            </button>); })}
          {!dockList.length && <p className="hint">{dock === 'favs' ? t('按 F 收藏当前配色', 'Press F to save') : ''}</p>}
        </div>
      </aside>
      <main className="cstage" ref={stageRef}>
        <div className="card-wrap">
          {svg ? <div key={anim} className="card-svg flip-in" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="card-svg skeleton" />}
          <div className="lg layout-dots" data-refract="28" data-mat="clear">
            {CARD_LAYOUTS.map((l, i) => <button key={l.id} className={'press' + (cur?.layout === l.id ? ' on' : '')} title={`${lang === 'zh' ? l.zh : l.en} (${i + 1})`} onClick={() => setLayout(l.id)}><span>{lang === 'zh' ? l.zh : l.en}</span></button>)}
            <button className={'lockl press' + (layoutLock ? ' on' : '')} title={t('锁定版式', 'Lock layout')} onClick={() => setLayoutLock(layoutLock ? null : cur?.layout ?? 'columns')}><Icon name={layoutLock ? 'lock' : 'unlock'} size={14} /></button>
          </div>
        </div>
      </main>
      <div className="dock cbar">
        <div className="lg cap" {...capProps}>
          <button className="icon-btn tip press" onClick={() => go(-1)} disabled={hi <= 0} data-tip={t('上一张', 'Previous') + ' · ←'}><Icon name="chevron-left" size={20} /></button>
          <span className="hist-count mono">{hist.length ? `${hi + 1} / ${hist.length}` : '–'}</span>
          <button className="icon-btn tip press" onClick={() => go(1)} disabled={hi >= hist.length - 1} data-tip={t('下一张', 'Next') + ' · →'}><Icon name="chevron-right" size={20} /></button>
        </div>
        <button className="lg ink draw press draw-pill" data-refract="48" data-bevel="26" data-ca=".08" onClick={draw}><span className="led" /><span>{t('抽配色', 'Draw')}</span><span className="kbd">{t('空格', 'Space')}</span></button>
        <div className="lg cap" {...capProps}>
          <button className={'icon-btn fav tip press' + (isFav ? ' on' : '')} onClick={toggleFav} data-tip={t('收藏', 'Save') + ' · F'}><Icon name="heart" size={19} /></button>
          <button className="remix press" onClick={() => pal && copy(pal.colors.join(' '), 'all')}><Icon name={copied === 'all' ? 'check' : 'copy'} size={15} /><span className="rl">{t('复制色号', 'Copy hex')}</span></button>
          <button className="remix press" onClick={toPoster}><Icon name="arrow-up-right" size={15} /><span className="rl">{t('用于海报', 'Use in poster')}</span></button>
        </div>
      </div>
      <aside {...panelProps} className="lg strong panel cpanel open">
        <div className="p-head"><div><div className="eyebrow">{t('当前配色', 'This palette')}{pal ? ` · ${pal.id}` : ''}</div><h2>{pal && meta ? (lang === 'zh' ? meta.title : meta.titleEn) : '…'}</h2></div></div>
        <div className="p-body">
          {pal && meta && <div className="sec" style={{ paddingTop: 0 }}>
            <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>{pal.src === 'wada' ? t('和田三造 · 1933', 'Wada · 1933') : 'nice-color-palettes'} · #{meta.idx}</p>
            <div className="cswatches">
              {pal.colors.map((c, i) => { const d = describe(c); return (
                <button key={c + i} className="swr" onClick={() => copy(c)} title={t('点击复制', 'Click to copy')}>
                  <span className="swc" style={{ background: c }} />
                  <span className="hex">{c.toUpperCase()}</span>
                  <span className="nm">{pal.names?.[i] ?? (lang === 'zh' ? d.zh : d.en)}</span>
                  <Icon name={copied === c ? 'check' : 'copy'} size={13} />
                </button>); })}
            </div>
          </div>}
          {pal && <div className="sec"><div className="sec-h"><h3>{t('对比度矩阵（WCAG / APCA）', 'Contrast matrix (WCAG / APCA)')}</h3></div>
            <table className="cmatrix"><tbody>
              {pal.colors.map((a, i) => <tr key={i}>{pal.colors.map((b, j) => { const v = wcag(a, b); return <td key={j} style={{ background: b, color: a }} title={`APCA Lc ${apca(a, b).toFixed(0)}`}>{i === j ? '' : v.toFixed(1)}</td>; })}</tr>)}
            </tbody></table>
            <p className="hint">{t('格子里是“该行文字色放在该列底色上”的对比度。≥4.5 适合正文，≥3 适合大字。', 'Each cell: row colour as text on the column colour. ≥4.5 body text, ≥3 large type.')}</p>
          </div>}
          <div className="sec"><div className="sec-h"><h3>{t('色彩分类', 'Filters')}</h3></div>
            <div className="frow"><label>{t('来源', 'Source')}</label><div className="chips">{chip('src', 'all', t('全部', 'All'))}{chip('src', 'wada', t('和田配色', 'Wada'))}{chip('src', 'nice', 'NICE')}</div></div>
            <div className="frow"><label>{t('明暗', 'Lightness')}</label><div className="chips">{chip('light', 'any', t('全部', 'Any'))}{L(LIGHT).map(([k, v]) => chip('light', k, v))}</div></div>
            <div className="frow"><label>{t('浓淡', 'Chroma')}</label><div className="chips">{chip('chroma', 'any', t('全部', 'Any'))}{L(CHROMA).map(([k, v]) => chip('chroma', k, v))}</div></div>
            <div className="frow"><label>{t('明暗差', 'Contrast')}</label><div className="chips">{chip('contrast', 'any', t('全部', 'Any'))}{L(CONTRAST).map(([k, v]) => chip('contrast', k, v))}</div></div>
            <div className="frow"><label>{t('气质', 'Mood')}</label><div className="chips">{chip('tag', 'any', t('全部', 'Any'))}{L(MOOD).map(([k, v]) => chip('tag', k, v))}</div></div>
          </div>
          <div className="sec"><div className="sec-h"><h3>{t('导出', 'Export')}</h3></div>
            <div className="btn-grid">
              <button className="btn acc press" onClick={() => exportAs('png')}><Icon name="download" size={14} />PNG 2×</button>
              <button className="btn press" onClick={() => exportAs('svg')}>SVG</button>
              <button className="btn press" onClick={() => exportAs('json')}>JSON</button>
              <button className="btn press" onClick={() => exportAs('css')}>CSS</button>
            </div>
          </div>
          <p className="hint panel-foot">{t('配色数据：dictionary-of-colour-combinations（MIT，和田三造原著已进入公有领域）与 nice-color-palettes（MIT）。名称与标签为本应用原创生成。快捷键：空格 抽取 · ←/→ 历史 · 1–4 版式 · C 复制 · F 收藏', 'Data: dictionary-of-colour-combinations (MIT; Wada’s book is public domain) and nice-color-palettes (MIT). Names and tags are generated by this app. Keys: Space draw · ←/→ history · 1–4 layout · C copy · F save')}</p>
        </div>
      </aside>
      {toast && <div className="toasts"><div className="lg toast strong"><Icon name="check" size={15} />{toast}</div></div>}
    </div>
  );
}
