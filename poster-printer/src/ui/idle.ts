// Phase 14: one shared idle queue for every background thumbnail (layout library, composition cards, style cards).
// Jobs run one per idle slot, so opening a panel never blocks the main thread with a burst of renders; a job keyed
// again is merged; a cancelled owner just drops its jobs.
import { useEffect, useState } from 'react';

type Job = { key: string; run: () => void; owner: object };
const q: Job[] = [];
let h = 0;
const ric: (f: IdleRequestCallback, o?: IdleRequestOptions) => number = typeof requestIdleCallback === 'function' ? requestIdleCallback : (f) => window.setTimeout(() => f({ didTimeout: true, timeRemaining: () => 8 } as IdleDeadline), 32);
// phase 20: while the layout glides (a panel opening / closing) background jobs wait, so no render lands mid-motion
let holdUntil = 0; let holdT = 0;
export function holdIdle(ms: number) {
  holdUntil = Math.max(holdUntil, performance.now() + ms);
  clearTimeout(holdT); holdT = window.setTimeout(pump, ms + 5);
}
function pump() {
  if (h || !q.length) return;
  if (performance.now() < holdUntil) { clearTimeout(holdT); holdT = window.setTimeout(pump, holdUntil - performance.now() + 5); return; }
  h = ric((dl) => {
    h = 0;
    if (performance.now() < holdUntil) { pump(); return; }
    // at least one job per slot; more only while the slot has real room left
    do { const j = q.shift(); if (!j) break; try { j.run(); } catch { /* a thumbnail failing is not fatal */ } } while (q.length && dl.timeRemaining() > 12);
    pump();
  }, { timeout: 700 });
}
export function idleJob(key: string, owner: object, run: () => void) {
  if (q.some((j) => j.key === key)) return;
  q.push({ key, run, owner }); pump();
}
export function dropJobs(owner: object) { for (let i = q.length - 1; i >= 0; i--) if (q[i].owner === owner) q.splice(i, 1); }

/** idle-computed values for a list of ids, cached across mounts in `cache` under `prefix + id` */
export function useIdleMap(ids: string[], prefix: string, cache: Map<string, string>, make: (id: string) => string): Record<string, string> {
  const [, bump] = useState(0);
  const sig = prefix + '|' + ids.join(',');
  useEffect(() => {
    const owner = {};
    let pending = 0; let raf = 0;
    const flush = () => { raf = 0; if (pending) { pending = 0; bump((n) => n + 1); } };
    for (const id of ids) if (!cache.has(prefix + id)) idleJob(prefix + id, owner, () => { cache.set(prefix + id, make(id)); pending++; if (!raf) raf = requestAnimationFrame(flush); });
    return () => { dropJobs(owner); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  const out: Record<string, string> = {};
  for (const id of ids) { const v = cache.get(prefix + id); if (v !== undefined) out[id] = v; }
  return out;
}
