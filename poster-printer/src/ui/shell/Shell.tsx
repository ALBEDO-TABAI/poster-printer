// The glass shell: ambient stage, top caps, rails, poster canvas, dock, panels, sheets and overlays.
// Layout follows grid.css (12-col grid between two rails); this file owns frame fitting, the ambient
// field under the glass, global shortcuts and URL-driven states.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useStore } from '../../store';
import { exportSVG, rasterizeSVG } from '../../lib/exporter';
import { DeckView } from '../../deck/DeckView';
import { Stage } from '../Stage';
import { TopCaps, Rails, Dock, Caption, Toasts, PinsBar } from './Chrome';
import { Inspector, CtxBar } from './Inspector';
import { Advanced } from './Advanced';
import { Library } from './Library';
import { Film } from './Film';
import { Sheets, exportNow } from './Sheets';
import { useUI } from './ui';
import G from '../glass/glass';
import * as A from './actions';

const px = (n: string) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)) || 0;

/* ---------- frame fitting + dock placement ---------- */
export function fitFrame() {
  const z = document.getElementById('zone-probe')?.getBoundingClientRect(); if (!z) return;
  const s = useStore.getState();
  const [a, b] = s.ratio.split(':').map(Number);
  const W = z.width, H = z.height - 24; // caption line 16 + 8 gap above the poster
  let w = W, h = (W * b) / a; if (h > H) { h = H; w = (H * a) / b; }
  w = Math.round(w); h = Math.round(h);
  const bc = document.body.classList;
  const right = bc.contains('insp-open') || bc.contains('adv-open'), left = bc.contains('lib-open') || bc.contains('view-deck');
  const x = right && !left ? z.right - w : left && !right ? z.left : z.left + (W - w) / 2;
  const y = z.top + 24 + (H - h) / 2;
  const u = useUI.getState();
  if (u.frame.w !== w || u.frame.h !== h) useUI.setState({ frame: { w, h } });
  const pr = u.posterRect;
  if (!pr || Math.abs(pr.left - x) > .5 || Math.abs(pr.top - y) > .5 || pr.width !== w || pr.height !== h) useUI.setState({ posterRect: { left: x, top: y, width: w, height: h, right: x + w, bottom: y + h } });
  placeDock();
}
let adaptT: ReturnType<typeof setTimeout> | undefined;
function placeDock() {
  const pr = useUI.getState().posterRect; if (!pr) return;
  const dock = document.getElementById('dock'); const dw = dock ? dock.offsetWidth : 600;
  const bc = document.body.classList;
  const m = px('--m'), rail = px('--rail'), g = px('--g');
  const fl = m + rail + g, colw = (innerWidth - 2 * fl - 11 * g) / 12, span = (n: number) => n * colw + (n - 1) * g;
  const minX = (bc.contains('lib-open') ? fl + span(4) + g : bc.contains('view-deck') ? fl + span(2) + g : fl - g) + dw / 2;
  const maxX = innerWidth - (bc.contains('adv-open') ? fl + span(6) + g : bc.contains('insp-open') ? fl + span(4) + g : fl - g) - dw / 2;
  const room = (maxX + dw / 2) - (minX - dw / 2);
  const tight = room < 712;
  if (tight !== bc.contains('dock-tight')) { bc.toggle('dock-tight', tight); requestAnimationFrame(placeDock); return; }
  const cx = pr.left + pr.width / 2;
  document.body.style.setProperty('--pcx', Math.round(minX > maxX ? (minX + maxX) / 2 : Math.max(minX, Math.min(maxX, cx))) + 'px');
  clearTimeout(adaptT); adaptT = setTimeout(adaptDock, 560);
  placeRails(pr);
}
/** phase 14: both rails sit on the poster's horizontal centre axis, clamped between the top bar and the dock band
 *  (on short windows they pin under the top bar and never cover the dock); snapped to the 4 px sub-grid */
function placeRails(pr: { top: number; height: number }) {
  const m = px('--m'), bar = px('--bar'), g = px('--g'), dock = px('--dock');
  const cy = pr.top + pr.height / 2;
  const lo = m + bar + g, bottom = innerHeight - m - dock - g;
  document.querySelectorAll<HTMLElement>('.rail').forEach((el) => {
    const h = el.offsetHeight; if (!h) return;
    const hi = bottom - h;
    const top = Math.round(Math.max(lo, Math.min(hi, cy - h / 2)) / 4) * 4;
    const v = top + 'px'; if (el.style.top !== v) el.style.top = v;
  });
  document.body.style.setProperty('--rail-oy', Math.round(cy - lo) + 'px');
  if (!document.body.classList.contains('rails-placed')) requestAnimationFrame(() => document.body.classList.add('rails-placed')); // no glide on first paint
}
function adaptDock() { const pr = useUI.getState().posterRect; if (!pr) return; document.querySelectorAll('.dock .cap.adaptive, .dock .draw').forEach((c) => G.adapt(c, pr)); }

/* ---------- ambient field: the poster, blurred across the stage, so the glass has colour under it ---------- */
let fieldT: ReturnType<typeof setTimeout> | undefined; let flip = 0; let lastUrl = ''; let fieldImg: HTMLImageElement | null = null;
export function rebuildField(now = false) {
  clearTimeout(fieldT);
  fieldT = setTimeout(async () => {
    const s = useStore.getState(); const sc = s.scene; if (!sc) return;
    let img = fieldImg;
    if (!now || !img) {
      try {
        const svg = await exportSVG(sc, false, 1);
        const blob = await rasterizeSVG(svg, sc.w, sc.h, Math.min(1, 360 / sc.w), 'image/png');
        const url = URL.createObjectURL(blob);
        img = new Image(); img.decoding = 'async'; img.src = url;
        await img.decode().catch(() => undefined);
        if (lastUrl) { const old = lastUrl; setTimeout(() => URL.revokeObjectURL(old), 4000); }
        lastUrl = url; fieldImg = img;
      } catch { return; }
    }
    const pr = useUI.getState().posterRect;
    const stage = getComputedStyle(document.documentElement).getPropertyValue('--stage').trim() || '#ebebee';
    const field = G.buildField(img, pr, stage, s.theme === 'dark' ? 0.42 : 0.5);
    const au = document.querySelectorAll<HTMLImageElement>('.aura img'); if (au.length < 2) return;
    flip ^= 1; const nx = au[flip], ox = au[flip ^ 1];
    nx.src = field; nx.classList.add('on'); ox.classList.remove('on');
    const dot = getComputedStyle(document.documentElement).getPropertyValue('--dot').trim();
    G.setScene({ field, poster: lastUrl, posterEl: document.querySelector('.frame .paper'), dots: `radial-gradient(circle at 1px 1px, ${dot} .7px, transparent 1.3px)` });
    G.setAmbient(s.result?.picked.palette.bg ?? '#888888', img);
    setTimeout(adaptDock, 60);
  }, now ? 0 : 120);
}

/* ---------- overlays ---------- */
function PosterGrid() {
  const on = useUI((u) => u.posterGrid);
  const scene = useStore((s) => s.scene);
  const { w, h } = useUI((u) => u.frame);
  const info = scene?.info as { snap?: { xs: number[]; ys: number[] }; grid?: { margin?: number } } | undefined;
  if (!scene || !w) return <div className="grid-ov" id="grid-ov" />;
  const k = w / scene.w;
  const xs = info?.snap?.xs ?? [], ys = info?.snap?.ys ?? [];
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  return (
    <div className={'grid-ov' + (on ? ' on' : '')} id="grid-ov">
      {xs.length > 1 && <svg viewBox={`0 0 ${w} ${h}`}>
        <rect x={minX * k} y={minY * k} width={(maxX - minX) * k} height={(maxY - minY) * k} fill="none" stroke="#ff5a1f" strokeWidth="1" opacity=".9" />
        {xs.map((x, i) => <line key={'x' + i} x1={x * k} x2={x * k} y1={minY * k} y2={maxY * k} stroke="#ff5a1f" strokeOpacity=".45" strokeWidth=".8" />)}
        {ys.map((y, i) => <line key={'y' + i} x1={minX * k} x2={maxX * k} y1={y * k} y2={y * k} stroke="#ff5a1f" strokeOpacity=".3" strokeDasharray="3 3" />)}
        {xs.slice(0, -1).map((x, i) => i % 2 === 0 && <rect key={'c' + i} x={x * k} y={minY * k} width={Math.max(0, (xs[i + 1] - x) * k)} height={(maxY - minY) * k} fill="#ff5a1f" fillOpacity=".06" />)}
      </svg>}
    </div>
  );
}
function UIGrid() {
  const on = useUI((u) => u.uiGrid);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!on || !ref.current) return;
    const draw = () => {
      const el = ref.current; if (!el) return;
      const W = innerWidth, H = innerHeight, m = px('--m'), rail = px('--rail'), g = px('--g'), bar = px('--bar'), dock = px('--dock');
      const fl = m + rail + g, col = (W - 2 * fl - 11 * g) / 12, top = m + bar + g;
      const C = '#e0245e', B = '#0a84ff';
      let o = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="PP Mono, monospace" font-size="9">`;
      for (let y = 8; y < H; y += 8) o += `<line x1="0" x2="${W}" y1="${y + .5}" y2="${y + .5}" stroke="${C}" stroke-opacity="${y % 24 === 0 ? .1 : .045}"/>`;
      for (let i = 0; i < 12; i++) {
        const x = fl + i * (col + g);
        o += `<rect x="${x}" y="0" width="${col}" height="${H}" fill="${C}" fill-opacity=".055"/><line x1="${x + .5}" x2="${x + .5}" y1="0" y2="${H}" stroke="${C}" stroke-opacity=".35"/><line x1="${x + col - .5}" x2="${x + col - .5}" y1="0" y2="${H}" stroke="${C}" stroke-opacity=".35"/>`;
        o += `<text x="${x + 4}" y="${top - 6}" fill="${C}" fill-opacity=".9">${i + 1}</text>`;
      }
      [m, W - m - rail].forEach((x) => { o += `<rect x="${x}" y="0" width="${rail}" height="${H}" fill="${B}" fill-opacity=".06"/><line x1="${x + .5}" x2="${x + .5}" y1="0" y2="${H}" stroke="${B}" stroke-opacity=".45"/><line x1="${x + rail - .5}" x2="${x + rail - .5}" y1="0" y2="${H}" stroke="${B}" stroke-opacity=".45"/>`; });
      ([[m, 'M'], [m + bar, 'BAR'], [top, 'TOP'], [H - m - dock, 'DOCK'], [H - m - dock / 2, '½'], [H - m, 'M']] as [number, string][]).forEach(([y, l]) => { o += `<line x1="0" x2="${W}" y1="${y + .5}" y2="${y + .5}" stroke="${C}" stroke-opacity=".6" stroke-dasharray="4 3"/><text x="${W - m + 3}" y="${y - 3}" fill="${C}">${l}</text>`; });
      o += `<line x1="${W / 2}" x2="${W / 2}" y1="0" y2="${H}" stroke="${C}" stroke-opacity=".5" stroke-dasharray="2 4"/>`;
      o += `</svg><div class="legend">UI GRID · M ${m} · RAIL ${rail} · G ${g} · 12 COL × ${col.toFixed(1)} · BAR ${bar} · DOCK ${dock} · 8PT</div>`;
      el.innerHTML = o;
    };
    draw(); window.addEventListener('resize', draw); return () => window.removeEventListener('resize', draw);
  }, [on]);
  return <div id="ui-grid" aria-hidden="true" ref={ref} />;
}

/* ---------- poster canvas ---------- */
function PosterCanvas() {
  const { w, h } = useUI((u) => u.frame);
  return (
    <main className="canvas-area" id="canvas-area" onClick={(e) => { if ((e.target as HTMLElement).closest('.frame')) return; if (useStore.getState().selected) useStore.setState({ selected: null, editingText: null }); }}>
      <div className="frame-wrap">
        <div className="frame" id="frame" style={{ width: w || undefined, height: h || undefined }}>
          <Stage W={w} H={h} />
          <PosterGrid />
        </div>
        <Caption />
      </div>
    </main>
  );
}

/* ---------- keyboard ---------- */
function onKey(e: KeyboardEvent) {
  const tg = e.target as HTMLElement; const typing = tg?.closest?.('input, textarea, select, [contenteditable]');
  const mod = e.metaKey || e.ctrlKey; const u = useUI.getState(); const s = useStore.getState();
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); if (u.sheet === 'cmdk') A.closeSheets(); else A.openSheet('cmdk'); return; }
  if (e.key === 'Escape') {
    if (u.sheet) return A.closeSheets();
    if (u.imgEdit || s.editingText) return; // Stage handles these
    if (s.selected) { useStore.setState({ selected: null }); return; }
    if (u.adv) return useUI.setState({ adv: false });
    if (u.lib) return useUI.setState({ lib: null });
    if (u.film) return useUI.setState({ film: false });
    if (u.insp) return useUI.setState({ insp: false });
    return;
  }
  if (typing) return;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) A.redo(); else A.undo(); return; }
  if (mod || e.altKey || u.sheet) return;
  const k = e.key, deck = s.view === 'deck';
  if (e.shiftKey && /^Digit[1-4]$/.test(e.code)) { A.toggleLock(A.LOCKS[+e.code.slice(5) - 1][0]); return; }
  if (e.shiftKey && k.toLowerCase() === 'd') return A.toggleTheme();
  if (e.shiftKey && k.toLowerCase() === 'l') return A.toggleLang();
  if (k === 'G') return A.showPosterGrid();
  if (k === 'g') return A.toggleUIGrid();
  if (k === '?') return A.openSheet('keys');
  if (k === 'e') return A.openSheet('export');
  if (deck) return; // the deck view owns space / arrows
  if (e.code === 'Space') { e.preventDefault(); if (e.repeat) return; if (tg?.closest?.('button')) tg.blur(); A.draw(); }
  else if (k === 'ArrowLeft') A.go(-1); else if (k === 'ArrowRight') A.go(1);
  else if (/^[1-6]$/.test(k)) A.setRatio(A.RATIOS[+k - 1]);
  else if (k === 'f' || k === 'F') A.favorite();
  else if (k === 's' || k === 'S') exportNow('png', useUI.getState().exportScale);
  else if (k === 'i') A.togglePanel('insp'); else if (k === 'a') A.togglePanel('adv'); else if (k === 'h') A.togglePanel('film'); else if (k === 'l') A.openLayers();
  else if ((k === 'Delete' || k === 'Backspace') && s.selected) A.hideSelected();
}

/* ---------- the shell ---------- */
export function Shell() {
  const view = useStore((s) => s.view);
  const ratio = useStore((s) => s.ratio);
  const theme = useStore((s) => s.theme);
  const ready = useStore((s) => s.ready);
  const replaying = useStore((s) => s.replaying);
  const insp = useUI((u) => u.insp), adv = useUI((u) => u.adv), lib = useUI((u) => u.lib), film = useUI((u) => u.film), uiGrid = useUI((u) => u.uiGrid);
  const deck = view === 'deck';

  // body classes drive grid.css zones
  useLayoutEffect(() => {
    const bc = document.body.classList;
    bc.toggle('insp-open', (insp || deck) && !(adv && !deck));
    bc.toggle('adv-open', adv && !deck);
    bc.toggle('lib-open', !!lib && !deck);
    bc.toggle('film-open', film && !deck);
    bc.toggle('view-deck', deck);
    bc.toggle('ui-grid', uiGrid);
    bc.toggle('replaying', replaying);
    // phase 14: measure after the frame that applies the new classes has painted (reading the zone synchronously forced
    // a full style + layout inside the click handler: ~100 ms on a panel toggle). The poster follows one frame later.
    let r1 = requestAnimationFrame(() => { r1 = 0; setTimeout(fitFrame, 0); });
    const h = setTimeout(() => { fitFrame(); rebuildField(true); }, 520);
    return () => { clearTimeout(h); if (r1) cancelAnimationFrame(r1); };
  }, [insp, adv, lib, film, deck, uiGrid, ratio, replaying]);
  useLayoutEffect(() => { fitFrame(); }, [ready]);
  // ambient field follows the poster
  // phase 14: subscribed outside React (reading scene in Shell re-rendered the whole shell on every live frame)
  useEffect(() => useStore.subscribe((st, pv) => { if (st.scene && st.scene !== pv.scene) rebuildField(); }), []);
  useEffect(() => { G.refreshAll(); rebuildField(true); }, [theme]);
  // glass bootstrap, resize, dock recede, keyboard
  useEffect(() => {
    G.auto(); G.refract();
    let rz: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => { fitFrame(); clearTimeout(rz); rz = setTimeout(() => rebuildField(true), 200); };
    // phase 14: pointer moves are coalesced to one check per frame, and the dock rect is read before any write
    let mvRaf = 0; let last: PointerEvent | null = null;
    const onMove = (ev: PointerEvent) => { last = ev; if (!mvRaf) mvRaf = requestAnimationFrame(() => { mvRaf = 0; if (last) recede(last); }); };
    const recede = (e: PointerEvent) => {
      if (e.buttons) return; // never while dragging a slider / the poster
      const dock = document.getElementById('dock'), pr = useUI.getState().posterRect; if (!dock || !pr) return;
      const d = dock.getBoundingClientRect();
      const near = e.clientX > d.left - 16 && e.clientX < d.right + 16 && e.clientY > d.top - 16;
      const onLower = e.clientX > pr.left && e.clientX < pr.right && e.clientY > d.top - 120 && e.clientY < pr.bottom && !near;
      dock.classList.toggle('recede', onLower || (useUI.getState().selBottom > d.top - 8 && !near));
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('keydown', onKey);
    // phase 14: a click on bare stage (not glass, not the poster) closes the light panels
    const onBare = (e: MouseEvent) => { const t = e.target as HTMLElement; if (!t?.closest || t.closest('.lg, .frame, .panel, .sheet, .scrim, .ctxbar, .pins-bar, .toast, button, input, a')) return; A.dismissLight(); };
    window.addEventListener('click', onBare);
    document.fonts?.ready.then(() => fitFrame());
    return () => { cancelAnimationFrame(mvRaf); window.removeEventListener('resize', onResize); window.removeEventListener('pointermove', onMove); window.removeEventListener('keydown', onKey); window.removeEventListener('click', onBare); };
  }, []);
  // URL-driven states (QA + screenshots): ?open=adv,insp,lib:styles,film,cmdk,export,keys,sel,grid &intent= &focus= &q= &rt=1 &rm=1 &grid=1 &locks=
  useEffect(() => {
    if (!ready) return;
    const Q = new URLSearchParams(location.search);
    if (Q.get('rt') === '1') A.setReduceT(true);
    if (Q.get('rm') === '1') document.documentElement.classList.add('reduce-motion');
    if (Q.get('grid') === '1') useUI.setState({ uiGrid: true });
    const locks = Q.get('locks'); if (locks) locks.split(',').forEach((k) => { const s = useStore.getState(); if (k in s.locks && !s.locks[k as keyof typeof s.locks]) s.toggleLock(k as keyof typeof s.locks); });
    const open = Q.get('open'); if (!open) return;
    const h = setTimeout(() => {
      for (const o of open.split(',')) {
        if (o === 'adv') useUI.setState({ adv: true, ...(Q.get('intent') ? { advIntent: Q.get('intent')! } : {}), ...(Q.get('focus') ? { focus: Q.get('focus')! } : {}), ...(Q.get('aq') ? { advQuery: Q.get('aq')! } : {}) });
        else if (o === 'insp') useUI.setState({ insp: true });
        else if (o.startsWith('lib:')) useUI.setState({ lib: o.slice(4) });
        else if (o === 'film') useUI.setState({ film: true });
        else if (o === 'cmdk') { useUI.setState({ cmdQ: Q.get('q') || '' }); A.openSheet('cmdk'); }
        else if (o === 'export') A.openSheet('export');
        else if (o === 'keys') A.openSheet('keys');
        else if (o === 'grid') A.showPosterGrid(true);
        else if (o === 'sel') {
          const sc = useStore.getState().scene; const want = Q.get('sel');
          const n = sc?.nodes.find((x) => (want ? x.id === want : x.kind === 'text' && /head|title|main/i.test(x.id))) || sc?.nodes.find((x) => x.kind === 'text');
          if (n) { useStore.setState({ selected: n.id }); useUI.setState({ insp: true, adv: false }); }
        }
      }
    }, 120);
    return () => clearTimeout(h);
  }, [ready]);

  return (
    <>
      <div className="stage"><div className="aura"><img alt="" /><img alt="" /></div><div className="dots" /><div className="vignette" /></div>
      <TopCaps />
      <Rails />
      {deck ? <DeckView /> : <PosterCanvas />}
      {!deck && <CtxBar />}
      {!deck && <Film />}
      {!deck && <Dock />}
      {!deck && <PinsBar />}
      {!deck && <Inspector />}
      {!deck && <Advanced />}
      {!deck && <Library />}
      <Sheets />
      <Toasts />
      <div id="zone-probe" aria-hidden="true" style={{ position: 'fixed', visibility: 'hidden', pointerEvents: 'none', left: 'var(--cl)', right: 'var(--cr)', top: 'var(--top)', bottom: 'var(--cb)' }} />
      <UIGrid />

    </>
  );
}
