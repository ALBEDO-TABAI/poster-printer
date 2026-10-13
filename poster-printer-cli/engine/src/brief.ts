// Brief schema (v1): what an agent fills after interviewing the user. Content first (the real copy), then intent.
// Every field is optional except content.title; unknown fields are reported back, never guessed.

export type Purpose = 'event' | 'exhibition' | 'talk' | 'product-launch' | 'sale' | 'announcement' | 'book' | 'film' | 'music' | 'personal' | 'other';
export interface ProgramItem { time?: string; title?: string; who?: string; note?: string }
export interface Person { name: string; role?: string; time?: string }
export interface BriefContent {
  title: string;
  /** the title in the other language (bilingual posters) */
  title_alt?: string;
  subtitle?: string;
  slogan?: string;
  /** ISO date/datetime ("2026-11-21", "2026-11-21T19:30") or free text ("11.21 SAT") */
  date?: string;
  date_end?: string;
  time?: string;
  venue?: string;
  address?: string;
  city?: string;
  organizers?: string[];
  speakers?: (string | Person)[];
  /** timetable / lineup / program items */
  program?: (string | ProgramItem)[];
  price?: string;
  ticket?: string;
  url?: string;
  qr_text?: string;
  body?: string;
  edition?: string;
  hashtags?: string[];
  credits?: string[];
  language?: 'zh' | 'en' | 'bilingual' | 'auto';
}
export interface BriefStyle {
  mood?: string[];
  era?: string;
  color?: { temperature?: 'warm' | 'cool' | 'neutral'; lightness?: 'light' | 'dark' | 'any'; chroma?: 'muted' | 'rich' | 'neon' | 'mono'; contrast?: 'gentle' | 'strong'; palette_tags?: string[]; must_include?: string[]; background?: 'light' | 'dark' | 'color' | 'auto' };
  typography?: { voice?: 'serif' | 'sans' | 'mono' | 'display' | 'script' | 'brush' | 'round' | 'mixed'; weight?: 'light' | 'regular' | 'heavy'; mood?: 'literary' | 'editorial' | 'swiss' | 'poster' | 'geometric' | 'technical' | 'avant'; case?: 'as-is' | 'upper' };
  density?: 'airy' | 'balanced' | 'packed' | number;
  /** pictures: `ids` (user images from `images add`, or catalogue ids) in importance order, the first is the hero;
   *  `files` are added as user images by the CLI and prepended to `ids`; `layout` picks the Swiss grid layout
   *  (phase 16); `count` asks for that many catalogue pictures when no ids are given */
  imagery?: { use?: 'none' | 'accent' | 'hero' | 'full-bleed'; subject?: string[]; ids?: string[]; files?: string[]; layout?: GridLayout; count?: number };
  texture?: 'flat' | 'grain' | 'paper' | 'riso' | 'halftone' | 'auto';
  references?: { kind: 'style-id' | 'poster-json' | 'note' | 'url'; value: string; note?: string }[];
  styles?: string[];
  ideas?: string[];
  avoid?: string[];
}
export interface BriefFormat { ratio?: string; count?: number; min_score?: number; formats?: string[]; scale?: number }
export type DisplayKind = 'phone-thumbnail' | 'phone' | 'screen' | 'print';
export interface BriefContext {
  /** what the poster is for: brand image, promotion, information, editorial, art */
  use?: 'brand' | 'promo' | 'info' | 'editorial' | 'art';
  audience?: string;
  /** where it is seen: drives the contrast (large-text threshold) and minimum text size checks */
  display?: { kind?: DisplayKind; width_px?: number; print_size?: string; viewing_distance_m?: number };
  /** information priority, most important first (content field keys, e.g. ["title","date","venue","program"]) */
  priority?: string[];
}
export interface Brief {
  $schema?: string;
  context?: BriefContext;
  purpose?: Purpose;
  content: BriefContent;
  style?: BriefStyle;
  format?: BriefFormat;
  constraints?: { seed?: string; must_show?: string[]; avoid_ideas?: string[] };
}

export const PURPOSES: Purpose[] = ['event', 'exhibition', 'talk', 'product-launch', 'sale', 'announcement', 'book', 'film', 'music', 'personal', 'other'];
export const MOODS = ['calm', 'bold', 'playful', 'elegant', 'technical', 'literary', 'raw', 'retro', 'futuristic', 'warm', 'minimal', 'traditional', 'editorial', 'loud', 'luxurious', 'dark'];
export const ERAS = ['swiss', 'bauhaus', 'art-deco', '70s', '80s', '90s', 'y2k', 'contemporary', 'east-traditional', 'newspaper', 'brutalist'];
export const RATIOS = ['3:4', '9:16', '1:1', '4:3', '16:9', '21:9'];
export const IDEA_IDS = ['scale', 'substitution', 'occlusion', 'anomaly', 'reveal', 'tension', 'emptiness', 'data', 'hanzi', 'split', 'orbit', 'voice', 'specimen', 'immersion', 'grid'];
/** phase 16: Swiss grid layouts for several pictures (modular: hero / flow / steps / strip / blocks; bleed grid: mosaic / rows); 'single' = one-picture compositions */
export const GRID_LAYOUTS = ['auto', 'hero', 'flow', 'steps', 'strip', 'blocks', 'mosaic', 'rows', 'single'] as const;
export type GridLayout = typeof GRID_LAYOUTS[number];

const str = { type: 'string' };
const strs = { type: 'array', items: str };
/** JSON Schema (draft 2020-12) of the brief */
export const BRIEF_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'ready-poster-printer/brief.v1', title: 'Ready Poster Printer brief', type: 'object', required: ['content'],
  properties: {
    purpose: { enum: PURPOSES },
    content: {
      type: 'object', required: ['title'], properties: {
        title: str, title_alt: str, subtitle: str, slogan: str, date: { ...str, description: 'ISO date/datetime or free text' }, date_end: str, time: str,
        venue: str, address: str, city: str, organizers: strs,
        speakers: { type: 'array', items: { anyOf: [str, { type: 'object', required: ['name'], properties: { name: str, role: str, time: str } }] } },
        program: { type: 'array', items: { anyOf: [str, { type: 'object', properties: { time: str, title: str, who: str, note: str, act: str, name: str, artist: str, by: str, role: str }, description: 'title may also be given as act / name / artist; who as by; note as role' }] } },
        price: str, ticket: str, url: str, qr_text: str, body: str, edition: str, hashtags: strs, credits: strs, language: { enum: ['zh', 'en', 'bilingual', 'auto'] },
      },
    },
    style: {
      type: 'object', properties: {
        mood: { type: 'array', items: { enum: MOODS } }, era: { enum: ERAS },
        color: { type: 'object', properties: { temperature: { enum: ['warm', 'cool', 'neutral'] }, lightness: { enum: ['light', 'dark', 'any'] }, chroma: { enum: ['muted', 'rich', 'neon', 'mono'] }, contrast: { enum: ['gentle', 'strong'] }, palette_tags: strs, must_include: strs, background: { enum: ['light', 'dark', 'color', 'auto'] } } },
        typography: { type: 'object', properties: { voice: { enum: ['serif', 'sans', 'mono', 'display', 'script', 'brush', 'round', 'mixed'] }, weight: { enum: ['light', 'regular', 'heavy'] }, mood: { enum: ['literary', 'editorial', 'swiss', 'poster', 'geometric', 'technical', 'avant'] }, case: { enum: ['as-is', 'upper'] } } },
        density: { anyOf: [{ enum: ['airy', 'balanced', 'packed'] }, { type: 'integer', minimum: 1, maximum: 5 }] },
        imagery: { type: 'object', properties: { use: { enum: ['none', 'accent', 'hero', 'full-bleed'] }, subject: strs, ids: { ...strs, description: 'picture ids in importance order (first = hero)' }, files: { ...strs, description: 'image files; the CLI adds them as user images (ids prepended)' }, layout: { enum: GRID_LAYOUTS, description: 'Swiss grid layout for several pictures' }, count: { type: 'integer', minimum: 1, maximum: 8, description: 'catalogue pictures to use when no ids are given' } } },
        texture: { enum: ['flat', 'grain', 'paper', 'riso', 'halftone', 'auto'] },
        references: { type: 'array', items: { type: 'object', required: ['kind', 'value'], properties: { kind: { enum: ['style-id', 'poster-json', 'note', 'url'] }, value: str, note: str } } },
        styles: strs, ideas: { type: 'array', items: { enum: IDEA_IDS } }, avoid: strs,
      },
    },
    format: { type: 'object', properties: { ratio: { enum: RATIOS }, count: { type: 'integer', minimum: 1, maximum: 48 }, min_score: { type: 'number', minimum: 1, maximum: 10 }, formats: strs, scale: { type: 'number' } } },
    constraints: { type: 'object', properties: { seed: str, must_show: strs, avoid_ideas: strs } },
    context: {
      type: 'object', description: 'use, audience, display condition and information priority (drive the correctness checks and the hierarchy)', properties: {
        use: { enum: ['brand', 'promo', 'info', 'editorial', 'art'] }, audience: str,
        display: { type: 'object', properties: { kind: { enum: ['phone-thumbnail', 'phone', 'screen', 'print'] }, width_px: { type: 'number', description: 'rendered width in CSS px (screens)' }, print_size: { type: 'string', description: 'A0–A5 or "WxH mm"' }, viewing_distance_m: { type: 'number' } } },
        priority: { type: 'array', items: { type: 'string' }, description: 'content field keys, most important first; the first fields are the ones that must be rendered' },
      },
    },
  },
} as const;

export interface Issue { path: string; msg: string }
/** structural validation (no external validator): returns errors (fatal) and warnings (ignored fields) */
export function validateBrief(b: unknown): { errors: Issue[]; warnings: Issue[] } {
  const errors: Issue[] = [], warnings: Issue[] = [];
  if (!b || typeof b !== 'object') return { errors: [{ path: '', msg: 'brief must be a JSON object' }], warnings };
  const o = b as Record<string, unknown>;
  const known = (obj: Record<string, unknown>, keys: string[], path: string) => { for (const k of Object.keys(obj)) if (!keys.includes(k)) warnings.push({ path: path + k, msg: 'unknown field (ignored)' }); };
  known(o, ['$schema', 'purpose', 'content', 'style', 'format', 'constraints', 'context'], '');
  const cx = o.context as Record<string, unknown> | undefined;
  if (cx && typeof cx === 'object') {
    known(cx, ['use', 'audience', 'display', 'priority'], 'context.');
    if (Array.isArray(cx.priority)) for (const k of cx.priority) if (!Object.keys(BRIEF_SCHEMA.properties.content.properties).includes(String(k))) warnings.push({ path: 'context.priority', msg: `"${k}" is not a content field (ignored)` });
    const d = cx.display as Record<string, unknown> | undefined;
    if (d && d.kind !== undefined && !['phone-thumbnail', 'phone', 'screen', 'print'].includes(String(d.kind))) errors.push({ path: 'context.display.kind', msg: 'one of phone-thumbnail|phone|screen|print' });
    if (d && d.print_size !== undefined && !/^(A[0-5]|\d+(\.\d+)?\s*[x×]\s*\d+(\.\d+)?\s*mm)$/i.test(String(d.print_size))) errors.push({ path: 'context.display.print_size', msg: 'A0–A5 or "420x594 mm"' });
  }
  const c = o.content as Record<string, unknown> | undefined;
  if (!c || typeof c !== 'object') errors.push({ path: 'content', msg: 'content is required' });
  else {
    if (typeof c.title !== 'string' || !c.title.trim()) errors.push({ path: 'content.title', msg: 'content.title is required (the real title of the poster)' });
    known(c, Object.keys(BRIEF_SCHEMA.properties.content.properties), 'content.');
    for (const k of ['organizers', 'hashtags', 'credits', 'speakers', 'program']) if (c[k] !== undefined && !Array.isArray(c[k])) errors.push({ path: 'content.' + k, msg: 'must be an array' });
    if (c.date !== undefined && typeof c.date !== 'string') errors.push({ path: 'content.date', msg: 'must be a string' });
  }
  if (o.purpose !== undefined && !PURPOSES.includes(o.purpose as Purpose)) warnings.push({ path: 'purpose', msg: `unknown purpose "${o.purpose}" (treated as other); one of ${PURPOSES.join('|')}` });
  const s = o.style as Record<string, unknown> | undefined;
  if (s && typeof s === 'object') {
    known(s, Object.keys(BRIEF_SCHEMA.properties.style.properties), 'style.');
    if (Array.isArray(s.mood)) for (const m of s.mood) if (!MOODS.includes(String(m))) warnings.push({ path: 'style.mood', msg: `unknown mood "${m}" (ignored); known: ${MOODS.join(', ')}` });
    if (s.era !== undefined && !ERAS.includes(String(s.era))) warnings.push({ path: 'style.era', msg: `unknown era "${s.era}" (ignored); known: ${ERAS.join(', ')}` });
    if (Array.isArray(s.ideas)) for (const m of s.ideas) if (!IDEA_IDS.includes(String(m))) errors.push({ path: 'style.ideas', msg: `unknown idea "${m}"; one of ${IDEA_IDS.join(', ')}` });
    const im = s.imagery as Record<string, unknown> | undefined;
    if (im && typeof im === 'object') {
      known(im, ['use', 'subject', 'ids', 'files', 'layout', 'count'], 'style.imagery.');
      if (im.layout !== undefined && !(GRID_LAYOUTS as readonly string[]).includes(String(im.layout))) errors.push({ path: 'style.imagery.layout', msg: `one of ${GRID_LAYOUTS.join(', ')}` });
      for (const k of ['ids', 'files', 'subject']) if (im[k] !== undefined && !Array.isArray(im[k])) errors.push({ path: 'style.imagery.' + k, msg: 'must be an array' });
      if (Array.isArray(im.ids) && im.ids.length > 8) warnings.push({ path: 'style.imagery.ids', msg: `${im.ids.length} pictures: the grid layouts show at most 8 (the first 8 are used)` });
      if (im.count !== undefined && !(Number.isInteger(im.count) && Number(im.count) >= 1 && Number(im.count) <= 8)) errors.push({ path: 'style.imagery.count', msg: 'an integer 1–8' });
    }
  }
  const f = o.format as Record<string, unknown> | undefined;
  if (f && typeof f === 'object') {
    if (f.ratio !== undefined && !RATIOS.includes(String(f.ratio))) errors.push({ path: 'format.ratio', msg: `ratio must be one of ${RATIOS.join(', ')}` });
    if (f.count !== undefined && !(Number.isInteger(f.count) && (f.count as number) >= 1 && (f.count as number) <= 48)) errors.push({ path: 'format.count', msg: 'count must be an integer 1–48' });
    if (f.min_score !== undefined && !(typeof f.min_score === 'number' && f.min_score >= 1 && f.min_score <= 10)) errors.push({ path: 'format.min_score', msg: 'min_score is on the taste scale 1–10' });
  }
  return { errors, warnings };
}

export function briefTemplate(lang: 'zh' | 'en' = 'en'): Brief {
  return lang === 'zh'
    ? { $schema: 'ready-poster-printer/brief.v1', purpose: 'talk', content: { title: '（标题）', subtitle: '', date: '2026-11-21T19:30', venue: '', organizers: [], speakers: [], program: [], price: '', url: '', body: '', language: 'zh' }, context: { use: 'info', audience: '', display: { kind: 'screen' }, priority: ['title', 'date', 'venue'] }, style: { mood: ['calm'], density: 'balanced', imagery: { use: 'accent' }, color: { background: 'auto' } }, format: { ratio: '3:4', count: 6, min_score: 6 } }
    : { $schema: 'ready-poster-printer/brief.v1', purpose: 'event', content: { title: '(title)', subtitle: '', date: '2026-11-21T19:30', venue: '', organizers: [], speakers: [], program: [], price: '', url: '', body: '', language: 'en' }, context: { use: 'promo', audience: '', display: { kind: 'screen' }, priority: ['title', 'date', 'venue'] }, style: { mood: ['bold'], density: 'balanced', imagery: { use: 'accent' }, color: { background: 'auto' } }, format: { ratio: '3:4', count: 6, min_score: 6 } };
}
