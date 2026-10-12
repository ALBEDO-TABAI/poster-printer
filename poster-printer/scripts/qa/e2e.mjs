// End-to-end QA for the glass UI: drives the real app in Chromium through the
// chrome (dock, top caps, rails, inspector, advanced, ⌘K, export sheet, deck,
// palette page, rating page) across every ratio and mode, and fails on any
// console error / page error.
// usage: node scripts/qa/e2e.mjs [outDir]
import { chromium } from 'playwright';
import fs from 'node:fs';
const out = process.argv[2] || 'test-results/e2e';
fs.mkdirSync(out, { recursive: true });
const base = (process.env.REA_URL || 'http://127.0.0.1:5180/').replace(/\/?$/, '/');
const RATIOS = ['3:4', '9:16', '1:1', '4:3', '16:9', '21:9'];
const MODES = ['experimental', 'card', 'clash', 'random', 'layered', 'nice', 'wada', 'brushImage', 'brushMask', 'bandMask'];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errs = [];
const watch = (p, tag) => { p.on('console', (m) => { if (m.type() === 'error') errs.push(tag + m.text()); }); p.on('pageerror', (e) => errs.push(tag + 'pageerror: ' + e.message)); };
watch(page, '');
const fails = []; let passes = 0;
const check = (cond, msg) => { if (!cond) { fails.push(msg); console.log('  ✗ ' + msg); } else passes++; };
const S = (fn, arg) => page.evaluate(fn, arg);
const st = (fn) => page.evaluate(`(() => { const s = window.__rea.getState(); return (${fn})(s); })()`);
const wait = (ms) => page.waitForTimeout(ms);
const POSTER = '.frame .paper svg';

await page.goto(base);
await page.waitForFunction(() => window.__rea?.getState().ready && window.__rea.getState().scene, null, { timeout: 90000 });
await page.waitForSelector(POSTER);
console.log('app ready');

// 1. every ratio (segmented control in the top cap) × draws via the dock button and Space
let n = 0; const times = [];
for (const r of RATIOS) {
  await page.click(`#seg-ratio button[data-v="${r}"]`); await wait(120);
  check((await st((s) => s.ratio)) === r, `ratio control sets ${r}`);
  for (let i = 0; i < 4; i++) {
    const h0 = await st((s) => s.history.length);
    if (i % 2) await page.keyboard.press('Space'); else await page.click('[data-qa=draw]');
    await wait(140);
    const info = await st((s) => ({ w: s.scene?.w, h: s.scene?.h, ms: s.result?.ms, n: s.history.length, svg: document.querySelectorAll('.frame .paper svg').length }));
    check(info.w > 0 && info.h > 0 && info.svg === 1, `scene rendered (${r} #${i})`);
    check(info.n === h0 + 1, `one draw per press (${r} #${i}: ${h0}→${info.n})`);
    if (info.ms != null) times.push(info.ms);
    n++;
  }
  await page.screenshot({ path: `${out}/ratio-${r.replace(':', 'x')}.png` });
}
// keyboard ratio shortcuts 1–6
await page.keyboard.press('5'); await wait(120); check((await st((s) => s.ratio)) === '16:9', 'key 5 → 16:9');
await page.keyboard.press('1'); await wait(120); check((await st((s) => s.ratio)) === '3:4', 'key 1 → 3:4');
console.log(`ratios: ${n} draws, gen avg ${(times.reduce((a, b) => a + b, 0) / Math.max(1, times.length)).toFixed(1)} ms, max ${Math.max(...times).toFixed(1)} ms`);
check(Math.max(...times) < 250, 'generation < 250ms');

// 2. every mode alone, plus all together (engine coverage)
for (const m of [...MODES.map((m) => [m]), MODES]) {
  await S((ms) => window.__rea.getState().set('modes', ms), m);
  for (const r of ['3:4', '16:9']) {
    await S((r) => window.__rea.getState().setRatio(r), r);
    for (let i = 0; i < 3; i++) await S(() => window.__rea.getState().draw());
    await wait(60);
    check(await S(() => !!window.__rea.getState().scene), `mode ${m.join('+')} @ ${r}`);
  }
  if (m.length === 1) await page.screenshot({ path: `${out}/mode-${m[0]}.png` });
}
await S(() => { const s = window.__rea.getState(); s.set('modes', []); s.setRatio('3:4'); });
await wait(200);
console.log('modes ok');

// 3. history via dock arrows + keyboard, film strip
await page.click('[data-qa=draw]'); await wait(150);
const h0 = await st((s) => s.hIndex);
await page.click('#btn-prev'); await wait(150);
check((await st((s) => s.hIndex)) === h0 - 1, 'dock ← goes back');
await page.click('#btn-next'); await wait(150);
check((await st((s) => s.hIndex)) === h0, 'dock → goes forward');
await page.keyboard.press('ArrowLeft'); await wait(150);
check((await st((s) => s.hIndex)) === h0 - 1, 'key ← goes back');
await page.keyboard.press('ArrowRight'); await wait(150);
await page.click('#btn-film'); await wait(500);
check(await S(() => document.querySelector('#film')?.classList.contains('open')), 'film strip opens');
const fth = await page.$$('#film-strip .fthumb');
check(fth.length >= 3, `film thumbs (${fth.length})`);
if (fth.length >= 3) { await fth[1].click(); await wait(250); check((await st((s) => s.hIndex)) !== h0, 'clicking a film thumb restores it'); }
await page.screenshot({ path: `${out}/film.png` });
await page.keyboard.press('Escape'); await wait(200);
check(!(await S(() => document.querySelector('#film')?.classList.contains('open'))), 'Esc closes film');

// 4. variants + locks (lock buttons in the top cap and Shift+digit)
for (const v of ['text', 'decor', 'color', 'image', 'tendency', 'structure']) { await S((v) => window.__rea.getState().variant(v), v); await wait(50); }
const txt = () => st((s) => JSON.stringify(s.result.picked.texts ?? s.result.picked.text));
const pal = () => st((s) => JSON.stringify(s.result.palette?.roles ?? s.result.picked.palette));
await page.click('[data-lock=text]'); await wait(100);
check(await st((s) => !!s.locks.text), 'text lock button toggles');
const t1 = await txt(); await page.click('[data-qa=draw]'); await wait(150); const t2 = await txt();
check(t1 && t1.length > 10 && t1 === t2, 'text lock keeps copy');
await page.click('[data-lock=text]'); await wait(80);
const colorIdx = await S(() => [...document.querySelectorAll('[data-lock]')].findIndex((b) => b.dataset.lock === 'color') + 1);
await page.keyboard.press(`Shift+Digit${colorIdx}`); await wait(100);
check(await st((s) => !!s.locks.color), 'Shift+digit toggles colour lock');
const c1 = await pal(); await page.keyboard.press('Space'); await wait(150); const c2 = await pal();
check(c1 && c1.length > 10 && c1 === c2, 'colour lock keeps palette');
await page.keyboard.press(`Shift+Digit${colorIdx}`); await wait(80);
console.log('history/variants/locks ok');

// 5. determinism: restoring an entry reproduces the same SVG
const same = await S(async () => {
  const st = window.__rea.getState(); const e = st.history[st.hIndex]; const a = document.querySelector('.frame .paper svg')?.outerHTML.length;
  await st.draw(); await st.restore(e, false); await new Promise((r) => setTimeout(r, 250));
  return a === document.querySelector('.frame .paper svg')?.outerHTML.length;
});
check(same, 'restore reproduces poster');

// 6. selection: click a text node → inspector + floating toolbar, edit text, size scrub, undo
await page.click('[data-qa=draw]'); await wait(200);
// wait for the print-in animation and the frame re-fit to settle, then find a text node whose centre really hits that text
const settle = () => page.waitForFunction(() => { const p = document.querySelector('.frame .paper'); return p && !p.getAnimations({ subtree: true }).some((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity); }, null, { timeout: 5000 }).catch(() => {});
const findText = () => page.evaluate(() => {
  const els = [...document.querySelectorAll('.frame .paper svg text')];
  const dk = document.querySelector('.dock')?.getBoundingClientRect();
  const area = (e) => { const r = e.getBoundingClientRect(); return r.width * r.height; };
  for (const el of els.sort((a, b) => area(b) - area(a))) {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 6) continue;
    for (const [fx, fy] of [[0.5, 0.5], [0.3, 0.5], [0.7, 0.5], [0.5, 0.35], [0.5, 0.65]]) {
      const x = r.x + r.width * fx, y = r.y + r.height * fy;
      if (dk && y > dk.top - 10) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && (hit === el || el.contains(hit) || hit.closest('text') === el)) return { x, y };
    }
  }
  return null;
});
await settle(); await wait(300);
let tbox = await findText();
check(!!tbox, 'found a clickable text node');
if (tbox) {
  for (let tries = 0; tries < 3; tries++) {
    await page.mouse.click(tbox.x, tbox.y); await wait(350);
    if (await st((s) => !!s.selected)) break;
    await page.keyboard.press('Escape'); await settle(); await wait(300); tbox = (await findText()) ?? tbox;
  }
  const sel = await st((s) => s.selected);
  check(!!sel, 'clicking poster text selects it');
  check(await S(() => document.querySelector('#ctxbar')?.classList.contains('show')), 'floating element toolbar shows');
  await page.screenshot({ path: `${out}/selection.png` });
  await page.click('#ctxbar [data-cx=edit]'); await wait(250);
  check(await st((s) => !!s.editingText) && await S(() => !!document.querySelector('.text-editor, .frame textarea')), 'toolbar “edit” starts in-place text editing');
  await page.keyboard.type('就地'); await page.keyboard.press('Meta+Enter'); await wait(250);
  check(!(await st((s) => s.editingText)) && await S(() => document.querySelector('.frame .paper svg')?.textContent.includes('就地')), '⌘↵ commits the in-place edit');
  await page.keyboard.press('Meta+z'); await wait(250);
  check(!(await S(() => document.querySelector('.frame .paper svg')?.textContent.includes('就地'))), '⌘Z undoes the in-place edit');
  if (!(await st((s) => s.selected))) { await page.mouse.click(tbox.x, tbox.y); await wait(300); }
  await page.click('#ctxbar [data-cx=edit]'); await wait(250); await page.keyboard.type('取消');
  await page.keyboard.press('Escape'); await wait(200);
  check(!(await st((s) => s.editingText)) && !(await S(() => document.querySelector('.frame .paper svg')?.textContent.includes('取消'))), 'Esc cancels in-place editing');
  if (!(await st((s) => s.selected))) { await page.mouse.click(tbox.x, tbox.y); await wait(300); }
  await page.click('#ctxbar button[title="颜色与大小"]'); await wait(350);
  check(await S(() => document.querySelector('#inspector')?.classList.contains('open')), 'toolbar opens the selection inspector');
  const ta = await page.$('#inspector textarea');
  check(!!ta, 'inspector shows a text field');
  if (ta) {
    await ta.fill('端到端测试'); await wait(150); await page.click('#inspector .p-head h2'); await wait(250);
    check(await S(() => document.querySelector('.frame .paper svg')?.textContent.includes('端到端测试')), 'inspector text edit updates the poster');
    const sc = await page.$('#inspector .scrub');
    if (sc) {
      await sc.focus(); await page.keyboard.press('Shift+ArrowRight'); await wait(200);
      check(await st((s) => Object.values(s.edits).some((e) => e.scale && e.scale !== 1)), 'inspector size scrub edits scale');
    }
    await page.click('#btn-undo'); await wait(250);
    await page.keyboard.press('Meta+z'); await wait(250);
    check(!(await S(() => document.querySelector('.frame .paper svg')?.textContent.includes('端到端测试'))), 'undo reverts the text edit');
  }
  // drag the selection = free placement edit (the frame re-fits when the inspector opens, so re-measure)
  const sid = await st((s) => s.selected);
  const nb = await page.evaluate((id) => {
    // a point on the selected node that is not covered by glass (inspector, toolbar, dock)
    const el = document.querySelector(`.frame .paper svg [data-id="${id}"]`); if (!el) return null; const r = el.getBoundingClientRect();
    for (const fy of [0.5, 0.3, 0.7, 0.2, 0.8]) for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85]) {
      const x = r.x + r.width * fx, y = r.y + r.height * fy; const hit = document.elementFromPoint(x, y);
      if (hit && hit.closest('.frame .paper') && (hit === el || el.contains(hit) || hit.closest(`[data-id="${id}"]`))) return { x, y };
    }
    return null;
  }, sid);
  if (nb) Object.assign(tbox, nb);
  else { await settle(); await wait(200); const fresh = await findText(); if (fresh) Object.assign(tbox, fresh); } // undo can clear the selection; drag any text (pointer-down selects)
  await page.mouse.move(tbox.x, tbox.y); await page.mouse.down(); await page.mouse.move(tbox.x + 40, tbox.y + 30, { steps: 6 }); await page.mouse.up();
  await wait(150);
  const dragOk = await st((s) => Object.keys(s.edits).length > 0);
  if (!dragOk) console.log('drag debug:', JSON.stringify({ sid, nb, tbox, sel: await st((s) => s.selected), hit: await page.evaluate(([x, y]) => { const h = document.elementFromPoint(x, y); return h ? h.tagName + '.' + (h.getAttribute('class') || '') + ' ' + (h.closest('[data-id]')?.getAttribute('data-id') || '') : null; }, [tbox.x, tbox.y]) }));
  check(dragOk, 'drag creates an edit');
  await page.keyboard.press('Escape'); await wait(150);
  check(!(await st((s) => s.selected)), 'Esc deselects');
  await S(() => window.__rea.getState().resetEdits());
}

// 7. advanced layer: every numeric param + a real scrub regenerates
const pcount = await S(async () => {
  const st = window.__rea.getState(); let c = 0;
  for (const [k, v] of Object.entries(st.params)) if (typeof v === 'number') { st.setParam(k, v); c++; }
  return c;
});
await page.click('#r-adv'); await wait(400);
check(await S(() => document.querySelector('#advanced')?.classList.contains('open')), 'advanced opens');
const intents = await page.$$eval('#adv-nav [data-intent], #adv-nav button', (els) => els.length);
let scrubs = 0; const seen = new Set();
for (const b of await page.$$('#adv-nav button')) {
  await b.click(); await wait(120);
  for (const m of await page.$$('#adv-main .more')) { if (!/收起|Less/.test(await m.textContent())) { await m.click(); await wait(60); } }
  scrubs += await page.$$eval('#adv-main .scrub', (e) => e.length);
  for (const k of await page.$$eval('#adv-main [data-k]', (e) => e.map((x) => x.dataset.k))) seen.add(k);
}
// every parameter the old sliders panel exposed must still be reachable (UI-only keys excluded)
const allKeys = await st((s) => Object.keys(s.params));
const missing = allKeys.filter((k) => !seen.has(k));
console.log(`advanced: ${seen.size} params reachable, not in advanced: ${missing.join(', ') || '—'}`);
check(seen.size >= 60, `advanced exposes the parameter set (${seen.size} params, ${scrubs} scrubs, ${intents} intents)`);
await page.fill('#adv-q', '标题整体大小'); await wait(250);
const scrub = await page.$('#adv-main .scrub[data-k="titleScale"]') ?? await page.$('#adv-main .scrub[data-k]');
if (scrub) {
  const k = await scrub.getAttribute('data-k');
  const before = await S(() => document.querySelector('.frame .paper svg')?.outerHTML);
  const v0 = await st((s) => s.params);
  await scrub.focus(); await page.keyboard.press('Shift+ArrowRight'); await wait(400);
  const v1 = await st((s) => s.params);
  const after = await S(() => document.querySelector('.frame .paper svg')?.outerHTML);
  check(v0[k] !== v1[k], `advanced scrub changes param ${k} (${v0[k]}→${v1[k]})`);
  check(before !== after, `advanced scrub regenerates the poster (${k})`);
  await page.keyboard.press('Shift+ArrowLeft'); await wait(200);
}
await page.fill('#adv-q', 'margin'); await wait(250);
check((await page.$$eval('#adv-main .scrub, #adv-main .ctl-row', (e) => e.length)) > 0, 'advanced search finds params');
await page.screenshot({ path: `${out}/advanced.png` });
await page.fill('#adv-q', '');
await page.click('#adv-nav [data-intent="color"]'); await wait(120); // phase 14: the layers rail button toggles like the other rail buttons
await page.click('#r-layers'); await wait(300);
check((await page.$$eval('#adv-main .sw, #adv-main [role=switch], #adv-main .layer', (e) => e.length)) > 0, 'layers & modes pane');
await page.keyboard.press('Escape'); await wait(200);
console.log(`numeric params: ${pcount}, advanced scrubs: ${scrubs}`);

// 8. ⌘K: search a parameter and run it; search a ratio command
await page.keyboard.press('Meta+k'); await wait(300);
check(await S(() => document.querySelector('#cmdk')?.classList.contains('open')), '⌘K opens the palette');
await page.keyboard.type('16:9'); await wait(200);
await page.keyboard.press('Enter'); await wait(300);
check((await st((s) => s.ratio)) === '16:9', '⌘K runs a ratio command');
await page.keyboard.press('Control+k'); await wait(300);
await page.keyboard.type('margin'); await wait(200);
await page.screenshot({ path: `${out}/cmdk.png` });
await page.keyboard.press('Enter'); await wait(400);
check(await S(() => document.querySelector('#advanced')?.classList.contains('open')), '⌘K param result opens advanced');
await page.keyboard.press('Escape'); await wait(150);
await S(() => window.__rea.getState().setRatio('3:4')); await wait(200);

// 9. exports: raw hooks + the export sheet downloads
for (const sc of [1, 2, 4]) {
  const url = await S((sc) => window.__reaRaster(sc), sc);
  check(url && url.startsWith('data:image/png') && url.length > 20000, `PNG export @${sc}x`);
  if (sc === 2) fs.writeFileSync(`${out}/export-2x.png`, Buffer.from(url.split(',')[1], 'base64'));
}
const svg = await S(() => window.__reaSVG());
check(svg && svg.includes('<text'), 'SVG export keeps editable text');
for (const [fmt, scale] of [['png', '2'], ['svg', null]]) {
  await page.click('#btn-export'); await wait(300);
  await page.click(`[data-fmt=${fmt}]`); if (scale) await page.click(`#seg-scale button[data-v="${scale}"]`);
  if (fmt === 'png') await page.screenshot({ path: `${out}/export-sheet.png` });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[data-qa=do-export]')]);
  const p = `${out}/dl-${dl.suggestedFilename()}`; await dl.saveAs(p);
  const buf = fs.readFileSync(p);
  if (fmt === 'png') check(buf.length > 20000 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(16) > 1000, `export sheet PNG @2x (${dl.suggestedFilename()}, ${buf.readUInt32BE(16)}px)`);
  else check(buf.toString('utf8').includes('<svg') && buf.toString('utf8').includes('<text'), `export sheet SVG (${dl.suggestedFilename()})`);
  await page.keyboard.press('Escape'); await wait(200);
}

// 10. libraries: every rail tab renders content; components; image usage badges
for (const k of await page.$$eval('.rail-l [data-lib]', (b) => b.map((x) => x.dataset.lib))) {
  await page.click(`.rail-l [data-lib="${k}"]`); await wait(350);
  check(await S(() => document.querySelector('#library.open .p-body')?.children.length > 0), `library tab ${k} renders`);
  if (k === 'images') check(await S(() => document.querySelectorAll('.img-item .uses').length) > 0, 'usage-count badges on library images');
  if (k === 'styles') await page.screenshot({ path: `${out}/lib-styles.png` });
}
await page.keyboard.press('Escape'); await wait(150);
await S(() => { const s = window.__rea.getState(); s.clearPlaced(); s.addComponent({ type: 'stamp' }); }); await wait(300);
await S(() => window.__rea.getState().addComponent({ type: 'ticket' })); await wait(300);
check(await S(() => document.querySelectorAll('.frame .paper svg [data-id^="pc-"]').length) >= 2, 'components render on the stage');
await page.click('[data-qa=draw]'); await wait(400);
check(await S(() => document.querySelectorAll('.frame .paper svg [data-id^="pc-"]').length) >= 2, 'components persist across draws');
await S(() => window.__rea.getState().set('showSlots', true)); await wait(200);
check(await S(() => document.querySelectorAll('.slot-box').length) > 0, 'free slots overlay');
await S(() => { const s = window.__rea.getState(); s.set('showSlots', false); s.clearPlaced(); });
await S(() => { const s = window.__rea.getState(); s.setParam('composition', 'swiss'); s.setParam('sidebarTpl', 'colophon'); }); await wait(300);
await S(() => window.__rea.getState().saveSidebarSize('colophon', 140)); await wait(200);
check(await S(() => JSON.parse(localStorage.getItem('rea.sbsizes.v1') || '{}').colophon === 140), 'sidebar size saved per template');
await S(() => { const s = window.__rea.getState(); s.saveSidebarSize('colophon', null); s.setParam('sidebarTpl', 'auto'); s.setParam('composition', 'auto'); });

// 11. grid overlay (G / g), theme + language toggles
await page.keyboard.press('g'); await wait(150);
check(await S(() => document.body.classList.contains('ui-grid')), 'g toggles the UI grid overlay');
await page.keyboard.press('g'); await wait(100);
await page.click('#btn-theme'); await wait(300);
const th = await S(() => document.documentElement.dataset.theme);
await page.screenshot({ path: `${out}/theme-${th}.png` });
await page.click('#btn-theme'); await wait(300);
check(th && th !== (await S(() => document.documentElement.dataset.theme)), `theme toggle (${th})`);
await page.click('#btn-lang'); await wait(300);
check((await st((s) => s.lang)) === 'en' && (await S(() => document.querySelector('#btn-export')?.textContent.includes('Export'))), 'language toggle → English chrome');
await page.screenshot({ path: `${out}/en.png` });
await page.click('#btn-lang'); await wait(200);
check((await st((s) => s.lang)) === 'zh', 'language back to 中文');

// 12. deck view via the view switch
await page.click('#seg-view button[data-v=deck]');
await page.waitForSelector('.deck-thumb', { timeout: 20000 }); await wait(700);
check(await S(() => document.querySelectorAll('.deck-thumb').length) >= 2, 'deck renders pages');
const dk0 = await S(() => document.querySelector('.frame svg')?.outerHTML.length);
await page.click('[data-qa=draw]'); await wait(600);
check(dk0 !== (await S(() => document.querySelector('.frame svg')?.outerHTML.length)), 'deck redraws the current page');
await page.screenshot({ path: `${out}/deck.png` });
await page.click('#seg-view button[data-v=poster]'); await wait(500);
check(await S(() => document.querySelectorAll('.frame .paper svg').length) === 1, 'back to poster view');

// 13. palette page
const cp = await ctx.newPage(); watch(cp, 'color: ');
await cp.goto(base + 'color.html');
await cp.waitForSelector('.card-svg svg', { timeout: 30000 }); await cp.waitForTimeout(800);
check(await cp.evaluate(() => document.querySelectorAll('.cswatches .swr').length) >= 3, 'palette page lists swatches');
const palId = () => cp.evaluate(() => document.querySelector('.cpanel .eyebrow')?.textContent + '|' + document.querySelector('.card-svg')?.innerHTML);
const ch0 = await palId(); let changed = false;
for (let i = 0; i < 3 && !changed; i++) { await cp.mouse.click(5, 450); await cp.keyboard.press('Space'); await cp.waitForTimeout(500); changed = ch0 !== (await palId()); }
check(changed, 'palette page draws a new card on Space');
await cp.screenshot({ path: `${out}/color.png` });
await cp.close();

// 14. rating page: rate by key and click, skip, undo, export reproduces scenes
const rp = await ctx.newPage(); watch(rp, 'rate: ');
await rp.goto(base + 'rate.html');
await rp.evaluate(() => localStorage.removeItem('pp.ratings.v1'));
await rp.reload();
await rp.waitForSelector('.rate-frame svg', { timeout: 60000 }); await rp.waitForTimeout(500);
await rp.keyboard.press('7'); await rp.waitForTimeout(500);
await rp.click('[data-rate="3"]'); await rp.waitForTimeout(500);
await rp.keyboard.press('s'); await rp.waitForTimeout(500);
await rp.keyboard.press('9'); await rp.waitForTimeout(500);
await rp.keyboard.press('z'); await rp.waitForTimeout(300);
const rc = await rp.evaluate(() => JSON.parse(localStorage.getItem('pp.ratings.v1') || '[]'));
check(rc.length === 2 && rc[0].rating === 7 && rc[1].rating === 3, `rating page records key + click ratings, undo works (${rc.map((r) => r.rating)})`);
check((await rp.textContent('[data-qa=rate-count]'))?.includes('2'), 'rating progress counter');
const [rdl] = await Promise.all([rp.waitForEvent('download', { timeout: 20000 }), rp.click('[data-qa=rate-export]')]);
await rdl.saveAs(`${out}/ratings.json`);
const rj = JSON.parse(fs.readFileSync(`${out}/ratings.json`, 'utf8'));
const r0 = rj.ratings?.[0] ?? {};
if (!(r0.seed && r0.ratio && r0.composition && r0.entry && r0.scene && typeof r0.taste === 'number' && Object.keys(r0.features ?? {}).length === rj.featureNames?.length)) console.log('rating export sample:', typeof r0.features, r0.features?.length, JSON.stringify(Object.fromEntries(Object.entries(r0).map(([k, v]) => [k, typeof v === 'object' ? typeof v : v]))), rj.featureNames?.length);
check(r0.seed && r0.ratio && r0.composition && r0.entry && r0.scene && typeof r0.taste === 'number' && Object.keys(r0.features ?? {}).length === rj.featureNames?.length, 'rating export carries seed/ratio/composition/entry/scene/selector score/features');
check(rj.ratings.every((r) => r.reproduced === true), `rated posters reproduce exactly from the exported entry (${rj.ratings.map((r) => r.reproduced)})`);
await rp.screenshot({ path: `${out}/rate.png` });
await rp.close();

// 14b. phase 13: two scopes — pin from a control, chip under 抽一张, draw keeps it, ✕ unpin, ⌘Z restores pins, tweak stays on its poster
await page.goto(base + '?fresh');
await page.waitForFunction(() => window.__rea?.getState().ready && window.__rea.getState().scene, null, { timeout: 90000 }); await wait(400);
await page.keyboard.press('a'); await wait(400);
await page.click('#adv-nav [data-intent="color"]'); await wait(250);
await S(() => window.__rea.getState().setParam('bgPref', 'dark'));
await wait(300);
const comp0 = await st('(s) => s.result.picked.comp');
await S(() => window.__rea.getState().setParam('saturation', 120)); await wait(300);
check(await st('(s) => s.result.picked.comp') === comp0, 'adjusting this poster keeps its composition');
check(await page.locator('#adv-main .ptag.palette').count() > 0, 'scope tags rendered (只换配色)');
await page.hover('#adv-main [data-pk="bgPref"]'); await page.click('#adv-main [data-pk="bgPref"] [data-act="pin"]'); await wait(200);
check(await page.isVisible('#pins-bar [data-pin="bgPref"]'), 'pinned control shows a chip under 抽一张');
await page.keyboard.press('Escape'); await page.mouse.click(5, 450); await page.keyboard.press('Space'); await wait(900);
check(await st('(s) => s.params.bgPref === "dark" && s.params.saturation === 100'), 'a draw keeps the pin and drops unpinned tweaks');
await page.click('#btn-unpin-all'); await wait(200);
check(await st('(s) => Object.keys(s.pins).length === 0') && !(await page.isVisible('#pins-bar')), '全部解除 clears all pins');
await page.keyboard.press('Meta+z').catch(() => {}); await wait(300);
if (await st('(s) => !s.pins.bgPref')) { await page.keyboard.press('Control+z'); await wait(300); }
check(await st('(s) => s.pins.bgPref === "dark"'), 'undo restores pins');
await page.screenshot({ path: `${out}/pins.png` });
await S(() => { window.__rea.getState().clearPins(); localStorage.removeItem('rea.session.v1'); });

// 15. fallbacks: reduced transparency / motion via URL
await page.goto(base + '?rt=1&rm=1');
await page.waitForFunction(() => window.__rea?.getState().scene, null, { timeout: 60000 }); await wait(400);
check(await S(() => document.documentElement.dataset.glass === 'none' || document.documentElement.classList.contains('reduce-transparency')), 'reduced-transparency fallback');
check(await S(() => document.documentElement.classList.contains('reduce-motion')), 'reduced-motion fallback');
await page.screenshot({ path: `${out}/reduced.png` });

const realErrs = errs.filter((e) => !/favicon/.test(e));
check(realErrs.length === 0, `console errors: ${realErrs.length}`);
if (realErrs.length) console.log(realErrs.slice(0, 20).join('\n'));
console.log(`\n${fails.length ? 'FAILED' : 'PASSED'} — ${passes} checks passed, ${fails.length} failures, ${n} ratio draws, ${MODES.length + 1} mode sets`);
await browser.close();
process.exit(fails.length ? 1 : 0);
