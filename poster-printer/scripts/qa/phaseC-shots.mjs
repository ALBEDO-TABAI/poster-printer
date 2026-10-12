// Phase 14 screenshots + demo video: rails on the poster axis (tall / short window), panels, sheet from its trigger,
// toast dedupe, pins chips, slider drag, reduced motion. Writes test-results/ui/phaseC_*.png and phaseC_demo.webm.
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync } from 'node:fs';
const URL = process.env.APP_URL || 'http://127.0.0.1:5180/';
const out = 'test-results/ui'; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const boot = async (p) => { await p.goto(URL + '?fresh'); await p.waitForFunction(() => { const s = window.__rea?.getState(); return s?.ready && s.scene && s.presetImages.length; }, null, { timeout: 90000 }); await p.waitForTimeout(1500); };
const shot = (p, n) => p.screenshot({ path: `${out}/phaseC_${n}.png` });
// stills
const c1 = await b.newContext({ viewport: { width: 1512, height: 945 }, deviceScaleFactor: 1 }); const p = await c1.newPage(); await boot(p);
const axis = await p.evaluate(() => { const pr = window.__ui.getState().posterRect; const c = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return Math.round(r.top + r.height / 2); }; return { poster: Math.round(pr.top + pr.height / 2), left: c('.rail-l'), right: c('.rail-r') }; });
console.log('axis 1512x945', axis);
await p.evaluate(() => window.__ui.setState({ uiGrid: true })); await p.waitForTimeout(400); await shot(p, 'rails_centred_grid');
await p.evaluate(() => window.__ui.setState({ uiGrid: false })); await p.waitForTimeout(300); await shot(p, 'rails_centred');
await p.click('#r-adv'); await p.waitForTimeout(500); await shot(p, 'advanced_open');
await p.hover('#adv-main [data-pk]'); await p.click('#adv-main [data-pk] [data-act="help"]'); await p.waitForTimeout(300); await shot(p, 'explainer');
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
for (const k of ['margin']) { await p.click('#adv-nav [data-intent="layout"]'); await p.waitForTimeout(300); await p.hover(`#adv-main [data-pk="${k}"]`); await p.click(`#adv-main [data-pk="${k}"] [data-act="pin"]`); }
await p.click('#adv-nav [data-intent="type"]'); await p.waitForTimeout(300); await p.hover('#adv-main [data-pk="titleScale"]'); await p.click('#adv-main [data-pk="titleScale"] [data-act="pin"]'); await p.waitForTimeout(250);
await shot(p, 'pins_one_toast');
await p.click('#btn-export'); await p.waitForTimeout(80); await shot(p, 'sheet_from_trigger_midway'); await p.waitForTimeout(400); await shot(p, 'export_sheet');
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
await p.click('.rail-l [data-lib]:nth-child(1)'); await p.waitForTimeout(900); await shot(p, 'library_open');
await p.click('#btn-unpin-all').catch(() => {});
await c1.close();
const c2 = await b.newContext({ viewport: { width: 1280, height: 640 } }); const q = await c2.newPage(); await boot(q);
console.log('axis 1280x640', await q.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const top = r('.top').bottom, dock = r('#dock').top, l = r('.rail-l'), rr = r('.rail-r'); return { topBar: Math.round(top), dockTop: Math.round(dock), left: [Math.round(l.top), Math.round(l.bottom)], right: [Math.round(rr.top), Math.round(rr.bottom)] }; }));
await shot(q, 'rails_short_window'); await c2.close();
// demo video
const c3 = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: out + '/vid', size: { width: 1280, height: 800 } } }); const v = await c3.newPage(); await boot(v);
const pause = (ms = 700) => v.waitForTimeout(ms);
await v.click('#btn-draw'); await pause(1200); await v.click('#btn-draw'); await pause(1200);
await v.click('#r-adv'); await pause(); await v.click('#adv-nav [data-intent="type"]'); await pause();
const bb = await v.locator('#adv-main .scrub[data-k="titleScale"]').boundingBox();
await v.mouse.move(bb.x + bb.width * .3, bb.y + 12); await v.mouse.down();
for (let i = 0; i <= 50; i++) { await v.mouse.move(bb.x + bb.width * (.3 + .5 * Math.sin(i / 50 * Math.PI)), bb.y + 12); await v.waitForTimeout(20); }
await v.mouse.up(); await pause();
await v.hover('#adv-main [data-pk="titleScale"]'); await v.click('#adv-main [data-pk="titleScale"] [data-act="pin"]'); await pause(1000);
await v.click('#r-insp'); await pause(); await v.click('.rail-l [data-lib]:nth-child(1)'); await pause(1200);
await v.mouse.click(640, 60); await pause(); await v.keyboard.press('Escape'); await pause();
await v.click('#btn-export'); await pause(900); await v.keyboard.press('Escape'); await pause();
await v.click('#seg-ratio button[data-v="1:1"]'); await pause(1200); await v.click('#seg-ratio button[data-v="3:4"]'); await pause(1200);
await v.click('#btn-unpin-all').catch(() => {}); await pause(800);
await c3.close();
const f = readdirSync(out + '/vid').find((x) => x.endsWith('.webm')); renameSync(`${out}/vid/${f}`, `${out}/phaseC_demo.webm`);
await b.close();
