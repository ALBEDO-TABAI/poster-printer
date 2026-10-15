// Start screen: the README banner's content (name, tagline, counts, repo), with the loading bar as its rule.
import { useEffect, useRef, useState } from 'react';
import { APP_AUTHOR, APP_NAME, APP_REPO, APP_VERSION } from '../config';
import { PARAMS } from '../engine/params';
import { RATIOS } from '../engine/types';
import { SELECT_K } from '../store';
import { PALETTE_COUNT } from '../lib/assets';

const comp = PARAMS.find((p) => p.key === 'composition');
export const SPLASH_STATS: [number, string, string][] = [
  [comp?.type === 'seg' ? comp.options.filter((o) => o.v !== 'auto').length : 0, '种构图手法', 'Compositions'],
  [PALETTE_COUNT, '套配色', 'Palettes'],
  [RATIOS.length, '种画幅', 'Formats'],
  [SELECT_K, '个候选里挑最好', 'Drafts per pull'],
];

/** The bar fills over FILL_MS but never runs ahead of loading: each `loadMsg` stage of `init()` caps it. */
const STAGE: Record<string, number> = { start: 0.15, fonts: 0.35, images: 0.7, '': 0.9 };
const FILL_MS = 2000, HOLD_MS = 250, FADE_MS = 380;
const ease = (t: number) => (t >= 1 ? 1 : 0.5 - Math.cos(Math.PI * Math.max(0, t)) / 2);

/**
 * `msg` is the store's loadMsg and `ready` its ready flag: the bar fills to the end, holds, and the
 * splash fades out and calls `onDone`. Without `msg` the bar runs as an indeterminate loop.
 */
export function Splash({ msg, ready, onDone }: { msg?: string; ready?: boolean; onDone?: () => void }) {
  const bar = useRef<HTMLElement>(null);
  const live = useRef({ msg, ready, onDone });
  live.current = { msg, ready, onDone };
  const [out, setOut] = useState(false);
  const loop = msg === undefined;
  useEffect(() => {
    if (loop) return;
    let raf = 0, p = 0, full = 0, timer = 0;
    const t0 = performance.now();
    let last = t0;
    const tick = (now: number) => {
      const { msg: m = '', ready: r } = live.current;
      const goal = Math.min(r ? 1 : STAGE[m] ?? 0.9, ease((now - t0) / FILL_MS));
      p += (goal - p) * Math.min(1, (now - last) / 90);
      last = now;
      if (goal === 1 && p > 0.997) p = 1;
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
      if (p === 1 && !full) full = now;
      if (full && now - full >= HOLD_MS) { setOut(true); timer = window.setTimeout(() => live.current.onDone?.(), FADE_MS); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [loop]);
  const error = msg?.startsWith('error') ? msg : '';
  return (
    <div className={'splash' + (out ? ' out' : '')} role="status" aria-label={APP_NAME}>
      <div className="sp-art">
        <p className="sp-kicker">Open-source poster generator · macOS / Windows · v{APP_VERSION}</p>
        <h1>{APP_NAME}</h1>
        <p className="sp-zh">随手一抽，就是一张设计师水准的海报。</p>
        <p className="sp-en">One random pull, and you’ve got a designer-level poster.</p>
        <div className={'load-bar' + (loop ? ' loop' : '')}><i ref={bar} /></div>
        {error && <small className="sp-msg">{error}</small>}
        <ul className="sp-stats">
          {SPLASH_STATS.map(([n, zh, en]) => <li key={en}><b>{n}</b><span>{zh}</span><small>{en}</small></li>)}
        </ul>
        <p className="sp-repo">github.com/{APP_REPO}</p>
        <p className="sp-credit">Created by {APP_AUTHOR} · AGPL-3.0</p>
      </div>
    </div>
  );
}
