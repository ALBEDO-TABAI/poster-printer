import type { Scene, SceneNode, TextNode } from '../engine/types';

export interface NodeEdit { dx?: number; dy?: number; raw?: string; fx?: number; fy?: number; zoom?: number; hidden?: boolean; scale?: number; fill?: string }
export type Edits = Record<string, NodeEdit>;

function retext(t: TextNode, raw: string): TextNode {
  const lines = raw.split('\n');
  const lh = t.lines.length > 1 ? t.lines[1].y - t.lines[0].y : t.size * 1.12;
  const x = t.lines[0]?.x ?? t.box.x;
  const y0 = t.lines[0]?.y ?? t.box.y + t.size;
  return { ...t, raw, lines: lines.map((s, i) => ({ text: s, x, y: y0 + i * lh })), box: { ...t.box, h: Math.max(t.box.h, lh * lines.length) } };
}

function scaleText(t: TextNode, k: number): TextNode {
  const ox = t.box.x, oy = t.box.y;
  return {
    ...t, size: t.size * k,
    lines: t.lines.map((l) => ({ ...l, x: ox + (l.x - ox) * k, y: oy + (l.y - oy) * k })),
    box: { x: ox, y: oy, w: t.box.w * k, h: t.box.h * k },
  };
}

function applyOne(nd: SceneNode, e: NodeEdit | undefined): SceneNode | null {
  if (!e) return nd;
  if (e.hidden) return null;
  let out: SceneNode = nd;
  if (out.kind === 'text') {
    if (e.raw !== undefined && e.raw !== out.raw) out = retext(out, e.raw);
    if (e.scale && e.scale !== 1) out = scaleText(out, e.scale);
    if (e.fill) out = { ...out, fill: e.fill };
  }
  if (out.kind === 'image' && (e.fx !== undefined || e.fy !== undefined || e.zoom !== undefined)) {
    out = { ...out, fx: e.fx ?? out.fx, fy: e.fy ?? out.fy, zoom: e.zoom ?? out.zoom };
  }
  if ((e.dx || e.dy) && out) {
    out = { kind: 'group', id: out.id + '~mv', layer: out.layer, children: [out], transform: `translate(${(e.dx || 0).toFixed(1)} ${(e.dy || 0).toFixed(1)})` };
  }
  return out;
}

export function applyEdits(scene: Scene, edits: Edits): Scene {
  if (!edits || !Object.keys(edits).length) return scene;
  const walk = (nodes: SceneNode[]): SceneNode[] =>
    nodes.flatMap((nd) => {
      let x: SceneNode | null = nd;
      if (x.kind === 'group' && !edits[x.id]) x = { ...x, children: walk(x.children) };
      x = applyOne(x, edits[nd.id]);
      return x ? [x] : [];
    });
  return { ...scene, nodes: walk(scene.nodes) };
}

export function findNode(scene: Scene, id: string): SceneNode | null {
  const walk = (nodes: SceneNode[]): SceneNode | null => {
    for (const nd of nodes) {
      if (nd.id === id) return nd;
      if (nd.kind === 'group') { const r = walk(nd.children); if (r) return r; }
    }
    return null;
  };
  return walk(scene.nodes);
}

/** bounding box of a node (approximate for paths) */
export { nodeBoxOf as nodeBox } from '../engine/bbox';
