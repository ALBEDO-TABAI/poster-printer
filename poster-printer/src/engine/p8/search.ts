// Phase 8 search loop helpers: design-problem diagnosis of a candidate (which semantic mutation fixes it) and the
// MAP-Elites cell of a scene (lead × density × stability), so the candidates kept and shown stay diverse.
import type { Scene, SceneNode, TextNode } from '../types';

export type Lead = 'text' | 'balanced' | 'image';
export type Density = 'low' | 'mid' | 'high';
export type Stability = 'stable' | 'offset' | 'dynamic';
export interface Cell { lead: Lead; density: Density; stability: Stability }
export const cellKey = (c: Cell) => `${c.lead}/${c.density}/${c.stability}`;

/** semantic mutations, each tied to a design problem (encoded in the layout salt as `µX`, so replays are exact) */
export type Mutation = 'H' | 'I' | 'C' | 'M';
export const MUTATIONS: Record<Mutation, string> = {
  H: 'headline not dominant → coupled scale up of the headline, secondary type and spacing down',
  I: 'info fragmented / cramped → switch the info group between columns and a single list',
  C: 'image lacks tension → tighter crop on the subject (zoom), entry from the subject side',
  M: 'mood → new colour system on the same structure',
};

function flat(ns: SceneNode[], out: SceneNode[] = []): SceneNode[] { for (const n of ns) { if (n.kind === 'group') flat(n.children, out); else out.push(n); } return out; }

interface Stats { head: number; second: number; imgShare: number; chars: number; texts: number; headCx: number; headCy: number; rotated: boolean; breaks: number; infoClusters: number }
function stats(s: Scene): Stats {
  const ns = flat(s.nodes);
  const W = s.w, H = s.h, A = W * H, m = Math.min(W, H);
  const tx = ns.filter((n): n is TextNode => n.kind === 'text' && (n.opacity ?? 1) > 0.3);
  const sizes = tx.map((t) => t.size).sort((a, b) => b - a);
  const big = tx.reduce<TextNode | null>((a, t) => (!a || t.size > a.size ? t : a), null);
  let img = 0;
  for (const n of ns) if (n.kind === 'image' && !n.cutout && (n.opacity ?? 1) > 0.5) { const c = n.clip?.type === 'rect' ? n.clip : null; const w = c ? c.w : n.w, h = c ? c.h : n.h; img = Math.max(img, Math.min(A, Math.max(0, w) * Math.max(0, h)) / A); }
  const small = tx.filter((t) => big && t.size < big.size * 0.4);
  // info clusters: small texts more than 8u apart from each other
  const u = m / 100; const seen = new Set<number>(); let cl = 0;
  small.forEach((_, i) => {
    if (seen.has(i)) return; cl++; const st = [i]; seen.add(i);
    while (st.length) { const a = small[st.pop()!].box; small.forEach((t, j) => { if (seen.has(j)) return; const b = t.box; const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w)), dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h)); if (dx < u * 8 && dy < u * 4) { seen.add(j); st.push(j); } }); }
  });
  const sem = s.info?.sem as { breaks?: unknown[] } | undefined;
  return { head: (sizes[0] ?? 0) / m, second: (sizes[1] ?? 0) / m, imgShare: img, chars: tx.reduce((x, t) => x + (t.raw?.length ?? 0), 0), texts: tx.length,
    headCx: big ? (big.box.x + big.box.w / 2) / W : 0.5, headCy: big ? (big.box.y + big.box.h / 2) / H : 0.5, rotated: tx.some((t) => !!t.rotate || !!t.vertical), breaks: sem?.breaks?.length ?? 0, infoClusters: cl };
}

export function cellOf(s: Scene): Cell {
  const st = stats(s);
  const typeW = st.head * 2.2;
  const lead: Lead = st.imgShare > 0.45 && st.imgShare > typeW ? 'image' : st.imgShare < 0.15 || typeW > st.imgShare * 2 ? 'text' : 'balanced';
  const density: Density = st.chars < 45 && st.texts <= 6 ? 'low' : st.chars > 120 || st.texts > 14 ? 'high' : 'mid';
  const off = Math.abs(st.headCx - 0.5) + Math.abs(st.headCy - 0.5) * 0.5;
  const stability: Stability = st.rotated || st.breaks > 0 || st.head > 0.45 ? 'dynamic' : off > 0.18 ? 'offset' : 'stable';
  return { lead, density, stability };
}

/** which design problem a candidate shows most clearly (deterministic, from the scene graph) */
export function diagnose(s: Scene, comp: string): Mutation {
  const st = stats(s);
  const hier = st.second ? st.head / st.second : 9;
  if (hier < 2.6 || st.head < 0.07) return 'H';
  if (st.infoClusters > 3 && ['typeled', 'programme', 'exhibit', 'interleave'].includes(comp)) return 'I';
  if (st.imgShare > 0.12 && st.imgShare < 0.7) return 'C';
  return 'M';
}

export function parseMutation(salt: string | undefined): Mutation | null { const m = /µ([HICM])/.exec(salt ?? ''); return (m?.[1] as Mutation) ?? null; }
