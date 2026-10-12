// Phase 12: typesetting + balance audit on the REAL rendered poster. N draws in the running app (editor path); each
// scene is rendered to SVG in the page and every text line is measured in the DOM (getComputedTextLength, letter-
// spacing included). Reports
//   - width mismatch: engine width (the canvas measurer the generator used) vs rendered width, per line
//   - orphans / widows on the rendered lines: a lone number group on its own line, a final line of < 2 Han characters,
//     or a final single short Latin word (≤ 5 letters, or < 35 % of the block's widest line)
//   - optical balance: centre of visual mass of the rasterised poster (|lum − bg| per pixel) and of the text alone
//     (engine optical-weight model), as the distance from the poster centre in % of the half-diagonal
// usage: node scripts/qa/text-audit.mjs <out.json> [N=200] [seed=TXT] ; env REA_URL (default http://127.0.0.1:5180/)
import { chromium } from 'playwright';
import fs from 'node:fs';
const out = process.argv[2] || '/tmp/txt.json', N = +(process.argv[3] || 200), SEED = process.argv[4] || 'TXT';
const base = process.env.REA_URL || 'http://127.0.0.1:5180/';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(base);
await page.waitForFunction(() => window.__rea?.getState().ready, null, { timeout: 120000 });
const BAL = process.env.BAL_URL || 'http://127.0.0.1:5180/src/engine/aesthetic/balance.ts';
const res = await page.evaluate(async ({ N, SEED, BAL }) => {
  const { renderSVG } = await import('/src/engine/render/svg.ts');
  const { canvasMeasurer } = await import('/src/engine/text/measure.ts');
  // the balance model always comes from the current tree (served by the P12 dev server), so before / after use one ruler
  const { balanceOf } = await import(BAL);
  const M = canvasMeasurer();
  const st0 = window.__rea.getState();
  const styles = st0.styles.filter((s) => s.builtIn && !s.optIn).map((s) => s.id).sort();
  const RATIOS = ['3:4', '3:4', '3:4', '3:4', '3:4', '9:16', '9:16', '9:16', '1:1', '1:1', '4:3', '4:3', '16:9', '16:9', '21:9'];
  let h = 0; for (const c of SEED) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => { h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:800px;opacity:0;pointer-events:none'; document.body.appendChild(host);
  const HAN = /[\u3400-\u9fff\uf900-\ufaff]/g;
  const lum = (hex) => { const v = parseInt(String(hex).slice(1, 7), 16); if (!(v >= 0)) return 0.5; const c = [v >> 16, (v >> 8) & 255, v & 255].map((x) => x / 255); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const rows = [];
  for (let i = 0; i < N; i++) {
    const st = window.__rea.getState();
    const style = styles[Math.floor(rnd() * styles.length)], ratio = RATIOS[Math.floor(rnd() * RATIOS.length)];
    const seed = SEED + i;
    st.pickStyle(style); st.set('ratio', ratio); st.set('customOn', false); st.set('imgPick', []); st.set('edits', {}); st.set('placed', []);
    st.set('seeds', { layout: seed + 'L', text: seed + 'T', color: seed + 'C', image: seed + 'I' });
    await st.regen(true);
    const r = window.__rea.getState().result; const sc = window.__rea.getState().scene;
    host.innerHTML = renderSVG(sc, { interactive: true });
    await document.fonts.ready;
    const byId = new Map(); const walk = (ns) => { for (const n of ns) { if (n.kind === 'text') byId.set(n.id, n); if (n.children) walk(n.children); } }; walk(sc.nodes);
    let lines = 0, mism = 0, maxErr = 0; const orphans = []; const errs = [];
    // text optical mass (engine-independent: rendered line widths × cap height × stroke density × contrast)
    let tm = 0, tx = 0, ty = 0;
    for (const el of host.querySelectorAll('text[data-id]')) {
      const t = byId.get(el.getAttribute('data-id')); if (!t || t.rotate || t.vertical || (t.opacity ?? 1) < 0.45) continue;
      if (!['text', 'sidebar', 'band'].includes(t.layer)) continue;
      const ls = t.tracking * t.size;
      const spans = [...el.children].filter((c) => c.tagName === 'tspan' && c.hasAttribute('y'));
      const lw = [];
      // a CJK line may be several tspans on one baseline: group by y
      const byY = new Map(); for (const sp of spans) { const k = sp.getAttribute('y'); byY.set(k, (byY.get(k) || 0) + 0); }
      for (const l of t.lines) {
        const sps = spans.filter((sp) => Math.abs(+sp.getAttribute('y') - l.y) < 0.01);
        let x0 = Infinity, x1 = -Infinity;
        for (const sp of sps) { const b = sp.getBBox(); if (b.width) { x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x + b.width); } }
        const dom = x1 > x0 ? x1 - x0 - (ls > 0 ? ls : 0) : 0;
        const eng = M.width(l.text, { family: t.family, fallback: t.fallback, weight: t.weight, size: t.size, tracking: t.tracking, italic: t.italic });
        lw.push(dom || eng);
        if (dom && l.text.trim().length > 1) { lines++; const e = (eng - dom) / Math.max(dom, 1); if (Math.abs(e) > Math.abs(maxErr)) maxErr = e; if (Math.abs(e) > 0.03 && Math.abs(eng - dom) > 2) { mism++; if (errs.length < 6) errs.push({ text: l.text.slice(0, 30), family: t.family, eng: +eng.toFixed(1), dom: +dom.toFixed(1) }); } }
      }
      // orphan / widow rules on the rendered lines
      if (t.lines.length >= 2) {
        const wmax = Math.max(...lw);
        t.lines.forEach((l, k) => {
          const s = l.text.trim();
          const numGroup = /^[#№¥$€£]?[\d０-９][\d０-９.,:：/%°]*$/.test(s) && t.lines.length > 1 && !t.raw.includes('\n');
          const last = k === t.lines.length - 1;
          const hanN = (s.match(HAN) || []).length;
          const zhShort = last && t.lang === 'zh' && hanN > 0 && hanN < 2 && [...s.replace(/[\s\u2005]/g, '')].length <= 2;
          const enShort = last && t.lang === 'en' && !/\s/.test(s) && /^[A-Za-z’'\-]+[.,!?]?$/.test(s) && ((!t.lines.every((q) => !/\s/.test(q.text.trim())) && s.length <= 5) || lw[k] < (t.lines.every((q) => !/\s/.test(q.text.trim())) ? 0.35 : 0.4) * wmax) && t.lines.length >= 2 && !t.raw.includes('\n');
          if (numGroup || zhShort || enShort) orphans.push({ id: t.id, role: t.role, kind: numGroup ? 'number' : zhShort ? 'zh-short' : 'en-short', line: s, raw: t.raw.slice(0, 40) });
        });
      }
      const dens = 0.12 + 0.5 * Math.pow(Math.max(100, Math.min(900, t.weight)) / 900, 1.6);
      const con = Math.abs(lum(t.fill) - lum(sc.bg)) + 0.15;
      t.lines.forEach((l, k) => { const w = lw[k] || 0; const hh = 0.72 * t.size; const m = w * hh * dens * con; const cx = t.anchor === 'start' ? l.x + w / 2 : t.anchor === 'end' ? l.x - w / 2 : l.x; tm += m; tx += m * cx; ty += m * (l.y - hh / 2); });
    }
    const half = Math.hypot(sc.w, sc.h) / 2;
    const textCom = tm ? +(100 * Math.hypot(tx / tm - sc.w / 2, ty / tm - sc.h / 2) / half).toFixed(1) : 0;
    rows.push({ i, style, ratio, seed, comp: r.picked.comp, lines, mism, maxErr: +maxErr.toFixed(3), errs, orphans, textCom, balance: balanceOf(sc, M) });
  }
  return rows;
}, { N, SEED, BAL });
fs.writeFileSync(out, JSON.stringify(res));
const orph = res.reduce((s, r) => s + r.orphans.length, 0), posters = res.filter((r) => r.orphans.length).length;
const kinds = {}; for (const r of res) for (const o of r.orphans) kinds[o.kind] = (kinds[o.kind] || 0) + 1;
const L = res.reduce((s, r) => s + r.lines, 0), MM = res.reduce((s, r) => s + r.mism, 0);
const tc = res.map((r) => r.textCom).sort((a, b) => a - b);
const bd = res.map((r) => r.balance.dev).sort((a, b) => a - b);
const bal = { devMedian: bd[bd.length >> 1], devP90: bd[Math.floor(bd.length * 0.9)], devMean: +(bd.reduce((a, b) => a + b, 0) / bd.length).toFixed(3), lopsided: res.filter((r) => r.balance.lopsided).length, unanchored: res.filter((r) => !r.balance.anchored).length, jump500: res.filter((r) => r.balance.jump >= 500).length };
console.log(JSON.stringify({ bal, n: res.length, orphanLines: orph, postersWithOrphans: posters, kinds, lines: L, widthMismatchLines: MM, mismatchRate: +(MM / L).toFixed(4), textComMedian: tc[tc.length >> 1], textComP90: tc[Math.floor(tc.length * 0.9)], textComMean: +(tc.reduce((a, b) => a + b, 0) / tc.length).toFixed(1) }));
await browser.close();
