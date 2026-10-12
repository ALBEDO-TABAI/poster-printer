// Modal glass sheets: export (wired to the real exporter), command palette (⌘K) and keyboard shortcuts.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore, type Locks } from '../../store';
import { exportSVG, rasterize, download } from '../../lib/exporter';
import { sessionJson, parseSession, recordWebM } from '../../lib/session';
import { APP_SLUG } from '../../config';
import { useT } from '../i18n';
import { Icon } from '../Icon';
import { LSeg, Switch, Scrub } from '../controls';
import { useUI, useLinger } from './ui';
import { INTENTS, UIPARAMS } from './ia';
import { LIBS } from './Chrome';
import { SceneThumb, replay, toggleRecording } from './thumbs';
import * as A from './actions';

const sheetProps = { 'data-refract': '60', 'data-bevel': '30', 'data-blur': '10', 'data-ca': '.08', role: 'dialog', 'aria-modal': true } as const;
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

export function Sheets() {
  const sheet = useUI((u) => u.sheet);
  const shown = useLinger(sheet, 260);
  useLayoutEffect(() => {
    if (!sheet) return; const el = document.getElementById(sheet); const o = A.sheetOrigin(); if (!el || !o) return;
    const w = el.offsetWidth, h = el.offsetHeight; const l = (innerWidth - w) / 2, tp = (innerHeight - h) / 2;
    el.style.setProperty('--sx', Math.round(o.x - l) + 'px'); el.style.setProperty('--sy', Math.round(o.y - tp) + 'px');
  }, [sheet]);
  return (<>
    <div className={'scrim' + (sheet ? ' on' : '')} id="scrim" onClick={A.closeSheets} />
    <div {...sheetProps} className={'lg strong sheet export' + (sheet === 'export' ? ' open' : '')} id="export" role="dialog" aria-modal={sheet === 'export'}>{shown === 'export' && <ExportSheet />}</div>
    <div {...sheetProps} className={'lg strong sheet cmdk' + (sheet === 'cmdk' ? ' open' : '')} id="cmdk" role="dialog" aria-modal={sheet === 'cmdk'}>{shown === 'cmdk' && <Cmdk />}</div>
    <div {...sheetProps} className={'lg strong sheet shortcuts' + (sheet === 'keys' ? ' open' : '')} id="keys" role="dialog" aria-modal={sheet === 'keys'}>{shown === 'keys' && <KeysSheet />}</div>
  </>);
}

/* ---------- export ---------- */
export async function exportNow(fmt: 'png' | 'jpg' | 'svg', scale: number, name?: string) {
  const s = useStore.getState(); if (!s.scene) return;
  const base = name || defaultName(fmt, scale);
  if (fmt === 'svg') download(await exportSVG(s.scene, Boolean(s.params.embedFonts)), base.endsWith('.svg') ? base : base + '.svg');
  else download(await rasterize(s.scene, scale, fmt === 'png' ? 'image/png' : 'image/jpeg'), base.endsWith('.' + fmt) ? base : `${base}.${fmt}`);
  s.toast((s.lang === 'zh' ? '已导出 ' : 'Exported ') + fmt.toUpperCase() + (fmt === 'svg' ? '' : ` @${scale}×`));
}
function defaultName(fmt: string, scale: number) {
  const s = useStore.getState();
  return `poster-printer-${s.seeds.layout.slice(0, 6)}-${s.ratio.replace(':', 'x')}${fmt === 'svg' ? '' : '@' + scale + 'x'}.${fmt}`;
}
/** phase 13: app preferences moved out of 高级调校 (they never change a poster) */
function Prefs() {
  const t = useT();
  const p = useStore((s) => s.params);
  const fc = useStore((s) => s.fontCount);
  const set = (k: string, v: number | boolean) => useStore.getState().setParam(k, v);
  return (<div id="prefs"><span className="lbl">{t('偏好（不影响海报）', 'Preferences (never change the poster)')}</span>
    <div className="prefs-grid">
      <Scrub dataK="replaySpeed" label={t('回放间隔', 'Replay interval')} value={Number(p.replaySpeed)} min={200} max={3000} step={50} unit="ms" def={900} onChange={(v) => set('replaySpeed', v)} />
      <Scrub dataK="fontCount" label={t('摇字体时用几款', 'Fonts per shake')} value={fc} min={1} max={3} step={1} def={2} onChange={(v) => useStore.getState().set('fontCount', v)} />
      <div className="ctl-row" data-k="snapGrid"><span className="lab">{t('拖动吸附网格', 'Snap drags to grid')}</span><Switch on={!!p.snapGrid} label="snap" onChange={(v) => set('snapGrid', v)} /></div>
      <div className="ctl-row" data-k="shakeOnDraw"><span className="lab">{t('抽卡时换字体', 'New fonts each draw')}</span><Switch on={!!p.shakeOnDraw} label="shake" onChange={(v) => set('shakeOnDraw', v)} /></div>
    </div></div>);
}
function ExportSheet() {
  const t = useT();
  const scene = useStore((s) => s.scene);
  const embed = useStore((s) => Boolean(s.params.embedFonts));
  const recorded = useStore((s) => s.recorded);
  const history = useStore((s) => s.history);
  const fmt = useUI((u) => u.exportFmt);
  const sc = useUI((u) => u.exportScale);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const s = useStore.getState();
  const auto = defaultName(fmt, sc);
  useEffect(() => setName(''), [fmt, sc]);
  const fmts: [typeof fmt, string, string, string, string][] = [['png', 'file-image', 'PNG', '无损位图，适合社交媒体', 'Lossless bitmap'], ['jpg', 'image', 'JPG', '体积小，适合预览分享', 'Small, for sharing'], ['svg', 'file-code', 'SVG', '矢量，文字不转曲', 'Vector, live text']];
  const list = recorded.length ? recorded : history;
  const cur = history[s.hIndex];
  const doIt = async () => { setBusy('…'); try { await exportNow(fmt, sc, name || auto); } finally { setBusy(''); } A.closeSheets(); };
  return (<>
    <div className="pv"><SceneThumb scene={scene} className="svgth pvposter" /><span className="dim mono">{fmt === 'svg' ? t('矢量 · 无限缩放', 'vector · scalable') : scene ? `${Math.round(scene.w * sc)} × ${Math.round(scene.h * sc)} px` : ''}</span></div>
    <div className="opts">
      <div className="row"><h2>{t('导出', 'Export')}</h2><span className="grow" /><button className="icon-btn press" title={t('关闭', 'Close')} onClick={A.closeSheets}><Icon name="x" size={18} /></button></div>
      <div><span className="lbl">{t('格式', 'Format')}</span><div className="fmt-grid">{fmts.map(([k, i, n, z, e]) => <button key={k} className={'fmt press' + (fmt === k ? ' on' : '')} data-fmt={k} onClick={() => useUI.setState({ exportFmt: k })}><b><Icon name={i} size={15} />{n}</b><span>{t(z, e)}</span></button>)}</div></div>
      <div className="row" style={{ alignItems: 'flex-end', gap: 14 }}>
        <div style={{ flex: 1, opacity: fmt === 'svg' ? .45 : 1, pointerEvents: fmt === 'svg' ? 'none' : undefined }}><span className="lbl">{t('倍率', 'Scale')}</span><LSeg id="seg-scale" className="boxed fill" value={String(sc)} options={[1, 2, 3, 4].map((x) => ({ v: String(x), l: x + '×' }))} onChange={(v) => useUI.setState({ exportScale: Number(v) })} /></div>
        <div className="ctl-row" style={{ margin: 0, minWidth: 168 }}><span className="lab">{t('SVG 内嵌字体', 'Embed fonts')}</span><Switch on={embed} label="embed" onChange={(v) => s.setParam('embedFonts', v)} /></div>
      </div>
      <label className="field" style={{ margin: 0 }}><span className="lbl" style={{ margin: 0 }}>{t('文件名', 'File name')}</span><input className="inp mono" style={{ fontSize: 12 }} value={name || auto} onChange={(e) => setName(e.target.value)} spellCheck={false} /></label>
      <div><span className="lbl">{t('更多输出', 'More outputs')}</span><div className="mini-list">
        <button className="chipt press" disabled={!cur} onClick={() => cur && download(JSON.stringify({ app: APP_SLUG, kind: 'poster', version: 1, entry: { ...cur, edits: s.edits } }, null, 1), `${APP_SLUG}-${stamp()}.json`)}><Icon name="file-json" size={13} />{t('海报 JSON', 'Poster JSON')}</button>
        <button className="chipt press" disabled={!list.length} onClick={() => download(sessionJson(list), `${APP_SLUG}-session-${stamp()}.json`)}><Icon name="files" size={13} />{t('会话 JSON', 'Session JSON')}</button>
        <button className="chipt press" disabled={!!busy || !list.length} onClick={async () => { const l = list.slice(-40); setBusy('0/' + l.length); const b = await recordWebM(l, Number(s.params.replaySpeed), (i) => setBusy(`${i}/${l.length}`)); setBusy(''); if (b) download(b, `${APP_SLUG}-replay-${stamp()}.webm`); else s.toast(t('浏览器不支持录屏', 'Video capture unsupported'), 'warn'); }}><Icon name="video" size={13} />{busy && busy !== '…' ? t('渲染 ', 'Rendering ') + busy : t('WebM 回放视频', 'WebM replay')}</button>
        <button className="chipt press" onClick={() => { A.closeSheets(); A.setView('deck'); }}><Icon name="square-stack" size={13} />{t('多页 PDF / ZIP', 'Deck PDF / ZIP')}</button>
        <button className="chipt press" onClick={() => fileRef.current?.click()}><Icon name="upload" size={13} />{t('导入 JSON', 'Import JSON')}</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const l = parseSession(await f.text()); useStore.setState({ recorded: l }); s.toast(t(`载入 ${l.length} 条记录`, `Loaded ${l.length} entries`)); if (l.length === 1) s.restore(l[0], true); A.closeSheets(); } catch (er) { s.toast(String(er), 'warn'); } }} />
      </div></div>
      <Prefs />
      <div className="row" style={{ marginTop: 'auto', paddingTop: 4 }}><span className="muted" style={{ fontSize: 11 }}>{t('快速导出 PNG：按 S', 'Quick PNG: press S')}</span><span className="grow" /><button className="btn press" onClick={A.closeSheets}>{t('取消', 'Cancel')}</button><button className="btn acc press" data-qa="do-export" disabled={!!busy} style={{ padding: '0 20px' }} onClick={doIt}><Icon name="download" size={15} />{t('导出', 'Export')} {fmt.toUpperCase()}</button></div>
    </div>
  </>);
}

/* ---------- command palette ---------- */
interface Cmd { g: string; icn: string; label: string; alt: string; sub?: string; key?: string; key0?: string; run: () => void }
const GNAMES: Record<string, [string, string]> = { act: ['操作', 'Actions'], view: ['面板与视图', 'Panels & views'], pref: ['偏好', 'Preferences'], ratio: ['画幅', 'Ratio'], lock: ['锁定', 'Locks'], param: ['参数', 'Parameters'], style: ['风格', 'Styles'] };
function useCommands(): Cmd[] {
  const lang = useStore((s) => s.lang);
  const locks = useStore((s) => s.locks);
  const theme = useStore((s) => s.theme);
  const styles = useStore((s) => s.styles);
  const recording = useStore((s) => s.recording);
  const reduceT = useUI((u) => u.reduceT);
  return useMemo(() => {
    const t = (z: string, e: string) => (lang === 'zh' ? z : e);
    const C: Cmd[] = [];
    const add = (g: string, icn: string, zh: string, en: string, run: () => void, key?: string, sub?: string) => C.push({ g, icn, label: t(zh, en), alt: zh + ' ' + en, run, key, sub });
    add('act', 'shuffle', '抽一张', 'Draw a poster', () => A.draw(), t('空格', 'Space'));
    A.REMIX.forEach(([k, i, z, e]) => add('act', i, '换' + z, 'New ' + e.toLowerCase(), () => A.remix(k)));
    add('act', 'heart', '收藏当前', 'Favourite current', A.favorite, 'F');
    add('act', 'download', '导出…', 'Export…', () => A.openSheet('export'), 'E');
    add('act', 'file-image', '快速导出 PNG', 'Quick export PNG', () => exportNow('png', useUI.getState().exportScale), 'S');
    add('act', 'file-code', '导出 SVG', 'Export SVG', () => exportNow('svg', 1));
    add('act', 'undo-2', '撤销', 'Undo', A.undo, '⌘Z');
    add('act', 'redo-2', '重做', 'Redo', A.redo, '⇧⌘Z');
    add('act', 'circle-dot', recording ? '停止录制' : '开始录制', recording ? 'Stop recording' : 'Start recording', toggleRecording);
    add('act', 'play', '回放本次历史', 'Replay this session', () => replay());
    add('act', 'rotate-ccw', '还原手动修改', 'Reset manual edits', () => useStore.getState().resetEdits());
    add('view', 'panel-right', '检查器', 'Inspector', () => A.togglePanel('insp'), 'I');
    add('view', 'sliders-horizontal', '高级调校', 'Advanced', () => A.togglePanel('adv'), 'A');
    add('view', 'layers', '图层与模式', 'Layers & modes', A.openLayers, 'L');
    add('view', 'film', '历史胶片', 'History filmstrip', () => A.togglePanel('film'), 'H');
    LIBS.forEach(([k, i, z, e]) => add('view', i, z + '库', e + ' library', () => A.openLib(k)));
    add('view', 'heart', '收藏与历史', 'Favourites & history', () => A.openLib('saved'));
    add('view', 'settings-2', '会话、录制与设置', 'Session, recording & settings', () => A.openLib('more'));
    add('view', 'square-stack', '多页文档', 'Deck view', () => A.setView('deck'));
    add('view', 'image', '单页海报', 'Poster view', () => A.setView('poster'));
    add('view', 'grid-3x3', 'UI 布局网格', 'UI layout grid', () => A.toggleUIGrid(), 'G');
    add('view', 'layout-grid', '海报网格', 'Poster grid', () => A.showPosterGrid(), '⇧G');
    add('view', 'swatch-book', '配色抽卡页', 'Palette page', () => A.setView('palette'));
    add('pref', theme === 'dark' ? 'sun' : 'moon', '切换明暗', 'Toggle appearance', A.toggleTheme, '⇧D');
    add('pref', 'languages', '切换语言 English', 'Switch language 中文', A.toggleLang, '⇧L');
    add('pref', 'droplet', reduceT ? '恢复玻璃透明' : '减少透明度', reduceT ? 'Restore transparency' : 'Reduce transparency', () => A.setReduceT(!reduceT));
    add('pref', 'settings-2', 'AI 设置', 'AI settings', () => A.openLib('more'));
    add('pref', 'keyboard', '键盘快捷键', 'Keyboard shortcuts', () => A.openSheet('keys'), '?');
    A.RATIOS.forEach((r, i) => add('ratio', 'frame', '画幅 ' + r, 'Ratio ' + r, () => A.setRatio(r), String(i + 1)));
    A.LOCKS.forEach(([k, , z, e, kb]) => add('lock', locks[k as keyof Locks] ? 'lock' : 'lock-open', (locks[k] ? '解锁' : '锁定') + z, (locks[k] ? 'Unlock ' : 'Lock ') + e.toLowerCase(), () => A.toggleLock(k), kb));
    const itOf = (id: string) => INTENTS.find((x) => x.id === id) || { zh: '导出', en: 'Output', icon: 'download' };
    UIPARAMS.filter((p) => p.tier > 0).forEach((p) => { const it = itOf(p.intent); C.push({ g: 'param', key0: p.key, icn: it.icon, label: lang === 'zh' ? p.pzh : p.pen, alt: [p.pzh, p.pen, p.zh, p.en, p.key].join(' '), sub: t(it.zh, it.en) + ' · ' + ((lang === 'zh' ? p.hzh : p.hen) || (lang === 'zh' ? p.zh : p.en)), run: () => A.openParam(p.key) }); });
    styles.forEach((x) => C.push({ g: 'style', icn: 'swatch-book', label: x.name[lang], alt: x.name.zh + ' ' + x.name.en + ' ' + x.fonts[x.lib]['big.main'].family, sub: x.fonts[x.lib]['big.main'].family, run: () => A.pickStyle(x.id) }));
    return C;
  }, [lang, locks, theme, styles, recording, reduceT]);
}
function Cmdk() {
  const t = useT();
  const all = useCommands();
  const q0 = useUI((u) => u.cmdQ);
  const [i, setI] = useState(0);
  const inp = useRef<HTMLInputElement>(null);
  const resRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = setTimeout(() => inp.current?.focus(), 60); return () => clearTimeout(h); }, []);
  const q = q0.trim().toLowerCase();
  const order = ['act', 'view', 'param', 'style', 'pref', 'ratio', 'lock'];
  const res = useMemo(() => {
    const r = q ? all.filter((c) => (c.label + ' ' + c.alt + ' ' + (c.sub || '')).toLowerCase().includes(q)).sort((a, b) => (b.label.toLowerCase().includes(q) ? 1 : 0) - (a.label.toLowerCase().includes(q) ? 1 : 0))
      : all.filter((c) => c.g === 'act').slice(0, 6).concat(all.filter((c) => c.g === 'view').slice(0, 3), all.filter((c) => c.g === 'param' && ['margin', 'titleScale', 'texture'].includes(c.key0!)));
    return r.slice(0, 40).sort((a, b) => order.indexOf(a.g) - order.indexOf(b.g));
  }, [q, all]);
  useEffect(() => setI(0), [q]);
  useEffect(() => { resRef.current?.querySelector('.it.on')?.scrollIntoView({ block: 'nearest' }); }, [i]);
  const run = (c: Cmd) => { A.closeSheets(); setTimeout(() => c.run(), 60); };
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hi = (s: string) => { if (!q) return s; const parts = s.split(new RegExp('(' + esc + ')', 'ig')); return parts.map((p, k) => (p.toLowerCase() === q ? <mark key={k}>{p}</mark> : p)); };
  let lastG = '';
  return (<>
    <div className="q"><Icon name="command" size={20} /><input ref={inp} id="cmdq" placeholder={t('输入命令、参数或风格…  如「留白」「宋」「导出」', 'Type a command, parameter or style…')} value={q0} autoComplete="off" spellCheck={false}
      onChange={(e) => useUI.setState({ cmdQ: e.target.value })}
      onKeyDown={(e) => { const n = res.length; if (!n) return; if (e.key === 'ArrowDown') { e.preventDefault(); setI((i + 1) % n); } if (e.key === 'ArrowUp') { e.preventDefault(); setI((i - 1 + n) % n); } if (e.key === 'Enter') { e.preventDefault(); run(res[i]); } }} /><kbd>esc</kbd></div>
    <div className="res" id="cmdres" ref={resRef}>
      {res.length === 0 && <div style={{ padding: 30, textAlign: 'center' }} className="muted">{t('没有匹配项', 'No matches')}</div>}
      {res.map((c, k) => { const head = c.g !== lastG ? <div className="gl" key={'g' + k}>{t(...GNAMES[c.g])}</div> : null; lastG = c.g; return [head,
        <div key={k} className={'it' + (k === i ? ' on' : '')} data-i={k} onClick={() => run(c)} onMouseMove={() => k !== i && setI(k)}><Icon name={c.icn} size={17} /><b>{hi(c.label)}</b>{c.sub && <small>{hi(c.sub)}</small>}<span className="r">{c.key && <kbd>{c.key}</kbd>}</span></div>]; })}
    </div>
    <div className="foot"><span><kbd>↑</kbd><kbd>↓</kbd>{t('选择', 'navigate')}</span><span><kbd>↵</kbd>{t('执行', 'run')}</span><span><kbd>⌘K</kbd>{t('开关', 'toggle')}</span><span className="grow" /><span>{UIPARAMS.filter((p) => p.tier > 0).length} {t('参数', 'params')} · {all.filter((c) => c.g === 'style').length} {t('风格', 'styles')} · {all.filter((c) => !['param', 'style'].includes(c.g)).length} {t('命令', 'commands')}</span></div>
  </>);
}

/* ---------- shortcuts ---------- */
const K: [string, string, string, string][] = [['空格', 'Space', '抽一张', 'Draw'], ['← →', '← →', '历史前后', 'History'], ['⌘K', '⌘K', '命令面板', 'Command palette'], ['⌘Z / ⇧⌘Z', '⌘Z / ⇧⌘Z', '撤销 / 重做', 'Undo / redo'], ['F', 'F', '收藏', 'Favourite'], ['E', 'E', '导出面板', 'Export sheet'], ['S', 'S', '快速导出 PNG', 'Quick PNG'], ['1 – 6', '1 – 6', '切换画幅', 'Ratio'], ['⇧1 – ⇧4', '⇧1 – ⇧4', '锁定 文字/配色/主图/全部', 'Lock text/colour/image/all'], ['I', 'I', '检查器', 'Inspector'], ['A', 'A', '高级调校', 'Advanced'], ['L', 'L', '图层与模式', 'Layers & modes'], ['H', 'H', '历史胶片', 'Filmstrip'], ['G', 'G', 'UI 布局网格', 'UI layout grid'], ['⇧G', '⇧G', '海报网格', 'Poster grid'], ['⇧D / ⇧L', '⇧D / ⇧L', '明暗 / 语言', 'Theme / language'], ['Esc', 'Esc', '取消选择 / 关闭', 'Deselect / close'], ['Delete', 'Delete', '隐藏所选元素', 'Hide selection'], ['双击文字', 'Dbl-click text', '直接改字', 'Edit text in place'], ['双击数值条', 'Dbl-click value', '复位', 'Reset a value'], ['⇧ / ⌥ 拖动', '⇧ / ⌥ drag', '相对 / 精细调整', 'Relative / fine'], ['方向键', 'Arrows', '聚焦数值条时步进', 'Step a focused value']];
function KeysSheet() {
  const t = useT();
  return (<>
    <div className="row"><h2>{t('键盘快捷键', 'Keyboard shortcuts')}</h2><span className="grow" /><button className="icon-btn press" title={t('关闭', 'Close')} onClick={A.closeSheets}><Icon name="x" size={18} /></button></div>
    <div className="sc-grid">{K.map(([kz, ke, z, e]) => <div key={ke}><span>{t(z, e)}</span><kbd>{t(kz, ke)}</kbd></div>)}</div>
  </>);
}
