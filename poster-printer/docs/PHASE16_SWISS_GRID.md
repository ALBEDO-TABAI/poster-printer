# Phase 16: the Swiss modular grid, several pictures, and full-bleed layouts

## Why

Up to phase 15 the generator was built around one picture. Almost every composition used only the first image, the
old `swiss` composition put that image into a random cell, and the CLI resolver hard-coded `imageCount = 1`. The grid
itself (`gen/grid.ts`) split the type area into irregular columns and rows with no baseline relation, so text in two
columns never shared a baseline and no picture span was chosen for the picture's own proportion.

Two things that Swiss grid design is known for were missing:

- **A set of pictures of different sizes on one grid**: a hero, satellites a clear step smaller, a scale progression,
  a series in a justified row, a specimen sheet of modules.
- **Full-bleed (满版) layouts**: pictures of different proportions filling the sheet edge to edge, with the type in a
  cell of its own.

## What was built (`src/engine/swiss/`)

| File | Role |
|---|---|
| `lattice.ts` | The modular grid. The type area is divided into fields by gutters. One field plus one gutter is a whole number of baseline lines, so text in any field sits on one baseline grid. Columns follow the format and are compound counts (6 = 2·3, 12 = 2·3·4). Fields are near square. `refine()` doubles the grid (compound fine grid) for finer picture spans. `spanRect()` gives a span's pixel rect; outer edges may bleed to the trim. `writeGrid()` writes the legacy `Grid` view, so snapping, scene info and decoration keep working. |
| `solver.ts` | The template slicing solver. A layout typology is a slicing tree: `H` puts children side by side, `V` stacks them. Leaves are pictures, the headline, the info block, empty fields or colour fields. Dynamic programming chooses every cut on the lattice's field lines and minimises the sum of leaf costs. A picture leaf only tries extents near the one its proportion asks for. |
| `mosaic.ts` | The bleed grid. A slicing tree's composite proportion is Σa for side-by-side children and 1/Σ(1/a) for stacked ones. The type cell is flexible, so solving the tree for the sheet's proportion (bisection) moves all the slack into the type cell: the pictures keep their own proportion. Cuts snap to the baseline unit. |
| `typologies.ts` | The Swiss layout types, written as templates or explicit placements (see below). |
| `compose.ts` | The type model (headline fit per region, info-block height per width), the leaf cost model, the global costs, typology choice, and rendering on the baseline grid. Two compositions: `modular` and `bleedgrid`. |
| `pick.ts` | Companions: a random draw with one picture gets 2–6 more from the pool, on their own stream (same source tier and category first). The ids are stored, so replays lock them. A locked or given set is never extended. |

### Typologies (`gridLayout` param, 网格版式)

| Layout | Pictures | Structure |
|---|---|---|
| `hero` 主图卫星 | 1–7 | One hero bleeding off its outer edges, satellites in a row / column / small grid, type in its own fields. Long formats add hero / satellite grid / text-column templates. |
| `flow` 悬挂线 | 1–½·columns | The headline sits on a flowline; pictures and the info column hang from it at their own heights (ragged feet). |
| `steps` 尺度递进 | 2–3 | 1 → 2 → 3 field squares on a diagonal (heights fitted to each picture); the last step is the hero and bleeds; type in the empty triangles. |
| `strip` 图片横条 | 2–8 | One or two justified rows at a common height, bleeding left and right; type above / below. A single row must reach ~17 % of the sheet height. |
| `blocks` 模块分区 | 2–8 | Equal modules of fields; the hero may take 2×2 modules; a head row; tall / wide pictures take 1×2 / 2×1. |
| `mosaic` 满版拼贴 | 2–8 (`bleedgrid`) | Random and structured slicing trees solved for the sheet; seams none / hairline / gap, optional frame. |
| `rows` 满版行列 | 2–8 (`bleedgrid`) | Justified rows (columns on long sheets) plus the type cell. |

### Costs

- **Picture**: crop loss (share of the picture cut away, mild up to 12 %, steep past 42 %); subject cut (the analysed subject box must fit the visible fraction); size against the template's target share (hero ≈ 30–42 % of the sheet); a minimum of 9u per side.
- **Headline**: the largest size the title reaches in the region (semantic line breaks; CJK lines keep ≥ 2 characters; Latin lines keep ≥ 2 letters) against a target derived from the copy and the `titleScale` control; a mild pull against regions far taller than the title needs.
- **Info**: the height the explanation, items (in sub-columns on the lattice columns), prose and meta need at that width; the reading measure ≥ 13u.
- **Global**: every picture placed; the hero largest (≥ 1.8× for hero / steps); picture coverage per typology; real white space (empty fields plus the unused part of text regions) inside a per-typology band; no dead bands (an empty row or column between two that carry something; open space at one edge only up to ~25 %).

### Choice

The first draw of the typology is kept when its best template costs ≤ 1.6. Otherwise every feasible typology is
solved, and the draw picks among the typologies whose best fit is within 1.6 of the overall best, weighted by the
typology weights. Inside a typology, a softmax over the cheapest templates picks the layout, and a coin flips it left
to right. An asked-for typology (`gridLayout`) is kept whenever it can be built; otherwise the chain falls through to
the other typologies, then to the bleed grid, then to a single-picture composition.

### Type on the grid

- Display type hangs from a field top, or stands on the region foot (flowline). It is flush left and aligned on its ink (optical left edge), set as one text node.
- The explanation is about 1/3.4 of the display size.
- Info text is about b/1.36 (≈ 1.4u). Every small line advances by whole or half baselines, so columns share baselines.
- Items fill sub-columns on the lattice columns, row by row. Meta labels sit one per sub-column.
- Small text keeps 6:1 (ink) and 5.2:1 (soft) on its ground, a margin over 4.5:1 for anti-aliased strokes.
- Optional Swiss marks: a hairline rule over the info region, the flowline drawn as a rule, and one accent colour field in a near-square run of empty fields.

## Integration

- **Compositions**: `modular` (模块网格) and `bleedgrid` (满版拼图) are in `COMPS`, the composition control, the sampler (archetype `GRID`), `NEEDS_IMG` and `WIDE_OK`, plus one-hot taste features (`COMP_KEYS_16`).
- **Ideas**: a new idea `grid` (网格秩序) realises them; `specimen` and `immersion` realise them too.
- **Several pictures**: with ≥ 2 pictures (user, locked or picked), the grid compositions get ×4 and the others ×0.3.
- **Semantics**: both compositions declare `scene.info.sem` (strategy `grid:<typology>` / `bleed:<typology>`, roles, groups, crops, the typology, the template, the lattice and the per-typology fit). The art-direction pass and the extras kit therefore skip them; polish, gates, geometry and balance still run.
- **Parameters**: `gridLayout` (new, re-lays out). `imageCount` max 4 → 8. `margin`, `gutter`, `cols`, `rows` are read when set by the user (`honor`).
- **App UI**: the 网格版式 control, a 模块网格 layout preset, and the 拼贴 preset now uses the bleed grid.
- **CLI**: picture sets in briefs (`imagery.ids` / `files` / `layout` / `count`), set analysis and layout recommendation (`engine/src/layouts.ts`), an `images` correctness gate, subject detection for user images, stable image ids, `images inspect`, `catalog layouts`, `generate --image/--layout`.

## Measurements (this machine, approx measurer in node)

- One `generateOne` of the grid compositions: mean ≈ 8 ms, p90 ≈ 16 ms (solver); the whole auto draw with the 8-candidate selector: mean ≈ 26 ms.
- 48 locked mixed-proportion sets × 6 formats × 2 compositions: every picture drawn, no text collisions, no text over a picture.
- In 160 auto draws (selector on, mixed formats): `modular` 10 %, `bleedgrid` ≈ 2–5 % once single-picture draws stop down-weighting it. Archetype variety stays ≥ 10 effective kinds.
- CLI, a 5-photo bilingual exhibition brief, 30 candidates: all five pictures on every poster, the first picture as the hero, 28 of 30 passing every correctness gate. The two failures were small notes at 4.3–4.4:1 contrast; the info-text contrast margin added afterwards fixes them.

## Limits

- The taste model has no labels for the new compositions yet; they are judged on structure (gates, balance, light selector).
- The subject box of user images comes from a simple saliency model (colour distinctness + detail + centre prior). It is weaker than the precomputed boxes of the bundled pictures. An AI cut-out improves it.
- Captions per picture (credit lines under each picture) are not set yet; the info block carries the copy.
- The bleed grid's type cell sometimes gets more height than its copy on very tall sheets (9:16): white space in the cell.
