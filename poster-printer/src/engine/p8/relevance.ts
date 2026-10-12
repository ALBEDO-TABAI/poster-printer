// Phase 8: content-aware picture choice for real copy. The copy's words (EN directly, CN through a small concept map)
// are matched against each picture's title and category; the result multiplies the picture's draw weight.
import type { PickedTexts } from '../gen/pick';

const ZH: [RegExp, string[]][] = [
  [/夜|晚|灯|星|月/, ['night', 'moon', 'star', 'lamp', 'light', 'lantern', 'dark', 'evening']],
  [/江|河|海|水|湖|码头|港|雨/, ['water', 'river', 'sea', 'harbor', 'harbour', 'lake', 'rain', 'bridge', 'wave', 'boat', 'shore']],
  [/城|街|路|楼|建筑|步行/, ['city', 'street', 'building', 'architecture', 'road', 'urban', 'tower', 'stair']],
  [/山|林|树|花|草|园/, ['mountain', 'forest', 'tree', 'flower', 'plant', 'garden', 'leaf']],
  [/声|音|乐|频|现场|演出/, ['sound', 'music', 'instrument', 'concert', 'speaker', 'record', 'cable', 'tower', 'wire']],
  [/讲|谈|对话|讲座|论坛|读/, ['book', 'library', 'paper', 'desk', 'chair', 'hall', 'room', 'portrait', 'head']],
  [/茶|咖啡|食|饭|面包/, ['tea', 'cup', 'coffee', 'bread', 'food', 'bowl']],
  [/展|摄影|画|艺术/, ['photograph', 'gallery', 'art', 'painting', 'museum', 'frame']],
];
const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'night', 'one', 'now', 'new', 'free', 'entry', 'by', 'of', 'a', 'an', 'to', 'in', 'on', 'at']);

export function contentRelevance(T: PickedTexts): (a: { title?: string; category?: string; tier?: string }) => number {
  const copy = [T.headline.t, T.sub.t, ...T.groups.slice(0, T.customItems ?? 3).flatMap((g) => [g.main.t, g.note.t]), ...T.prose.slice(0, 1).map((p) => p.t)].join(' ');
  const words = new Set<string>();
  for (const w of copy.toLowerCase().match(/[a-z]{3,}/g) ?? []) if (!STOP.has(w)) words.add(w.replace(/s$/, ''));
  for (const [re, ws] of ZH) if (re.test(copy)) ws.forEach((w) => words.add(w));
  if (/night/i.test(copy)) words.add('night');
  if (!words.size) return () => 1;
  return (a) => {
    const t = `${a.title ?? ''} ${a.category ?? ''}`.toLowerCase();
    let hit = 0;
    for (const w of words) if (t.includes(w)) hit++;
    return 1 + 2.5 * Math.min(2, hit);
  };
}

/**
 * Content fit of a candidate for real copy (0…1 penalty units): the share of the given items / meta the poster
 * actually shows, plus a cost for Latin words set as stacked vertical letters. The taste model cannot see either.
 */
export function contentMiss(scene: { nodes: unknown[] }, T: PickedTexts): number {
  if (!T.custom) return 0;
  const texts: { raw?: string; vertical?: boolean }[] = [];
  const walk = (ns: unknown[]) => { for (const n of ns as { kind: string; children?: unknown[]; raw?: string; vertical?: boolean }[]) { if (n.kind === 'group') walk(n.children ?? []); else if (n.kind === 'text') texts.push(n); } };
  walk(scene.nodes);
  const shown = texts.map((t) => t.raw ?? '').join(' ').replace(/\s+/g, '').toLowerCase();
  const want = [...T.groups.slice(0, T.customItems ?? 0).map((g) => g.main.t), ...T.meta.slice(0, T.customMeta ?? 0).map((m) => m.t)].filter(Boolean);
  const key = (s: string) => s.replace(/\s+/g, '').toLowerCase().slice(0, 6);
  const miss = want.length ? want.filter((w) => !shown.includes(key(w))).length / want.length : 0;
  const stacked = texts.some((t) => t.vertical && /[A-Za-z]{4,}/.test((t.raw ?? '').replace(/\n/g, ''))) ? 0.5 : 0;
  return miss + stacked;
}
