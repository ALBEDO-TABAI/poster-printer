# REA Poster: design principles (phase 3)

These notes come from studying the reference keyframes in `lotgo-research/keyframes` and `crops`. The reference is studied, not copied.
No names, copy, images or style names are reused. The point is to write down *why* the good posters work, as measurable
rules, and then encode those rules in the generator (`src/engine/gen/direction.ts`) and the quality scorer
(`src/engine/gen/audit.ts → designAudit`, folded into `quality.ts`).

All sizes below are in canvas units `u = min(W,H)/100`.

## 1. One focal point, three or four type levels

* Every reference poster has exactly **one** dominant element. It is either a display word (often fitted edge to edge
  across the content width, 15–30 % of the poster height) or a single large image. Nothing else comes close in size.
* Below it, the type falls in **big, regular steps**. There are effectively 3–4 levels: display, headline (≈ 4–6 u),
  label (≈ 1.6–2.2 u) and micro/meta (≈ 0.9–1.2 u). Adjacent levels differ by about ×1.5 or more, and
  display/headline is often ×3–×6. There are no "almost the same" sizes.
* **Rule**: snap every non-display size to a modular scale (ratio 1.25–1.618 per style mood; display is exempt
  because it is fitted). Second-largest text ≤ focal / ratio². **Score**: focal dominance (largest ÷ second largest
  < 1.5 is penalised), number of distinct sizes > 6 is penalised.

## 2. Few text blocks

* Typical inventory: a display word, one headline group (title plus a one-line sub), 2–4 small "label + 2-line note"
  groups, a meta row of at most 3 items along one edge, and optionally one prose paragraph. That is **5–8 blocks**,
  never 15 scattered snippets.
* **Rule**: block budget by canvas (portrait 8, square 8, wide 9). Over budget, the lowest-priority blocks are removed
  first: pure-note groups far from any grid edge, then extra label groups. **Score**: −3 per block over budget.

## 3. Grid edges and margins

* Text groups start on **column edges**. Right-hand stacks share one right edge. The meta row sits on the margin line
  and is distributed left / centre / right. Outer margins are equal on all four sides (≈ 3.5–5 % of the short side).
* **Rule**: clusters snap their alignment edge to the nearest column edge (within 2 u) or to the content margin.
  First baselines of side-by-side groups are aligned (cross-column baseline alignment). Manual drags in the editor snap
  to the same column edges and margins. **Score**: share of blocks whose edge sits on a column/margin edge.

## 4. Whitespace

* At least ~35–40 % of every reference poster is *quiet*: one flat colour, or a calm, low-detail part of the photo.
  Text never fills a region edge to edge except the fitted display word.
* **Rule**: block budget + decoration budget. Wide (16:9 / 21:9) centred layouts get a structural anchor (image panel
  or display word) instead of floating in emptiness. **Score**: quiet ratio outside 0.3–0.8 is penalised (sampled on a
  24×24 grid: background colour, no text, low image detail).

## 5. Images and crops

* Images fill a whole grid cell / column or bleed off the edge. The **subject is kept whole**: heads, the top of a
  building, the vase silhouette. Crops never slice through the subject's top. Cut-outs overlap the display word for
  depth (the word is behind the subject, never covering a face).
* Text sits on the **calm** part of an image (sky, wall, shadow). When it has to sit on detail, the image gets a soft
  gradient scrim on that side (one gradient, never a hard box).
* **Rule**: `scripts/analyze-images.py` precomputes per image `focus`, a `subject` bbox (spectral-residual + colour
  saliency, or the alpha mask for cut-outs) and a 16×16 `detail` map. `Ctx.image` computes the crop anchor so the subject
  bbox stays inside the frame, with a little headroom above. The direction pass adds a gradient scrim under text
  clusters whose image area is busy (mean detail > 0.36). **Score**: −5 per text block on a busy area with no scrim.

## 6. Colour proportion (60 / 30 / 10)

* The ground colour takes ~55–70 %, the second colour (image or block) 20–35 %, and the accent ≤ 10 %: rules, a
  label, an icon, one word. The accent is the most saturated colour on the page. Muddy mid browns and olives are
  avoided: earth tones show up either as rich deep espresso or as clear ochre and terracotta.
* **Rule**: palettes are scored for harmony in OKLCH (hue relationship, lightness separation, a single chroma peak,
  no muddy mids) and the best of several candidates is used. Image-derived palettes are de-mudded and the accent is
  boosted. Accent-filled areas above 15 % of the canvas are recoloured to the secondary colour. **Score**: accent share
  > 15 % and low harmony are penalised.

## 7. Decoration is punctuation

* At most **two** decorative marks: one small icon in a corner plus perhaps a script signature, or grid ticks. They live
  in the margins and corners, never on the focal word or on a face. Large geometric curves appear only when the poster
  is otherwise very quiet (no photo).
* **Rule**: decoration budget (2–3 items depending on the `ornaments` parameter). Ghost glyphs are dropped when a
  fitted display word already exists, curves are capped when an image is present, and ornaments that overlap
  text or images are removed first. **Score**: −3 per decorative item over budget.

## 8. Typography details

* Display type is set **tight** (tracking −1 % to −3 %, leading 0.85–0.95). Small caps and labels are set **loose**
  (+6 % to +12 %). Body text stays neutral. Tracking is a function of size (optical tracking), not a constant.
* CJK: full-width punctuation is compressed (half-width at line ends and between consecutive marks), and closing
  punctuation **hangs** into the margin rather than forcing a break. Kinsoku rules still apply.
* No widows/orphans: a paragraph's last line never holds a single word (Latin) or a single character (CJK).
* CN + EN pairings follow the mood: literary serif with Song/Ming, Swiss grotesk with Hei, condensed display with
  heavy Hei, mono with Hei, playful with the rounded and handwritten families. Pairings are curated, not random.

## 9. Texture

* Grain should read like **print**: fine, mostly monochrome, low amplitude, blended soft-light so it reads as paper tooth (`tex-grain2` in `render/svg.ts`). Riso-like
  speckle only on flat colour areas, and never noisy over photos.

## Where each rule lives

| Rule | Generator (enforce) | Scorer (penalise) |
|---|---|---|
| Modular scale, focal demotion | `gen/direction.ts` step 1 (`typeRatio` param, ratio per composition / pairing) | `audit.ts` focal, sizes |
| Block budget | `direction.ts` step 2 (`blockBudget`) | blocks |
| Decoration budget | `direction.ts` step 3 (`decorBudget`) | decor |
| Focal clear of subject | `direction.ts` 3b + 6 (`protectBox`) | subject |
| Edge cohesion, baselines | `direction.ts` step 4 | align |
| Text over busy image | `direction.ts` step 5 (`busyScrim`, gradient scrim) | busy |
| 60/30/10 accent share | `direction.ts` step 7 | accent |
| Harmony (OKLCH), de-mud | `color/harmony.ts`, harmony gate in `generate.ts` | harmony |
| Quiet area | — | quiet |
| Subject-aware crop | `ctx.ts cropAlign` + `scripts/analyze-images.py` (saliency/cutout mask → `subject`, `detail`) | — |
| Optical tracking, CJK compression/hanging, widows | `typo.ts`, `text/breaker.ts`, `render/svg.ts cjkLine` | — |
| Mood pairings | `data/pairings.ts`, `lib/fonts.ts shakeFonts` | — |
| Snap to grid | `lib/snap.ts`, `ui/Stage.tsx` (Alt to bypass), `components.ts` slot snapping | — |

## Art direction v2 (phase 4)

1. **One committed idea per draw.** Each draw has a separate plan stream (`gen/plan.ts`) that picks:
   - type-only or image;
   - a tone key (dark / light / saturated);
   - a palette strategy (source / single hue / clash);
   - grain or flat;
   - the material, the geometry, the script and the detail kit.
   
   The layout, text and colour seeds keep their meaning.
2. **Flat by default.** Grain appears on at most about 12% of draws, more for retro styles. An explicit texture the user picks always wins.
3. **Type can carry a poster alone.** About 28% of draws have no image. Those use the typo, edge, Swiss, centred and giant compositions, with:
   - an anchor glyph (tonal or accent);
   - an accent block;
   - background geometry.
4. **Colour.** About 30% of draws are single-hue fields built in OKLCH (chroma capped per hue band). About 6% are deliberate two-hue clashes. Ink is always at least 4.5:1.
5. **The same image twice.** The ghost composition shows a washed duotone of the photo plus a crisp reveal through a window, strip, shard, word, arch or stamp.
6. **Materials are local.** Halftone, stamp and torn are applied to one card or panel, never to the whole surface. Brush, blob and wave masks are retired from the v2 random draw.
7. **The detail kit sits only on plain field.** Caption rows, corner marks, signatures, dots, frames and construction lines are placed only where the field is plain. Script lettering is limited to calm compositions and never crosses copy.

## Phase 5 additions

8. **The type is the image.** When a poster has no picture, it needs a type device that carries it on its own:
   - a knockout (headline in the field colour on an accent block);
   - an echo (one word repeated in outline or tonal rows, with one solid row);
   - a ring of type around a disc;
   - a vertical column or spine;
   - a quote with a big hanging mark.

   A centred headline with a footer is not enough.
9. **A masthead is a promise.** A cover masthead must stay readable. The subject may overlap it only while most of the word stays visible, with a scrim if the photo is busy.
10. **Long formats need a side that is full.** On 16:9 and 21:9, one side carries a full-height photo or block edge to edge. Small inset images on a wide field read as empty.
11. **No repeats in a session.** The sampler down-weights the compositions used in the last four draws, so consecutive draws change idea.

## Phase 6 additions

- **Generate, then choose.** A layout rule set has a ceiling; drawing several candidates and keeping the one a taste model prefers adds about a quarter point without narrowing the style range. Selection works within a composition; letting the model choose *between* compositions quickly collapses variety, so that is capped at one challenger.
- **Variety is budgeted by archetype, not by composition.** The sampler first gives each archetype (giant glyph, split, Swiss, centred, ring, cards, mosaic, partition, inset, full-bleed, depth cover, band) a target share, then splits it among its compositions, with recency penalties so neighbours in the history differ.
- **Probation, not deletion.** A weak layout stays in the pool but needs a higher score to be accepted, so its good cases still appear.
- **The cut-out subject is the idea.** Object posters and depth covers keep their picture across candidates; a giant word with no subject in front of it is an empty poster.
- **Long formats are their own medium.** On 16:9/21:9, repeated-word, mosaic and object layouts read as sparse strips; the split/knockout, band-under-photo panorama and depth cover hold the width best.
- **Short CJK headlines don't bleed.** Two to four characters fit the margin and sit on it; bleeding them on a pale ground reads as a crop.

## Phase 7 additions

- **Idea first.** Every poster states one idea as a rule system with a tension rule. Its hero, palette (one dominant Itten contrast), frame, type and single rule-break are derived from that idea (`gen/ideas.ts`).
- **Colour by hue families.** A poster uses at most 2–3 core hue families. Only a contrasting accent is held to a 2–8% spot (art-kb R1/R2).
- **Balance by style.** Centred styles sit near the centre. Minimal styles may drift up to 35%. Editorial work stays in 4–17% (R5).
- **Alignments.** They either coincide or differ clearly. Near-misses are penalised, more strongly in editorial styles (R14).
- **CJK.**
  - Tracking is never negative unless set explicitly.
  - Optical tracking is −0.01 em on display sizes and +0.02 em on small text.
  - Han↔Latin boundaries get a quarter space.
  - Display text never ends on a line of fewer than 3 characters.

## Phase 8 principles
- Randomise the strategy, not the coordinates: one choice (headline length) propagates through line shape, silhouette, picture crop, info density and ornament.
- When content exceeds a structure's capacity, switch structure; never shrink type to fit.
- Declared breaks: a deliberate overlap is licensed in the scene, not flagged.
- Real copy is sacred: never invent numbers, years, mastheads or quotes; names, dates, venues and prices never split.

## Phase 17 principles (the structure in layers; `docs/PHASE17_LAYERS.md`)
- **A structure has layers, and each layer can change alone.** The grid system, the picture placement and the typesetting draw from separate streams. Re-rolling one never moves the others.
- **The pictures are placed against blocks, not against glyphs.** Where a picture hangs from the type (type-led layouts, title bands), the block it hangs from belongs to the placement. The type is set inside that block.
- **A re-roll must be visible.** A type re-roll prefers a setting that moves, re-sizes or re-breaks the type over a colour change. If a layer has nothing else to offer, the poster stays and the reason is shown.
- **Old work never changes.** A poster without layers replays its single stream exactly.

## Phase 16 principles (the Swiss modular grid; `docs/PHASE16_SWISS_GRID.md`)
- **Fields, not coordinates.** The type area is divided into fields by gutters. One field plus one gutter is a whole number of baseline lines, so all small text shares one baseline grid. Every picture and text region spans whole fields.
- **A picture keeps its proportion.** Its span is chosen to match its own width / height. A crop above ~12 % costs, past ~40 % it is a fault, and the subject box always stays in frame.
- **One hero, then a clear step.** The hero is the largest picture by ≥ 1.8× in area; the others form a row, column, grid or progression. Equal sizes are a deliberate rhythm (strip, modules), never an accident.
- **Bleed is from a field edge.** A picture on an outer field may run to the trim; its inner edges stay on the grid. Text never bleeds.
- **White fields are part of the order.** White space is planned per layout type. An empty band across the middle (rows or columns with nothing between two that carry something) is a hole, not white space.
- **Full bleed keeps proportions too.** Edge to edge, pictures are packed in a slicing tree solved for the sheet's proportion; the type cell takes the slack. Busy pictures get seams or gutters rather than butt joints.
- **Type hangs or stands.** The headline hangs from a field top or stands on a flowline, flush left on its ink, sized to fill its fields. The info block runs in sub-columns on the grid's columns.
