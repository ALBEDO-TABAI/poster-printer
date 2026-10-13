# cli-anything-ready-poster-printer — test plan and results

## Part 1 — Plan

**Unit tests (`test_core.py`, synthetic data only, no browser):**
- **project:** the app-shaped Poster JSON (`app/kind/version/entry`). Covers save/open round trip, opening an app session file (takes the last entry), rejecting foreign JSON, info, and profiles.
- **session:** undo/redo, a new change clearing redo, history persisted in `x_cli` with the app shape intact, and bounded history.
- **export:** presets, JSON export without the engine, unknown preset.
- **fonts:** per-script relevant characters (CJK faces check CJK only), missing-glyph detection, copy collected from a brief.
- **backend:** the `paths`/`doctor` ops, a bad backend, an unknown op.
- **brief:** schema/template, validation errors, timetable detection, hierarchy (title first), resolve placing the real copy with reasons, background/density respected, seed equal to the content hash.
- **brief context:** validation, `priority` reorders the hierarchy, `display` raises `smallScale` so the min-size gate is achievable.
- **CLI in-process (Click runner):** help, `brief validate`/`resolve` `--json`, catalogues, undo without a project → exit 2.

**E2E (`test_full_e2e.py`):**
- `TestCLISubprocess` runs the installed `cli-anything-ready-poster-printer` through `_resolve_cli`, with `CLI_ANYTHING_FORCE_INSTALLED` and no cwd:
  - help/version; the `poster-printer` alias; doctor; catalogues; the brief flow;
  - exit codes 2 and 3;
  - generate ranked with `--min-score`, asserting the report structure (gates pass/fail with measured values, issues with region/evidence/impact/fix, aesthetics separated with nulls);
  - quick mode; the node backend;
  - project refine → undo → redo → export (png/svg/pdf/json verified);
  - variations + deck;
  - layer variations (app phase 17): `--vary type` keeps every picture frame (`layer.picturesKept`) and stores its salt in `picked.layers`; `--vary place` keeps the composition; `--vary grid` runs;
  - audit gates plus an actionable `refine --set` fix that is then applied;
  - `fonts check --fix`; images add/list/remove.
- `TestAppRoundTrip`:
  - builds rea-poster with vite into a temp dir and serves it (or uses `POSTER_PRINTER_APP_URL`);
  - imports CLI posters through the app's own JSON file input;
  - generates from a clean library (`POSTER_PRINTER_HOME` of its own): CLI user images added by other tests do not exist in the web app;
  - asserts the app's SVG equals the CLI's SVG modulo ids, and the app's raster matches the CLI PNG within ±2 levels (Chromium may antialias the edges of very large glyphs one level apart) (6 posters, 3 briefs).

**Also run:**
- rea-poster: `vitest`, `tsc -b`, `scripts/qa/e2e.mjs` against a vite preview build, after each engine change;
- a 240-draw byte-identical comparison against HEAD (the change has no effect when a field is absent);
- the CLI-Anything `validate` checklist; pyflakes.

Run: `cd agent-harness && CLI_ANYTHING_FORCE_INSTALLED=1 ../.venv/bin/python -m pytest cli_anything/poster_printer/tests/ -v -s`

## Part 2 — Results (2026-10-14 JST, app phase 17 / CLI 0.3.0)

- **Full suite:** **49 passed, 1 skipped** (the glyph-fix test needs the full font directory) in 8 min 2 s, on macOS with Microsoft Edge as the Chromium.
- **Round trip:** 6/6 posters imported via the file input; SVG identical modulo ids; raster within ±1 level (134 edge pixels of a 230 px CJK headline differed by one level).
- **New:** `test_layer_variations`: `--vary type` keeps every picture frame; the layer salt is stored; `--vary place` keeps the composition.
- **rea-poster:**
  - vitest 226 passed / 1 skipped, including `tests/layers.test.ts`;
  - posters without layers match fingerprints from the phase-16 build, and 172 draws + replays were byte-identical against it;
  - `scripts/qa/e2e.mjs` against the release build: 164 checks passed, including the layer menu, 排字 keeping the pictures, T / Esc and history restore. One check fails: "全部解除 clears all pins", which already failed on the phase-16 build.

## Part 2 — Results (2026-10-12 JST)

- **Full suite:** **49 passed** in 16 min 46 s (round trip included; most of the time goes to the vite build and headless Chrome).
- **Round trip:** 6/6 posters imported via the file input (`restored=True`); SVG identical modulo ids, PNG pixel-identical.
- **rea-poster** (commits a529dc8, 3035662, 7e31781):
  - vitest 180 passed / 1 skipped; `tsc -b` OK;
  - `scripts/qa/e2e.mjs` PASSED (150 checks);
  - absent new fields give byte-identical output over 240 draws.
- **validate checklist:** see the final report.
  - Remaining items are in the vendored CLI-Anything `repl_skin.py` (missing return hints, 3 pyflakes unused-variable notes, kept identical to upstream).
  - Plus a docstring mention of the default `/workspace/fonts` (configurable via `POSTER_PRINTER_FONTS`/engine paths).
