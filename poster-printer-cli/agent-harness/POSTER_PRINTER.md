# Poster Printer — CLI harness SOP

## Software
Poster Printer (`/workspace/rea-poster`) is a React/Vite web app that generates typographic posters
from seeds, styles and parameters. It has an idea layer, a taste selector and deterministic replays.
Its engine is pure TypeScript (`src/engine/**`); the browser supplies text measurement, fonts and rasterisation.

## Backend strategy
- `engine/` bundles the app's `src/` (esbuild, alias `@rea`) into `dist/engine.mjs`, a Node CLI that takes
  JSON on stdin and writes JSON on stdout, and `dist/page.js`, the page code that runs inside headless Chrome.
- The **chromium** backend (default) serves the app's `public/` assets and runs generation, measurement,
  `exportSVG` and `rasterizeSVG` in Chrome, the same code paths as the app. The output is therefore
  identical to the app's.
- The **node** backend uses the app's approximate measurer plus resvg with the full TTF/OTF fonts. It has
  no browser dependency and is approximate.
- Final outputs always come from the app-equivalent replay of the saved entry (`buildInput(keepPicked)`), so
  the saved Poster JSON reproduces the image exactly in the app.

## Data model
- The project is Poster JSON `{app:'poster-printer', kind:'poster', version:1, entry, x_cli?}`. `entry` is
  the app's history entry (seeds, styleId, ratio, params, picked (comp, attempt, salt, texts, palette,
  images, plan, idea), fonts, custom). `x_cli` holds the CLI undo/redo stacks (max 50), the brief and the
  reasons. The app ignores it.
- Content-driven copy lives in `entry.picked.texts`, including `texts.facts`: the optional real
  year / issue / date / numeral / times / values / signature / masthead / sticker that the engine uses
  instead of invented copy (added to rea-poster in commits a529dc8, 3035662 and 7e31781; byte-identical when absent).

## Commands → engine ops
`brief *` → schema/template/validate/analyze/resolve (pure). `generate` → resolve + font check/fix + generate.
`refine`/`variations`/`audit`/`deck`/`export` → refine/variations/audit/deck/render.
Catalogues → catalog. `doctor`/`paths` → doctor/paths. `images add` → images.analyse (sharp).

## Verification
The engine verifies every written file: PNG/JPEG magic, size and dimensions, non-blank pixels (stdev > 2),
SVG framing and the PDF header. It exits with code 4 on failure. Tests: `tests/TEST.md`.
