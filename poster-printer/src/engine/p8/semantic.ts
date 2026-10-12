// Phase 8: scene semantics. A scene graph says WHERE things are; this layer says WHAT they are and HOW they relate,
// so search, mutation, gates and editing can act on design units instead of coordinates.
// Stored as an optional `scene.info.sem` (and an optional `sem` / `grp` on nodes): old scenes and old readers are unaffected.
import type { Scene, SceneNode, TextNode } from '../types';

/** communicative role of an element */
export type Role8 = 'headline' | 'explanation' | 'info' | 'action' | 'ornament' | 'image';

/** an information group: members move / scale / reflow together and keep their internal order */
export interface InfoGroup { id: string; role: Role8; members: string[]; order: 'stack' | 'row' | 'grid' | 'list'; box?: { x: number; y: number; w: number; h: number }; label?: string }

/** relation between two elements (or groups): anchor = b is positioned from a's edge; align = shared edge/axis; scale = size ratio */
export type Relation =
  | { type: 'align'; a: string; b: string; edge: 'left' | 'right' | 'top' | 'bottom' | 'cx' | 'cy' | 'baseline' }
  | { type: 'anchor'; a: string; b: string; side: 'above' | 'below' | 'left' | 'right' | 'inside'; gap: number }
  | { type: 'scale'; a: string; b: string; ratio: number };

/** image crop policy: the crop may move inside `allowed` (image fractions) but must keep `protect` (subject / face) visible */
export interface CropSpec { node: string; allowed?: { x: number; y: number; w: number; h: number }; protect?: { x: number; y: number; w: number; h: number }; busy?: number }

/** design variable: fixed (content / user), coupled (derived from another variable) or free (the search may mutate it) */
export interface VarSpec { kind: 'fixed' | 'coupled' | 'free'; value: number | string; from?: string; range?: [number, number] }

/** a deliberate rule break: overlap / bleed / interleave / crop-through are intentional here, not errors */
export interface Break { kind: 'overlap' | 'interleave' | 'bleed' | 'crop' | 'offgrid' | 'rotate' | 'scale-shock'; nodes: string[]; reason: string }

export interface SceneSemantics {
  v: 1;
  strategy?: string;
  roles: Record<string, Role8>;
  groups: InfoGroup[];
  relations: Relation[];
  /** paint order of the semantic layers, bottom first (e.g. ['ground','image','headline','subject','info']) */
  layers?: string[];
  crops: CropSpec[];
  vars: Record<string, VarSpec>;
  breaks: Break[];
}

export const emptySem = (): SceneSemantics => ({ v: 1, roles: {}, groups: [], relations: [], crops: [], vars: {}, breaks: [] });

/** role of a node from the legacy role strings (phases 1–7) */
export function legacyRole(n: SceneNode): Role8 | null {
  if (n.kind === 'image') return 'image';
  if (n.kind !== 'text') return n.layer === 'ornament' || n.layer === 'shapes' || n.layer === 'curves' || n.layer === 'lines' ? 'ornament' : null;
  const t = n as TextNode;
  if (t.tag === 'kit' || t.layer === 'ornament' || t.role === 'zone' || t.role === 'tick' || t.role === 'glyph') return 'ornament';
  if (t.role === 'big.main') return 'headline';
  if (t.role === 'big.sub' || t.role === 'big.note') return 'explanation';
  return 'info';
}

/** semantics of a scene: the stored layer when present, otherwise inferred (roles + stacked info groups) */
export function semanticsOf(scene: Scene): SceneSemantics {
  const stored = scene.info?.sem as SceneSemantics | undefined;
  if (stored && stored.v === 1) return stored;
  const sem = emptySem();
  const flat: SceneNode[] = [];
  const walk = (ns: SceneNode[]) => { for (const n of ns) { if (n.kind === 'group') walk(n.children); else flat.push(n); } };
  walk(scene.nodes);
  for (const n of flat) { const r = legacyRole(n); if (r) sem.roles[n.id] = r; }
  // stacked info groups: info texts with a shared left edge and small vertical gaps
  const info = flat.filter((n): n is TextNode => n.kind === 'text' && sem.roles[n.id] === 'info' && !!n.lines?.length).sort((a, b) => a.box.y - b.box.y);
  const u = Math.min(scene.w, scene.h) / 100;
  const used = new Set<string>();
  for (const t of info) {
    if (used.has(t.id)) continue;
    const g: TextNode[] = [t]; used.add(t.id);
    for (const o of info) {
      if (used.has(o.id)) continue;
      const last = g[g.length - 1];
      if (Math.abs(o.box.x - t.box.x) < u * 0.6 && o.box.y - (last.box.y + last.box.h) < u * 2.5 && o.box.y >= last.box.y) { g.push(o); used.add(o.id); }
    }
    sem.groups.push({ id: 'g' + sem.groups.length, role: 'info', members: g.map((x) => x.id), order: 'stack', box: unionBox(g.map((x) => x.box)) });
  }
  return sem;
}

export function unionBox(bs: { x: number; y: number; w: number; h: number }[]) {
  if (!bs.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y));
  const x1 = Math.max(...bs.map((b) => b.x + b.w)), y1 = Math.max(...bs.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** ids that a declared break licenses to overlap each other */
export function licensedPairs(sem: SceneSemantics | undefined): Set<string> {
  const s = new Set<string>();
  if (!sem) return s;
  for (const b of sem.breaks) if (b.kind === 'overlap' || b.kind === 'interleave') for (const a of b.nodes) for (const c of b.nodes) if (a !== c) s.add(a + '|' + c);
  return s;
}
export const licensedIds = (sem: SceneSemantics | undefined) => new Set((sem?.breaks ?? []).filter((b) => b.kind === 'overlap' || b.kind === 'interleave').flatMap((b) => b.nodes));

/** move every member of a group (texts, and anything tagged with the group id) as one unit */
export function moveGroup(scene: Scene, g: InfoGroup, dx: number, dy: number) {
  const ids = new Set(g.members);
  const walk = (ns: SceneNode[]) => {
    for (const n of ns) {
      if (n.kind === 'group') { walk(n.children); continue; }
      if (!ids.has(n.id) && (n as { grp?: string }).grp !== g.id) continue;
      if (n.kind === 'text') { n.box.x += dx; n.box.y += dy; for (const l of n.lines) { l.x += dx; l.y += dy; } }
      else if (n.kind === 'rect' || n.kind === 'image') { n.x += dx; n.y += dy; }
      else if (n.kind === 'circle') { n.cx += dx; n.cy += dy; }
      else if (n.kind === 'line') { n.x1 += dx; n.x2 += dx; n.y1 += dy; n.y2 += dy; }
    }
  };
  walk(scene.nodes);
  if (g.box) { g.box.x += dx; g.box.y += dy; }
}

/** summary used by the search archive and the exemplar retrieval */
export interface DesignProblem { titleLen: number; titleWords: number; zh: boolean; bilingual: boolean; infoItems: number; infoChars: number; hasImage: boolean; subject: 'none' | 'tall' | 'wide' | 'round' | 'scene'; emphasis: 'title' | 'image' | 'info' }
