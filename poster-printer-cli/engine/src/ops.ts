// Op dispatch shared by both backends (payloads and results are plain JSON).
import { generateCandidates, replay, render, refine, variations, audit, deck, summarize, type Env, type Entry, type RenderOpts } from './core';
import { renderSVG } from '@rea/engine/render/svg';

export async function runOp(env: Env, op: string, p: any): Promise<unknown> {
  switch (op) {
    case 'generate': return generateCandidates(env, p);
    case 'render': {
      const e: Entry = p.entry;
      const r = await replay(env, e);
      const out: Record<string, unknown> = { summary: summarize(e, r.scene), rendered: await render(env, r.scene, p.render as RenderOpts) };
      // plain SVG (no fonts, images embedded) is the comparison format of the round-trip test (= app __reaSVG)
      if (p.plainSvg) out.svgPlain = await env.svg(r.scene, false);
      if (p.scene) out.scene = r.scene;
      return out;
    }
    case 'refine': return refine(env, p);
    case 'variations': return variations(env, p);
    case 'audit': return audit(env, p.entry, p.brief ?? null);
    case 'deck': return deck(env, p);
    case 'svg.raw': { const r = await replay(env, p.entry); return { svg: renderSVG(r.scene) }; }
    default: throw Object.assign(new Error('unknown op ' + op), { code: 2 });
  }
}
