// Phase 14 interaction audit: for every chrome control, measure click → next paint (Event Timing API), handler time and
// long tasks; check open/close symmetry, Esc / outside-click dismissal, focus return, single-panel rules, stuck hover,
// rapid double-click safety, toast dedupe and slider-drag smoothness. Writes test-results/interaction.json.
// usage: node scripts/qa/interaction.mjs [label]   (APP_URL defaults to the dev server)
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const URL = process.env.APP_URL || 'http://127.0.0.1:5180/';
const label = process.argv[2] || 'run';
const VIDEO = process.env.VIDEO_DIR;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-blink-features=EventTiming'] });
const ctx = await browser.newContext({ viewport: { width: 1512, height: 945 }, ...(VIDEO ? { recordVideo: { dir: VIDEO, size: { width: 1512, height: 945 } } } : {}) });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.addInitScript(() => {
  window.__ev = []; window.__lt = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ev.push({ name: e.name, start: e.startTime, dur: e.duration, proc: e.processingEnd - e.processingStart, delay: e.processingStart - e.startTime }); }).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch { /* */ }
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push({ start: e.startTime, dur: e.duration }); }).observe({ type: 'longtask', buffered: true }); } catch { /* */ }
});
await page.goto(URL + '?fresh');
await page.waitForFunction(() => { const s = window.__rea?.getState(); return s?.ready && s.scene && s.presetImages.length > 0; }, null, { timeout: 90000 });
await page.waitForTimeout(1200);
const U = () => page.evaluate(() => { const u = window.__ui.getState(); return { insp: u.insp, adv: u.adv, lib: u.lib, film: u.film, sheet: u.sheet }; });
const now = () => page.evaluate(() => performance.now());
const settle = (ms = 450) => page.waitForTimeout(ms);
const clearAll = async () => { await page.evaluate(() => { window.__ui.setState({ insp: false, adv: false, lib: null, film: false, sheet: null }); }); await settle(500); };
const rows = [];
/** click a control with real input; report the slowest event (input → next paint) and long tasks in the window */
async function measure(name, sel, opts = {}) {
  const el = page.locator(sel).first();
  if (!(await el.count()) || !(await el.isVisible())) { rows.push({ name, sel, skipped: true }); return null; }
  const t0 = await now();
  // a visual change: any attribute / class / child change, timestamped at the next animation frame
  await page.evaluate(() => { window.__mut = 0; const mo = new MutationObserver(() => { if (!window.__mut) requestAnimationFrame(() => { window.__mut = performance.now(); }); }); mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); window.__mo = mo; window.__click = 0; document.addEventListener('pointerdown', (e) => { window.__click = e.timeStamp; }, { once: true, capture: true }); });
  await el.click({ timeout: 3000, ...(opts.click ?? {}) });
  await settle(opts.wait ?? 450);
  const r = await page.evaluate((t0) => { window.__mo.disconnect(); const ev = window.__ev.filter((e) => e.start >= t0 - 1); const lt = window.__lt.filter((e) => e.start >= t0 - 1); return { paint: window.__mut && window.__click ? window.__mut - window.__click : null, evMax: ev.length ? Math.max(...ev.map((e) => e.dur)) : 0, procMax: ev.length ? Math.max(...ev.map((e) => e.proc)) : 0, long: lt.length, longMax: lt.length ? Math.max(...lt.map((e) => e.dur)) : 0 }; }, t0);
  const row = { name, sel, ...r, visual: r.paint != null ? Math.round(r.paint) : null };
  rows.push(row); return row;
}
// ---------- 1. latency of every chrome control
const controls = [
  ['ratio 1:1', '#seg-ratio button[data-v="1:1"]'], ['ratio 3:4', '#seg-ratio button[data-v="3:4"]'],
  ['lock text', '.lock >> nth=0'], ['lock text off', '.lock >> nth=0'],
  ['undo', '#btn-undo'], ['redo', '#btn-redo'],
  ['theme', '#btn-theme'], ['theme back', '#btn-theme'], ['lang', '#btn-lang'], ['lang back', '#btn-lang'],
  ['rail insp', '#r-insp'], ['rail insp close', '#r-insp'], ['rail adv', '#r-adv'], ['adv intent color', '#adv-nav [data-intent="color"]'], ['adv intent type', '#adv-nav [data-intent="type"]'],
  ['rail adv close', '#r-adv'], ['rail layers', '#r-layers'], ['rail layers close', '#r-layers'], ['rail film', '#r-film'], ['rail film close', '#r-film'],
  ['lib styles', '.rail-l [data-lib]:nth-child(1)'], ['lib styles close', '.rail-l [data-lib]:nth-child(1)'], ['lib 2', '.rail-l [data-lib]:nth-child(2)'], ['lib 3', '.rail-l [data-lib]:nth-child(3)'], ['lib 3 close', '.rail-l [data-lib]:nth-child(3)'],
  ['remix text', '[data-remix="text"]', { wait: 700 }], ['remix color', '[data-remix="color"]', { wait: 700 }], ['remix image', '[data-remix="image"]', { wait: 700 }],
  ['remix structure', '[data-remix="structure"]', { wait: 900 }], ['remix decor', '[data-remix="decor"]', { wait: 700 }],
  ['draw', '#btn-draw', { wait: 900 }], ['prev', '#btn-prev', { wait: 600 }], ['next', '#btn-next', { wait: 600 }], ['fav', '#btn-fav'], ['fav off', '#btn-fav'],
  ['cmdk open', '#btn-cmdk'], ['scrim close', '#scrim', { click: { position: { x: 30, y: 30 } } }], ['export open', '#btn-export'], ['scrim close 2', '#scrim', { click: { position: { x: 30, y: 30 } } }], ['keys open', '#r-keys'], ['scrim close 3', '#scrim', { click: { position: { x: 30, y: 30 } } }],
];
for (const [n, s, o] of controls) await measure(n, s, o);
await clearAll();
// ---------- 2. dismissal rules
const checks = [];
const ck = (ok, msg, info) => checks.push({ ok: !!ok, msg, ...(info !== undefined ? { info } : {}) });
// a point of bare stage: not glass, not the poster
const empty = async () => { const pt = await page.evaluate(() => { const pr = window.__ui.getState().posterRect; const y = pr.top + pr.height / 2; for (const x of [pr.right + 30, pr.left - 30, pr.right + 80, pr.left - 80, innerWidth / 2]) { const e = document.elementFromPoint(x, y); if (e && !e.closest('.lg, .panel, .frame, button')) return { x, y }; } return { x: innerWidth / 2, y: 70 }; }); await page.mouse.click(pt.x, pt.y); await settle(); };
for (const [name, open, key] of [['lib', '.rail-l [data-lib]:nth-child(1)', 'lib'], ['film', '#r-film', 'film'], ['insp', '#r-insp', 'insp'], ['adv', '#r-adv', 'adv']]) {
  await clearAll(); await page.click(open); await settle(); const o1 = (await U())[key];
  await page.keyboard.press('Escape'); await settle(); const e1 = (await U())[key];
  await page.click(open); await settle(); await empty(); const out = (await U())[key];
  await clearAll();
  ck(o1 && !e1, `${name}: opens and Esc closes`, { open: o1, afterEsc: e1 });
  const shouldClose = name === 'lib' || name === 'film';
  ck(shouldClose ? !out : true, `${name}: outside click ${shouldClose ? 'closes' : 'keeps (work panel)'}`, { afterOutside: out });
}
for (const [name, open] of [['cmdk', '#btn-cmdk'], ['export', '#btn-export'], ['keys', '#r-keys']]) {
  await clearAll(); await page.click(open); await settle();
  await page.keyboard.press('Escape'); await settle();
  const st = await U(); const focus = await page.evaluate((sel) => document.activeElement === document.querySelector(sel), open);
  ck(!st.sheet, `${name}: Esc closes sheet`); ck(focus, `${name}: focus returns to the trigger`);
}
// opening one panel closes the competing one
await clearAll(); await page.click('#r-insp'); await settle(); await page.click('#r-adv'); await settle();
let st = await U(); ck(st.adv && !st.insp, 'adv replaces inspector (one right panel)', st);
await page.click('.rail-l [data-lib]:nth-child(1)'); await settle(); await page.click('.rail-l [data-lib]:nth-child(2)'); await settle();
st = await U(); ck(typeof st.lib === 'string', 'one library panel at a time', st);
await page.click('#btn-export'); await settle(); st = await U(); ck(st.sheet === 'export', 'sheet opens over panels'); await page.keyboard.press('Escape'); await settle();
// a selection inside cmdk closes it
await clearAll(); await page.click('#btn-cmdk'); await settle(); await page.keyboard.type('抽一张'); await page.keyboard.press('Enter'); await settle(800);
ck(!(await U()).sheet, 'choosing a command closes ⌘K');
// explainer popover: Esc / outside click
await clearAll(); await page.click('#r-adv'); await settle(); await page.click('#adv-nav [data-intent="layout"]'); await settle(300); await page.hover('#adv-main [data-pk="margin"]'); await page.click('#adv-main [data-pk="margin"] [data-act="help"]'); await settle(200);
const helpOpen = await page.locator('#adv-main .pexp').count(); await page.keyboard.press('Escape'); await settle(250);
const helpAfterEsc = await page.locator('#adv-main .pexp').count(); const advAfter = (await U()).adv;
ck(helpOpen === 1 && helpAfterEsc === 0 && advAfter, 'explainer: Esc closes it first (panel stays)', { helpOpen, helpAfterEsc, advAfter });
if (!(await U()).adv) { await page.click('#r-adv'); await settle(); await page.click('#adv-nav [data-intent="layout"]'); await settle(300); }
if (!(await page.locator('#adv-main .pexp').count())) { await page.hover('#adv-main [data-pk="margin"]'); await page.click('#adv-main [data-pk="margin"] [data-act="help"]'); await settle(200); }
await page.mouse.click(700, 140); await settle(250);
ck(await page.locator('#adv-main .pexp').count() === 0, 'explainer: outside click closes it');
// ---------- 3. stuck hover / busy states
await clearAll(); await page.hover('#r-adv'); await settle(200); await page.mouse.move(760, 500); await settle(400);
ck(await page.evaluate(() => document.querySelectorAll('.tip:hover, .press:hover').length) === 0, 'no stuck hover after leaving a rail button');
await page.click('#btn-draw'); await settle(1000);
ck(await page.evaluate(() => document.querySelectorAll('.busy').length) === 0, 'draw: busy state clears');
// ---------- 4. rapid double clicks
await clearAll(); let h0 = await page.evaluate(() => window.__rea.getState().history.length);
await page.dblclick('#btn-draw'); await settle(1200); let h1 = await page.evaluate(() => window.__rea.getState().history.length);
ck(h1 - h0 === 1, 'double-clicking 抽一张 makes one draw', { added: h1 - h0 });
for (const sel of ['#r-insp', '#r-film', '.rail-l [data-lib]:nth-child(1)', '#btn-cmdk']) {
  await clearAll(); await page.dblclick(sel); await settle(500); const s2 = await U();
  const anyOpen = s2.insp || s2.film || !!s2.lib || !!s2.sheet; const vis = await page.evaluate(() => [...document.querySelectorAll('.panel.open, .film.open, .sheet.open, .lib.open')].length);
  ck((anyOpen ? 1 : 0) === Math.min(1, vis) || !anyOpen, `double-click ${sel}: state and view agree`, { anyOpen, vis });
}
// ---------- 5. toasts: dedupe and lifetime
await clearAll();
await page.evaluate(() => { const s = window.__rea.getState(); for (let i = 0; i < 4; i++) s.toast('同一条提示'); s.toast('另一条'); });
await settle(150);
const tN = await page.evaluate(() => document.querySelectorAll('.toasts .toast').length);
ck(tN <= 2, 'identical toasts are merged (≤ 2 visible)', { visible: tN });
await page.waitForTimeout(3600);
ck(await page.evaluate(() => document.querySelectorAll('.toasts .toast').length) === 0, 'toasts auto-dismiss');
// pinning several controls: chips are the feedback, toasts must not stack
await page.click('#r-adv'); await settle();
for (const k of ['margin', 'titleScale', 'contrast']) { await page.click(`#adv-nav [data-intent="${k === 'margin' ? 'layout' : k === 'titleScale' ? 'type' : 'color'}"]`); await settle(200); await page.hover(`#adv-main [data-pk="${k}"]`); await page.click(`#adv-main [data-pk="${k}"] [data-act="pin"]`); await settle(120); }
const pinToasts = await page.evaluate(() => document.querySelectorAll('.toasts .toast').length);
ck(pinToasts <= 1, 'pinning 3 controls stacks at most 1 toast', { pinToasts });
await page.click('#btn-unpin-all').catch(() => {}); await settle(300);
// ---------- 6. slider drag smoothness (titleScale)
await clearAll(); await page.click('#r-adv'); await settle(); await page.click('#adv-nav [data-intent="type"]'); await settle(300);
const bb = await page.locator('#adv-main .scrub[data-k="titleScale"]').boundingBox();
const tD = await now();
await page.evaluate(() => { window.__fr = []; let last = performance.now(); const tick = (t) => { window.__fr.push(t - last); last = t; if (window.__fr.length < 400) window.__rafH = requestAnimationFrame(tick); }; window.__rafH = requestAnimationFrame(tick); });
await page.mouse.move(bb.x + bb.width * 0.3, bb.y + bb.height / 2); await page.mouse.down();
for (let i = 0; i <= 40; i++) { await page.mouse.move(bb.x + bb.width * (0.3 + 0.6 * i / 40), bb.y + bb.height / 2); await page.waitForTimeout(16); }
await page.mouse.up(); await settle(700);
const drag = await page.evaluate((t0) => { cancelAnimationFrame(window.__rafH); const fr = window.__fr.slice(1); const lt = window.__lt.filter((e) => e.start >= t0); const ev = window.__ev.filter((e) => e.start >= t0 && e.name.startsWith('pointer')); fr.sort((a, b) => a - b); return { frames: fr.length, p50: Math.round(fr[Math.floor(fr.length * 0.5)]), p95: Math.round(fr[Math.floor(fr.length * 0.95)]), maxFrame: Math.round(fr[fr.length - 1]), dropped: fr.filter((x) => x > 34).length, longTasks: lt.length, longMax: Math.round(lt.length ? Math.max(...lt.map((e) => e.dur)) : 0), longSum: Math.round(lt.reduce((s, e) => s + e.dur, 0)), pointerEvMax: Math.round(ev.length ? Math.max(...ev.map((e) => e.dur)) : 0) }; }, tD);
// render cost profile: one adjust re-render, split
const prof = await page.evaluate(async () => {
  const st = window.__rea.getState; const t = []; for (let i = 0; i < 8; i++) { const a = performance.now(); await st().regen(false); t.push(performance.now() - a); }
  t.sort((a, b) => a - b); return { regenMedian: Math.round(t[4]), regenMax: Math.round(t[7]) };
});
await clearAll();
const valid = rows.filter((r) => !r.skipped);
const sum = { controls: valid.length, skipped: rows.filter((r) => r.skipped).map((r) => r.name), visualP50: med(valid.map((r) => r.visual ?? 0)), visualMax: Math.max(...valid.map((r) => r.visual ?? 0)), over100: valid.filter((r) => (r.visual ?? 0) > 100).map((r) => `${r.name} ${r.visual}`), handlerOver16: valid.filter((r) => r.procMax > 16).map((r) => `${r.name} ${Math.round(r.procMax)}`), withLongTask: valid.filter((r) => r.long).map((r) => `${r.name} ${Math.round(r.longMax)}`) };
function med(a) { const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.floor(s.length / 2)]); }
mkdirSync('test-results', { recursive: true });
const outp = { label, sum, drag, prof, checks, rows, errors: errs };
writeFileSync(`test-results/interaction-${label}.json`, JSON.stringify(outp, null, 1));
console.log(JSON.stringify({ sum, drag, prof }, null, 1));
for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.msg}${c.info !== undefined ? ' ' + JSON.stringify(c.info) : ''}`);
console.log('page errors', errs.length);
await ctx.close(); await browser.close();
const bad = checks.filter((c) => !c.ok).length + (errs.length ? 1 : 0);
process.exit(process.env.AUDIT_STRICT && bad ? 1 : 0);
