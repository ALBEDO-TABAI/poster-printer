# Phase 9: layout-first generated pictures

All ratings here are mine, by eye. Blinding was only partial: the pairs were shown left/right at random, but the zoned layout is easy to recognise.

## What changed
- **Six original AI-generated pictures (Grok Bot GenerateImage).** They are imported by `scripts/import-genimg.py`. Each 1280×720 frame becomes a 900×1200 portrait: a crop on the subject, plus an extension of the flat background where the brief planned an empty zone. Provenance is in `licenses/IMAGES.md`.
- **New manifest fields:** `zones` (headline/info safe-text rects, 0..1), `accent`, `mood` and `interleave`. Tier `gen`.
- **New strategy `zoned`** (`src/engine/p8/grammar.ts`), sampler archetype FB:
  - The picture runs full bleed. The crop keeps the zones and the subject in frame.
  - Line count comes from the zone's proportion. The headline fills the headline zone.
  - Ink colour comes from the luminance under the zone. The picture's accent colours the headline when it reads, otherwise the explanation or rule.
  - On the trumpet, the cut-out is drawn over the headline (a declared interleave break).
  - Info goes in the info zone.
- **Search:** a picture with zones always gets the `zones` route. That route carries `SEARCH.zonedBonus = 0.5` as a prior because the picture was planned for this layout, and it has no route margin.
- **Fix:** in landscape `exhibit`, the caption column ran off the right edge when a wide frame sat left of centre. A newly drawn picture exposed this in the layout test.

## Evaluation
Six fixed contents (`lotgo-research/p9/contents.json`). Each picture is locked through `imgPick`, with 12 random draws per content per engine at 3:4. P8 is the `5ba2d32` worktree, using the same pictures.

The route won in 39 of 72 draws. Remaining draws by content:

| content | zoned draws | P9 wins | P8 wins | ties |
|---|---|---|---|---|
| N night voyage | 7/12 | 7 | 0 | 5 |
| S speaker launch | 6/12 | 6 | 0 | 6 |
| P photo exhibition | 4/12 | 3 | 2 | 7 |
| T music night (cut-out) | 9/12 | 8 | 1 | 3 |
| D design talk | 8/12 | 8 | 1 | 3 |
| F city sound festival | 5/12 | 7 | 3 | 2 |
| **total** | 39/72 | **39** | **7** | 26 |

P9 won 85% of the decided pairs, or 72% when ties count as half.

Best-of scores:

| | N | S | P | T | D | F | mean |
|---|---|---|---|---|---|---|---|
| P9 | 8.0 | 7.6 | 7.4 | 8.2 | 7.6 | 7.9 | 7.8 |
| P8 | 7.2 | 7.0 | 7.5 | 8.1 | 6.8 | 7.6 | 7.4 |

Random-draw mean: P9 about 7.3, P8 about 6.8. **No poster reaches 9.**

What holds them back:
- **Zoned outputs look alike from draw to draw.** Only the font and the accent change, so one picture yields one poster.
- **The info type is small.**
- **The headline sits in the zone rather than doing something with the picture.** The trumpet is the exception.
- **The tall stair crop is soft.** It is an upscale of a 540 px window.

Sheet: `docs/showcase/phase9_genimg.jpg`. Rows: P9 best, P9 another draw, P8 best.
