import type { Palette } from './color/palette';

export type Ratio = '3:4' | '9:16' | '1:1' | '4:3' | '16:9' | '21:9' | '1:2.1';
export const RATIOS: Ratio[] = ['3:4', '9:16', '1:1', '4:3', '16:9', '21:9', '1:2.1'];
export function canvasSize(r: Ratio): [number, number] {
  const [a, b] = r.split(':').map(Number);
  const short = 1200;
  return a < b ? [short, Math.round((short * b) / a)] : [Math.round((short * a) / b), short];
}

export type LayerKey = 'bg' | 'zones' | 'lines' | 'curves' | 'noise' | 'texture' | 'text' | 'ornament' | 'shapes' | 'images' | 'sidebar' | 'band';
export const LAYERS: LayerKey[] = ['bg', 'zones', 'lines', 'curves', 'noise', 'texture', 'text', 'ornament', 'shapes', 'images', 'sidebar', 'band'];

export type ModeKey = 'experimental' | 'card' | 'clash' | 'random' | 'layered' | 'nice' | 'wada' | 'brushImage' | 'brushMask' | 'bandMask';
export const MODES: ModeKey[] = ['experimental', 'card', 'clash', 'random', 'layered', 'nice', 'wada', 'brushImage', 'brushMask', 'bandMask'];

export type Shape =
  | { type: 'rect'; x: number; y: number; w: number; h: number; rx?: number }
  | { type: 'path'; d: string }
  | { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'text'; lines: { text: string; x: number; y: number }[]; size: number; family: string; weight: number; tracking?: number; anchor?: 'start' | 'middle' | 'end' }
  | { type: 'union'; shapes: Shape[] };

export interface ImgFilter { sat?: number; bright?: number; contrast?: number; duotone?: [string, string]; blur?: number; grayscale?: boolean; invert?: boolean }

interface NodeBase { id: string; layer: LayerKey; opacity?: number; clip?: Shape; blend?: string; locked?: boolean; tag?: string }
export interface RectNode extends NodeBase { kind: 'rect'; x: number; y: number; w: number; h: number; fill: string; rx?: number; stroke?: string; sw?: number }
export interface PathNode extends NodeBase { kind: 'path'; d: string; rule?: 'evenodd'; fill?: string; stroke?: string; sw?: number; dash?: string; cap?: 'round' | 'butt' | 'square' }
export interface CircleNode extends NodeBase { kind: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number; dash?: string }
export interface LineNode extends NodeBase { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number; dash?: string }
export interface ImageNode extends NodeBase {
  kind: 'image'; imageId: string; src: string; iw: number; ih: number;
  x: number; y: number; w: number; h: number; // frame (covered with slice fit)
  fx: number; fy: number; zoom: number; // focus & zoom
  filter?: ImgFilter; overlay?: { color: string; opacity: number; blend?: string };
  cutout?: boolean; // render the cut-out (alpha) version
  /** print as a halftone screen: ink dots on paper, dot density following the photo's darkness */
  halftone?: { ink: string; paper: string; cell: number };
}
export interface TextLine { text: string; x: number; y: number } // y is baseline
export interface TextNode extends NodeBase {
  kind: 'text'; role: string; lang: 'zh' | 'en';
  lines: TextLine[]; size: number; family: string; fallback?: string; weight: number; tracking: number; italic?: boolean;
  fill: string; anchor: 'start' | 'middle' | 'end';
  box: { x: number; y: number; w: number; h: number }; // layout box for editing/hit-testing
  raw: string; rotate?: number; vertical?: boolean; stroke?: string; sw?: number;
  /** phase 18: the text this node is part of (a construction sets each line and script run as its own node; readers
   *  that match copy join the nodes of one unit in order). Renderers ignore it. */
  unit?: string;
}
export interface GroupNode extends NodeBase { kind: 'group'; children: SceneNode[]; transform?: string }
export type SceneNode = RectNode | PathNode | CircleNode | LineNode | ImageNode | TextNode | GroupNode;

export interface Scene {
  w: number; h: number;
  bg: string;
  nodes: SceneNode[];
  tune?: { contrast: number; saturation: number; brightness: number };
  texture?: { kind: string; amount: number; color: string };
  palette: Palette;
  info: Record<string, unknown>;
}
