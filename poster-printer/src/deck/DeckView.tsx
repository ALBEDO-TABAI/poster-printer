import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { useDeck, renderDeck } from './deck';
import { renderSVG } from '../engine/render/svg';
import { PARAMS } from '../engine/params';
import { exportSVG, rasterizeSVG, download } from '../lib/exporter';
import { makePdf, jpegSize } from '../lib/pdf';
import { makeZip } from '../lib/zip';
import { Toggle } from '../ui/controls';
import { useUI } from '../ui/shell/ui';
import { Dock, compLabel } from '../ui/shell/Chrome';
import { Icon } from '../ui/Icon';
import { useT } from '../ui/i18n';
import type { Scene } from '../engine/types';

const compDef = PARAMS.find((p) => p.key === 'composition')!;
const fit = (svg: string) => svg.replace(/^<svg([^>]*?) width="[\d.]+" height="[\d.]+"/, '<svg$1 width="100%" height="100%"');

export function DeckView() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const ready = useStore((s) => s.ready);
  // re-render when the shared style changes
  const params = useStore((s) => s.params);
  const fonts = useStore((s) => s.fonts);
  const ratio = useStore((s) => s.ratio);
  const modules = useStore((s) => s.modules);
  const modes = useStore((s) => s.modes);
  const styleId = useStore((s) => s.styleId);
  const styles = useStore((s) => s.styles);
  const scene0 = useStore((s) => s.scene);
  const d = useDeck();
  const [busy, setBusy] = useState<string | null>(null);
  const frame = useUI((u) => u.frame);

  useEffect(() => { if (ready && !d.pages.length) d.start(6); }, [ready, d]);

  const results = useMemo(() => (ready && d.pages.length && scene0 ? renderDeck(useStore.getState(), d) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, d.pages, d.palette, d.grid, d.textSet, d.folio, d.noRepeat, params, fonts, ratio, modules, modes, styleId, !!scene0]);
  const svgs = useMemo(() => results.map((r) => fit(renderSVG(r.scene))), [results]);
  const cur = Math.min(d.cur, Math.max(0, results.length - 1));
  const sc = results[cur]?.scene;

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement;
      if (tg?.closest?.('input, textarea, select, [contenteditable]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const D = useDeck.getState();
      if (e.code === 'Space') { e.preventDefault(); if (tg?.closest?.('button')) tg.blur(); D.drawPage(D.cur); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); D.set('cur', Math.max(0, D.cur - 1)); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); D.set('cur', Math.min(D.pages.length - 1, D.cur + 1)); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const rasterPages = async (scale: number, type: string, q = 0.92) => {
    const out: { blob: Blob; scene: Scene }[] = [];
    for (let i = 0; i < results.length; i++) {
      setBusy(t(`渲染第 ${i + 1}/${results.length} 页…`, `Rendering page ${i + 1}/${results.length}…`));
      const svg = await exportSVG(results[i].scene, true, 1);
      out.push({ blob: await rasterizeSVG(svg, results[i].scene.w, results[i].scene.h, scale, type, q), scene: results[i].scene });
    }
    return out;
  };
  const stamp = () => { const d = new Date(); const z = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`; };
  const exportPdf = async () => {
    try {
      const pages = await rasterPages(1.5, 'image/jpeg', 0.9);
      setBusy(t('写入 PDF…', 'Writing PDF…'));
      const pdfPages = await Promise.all(pages.map(async ({ blob, scene }) => {
        const jpeg = new Uint8Array(await blob.arrayBuffer());
        const sz = jpegSize(jpeg) ?? { w: Math.round(scene.w * 1.5), h: Math.round(scene.h * 1.5) };
        const ptW = 595.28, ptH = (ptW * scene.h) / scene.w; // A4-wide pages at the deck's ratio
        return { jpeg, pxW: sz.w, pxH: sz.h, ptW, ptH };
      }));
      download(new Blob([makePdf(pdfPages, { title: 'Poster Printer deck' }) as BlobPart], { type: 'application/pdf' }), `poster-printer-deck-${stamp()}.pdf`);
      useStore.getState().toast(t(`已导出 ${pages.length} 页 PDF`, `Exported a ${pages.length}-page PDF`));
    } finally { setBusy(null); }
  };
  const exportZip = async () => {
    try {
      const pages = await rasterPages(1.5, 'image/png');
      setBusy(t('打包 ZIP…', 'Packing ZIP…'));
      const files = await Promise.all(pages.map(async ({ blob }, i) => ({ name: `page-${String(i + 1).padStart(2, '0')}.png`, data: new Uint8Array(await blob.arrayBuffer()) })));
      download(new Blob([makeZip(files) as BlobPart], { type: 'application/zip' }), `poster-printer-deck-${stamp()}.zip`);
      useStore.getState().toast(t(`已导出 ${pages.length} 张 PNG`, `Exported ${pages.length} PNGs`));
    } finally { setBusy(null); }
  };

  const style = styles.find((x) => x.id === styleId);
  const page = d.pages[cur];
  const r = results[cur];
  const panelProps = { 'data-refract': '64', 'data-bevel': '28', 'data-blur': '10', 'data-ca': '.05' };
  const D = useDeck.getState();
  return (
    <>
      <aside className="lg deck-pages" data-refract="36" aria-label={t('页面', 'Pages')}>
        <div className="dp-h">{t('多页', 'Deck')} · {svgs.length}</div>
        {svgs.map((svg, i) => (
          <div key={d.pages[i]?.id ?? i} className={'deck-thumb pg' + (i === cur ? ' on' : '')} onClick={() => d.set('cur', i)}>
            <div className="deck-mini" style={{ aspectRatio: `${results[i].scene.w} / ${results[i].scene.h}` }} dangerouslySetInnerHTML={{ __html: svg }} />
            <span className="deck-no">{String(i + 1).padStart(2, '0')}{i === 0 ? ' · ' + t('封面', 'cover') : ''}</span>
            <span className="deck-tools" onClick={(e) => e.stopPropagation()}>
              <button className="icon-btn" title={t('上移', 'Move up')} disabled={i === 0} onClick={() => d.move(i, -1)}><Icon name="chevron-up" size={12} /></button>
              <button className="icon-btn" title={t('下移', 'Move down')} disabled={i === svgs.length - 1} onClick={() => d.move(i, 1)}><Icon name="chevron-down" size={12} /></button>
              <button className="icon-btn" title={t('复制', 'Duplicate')} onClick={() => d.duplicate(i)}><Icon name="copy" size={12} /></button>
              <button className="icon-btn" title={t('删除', 'Delete')} disabled={svgs.length <= 1} onClick={() => d.remove(i)}><Icon name="trash-2" size={12} /></button>
            </span>
          </div>
        ))}
        <button className="deck-add btn press" title={t('添加页面', 'Add page')} onClick={() => d.addPage(cur)}><Icon name="plus" size={14} /></button>
      </aside>
      <main className="canvas-area" id="canvas-area">
        <div className="frame-wrap">
          <div className="frame" id="frame" style={{ width: frame.w || undefined, height: frame.h || undefined }}>
            {sc && <div className="paper poster layer-in" key={(d.pages[cur]?.id ?? '') + JSON.stringify(d.pages[cur]?.seeds ?? {})} dangerouslySetInnerHTML={{ __html: svgs[cur] }} />}
          </div>
          <div className="caption mono" id="caption"><span>{t('第', 'Page ')} {String(cur + 1).padStart(2, '0')}{t(' 页', '')} / {svgs.length}</span><span className="sep">·</span><span>{r ? compLabel(r.picked.comp, lang) : ''}</span><span className="sep">·</span><span className="muted">{t('空格 重抽本页 · ← → 翻页', 'Space redraws · ← → pages')}</span>{busy && <><span className="sep">·</span><span style={{ color: 'var(--accent)' }}>{busy}</span></>}</div>
        </div>
      </main>
      <Dock deck={{ cur, n: svgs.length, prev: () => d.set('cur', Math.max(0, cur - 1)), next: () => d.set('cur', Math.min(svgs.length - 1, cur + 1)), redraw: () => D.drawPage(cur) }} />
      <aside {...panelProps} className="lg strong panel inspector open deck-panel" id="inspector">
        <div className="p-head"><div><div className="eyebrow">{t('多页文档', 'Deck')}</div><h2>{t(`${d.pages.length} 页 · 共享风格`, `${d.pages.length} pages · shared style`)}</h2></div></div>
        <div className="p-body">
          <div className="sec" style={{ paddingTop: 4 }}><div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn solid press" onClick={() => d.drawPage(cur)}><Icon name="shuffle" size={14} />{t('重抽本页', 'Redraw page')}</button>
            <button className="btn press" onClick={() => d.drawAll()}><Icon name="refresh-cw" size={14} />{t('重抽内页', 'Redraw inner')}</button>
            <button className="btn press" onClick={() => d.recolor()}><Icon name="palette" size={14} />{t('换一套配色', 'New palette')}</button>
            <button className="btn press" onClick={() => { if (confirm(t('用当前单页海报重新开始多页文档？', 'Restart the deck from the current poster?'))) d.start(d.pages.length || 6); }}><Icon name="rotate-ccw" size={14} />{t('从当前海报重新开始', 'Restart from poster')}</button>
          </div></div>
          <div className="sec"><div className="sec-h"><h3>{t('共享', 'Shared')}</h3></div>
            <dl className="kv">
              <dt>{t('风格', 'Style')}</dt><dd>{style ? (lang === 'zh' ? style.name.zh : style.name.en) : '—'}</dd>
              <dt>{t('网格', 'Grid')}</dt><dd>{d.grid ? `${d.grid.type} / ${d.grid.density}` : t('自动', 'auto')}</dd>
              <dt>{t('文案集', 'Copy set')}</dt><dd>{d.textSet ?? t('自动', 'auto')}</dd>
              <dt>{t('配色', 'Palette')}</dt><dd className="sw-row">{d.palette ? [d.palette.bg, d.palette.ink, d.palette.accent, d.palette.alt, ...d.palette.fills.slice(0, 2)].map((c, i) => <i key={i} style={{ background: c }} title={c} />) : '—'}</dd>
            </dl>
            <Toggle label={t('统一网格（类型+密度）', 'Consistent grid (type + density)')} value={!!d.grid} onChange={(v) => { const r0 = results[0]; d.set('grid', v && r0 ? { type: r0.picked.grid.type, density: r0.picked.grid.density } : null); }} />
            <Toggle label={t('页码', 'Folios')} value={d.folio} onChange={(v) => d.set('folio', v)} />
            <Toggle label={t('各页不重复图片', 'No repeated images')} value={d.noRepeat} onChange={(v) => d.set('noRepeat', v)} />
            <p className="hint">{t('风格、字体与参数沿用单页编辑器，在「海报」页修改后这里同步更新。', 'Style, fonts and parameters come from the poster editor; change them there and the deck follows.')}</p>
          </div>
          {page && (
            <div className="sec"><div className="sec-h"><h3>{t(`第 ${cur + 1} 页构图`, `Page ${cur + 1} composition`)}</h3><div className="act"><span className="tag">{r ? `q ${String(r.scene.info.score ?? '–')}` : ''}</span></div></div>
              <div className="chips">
                {compDef.type === 'seg' && compDef.options.map((o) => <button key={o.v} className={'chipt press' + (page.comp === o.v ? ' on' : '')} onClick={() => d.setComp(cur, o.v)}>{lang === 'zh' ? o.zh : o.en}</button>)}
              </div>
            </div>
          )}
          <div className="sec"><div className="sec-h"><h3>{t('导出', 'Export')}</h3></div>
            <div className="row">
              <button className="btn acc press" data-qa="deck-pdf" disabled={!!busy || !results.length} onClick={exportPdf}><Icon name="download" size={14} />{t('多页 PDF', 'Multi-page PDF')}</button>
              <button className="btn press" data-qa="deck-zip" disabled={!!busy || !results.length} onClick={exportZip}>PNG ZIP</button>
            </div>
            <p className="hint">{t('PDF：每页一张 1.5× JPEG，页宽 A4（595pt），比例与文档一致。ZIP：每页 1.5× PNG。', 'PDF: one 1.5× JPEG per page, A4 width (595 pt) at the deck ratio. ZIP: 1.5× PNG per page.')}</p>
          </div>
        </div>
      </aside>
    </>
  );
}
