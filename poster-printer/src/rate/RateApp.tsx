// Hidden rating page (/rate.html): live random posters, one at a time, rated 1–9 by keyboard or click.
// Finer scores (phase 10): Shift+digit (or Shift+click) = digit + 0.5; ] / [ nudge the last rating by ±0.25.
// Pairwise A/B mode: two posters of the same ratio side by side; ← / A = left better, → / B = right better, ↓ / = tie.
// Ratings are stored in localStorage (pp.ratings.v1) with everything needed to reproduce the poster
// (seeds, ratio, style, params, picks) plus the selector's taste score and the scene features, and can be
// exported as JSON to retrain the taste selector (scripts/taste). Generator logic is used as-is.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore, buildInput, entryScene, type Entry, type State } from '../store';
import { generate } from '../engine/generate';
import { DEFAULT_PARAMS, PARAMS, type Params } from '../engine/params';
import { renderSVG } from '../engine/render/svg';
import { sceneFeatures, FEATURE_NAMES } from '../engine/aesthetic/features';
import { tasteScore } from '../engine/aesthetic/score';
import { newSeed, Rng } from '../engine/rng';
import { ensureFontSet } from '../lib/fonts';
import { download } from '../lib/exporter';
import { useLocalLang, useLocalTheme } from '../lib/lang';
import { RANDOM_STYLES, BUILTIN_STYLES, type Style } from '../data/styles';
import type { Ratio, Scene } from '../engine/types';
import { APP_SLUG, APP_VERSION } from '../config';
import { BrandMark, Wordmark } from '../ui/shell/Chrome';
import { Splash } from '../ui/Splash';
import { Icon } from '../ui/Icon';
import { LSeg } from '../ui/controls';
import G from '../ui/glass/glass';

const KEY = 'pp.ratings.v1';
const OPT_KEY = 'pp.ratings.opts.v1';
const PAIR_KEY = 'pp.pairs.v1';
const RATIOS: Ratio[] = ['3:4', '9:16', '1:1', '4:3', '16:9', '21:9'];
const RATIO_W = [5, 3, 2, 2, 2, 1]; // portrait-heavy, like real use
const compDef = PARAMS.find((p) => p.key === 'composition')!;
const COMPS = compDef.type === 'seg' ? compDef.options.map((o) => o.v).filter((v) => v !== 'auto') : [];

export interface Rating {
  id: string; ts: number; rating: number;
  seed: string; seeds: Entry['seeds']; ratio: Ratio; composition: string; compMode: 'auto' | 'forced'; styleId: string;
  taste: number | null; quality: number | null; selector: { on: boolean; k: number; attempts?: number };
  entry: Omit<Entry, 'fonts'> & { fonts: Entry['fonts'] }; features: Record<string, number>; v: string;
  /** rating resolution used (1 = integer keys, 0.5 / 0.25 = finer); absent on old exports (integer) */
  step?: number;
  /** A/B arm (phase 11): 'p11' = gates + light selector, 'p10-random' = no selector, no geometry / palette-fit gates */
  arm?: 'p11' | 'p10-random';
}
/** one A/B judgement: both posters fully recorded (rating field unused = 0) */
export interface PairJudgement { id: string; ts: number; a: Rating; b: Rating; winner: 'a' | 'b' | 'tie'; v: string; /** phase 11: which arm was shown left (a) — sides are randomised per pair */ arms?: { a: 'p11' | 'p10-random'; b: 'p11' | 'p10-random' } }
interface Item { entry: Entry; scene: Scene; svg: string; compMode: 'auto' | 'forced'; attempts?: number; arm?: 'p11' | 'p10-random' }
interface Opts { comp: 'auto' | 'mix' | 'forced'; showScore: boolean; target: number; mode?: 'single' | 'ab' }

const LS = { get: <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d; } catch { return d; } }, set: (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } } };
const fit = (svg: string) => svg.replace(/^<svg([^>]*?) width="[\d.]+" height="[\d.]+"/, '<svg$1 width="100%" height="100%"');

// Phase 11 A/B: one draw (seeds, ratio, style, composition) rendered by both arms, so a pair differs only in the
// generator: P11 (geometry + palette-fit gates, light selector, modern hanzi for opt-in styles) vs the P10 pure-random
// path (no selector, no geometry / palette-fit gates, the full P10 style pool). Code-level layout fixes apply to both.
const MODERN: Record<string, string> = { 'zh-brush-title': 'zh-modern-song', 'zh-cursive-air': 'zh-modern-hei', 'zh-longcang': 'zh-modern-song', 'zh-wild-grass': 'zh-modern-hei', 'zh-wenkai-note': 'zh-modern-song', 'zh-xiaowei': 'zh-modern-song' };
const P10_POOL = BUILTIN_STYLES.filter((x) => !x.id.startsWith('zh-modern-'));
async function makeArm(arm: 'p11' | 'p10-random', style: Style, ratio: Ratio, seeds: Entry['seeds'], recent: string[]): Promise<Item> {
  const s = useStore.getState();
  const params = { ...DEFAULT_PARAMS, ...style.params, composition: 'auto', ...(arm === 'p10-random' ? { geoGate: false, paletteFit: false } : {}) } as Params;
  await ensureFontSet(style.fonts);
  const over: State = {
    ...s, seeds, decorSalt: '', ratio, styleId: style.id, params, fonts: style.fonts, modes: style.modes ?? [], modules: s.modules,
    result: null, scene: null, edits: {}, placed: [], imgPick: [], imgCat: 'all', pinnedPalette: null, customOn: false,
    locks: { text: false, color: false, image: false, images: false }, palFilter: { src: 'all', light: 'any', chroma: 'any', contrast: 'any', tag: 'any' },
    history: recent.map((c) => ({ comp: c }) as unknown as Entry), hIndex: -1,
  };
  const inp = buildInput(over);
  const res = generate(arm === 'p10-random' ? { ...inp, select: 0 } : { ...inp, selectMode: 'light' });
  const entry: Entry = { id: arm + '-' + (res.seeds ?? seeds).layout + '-' + Date.now().toString(36), ts: Date.now(), seeds: { ...(res.seeds ?? seeds) }, decorSalt: '', ratio, styleId: style.id, params, modules: { ...s.modules }, modes: [...(style.modes ?? [])], fonts: style.fonts, picked: res.picked, edits: {}, custom: null, comp: res.picked.comp };
  const scene = entryScene(entry) ?? res.scene;
  return { entry, scene, svg: fit(renderSVG(scene)), compMode: 'auto', attempts: res.attempts, arm };
}
async function makePair(recent: string[]): Promise<[Item, Item]> {
  const r = new Rng(newSeed(8));
  const ratio = r.weighted(RATIOS.map((x, i) => [x, RATIO_W[i]] as [Ratio, number]));
  const st10 = r.pick(P10_POOL);
  const st11 = MODERN[st10.id] ? BUILTIN_STYLES.find((x) => x.id === MODERN[st10.id]) ?? st10 : st10;
  const seeds = { layout: newSeed(), text: newSeed(), color: newSeed(), image: newSeed() };
  const p11 = await makeArm('p11', st11, ratio, seeds, recent);
  const p10 = await makeArm('p10-random', st10, ratio, seeds, recent);
  return r.next() < 0.5 ? [p11, p10] : [p10, p11];
}

async function makeItem(opts: Opts, recent: string[], fixedRatio?: Ratio): Promise<Item> {
  const s = useStore.getState();
  const r = new Rng(newSeed(8));
  const rr = r.weighted(RATIOS.map((x, i) => [x, RATIO_W[i]] as [Ratio, number]));
  const ratio = fixedRatio ?? rr;
  const style = r.pick(RANDOM_STYLES);
  const forced = opts.comp === 'forced' || (opts.comp === 'mix' && r.next() < 0.35);
  const composition = forced ? r.pick(COMPS) : 'auto';
  const seeds = { layout: newSeed(), text: newSeed(), color: newSeed(), image: newSeed() };
  const params = { ...DEFAULT_PARAMS, ...style.params, composition } as Params;
  await ensureFontSet(style.fonts);
  const over: State = {
    ...s, seeds, decorSalt: '', ratio, styleId: style.id, params, fonts: style.fonts, modes: style.modes ?? [], modules: s.modules,
    result: null, scene: null, edits: {}, placed: [], imgPick: [], imgCat: 'all', pinnedPalette: null, customOn: false,
    locks: { text: false, color: false, image: false, images: false }, palFilter: { src: 'all', light: 'any', chroma: 'any', contrast: 'any', tag: 'any' },
    history: recent.map((c) => ({ comp: c }) as unknown as Entry), hIndex: -1,
  };
  const res = generate(buildInput(over));
  const entry: Entry = { id: (res.seeds ?? seeds).layout + '-' + Date.now().toString(36), ts: Date.now(), seeds: { ...(res.seeds ?? seeds) }, decorSalt: '', ratio, styleId: style.id, params, modules: { ...s.modules }, modes: [...(style.modes ?? [])], fonts: style.fonts, picked: res.picked, edits: {}, custom: null, comp: res.picked.comp };
  // Show the scene exactly as the editor re-creates it from the entry (entryScene), so what is rated is what the
  // exported entry reproduces. The selector's first render can very occasionally differ from the replay.
  const scene = entryScene(entry) ?? res.scene;
  return { entry, scene, svg: fit(renderSVG(scene)), compMode: forced ? 'forced' : 'auto', attempts: res.attempts };
}

export function RateApp() {
  const [lang, setLang, t] = useLocalLang();
  const [theme, setTheme] = useLocalTheme();
  const [ready, setReady] = useState(false);
  const [cur, setCur] = useState<Item | null>(null);
  const [curB, setCurB] = useState<Item | null>(null);
  const [pairs, setPairs] = useState<PairJudgement[]>(() => LS.get<PairJudgement[]>(PAIR_KEY, []));
  const [ratings, setRatings] = useState<Rating[]>(() => LS.get<Rating[]>(KEY, []));
  const [session, setSession] = useState(0);
  const [opts, setOpts] = useState<Opts>(() => LS.get<Opts>(OPT_KEY, { comp: 'auto', showScore: false, target: 100 }));
  const [flash, setFlash] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const next = useRef<Promise<Item> | null>(null);
  const nextB = useRef<Promise<Item> | null>(null);
  const ab = opts.mode === 'ab';
  const recent = useRef<string[]>([]);
  const busy = useRef(false);
  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2200); };

  useEffect(() => { document.title = `${t('打分', 'Rate')} · Ready Poster Printer`; document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'; }, [lang]);
  useEffect(() => { LS.set(OPT_KEY, opts); }, [opts]);
  useEffect(() => { G.auto(); G.refract(); }, []);
  useEffect(() => { G.refreshAll(); }, [theme]);

  const prefetch = useCallback(() => {
    if (opts.mode === 'ab') {
      // phase 11: both sides from the same seeds / ratio / style draw (P11 vs P10 pure random), sides randomised
      const pr = new Promise<[Item, Item]>((res) => setTimeout(() => res(makePair(recent.current)), 30));
      next.current = pr.then((p) => p[0]); nextB.current = pr.then((p) => p[1]);
      return;
    }
    next.current = new Promise((res) => setTimeout(() => res(makeItem(opts, recent.current)), 30));
    nextB.current = null;
  }, [opts]);
  const advance = useCallback(async () => {
    if (busy.current) return; busy.current = true;
    try {
      let it: Item, itB: Item | null = null;
      if (opts.mode === 'ab') { if (next.current && nextB.current) { it = await next.current; itB = await nextB.current; } else [it, itB] = await makePair(recent.current); }
      else it = await (next.current ?? makeItem(opts, recent.current));
      recent.current = [...recent.current, it.entry.picked.comp].slice(-4);
      setCur(it); setCurB(itB); prefetch();
    } catch (e) { console.warn(e); toast(String(e)); next.current = null; }
    busy.current = false;
  }, [opts, prefetch]);

  // boot: load assets through the editor store (do not consume the palette hand-over meant for the editor)
  useEffect(() => {
    (async () => {
      const pin = localStorage.getItem('rea.pinPalette');
      await useStore.getState().init();
      if (pin) localStorage.setItem('rea.pinPalette', pin);
      await useStore.getState().regen(false);
      await document.fonts.ready; // let any lazily-triggered faces settle so the first poster measures like the replay
      setReady(true);
    })().catch((e) => { console.error(e); toast(String(e)); });
  }, []);
  useEffect(() => { if (ready) { next.current = null; nextB.current = null; advance(); } }, [ready, opts.comp, opts.mode]);

  // ambient field from the current poster
  useEffect(() => {
    if (!cur) return;
    const img = new Image();
    img.onload = () => {
      const fr = document.querySelector('.rate-frame')?.getBoundingClientRect();
      const stage = getComputedStyle(document.documentElement).getPropertyValue('--stage').trim() || '#ebebee';
      const url = G.buildField(img, fr ? { left: fr.left, top: fr.top, width: fr.width, height: fr.height } : null, stage, theme === 'dark' ? 0.42 : 0.5);
      const au = document.querySelectorAll<HTMLImageElement>('.aura img'); if (au.length < 2) return;
      const on = au[0].classList.contains('on') ? 1 : 0; au[on].src = url; au[on].classList.add('on'); au[on ^ 1].classList.remove('on');
      G.setScene({ field: url });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(renderSVG(cur.scene));
  }, [cur, theme]);

  const recordOf = (it: Item, n: number, step: number): Rating => {
    const sc = it.scene; const e = it.entry;
    return {
      id: e.id, ts: Date.now(), rating: n, seed: e.seeds.layout, seeds: e.seeds, ratio: e.ratio, composition: e.picked.comp, compMode: it.compMode, styleId: e.styleId,
      taste: e.picked.taste ?? +tasteScore(sc).toFixed(4), quality: (sc.info.score as number) ?? null, selector: { on: it.compMode === 'auto', k: 8, attempts: it.attempts },
      entry: e, features: Object.fromEntries(Object.entries(sceneFeatures(sc)).map(([k, v]) => [k, +(+v).toFixed(5)])), v: APP_VERSION, step, ...(it.arm ? { arm: it.arm } : {}),
    };
  };
  const judge = useCallback((w: 'a' | 'b' | 'tie') => {
    if (!cur || !curB) return;
    const rec: PairJudgement = { id: cur.entry.id + '|' + curB.entry.id, ts: Date.now(), a: recordOf(cur, 0, 0), b: recordOf(curB, 0, 0), winner: w, v: APP_VERSION, ...(cur.arm && curB.arm ? { arms: { a: cur.arm, b: curB.arm } } : {}) };
    setPairs((ps) => { const out = [...ps, rec]; if (!LS.set(PAIR_KEY, out)) toast(t('本地存储已满，请先导出', 'Storage full — export first')); return out; });
    setSession((x) => x + 1);
    advance();
  }, [cur, curB, advance, t]);
  const nudge = (d: number) => {
    const last = ratings[ratings.length - 1]; if (!last) return;
    const v = Math.max(1, Math.min(9, last.rating + d));
    const out = [...ratings.slice(0, -1), { ...last, rating: v, step: 0.25 }]; setRatings(out); LS.set(KEY, out);
    toast(t(`上一张改为 ${v}`, `Last rating → ${v}`));
  };
  const rate = useCallback((n: number, step = 1) => {
    if (!cur) return;
    const sc = cur.scene; const e = cur.entry;
    const rec: Rating = {
      id: e.id, ts: Date.now(), rating: n, seed: e.seeds.layout, seeds: e.seeds, ratio: e.ratio, composition: e.picked.comp, compMode: cur.compMode, styleId: e.styleId,
      taste: e.picked.taste ?? +tasteScore(sc).toFixed(4), quality: (sc.info.score as number) ?? null, selector: { on: cur.compMode === 'auto', k: 8, attempts: cur.attempts },
      entry: e, features: Object.fromEntries(Object.entries(sceneFeatures(sc)).map(([k, v]) => [k, +(+v).toFixed(5)])), v: APP_VERSION, step,
    };
    setRatings((rs) => { const out = [...rs, rec]; if (!LS.set(KEY, out)) toast(t('本地存储已满，请先导出', 'Storage full — export first')); return out; });
    setSession((x) => x + 1);
    setFlash(n); setTimeout(() => setFlash(null), 260);
    advance();
  }, [cur, advance, t]);
  const undo = () => {
    if (ab) { const lp = pairs[pairs.length - 1]; if (!lp) return; const out = pairs.slice(0, -1); setPairs(out); LS.set(PAIR_KEY, out); setSession((x) => Math.max(0, x - 1)); toast(t('已撤销上一组', 'Undone · last pair')); return; }
    const last = ratings[ratings.length - 1]; if (!last) return;
    const out = ratings.slice(0, -1); setRatings(out); LS.set(KEY, out); setSession((x) => Math.max(0, x - 1));
    const sc = entryScene(last.entry as Entry);
    if (sc && cur) { next.current = Promise.resolve(cur); setCur({ entry: last.entry as Entry, scene: sc, svg: fit(renderSVG(sc)), compMode: last.compMode }); }
    toast(t(`已撤销 · ${last.rating} 分`, `Undone · ${last.rating}`));
  };
  const exportJson = (withScenes = true) => {
    const data = {
      app: APP_SLUG, kind: 'ratings', version: 1, generator: APP_VERSION, exported: new Date().toISOString(), scale: '1–9 (higher is better)',
      featureNames: FEATURE_NAMES,
      howToReproduce: 'entryScene(entry) in src/store.ts re-creates the exact scene from entry (seeds, ratio, styleId, params, modules, modes, fonts, picked). features = sceneFeatures(scene) (src/engine/aesthetic/features.ts), the taste model\'s input.',
      pairs: pairs.map((p) => ({ ...p, a: { ...p.a, scene: withScenes ? entryScene(p.a.entry as Entry) : undefined }, b: { ...p.b, scene: withScenes ? entryScene(p.b.entry as Entry) : undefined } })),
      ratings: ratings.map((r) => {
        const scene = entryScene(r.entry as Entry);
        // integrity check: the regenerated scene must yield the features recorded at rating time
        const f = scene ? sceneFeatures(scene) as Record<string, number> : null;
        const reproduced = !!f && Object.entries(r.features).every(([k, v]) => Math.abs((+f[k] || 0) - v) < 1e-4);
        return { ...r, reproduced, scene: withScenes ? scene : undefined };
      }),
    };
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    download(JSON.stringify(data), `${APP_SLUG}-ratings-${ratings.length}${pairs.length ? `-pairs-${pairs.length}` : ''}-${stamp}.json`);
    toast(t(`已导出 ${ratings.length} 条评分 · ${pairs.length} 组对比`, `Exported ${ratings.length} ratings · ${pairs.length} pairs`));
  };
  const clearAll = () => { if (ab) { if (!pairs.length || !confirm(t(`清空本机的 ${pairs.length} 组对比？建议先导出。`, `Clear ${pairs.length} local pairs? Export first.`))) return; setPairs([]); LS.set(PAIR_KEY, []); setSession(0); return; }
    if (!ratings.length || !confirm(t(`清空本机的 ${ratings.length} 条评分？建议先导出。`, `Clear ${ratings.length} local ratings? Export first.`))) return; setRatings([]); LS.set(KEY, []); setSession(0); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea,select')) return;
      if (e.metaKey || e.ctrlKey) { if (e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); } return; }
      if (e.altKey) return;
      if (ab) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); judge('a'); return; }
        if (e.key === 'ArrowRight' || e.key === 'b' || e.key === 'B') { e.preventDefault(); judge('b'); return; }
        if (e.key === 'ArrowDown' || e.key === '=') { e.preventDefault(); judge('tie'); return; }
      }
      const dg = /^Digit([1-9])$/.exec(e.code);
      if (!ab && dg && e.shiftKey) { e.preventDefault(); if (+dg[1] < 9) rate(+dg[1] + 0.5, 0.5); else rate(9, 0.5); }
      else if (!ab && /^[1-9]$/.test(e.key)) { e.preventDefault(); rate(+e.key); }
      else if (!ab && (e.key === ']' || e.key === '[')) { e.preventDefault(); nudge(e.key === ']' ? 0.25 : -0.25); }
      else if (e.key === '0' || e.key === 's' || e.key === 'S' || e.code === 'Space') { e.preventDefault(); advance(); }
      else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') { e.preventDefault(); undo(); }
      else if (e.key === 'i' || e.key === 'I') setOpts((o) => ({ ...o, showScore: !o.showScore }));
      else if (e.key === 'e' || e.key === 'E') exportJson();
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });

  const n = ab ? pairs.length : ratings.length;
  const pct = Math.min(1, n / Math.max(1, opts.target));
  const avg = n ? ratings.reduce((a, r) => a + r.rating, 0) / n : 0;
  const hist = Array.from({ length: 9 }, (_, i) => ratings.filter((r) => Math.floor(r.rating) === i + 1).length);
  const hmax = Math.max(1, ...hist);
  const e = cur?.entry;
  const style = e ? BUILTIN_STYLES.find((x) => x.id === e.styleId) : null;
  const [a0, b] = (e?.ratio ?? '3:4').split(':').map(Number);
  const a = ab ? a0 * 2.06 : a0; // A/B: two papers of the same ratio side by side
  const capProps = { 'data-refract': '36', 'data-bevel': '20', 'data-mat': 'clear', 'data-ca': '.1' };
  const labels = [t('很差', 'Awful'), '', '', '', t('一般', 'OK'), '', '', '', t('惊艳', 'Stunning')];
  return (
    <div className="rapp" style={{ ['--ar' as string]: `${a} / ${b}` }}>
      <div className="stage"><div className="aura"><img alt="" /><img alt="" /></div><div className="dots" /><div className="vignette" /></div>
      <header className="top">
        <div className="lg cap" data-refract="28" data-mat="clear">
          <a className="brand" href="./"><BrandMark /><Wordmark /></a>
          <span className="vsep" /><span className="rate-title">{t('打分', 'Rate')}</span>
        </div>
        <div className="lg cap center prog-cap" data-refract="32" data-mat="clear" data-ca=".08">
          <span className="mono prog-n" data-qa="rate-count">{n}<small> / {opts.target}</small></span>
          <span className="prog"><i style={{ width: `${pct * 100}%` }} /></span>
          <span className="mono muted prog-s">{t('本次', 'session')} {session} · {t('均分', 'avg')} {avg ? avg.toFixed(1) : '–'}</span>
        </div>
        <div className="grow" />
        <div className="lg cap" data-refract="28" data-mat="clear">
          <button className="icon-btn tip press" data-tip={t('撤销上一个 · Z', 'Undo last · Z')} disabled={!n} onClick={undo}><Icon name="undo-2" size={17} /></button>
          <button className="icon-btn tip press" data-tip={t('清空', 'Clear all')} disabled={!n} onClick={clearAll}><Icon name="trash-2" size={17} /></button>
          <span className="vsep" />
          <button className="icon-btn tip press" data-tip={t('English', '中文')} onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}><span style={{ fontWeight: 600, fontSize: 12 }}>{lang === 'zh' ? 'EN' : '中'}</span></button>
          <button className="icon-btn tip press" data-tip={t('明暗', 'Appearance')} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}><Icon name={theme === 'light' ? 'moon' : 'sun'} size={17} /></button>
        </div>
        <button className="lg ink primary-btn press hl" data-qa="rate-export" data-refract="30" data-ca=".06" disabled={!n} onClick={() => exportJson()}><span className="hl-glow" /><Icon name="download" size={17} /><span>{t('导出 JSON', 'Export JSON')}</span></button>
      </header>

      <aside className="lg strong panel rate-side open" data-refract="64" data-bevel="28" data-blur="10" data-ca=".05">
        <div className="p-head"><div><div className="eyebrow">{t('训练品味选择器', 'Taste selector training')}</div><h2>{t('凭直觉打分', 'Rate by gut feeling')}</h2></div></div>
        <div className="p-body">
          <p className="hint" style={{ marginTop: 0 }}>{t('每张都是现场随机生成（随机种子、画幅、风格与构图，选择器开启）。按 1–9 打分，越高越好；0 / 空格跳过，Z 撤销。评分只存在本机，可导出 JSON 用来重新训练品味模型。', 'Every poster is generated live (random seed, ratio, style and composition; selector on). Press 1–9 — higher is better; 0 / Space skips, Z undoes. Ratings stay in this browser; export JSON to retrain the taste model.')}</p>
          <div className="sec"><div className="sec-h"><h3>{t('构图来源', 'Composition')}</h3></div>
            <LSeg className="boxed fill sm" value={opts.comp} options={[{ v: 'auto', l: t('选择器', 'Selector') }, { v: 'mix', l: t('混合', 'Mixed') }, { v: 'forced', l: t('全随机', 'Random') }]} onChange={(v) => setOpts((o) => ({ ...o, comp: v }))} />
            <p className="hint">{t('选择器：完全按产品逻辑出图（推荐）。混合 / 全随机：部分或全部强制随机构图，覆盖选择器平时不选的构图（此时只对版式变体做选择）。', 'Selector: exactly what the product draws (recommended). Mixed / Random: some or all posters force a random composition, covering ones the selector would skip.')}</p>
          </div>
          <div className="sec"><div className="sec-h"><h3>{t('模式', 'Mode')}</h3></div>
            <LSeg className="boxed fill sm" value={opts.mode ?? 'single'} options={[{ v: 'single', l: t('打分', 'Score') }, { v: 'ab', l: t('A/B 对比', 'A/B pairs') }]} onChange={(v) => setOpts((o) => ({ ...o, mode: v as Opts['mode'] }))} />
            <p className="hint">{ab ? t('同一组种子、画幅与风格，由两版生成器各出一张（P11 对 P10 纯随机，左右随机）：← / A 左边更好，→ / B 右边更好，↓ / = 差不多。', 'Same seeds, ratio and style drawn by two generators (P11 vs P10 pure random, sides shuffled): ← / A left is better, → / B right is better, ↓ / = about equal.') : t('Shift+数字 = 加半分（如 Shift+7 = 7.5）；] / [ 把上一张 ±0.25。', 'Shift+digit = +0.5 (Shift+7 = 7.5); ] / [ nudge the last rating by ±0.25.')}</p>
          </div>
          <div className="sec"><div className="sec-h"><h3>{t('目标', 'Goal')}</h3></div>
            <LSeg className="boxed fill sm" value={String(opts.target)} options={[50, 100, 200, 500].map((x) => ({ v: String(x), l: String(x) }))} onChange={(v) => setOpts((o) => ({ ...o, target: +v }))} />
          </div>
          <div className="sec"><div className="sec-h"><h3>{t('分布', 'Distribution')}</h3><div className="act"><span className="tag">{n}</span></div></div>
            <div className="rhist">{hist.map((c, i) => <div key={i}><i style={{ height: `${(c / hmax) * 100}%` }} /><span className="mono">{i + 1}</span></div>)}</div>
          </div>
          <div className="sec"><div className="sec-h"><h3>{t('当前海报', 'This poster')}</h3><div className="act"><button className="text-btn press" style={{ height: 26, fontSize: 11 }} onClick={() => setOpts((o) => ({ ...o, showScore: !o.showScore }))}><Icon name={opts.showScore ? 'eye-off' : 'eye'} size={13} />{opts.showScore ? t('隐藏分数', 'Hide score') : t('显示分数 · I', 'Show score · I')}</button></div></div>
            {e && <dl className="kv mono">
              <dt>seed</dt><dd>{e.seeds.layout}</dd>
              <dt>{t('画幅', 'ratio')}</dt><dd>{e.ratio}</dd>
              <dt>{t('风格', 'style')}</dt><dd>{style ? style.name[lang] : e.styleId}</dd>
              <dt>{t('构图', 'comp')}</dt><dd>{e.picked.comp}{cur?.compMode === 'forced' ? ' · ' + t('强制', 'forced') : ''}</dd>
              {opts.showScore && <><dt>taste</dt><dd>{(e.picked.taste ?? tasteScore(cur!.scene)).toFixed(2)}</dd><dt>quality</dt><dd>{String(cur!.scene.info.score ?? '–')}</dd></>}
            </dl>}
            {!opts.showScore && <p className="hint">{t('分数默认隐藏，避免影响你的判断。', 'Scores are hidden by default so they don’t bias you.')}</p>}
          </div>
          <div className="sec"><div className="sec-h"><h3>{t('快捷键', 'Keys')}</h3></div>
            <div className="sc-grid one">{[['1 – 9', t('打分', 'Rate')], ['⇧ 1 – 8', t('加半分', '+0.5')], ['] / [', t('上一张 ±0.25', 'Last ±0.25')], ['← → ↓', t('A/B 模式', 'A/B mode')], ['0 / Space', t('跳过', 'Skip')], ['Z / ⌘Z', t('撤销', 'Undo')], ['I', t('显示分数', 'Show score')], ['E', t('导出 JSON', 'Export JSON')]].map(([k, l]) => <div key={k}><span>{l}</span><kbd>{k}</kbd></div>)}</div>
          </div>
        </div>
      </aside>

      <main className="rate-canvas">
        <div className="rate-frame">
          {ab ? <>
            {cur ? <div key={cur.entry.id} className="paper poster layer-in" style={{ right: '51.5%' }} data-qa="rate-a" onClick={() => judge('a')} dangerouslySetInnerHTML={{ __html: cur.svg }} /> : <div className="paper skeleton" style={{ right: '51.5%' }} />}
            {curB ? <div key={curB.entry.id} className="paper poster layer-in" style={{ left: '51.5%' }} data-qa="rate-b" onClick={() => judge('b')} dangerouslySetInnerHTML={{ __html: curB.svg }} /> : <div className="paper skeleton" style={{ left: '51.5%' }} />}
          </> : cur ? <div key={cur.entry.id} className="paper poster layer-in" dangerouslySetInnerHTML={{ __html: cur.svg }} /> : <div className="paper skeleton" />}
          {flash !== null && <div className="rate-flash mono">{flash}</div>}
        </div>
      </main>

      <div className="dock rate-dock">
        <div className="lg cap rate-keys" {...capProps}>
          {Array.from({ length: 9 }, (_, i) => (
            <button key={i} className={'rk press hl' + (flash === i + 1 ? ' on' : '')} data-rate={i + 1} disabled={!cur || ab} onClick={(ev) => (ev.shiftKey && i < 8 ? rate(i + 1.5, 0.5) : rate(i + 1))} title={(labels[i] ? labels[i] + ' · ' : '') + t('Shift+点击 = +0.5', 'Shift+click = +0.5')}>
              <span className="hl-glow" /><b className="mono">{i + 1}</b>{labels[i] && <small>{labels[i]}</small>}
            </button>
          ))}
        </div>
        <div className="lg cap" {...capProps}>
          <button className="remix press" data-qa="rate-skip" disabled={!cur} onClick={() => advance()}><Icon name="skip-forward" size={15} /><span className="rl">{t('跳过', 'Skip')}</span><kbd>0</kbd></button>
        </div>
      </div>
      {msg && <div className="toasts"><div className="lg toast strong"><Icon name="check" size={15} />{msg}</div></div>}
      {!ready && <Splash />}
    </div>
  );
}
