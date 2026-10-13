# Phase 17: the structure in three layers (网格 / 图位 / 排字)

## Why

"换结构" re-rolled everything that makes a layout at once: the grid system, where the pictures sit and how the type is
set. A common wish is narrower. You like where the pictures are (or that they run full bleed) and only want the type
set another way. Or you like the type and want the pictures moved. Before this phase, the only way to get that was to
press 换结构 until all three happened to come out right.

The obstacle was the random stream. Each composition drew its grid, picture and type decisions from **one** layout
stream, interleaved. Changing one draw shifted every draw after it, so there was no way to change only the type.

## What was built

### Three streams (`generate.ts`, `gen/ctx.ts`)

A new poster draws from three independent streams derived from its layout seed:

| Stream | `Ctx` field | Draws |
|---|---|---|
| grid 网格 | `ctx.rg` | `makeGrid` (columns, rows, margins); the Swiss lattice (margin, field proportion); the bleed grid's seams and frame |
| placement 图位 | `ctx.rng` | the typology / template, picture sizes and positions, masks, panels, picture treatment, the headline *block* in type-led layouts |
| type 排字 | `ctx.rt` | line breaks, alignment, headline size within its block, accent or ink, where the headline and the info block sit among the free fields, display faces (`ctx.rtd`) |

Decoration keeps its own stream (`ctx.rd`), seeded from the base layout seed, so re-rolling a layer never changes the
ornaments by accident.

A layer is re-rolled by **salting** its stream: `GenInput.layers = { v: 2, grid?, place?, type? }`. The salts are stored
in `Picked.layers`, so history, favourites, undo and the CLI replay the result exactly.

### Backward compatibility

- `layers: undefined` means a new poster. It is layered (`{ v: 2 }`).
- `layers: null` means a poster made before phase 17 (its `picked` has no `layers`). Every stream is the same object, so
  the draw order is exactly the old one. `tests/layers.test.ts` checks scene fingerprints taken from the phase-16 build.
  A comparison of 172 fresh draws and replays against that build was byte-identical.
- Type variations that legacy posters never drew are guarded by `ctx.layered`.
- The first layer re-roll of an old poster converts it to layers. This re-lays it out once, and the app says so.

### Keeping the pictures still while the type changes

Where a composition places a picture *against* the type, the coupling was cut on layered posters:

- **typeled**: the headline block (measure, height, silhouette) is placement, drawn from `ctx.rng.fork('typeled-head')`.
  The picture is placed against that block. The type layer then sets the headline inside it: another break or
  silhouette of the same line count, never taller, never reaching into the room beside the short line.
- **inset**: the title band's height is measured with the placement stream. The type layer's setting is used when it
  fits the band, otherwise the band's own setting.
- **modular**: the template places the pictures. `retype()` then re-places the headline and the info block among the
  fields the pictures leave, choosing among the template's own arrangement and `placeType()` variants (head top or
  bottom, left or right, info near or apart).
- **contentOf** (phase-8 grammars): how many stand-in facts a poster shows is content, not type. A layered poster keeps
  the count when a layer is re-rolled.

### The re-roll search (`rerollLayer`)

A re-roll tries a few salts (type: 6, others: 4) and keeps the first one that:

1. changes the layer. For type, a *visible* change wins over colour only: a box moves, a size changes, or a line breaks
   differently.
2. keeps every picture frame (type re-rolls only).
3. passes the hard gates.

Otherwise it keeps the best of them. `scene.info.reroll = { layer, changed, kept }` reports what happened. A re-roll
that changes nothing leaves the poster and the history alone, and shows a hint.

Measured over all 38 compositions × 12 posters: a type re-roll kept every picture frame in 480 of 480 cases, changed
the type in 97 % and moved or re-sized it in 92 %.

**Fixed placements.** `layers.ts: FIXED_PLACE` lists the compositions whose picture position is part of the design:
full bleed, a set plate, a disc (`cover`, `fullbleed`, `ghost`, `layered`, `mosaic`, `object`, `quote`, `ring`, `veil`,
`window`). In those, 图位 is disabled with a reason, and 整体结构 is the way to move the picture.

## The interface

- **结构 is a split button.** The label re-lays out the whole structure, as before. The caret opens the layer menu:
  网格 / 图位 / 排字 / 整体结构, each with a one-line description and its shortcut.
- **The menu stays open** while you re-roll, so you can press 排字 a few times in a row. Esc or a click outside closes it.
- **Shortcuts.** `T` 排字, `P` 图位, `R` 网格 (*Raster*, the Swiss word for grid). They are also in ⌘K and the shortcut
  sheet.
- Each re-roll is one undo step and one history entry.

## The CLI

`variations --vary type|place|grid` re-rolls one layer and keeps the other two. Each item reports
`layer.changed`, `layer.picturesKept` and `layer.fixedPlacement`. `replayInput` passes the stored layers, so older
project files replay exactly.

## Also fixed

When an asked lead layout (hero / steps) fell back to another typology, the hero could end up smaller than a satellite.
The hero rule now follows the request on layered posters. Strip fallbacks included.
