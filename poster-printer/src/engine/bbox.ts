import type { SceneNode } from './types';

export function nodeBoxOf(nd: SceneNode): { x: number; y: number; w: number; h: number } | null {
  switch (nd.kind) {
    case 'text': return nd.box;
    case 'rect': case 'image': return { x: nd.x, y: nd.y, w: nd.w, h: nd.h };
    case 'circle': return { x: nd.cx - nd.r, y: nd.cy - nd.r, w: nd.r * 2, h: nd.r * 2 };
    case 'line': return { x: Math.min(nd.x1, nd.x2), y: Math.min(nd.y1, nd.y2), w: Math.abs(nd.x2 - nd.x1) || 2, h: Math.abs(nd.y2 - nd.y1) || 2 };
    case 'path': {
      const nums = (nd.d.match(/-?\d+(\.\d+)?/g) || []).map(Number);
      if (nums.length < 2) return null;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i + 1 < nums.length; i += 2) { x0 = Math.min(x0, nums[i]); x1 = Math.max(x1, nums[i]); y0 = Math.min(y0, nums[i + 1]); y1 = Math.max(y1, nums[i + 1]); }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    case 'group': {
      const bs = nd.children.map(nodeBoxOf).filter(Boolean) as { x: number; y: number; w: number; h: number }[];
      if (!bs.length) return null;
      const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y));
      return { x: x0, y: y0, w: Math.max(...bs.map((b) => b.x + b.w)) - x0, h: Math.max(...bs.map((b) => b.y + b.h)) - y0 };
    }
  }
}
