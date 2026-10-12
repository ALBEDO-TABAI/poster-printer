// Curated CN + EN font pairings by mood. "Shake" draws from these instead of combining fonts at random:
// each row was chosen for matching stroke contrast, x-height / CJK face size and voice
// (a Didone with a Song/Ming face, a grotesk with Hei, a heavy condensed with a black Hei, …).
import type { FontRecipe } from '../engine/typo';

export type Mood = 'literary' | 'editorial' | 'swiss' | 'poster' | 'geometric' | 'technical' | 'avant';
export interface Pairing { id: string; mood: Mood; recipe: FontRecipe; ratio: number }

const P = (id: string, mood: Mood, ratio: number, recipe: FontRecipe): Pairing => ({ id, mood, ratio, recipe });
const up = { case: 'upper' as const };

export const PAIRINGS: Pairing[] = [
  // literary: old-style serifs + Song/Ming, quiet mono or small-caps captions
  P('lit-garamond', 'literary', 1.414, { display: ['Cormorant Garamond', 500], text: ['EB Garamond', 400], caption: ['IBM Plex Mono', 400, up], zhDisplay: ['Noto Serif SC', 600], zhText: ['Noto Serif SC', 400] }),
  P('lit-newsreader', 'literary', 1.414, { display: ['Fraunces', 500], text: ['Newsreader', 400], caption: ['DM Mono', 400, up], zhDisplay: ['Noto Serif SC', 700], zhText: ['Chiron Sung HK', 400] }),
  P('lit-spectral', 'literary', 1.333, { display: ['Spectral', 300], text: ['Spectral', 400], caption: ['Source Sans 3', 600, up], zhDisplay: ['Source Han Serif CN', 700], zhText: ['Noto Serif SC', 400] }),
  // editorial: high-contrast display serifs + clean grotesk text
  P('ed-dmserif', 'editorial', 1.5, { display: ['DM Serif Display', 400], text: ['Inter', 400], caption: ['Inter', 600, up], zhDisplay: ['Noto Serif SC', 900], zhText: ['Noto Sans SC', 400] }),
  P('ed-bodoni', 'editorial', 1.618, { display: ['Bodoni Moda', 700], text: ['Libre Franklin', 400], caption: ['Space Mono', 400, up], zhDisplay: ['Source Han Serif CN', 900], zhText: ['Noto Sans SC', 400] }),
  P('ed-instrument', 'editorial', 1.5, { display: ['Instrument Serif', 400], text: ['Instrument Sans', 400], caption: ['Geist Mono', 400, up], zhDisplay: ['Noto Serif SC', 500], zhText: ['Noto Sans SC', 300] }),
  P('ed-playfair', 'editorial', 1.5, { display: ['Playfair Display', 700], text: ['Source Serif 4', 400], caption: ['Inter', 500, up], zhDisplay: ['Source Han Serif CN', 700], zhText: ['Noto Serif SC', 400] }),
  // swiss: grotesks + Hei
  P('sw-intertight', 'swiss', 1.333, { display: ['Inter Tight', 700], text: ['Inter', 400], caption: ['Inter', 600, up], zhDisplay: ['Noto Sans SC', 700], zhText: ['Noto Sans SC', 400] }),
  P('sw-archivo', 'swiss', 1.333, { display: ['Archivo', 800], text: ['Archivo', 400], caption: ['IBM Plex Mono', 500, up], zhDisplay: ['Source Han Sans CN', 900], zhText: ['Noto Sans SC', 400] }),
  P('sw-schibsted', 'swiss', 1.414, { display: ['Schibsted Grotesk', 800], text: ['Hanken Grotesk', 400], caption: ['JetBrains Mono', 400, up], zhDisplay: ['Noto Sans SC', 800], zhText: ['Noto Sans SC', 400] }),
  P('sw-plex', 'swiss', 1.25, { display: ['IBM Plex Sans', 600], text: ['IBM Plex Sans', 400], caption: ['IBM Plex Mono', 400, up], zhDisplay: ['Noto Sans SC', 600], zhText: ['Noto Sans SC', 400] }),
  // poster: heavy condensed + black Hei
  P('po-anton', 'poster', 1.618, { display: ['Anton', 400, up], text: ['Work Sans', 400], caption: ['Work Sans', 600, up], zhDisplay: ['Source Han Sans CN', 900], zhText: ['Noto Sans SC', 400] }),
  P('po-bebas', 'poster', 1.618, { display: ['Bebas Neue', 400, up], text: ['Barlow', 400], caption: ['Barlow Condensed', 600, up], zhDisplay: ['Noto Sans SC', 900], zhText: ['Noto Sans SC', 400] }),
  P('po-shoulders', 'poster', 1.618, { display: ['Big Shoulders Display', 800, up], text: ['Libre Franklin', 400], caption: ['DM Mono', 400, up], zhDisplay: ['Source Han Sans CN', 900], zhText: ['Noto Sans SC', 400] }),
  P('po-oswald', 'poster', 1.5, { display: ['Oswald', 600, up], text: ['Source Serif 4', 400], caption: ['Oswald', 400, up], zhDisplay: ['Smiley Sans', 400], zhText: ['Noto Serif SC', 400] }),
  // geometric: round grotesks, friendly Hei
  P('ge-outfit', 'geometric', 1.333, { display: ['Outfit', 700], text: ['Outfit', 300], caption: ['Space Mono', 400, up], zhDisplay: ['Noto Sans SC', 700], zhText: ['Noto Sans SC', 300] }),
  P('ge-syne', 'geometric', 1.414, { display: ['Syne', 700], text: ['Manrope', 400], caption: ['Manrope', 600, up], zhDisplay: ['ZCOOL QingKe HuangYou', 400], zhText: ['Noto Sans SC', 400] }),
  P('ge-jost', 'geometric', 1.333, { display: ['Jost', 600], text: ['Jost', 400], caption: ['Jost', 500, up], zhDisplay: ['Noto Sans SC', 700], zhText: ['Noto Sans SC', 400] }),
  // technical: mono display, grotesk text
  P('te-martian', 'technical', 1.25, { display: ['Martian Mono', 700], text: ['IBM Plex Sans', 400], caption: ['IBM Plex Mono', 400, up], zhDisplay: ['Noto Sans SC', 700], zhText: ['Noto Sans SC', 400] }),
  P('te-space', 'technical', 1.333, { display: ['Space Mono', 700], text: ['Space Grotesk', 400], caption: ['Space Mono', 400, up], zhDisplay: ['Smiley Sans', 400], zhText: ['Noto Sans SC', 400] }),
  // avant: idiosyncratic display, restrained text
  P('av-bluu', 'avant', 1.5, { display: ['Bluu Next', 700], text: ['Karla', 400], caption: ['Fragment Mono', 400, up], zhDisplay: ['Chiron Sung HK', 800], zhText: ['Noto Serif SC', 400] }),
  P('av-sporting', 'avant', 1.5, { display: ['Sporting Grotesque', 700], text: ['Inter', 400], caption: ['Azeret Mono', 400, up], zhDisplay: ['Smiley Sans', 400], zhText: ['Noto Sans SC', 400] }),
  P('av-junction', 'avant', 1.414, { display: ['Junction', 700], text: ['Prociono', 400], caption: ['Junction', 300, up], zhDisplay: ['Chiron Hei HK', 700], zhText: ['Chiron Sung HK', 400] }),
];

export const MOOD_WEIGHTS: Record<Mood, number> = { literary: 2.2, editorial: 2.6, swiss: 3, poster: 2.4, geometric: 1.4, technical: 1, avant: 0.8 };
export const MOOD_LABELS: Record<Mood, [string, string]> = { literary: ['文学', 'Literary'], editorial: ['杂志', 'Editorial'], swiss: ['瑞士', 'Swiss'], poster: ['海报', 'Poster'], geometric: ['几何', 'Geometric'], technical: ['技术', 'Technical'], avant: ['先锋', 'Avant'] };
