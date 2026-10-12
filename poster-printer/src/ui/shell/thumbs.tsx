// Lazily rendered SVG thumbnails of history entries (computed when idle, cached per entry + edits).
import { useEffect, useState } from 'react';
import { entryScene, useStore, type Entry } from '../../store';
import { renderSVG } from '../../engine/render/svg';
import type { Scene } from '../../engine/types';

const cache = new Map<string, string>();
export const fitSvg = (svg: string) => svg.replace(/^<svg([^>]*?) width="[\d.]+" height="[\d.]+"/, '<svg$1 width="100%" height="100%" preserveAspectRatio="xMidYMid slice"');
const idle = (f: () => void) => (window.requestIdleCallback ? window.requestIdleCallback(f, { timeout: 600 }) : window.setTimeout(f, 30));
const unidle = (h: number) => (window.cancelIdleCallback ? window.cancelIdleCallback(h) : clearTimeout(h));

export function EntryThumb({ e, className = 'svgth' }: { e: Entry; className?: string }) {
  const key = e.id + JSON.stringify(e.edits || {}) + (e.placed?.length ?? 0);
  const [svg, setSvg] = useState(cache.get(key) || '');
  useEffect(() => {
    const c = cache.get(key); if (c) { setSvg(c); return; }
    const h = idle(() => { const sc = entryScene(e); const out = sc ? fitSvg(renderSVG(sc)) : ''; cache.set(key, out); setSvg(out); });
    return () => unidle(h);
  }, [key]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
export function SceneThumb({ scene, className = 'svgth' }: { scene: Scene | null; className?: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => { if (!scene) return; const h = idle(() => setSvg(fitSvg(renderSVG(scene)))); return () => unidle(h); }, [scene]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/* ---------- replay (shared by filmstrip, ⌘K and the export sheet) ---------- */
let stop = false;
export async function replay(list?: Entry[]) {
  const s = useStore.getState();
  if (s.replaying) { stop = true; return; }
  const l = list ?? (s.recorded.length ? s.recorded : s.history);
  if (!l.length) return;
  stop = false; s.set('replaying', true);
  const keep = s.scene;
  for (const e of l) {
    if (stop) break;
    const sc = entryScene(e); if (sc) useStore.setState({ scene: sc });
    await new Promise((r) => setTimeout(r, Number(useStore.getState().params.replaySpeed)));
  }
  useStore.setState({ scene: keep, replaying: false });
}
export function toggleRecording() {
  const s = useStore.getState();
  if (s.recording) useStore.setState({ recording: false }); else useStore.setState({ recording: true, recorded: [] });
  s.toast(!s.recording ? (s.lang === 'zh' ? '开始录制：之后的每次抽卡都会被记录' : 'Recording every draw from now') : (s.lang === 'zh' ? `录制已停止 · ${s.recorded.length} 张 · 可导出 WebM` : `Recording stopped · ${s.recorded.length} · export WebM`));
}
