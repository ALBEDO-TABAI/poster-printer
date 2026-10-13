# cli-anything-ready-poster-printer

Content-driven poster generation from the command line, built on the real **Ready Poster Printer** engine.
You write a brief with the real copy (title, date, venue, programme, speakers…) and the style intent.
The CLI analyses the content, picks styles, ideas, compositions and type scale (with a reason for each
choice), places the real copy into the layout slots, and renders N candidates ranked by the app's own
taste selector.

Every poster is saved as the web app's own **Poster JSON**. Import it in the app (Export ▸ Import JSON)
and it renders identically, pixel for pixel. Rendering goes through headless Chrome using the app's code,
fonts and rasteriser. `--backend node` (resvg) is a faster approximate alternative.

## Install

Requirements: Python ≥ 3.10, Node ≥ 20, Google Chrome / Chromium (for the default backend), and the
Ready Poster Printer app repository (`REA_POSTER`, default: the sibling `poster-printer/` directory) for its assets.

```bash
cd poster-printer-cli/engine && npm install && node build.mjs      # bundles the app engine
cd ../agent-harness && pip install -e .                             # cli-anything-ready-poster-printer + ready-poster-printer
ready-poster-printer doctor
```

Environment: `REA_POSTER` (app repo), `POSTER_PRINTER_CHROME` (browser binary),
`POSTER_PRINTER_FONTS` (full fonts for glyph fallback, default `/workspace/fonts`),
`POSTER_PRINTER_HOME` (user images / fallback fonts, default `~/.poster-printer`),
`POSTER_PRINTER_ENGINE` (path to `engine/dist/engine.mjs`), `POSTER_PRINTER_BACKEND` (`chromium` | `node`).

## Usage (quick start)

```bash
ready-poster-printer brief template --lang zh > brief.json         # fill in the real content
ready-poster-printer brief resolve brief.json                      # what will be used, and why
ready-poster-printer --json generate --brief brief.json --count 6 --min-score 6.5 -o out/
ready-poster-printer --project out/01-*.json refine --set titleScale=130 --text sub="新的副标题"
ready-poster-printer --project out/01-*.json undo
ready-poster-printer export out/01-*.json --format pdf -o poster.pdf
ready-poster-printer                                                # interactive REPL
```

Quick mode without a brief file: `ready-poster-printer generate --title "Paper Weekend" --date 2026-11-08 --line "10:00 Opening" --line "13:00 Workshop" --mood playful`.

### Pictures and Swiss grid layouts (phase 16)

Give the user's pictures in the brief in importance order; the first is the hero. Files are added automatically, with stable ids.

```json
"style": { "imagery": { "use": "hero", "files": ["hero.jpg", "a.jpg", "b.jpg", "c.jpg"], "layout": "auto" } }
```

- `brief resolve` analyses the set (proportions, orientation mix, series, busyness) and recommends grid layouts, each with its reasons.
- With several pictures, every direction uses the grid compositions:
  - `modular` (模块网格) with `hero` · `flow` · `steps` · `strip` · `blocks`
  - `bleedgrid` (满版拼图, edge to edge) with `mosaic` · `rows`
- `layout` forces one of these; `single` keeps the one-picture compositions.
- The report's `images` gate checks that every picture is drawn, its `crop_loss` and its `subject_visible`.
- `images add FILE…` and `images inspect ID…` show what a layout decision needs. `catalog layouts` lists the layouts.
- Quick mode: `ready-poster-printer generate --title "…" --image a.jpg --image b.jpg --layout auto`.
- The method an agent should follow is in `skills/LAYOUT_METHOD.md` (next to `skills/SKILL.md`).

## Commands

All commands accept the global `--json` (machine output), `--project FILE` (the Poster JSON to act on;
it is saved after mutations, with undo/redo history kept in `x_cli`), `--dry-run` and `--backend chromium|node`.

| Group | Commands |
|---|---|
| brief | `schema`, `template [--lang zh/en]`, `validate F`, `analyze F`, `resolve F [--top N] [--full]` |
| generate | `--brief F` or `--title/--subtitle/--date/--venue/--line/--mood/--image/--layout`; `--count N --min-score S --ratio R --seed S --direction d1 --format png,svg,jpeg --scale X -o DIR --no-font-fix --no-sheet` |
| iterate | `refine [F] --set k=v --text slot=v --style ID --ratio R`, `variations [F] --vary layout/structure/grid/place/type/color/image/decor/tendency -n N [--pick N]` (grid / place / type re-roll one layer of the structure: 网格 / 图位 / 排字), `audit [F]`, `info [F]` |
| history | `undo`, `redo`, `history`, `open F`, `save [F]` |
| output | `export [F] --format png/png@2x/png@4x/jpg/svg/svg-light/pdf/json -o PATH`, `deck [F] --pages N --format pdf,zip,png` |
| catalogues | `styles list/show`, `palettes search/show`, `fonts list/pairings/check [--fix]`, `images list/add/inspect/remove`, `catalog layouts/ideas/comps/params/ratios/exports` |
| system | `doctor`, `repl` |

Exit codes: 0 ok · 1 engine failure · 2 usage / invalid input · 3 missing file · 4 output verification failed · 5 nothing reached `--min-score`.

## Examples

```bash
# 1. scaffold and fill a brief, check it, see how it maps to engine settings (with reasons)
ready-poster-printer brief template --lang zh > talk.json
ready-poster-printer brief validate talk.json
ready-poster-printer --json brief resolve talk.json

# 2. six candidates that pass the correctness gates with taste >= 6.5, plus a contact sheet
ready-poster-printer generate --brief talk.json --count 6 --min-score 6.5 -o out/talk

# 3. read one candidate's report at its real display size, apply a suggested fix, undo it
ready-poster-printer audit out/talk/01-*.json --brief talk.json --display print --print-size A2 --distance 1.0
ready-poster-printer --project out/talk/01-*.json refine --set smallScale=130
ready-poster-printer --project out/talk/01-*.json audit
ready-poster-printer --project out/talk/01-*.json undo

# 4. alternatives and outputs
ready-poster-printer variations out/talk/01-*.json --vary structure -n 4
ready-poster-printer export out/talk/01-*.json --format pdf -o talk.pdf
ready-poster-printer deck out/talk/01-*.json --pages 3 --format pdf
```

## The brief

```jsonc
{
  "purpose": "talk | music | exhibition | event | product-launch | sale | announcement | film | workshop | festival",
  "content": {
    "title": "留白之后", "title_alt": "AFTER THE MARGIN", "subtitle": "…", "slogan": "…",
    "date": "2026-11-21T19:30", "date_end": "…", "time": "…", "venue": "…", "address": "…", "city": "…",
    "speakers": ["林知远 · 字体设计师", {"name": "…", "role": "…"}],
    "program": ["20:00 苔原 Tundra — opening set", {"time": "21:00", "title": "Soft Static", "who": "…"}],
    "organizers": [], "price": "免费 · 需预约", "ticket": "", "url": "", "qr_text": "", "body": "",
    "edition": "第07期", "hashtags": [], "credits": [], "language": "zh | en | bilingual | auto"
  },
  "style": {
    "mood": ["calm", "literary"], "era": "contemporary | 70s | 80s | 90s | y2k | …",
    "color": {"background": "light | dark | auto", "lightness": "…", "chroma": "soft | mid | rich", "contrast": "…",
              "temperature": "warm | cool | neutral", "palette_tags": ["muted"], "must_include": ["#c33"]},
    "typography": {"voice": "serif | sans | mono | script | display", "weight": "…", "mood": "literary | swiss | …", "case": "…"},
    "density": "airy | balanced | dense", "imagery": {"use": "none | accent | hero", "subject": ["landscape"], "ids": []},
    "texture": "flat | paper | grain", "styles": ["zh-song-edit"], "ideas": ["hanzi"], "avoid": ["script"]
  },
  "format": {"ratio": "3:4", "count": 6, "min_score": 6.5, "formats": ["png"], "scale": 1},
  "constraints": {"seed": "…", "must_show": ["date", "venue"], "avoid_ideas": []},
  "context": {
    "use": "brand | promo | info | editorial | art", "audience": "…",
    "display": {"kind": "phone-thumbnail | phone | screen | print", "width_px": 390, "print_size": "A2 | 420x594 mm", "viewing_distance_m": 1.0},
    "priority": ["title", "date", "venue", "program"]
  }
}
```

`poster-printer brief schema` prints the full JSON Schema. Only `content.title` is required.

**What the analyser finds:** the language mix (Chinese / English / bilingual, and the CJK share of the title).
It ranks the fields by importance (hero / secondary / tertiary, adjusted for the purpose). It spots lists
(timetable, lineup or speakers), dates and date ranges, and numerals that could become graphics. It also
classifies the title's shape (a 1–4 hanzi glyph title through to a long title), quote-like copy, and the
overall copy load.

**How content maps to design:**
- A timetable or speaker list of 3 or more items → the *data* idea (index / programme compositions) with the real times.
- A short Chinese title → *hanzi* (the character becomes the picture).
- A dated event → a real calendar (correct month length and weekday).
- Quote-like copy → *voice*.
- Hero imagery → immersion / reveal / specimen.
- Mood, era and voice → a ranking of the 62 built-in styles and a font pairing.
- The background intent sets the plan tone, with bounded colour re-rolls and a penalty if it still misses.
- Density sets the block / decor budgets (the old `whitespace` param was removed in app phase 13; `--set whitespace=` is accepted and ignored).
- The title's width and hierarchy set the title scale.

Real copy fills the headline, subtitle, caption, groups, meta and prose slots. The app's invented
copy (issue numbers, years, calendar days, times, script words, stickers) is replaced by the real facts
or left out. Every choice appears with its reason in `brief resolve` and in each poster's `reasons`.

## Evaluation: correctness gates vs aesthetic scores

`audit` and every `generate` candidate return a report with two separate parts.

**Correctness gates.** Each gate reports pass, fail or n/a, with measured values and regions:
- **content:** every brief field is drawn, with the text exactly as in the brief. Dates may appear in any
  date format and Latin case may follow the style. Each rendering is checked for being missing, truncated,
  clipped by the canvas or a mask, overlapped by other text, or covered by a later image or panel. Required
  fields are the first four entries of `context.priority`, or else title (+ title_alt for bilingual), date,
  venue and anything in `must_show`. Failures on other fields are reported as advisory.
- **checked text contrast:** the WCAG 2.2 thresholds (4.5:1, or 3:1 for large text ≥ 18 pt / 14 pt bold at
  the target display), computed from relative luminance against the rendered pixels behind each text box
  (worst-case sample). This is a check, not a WCAG compliance claim. Decorative text (giant glyphs, ghost
  or masked type) counts as incidental and is skipped.
- **min_size:** required text in CSS-px equivalents at `context.display`. Defaults: info text ≥ 9 CSS px on
  phone, screen and print, and only the title (≥ 12) for phone thumbnails. Print sizes are converted with the
  CSS reference pixel (0.2646 mm at 0.71 m), scaled by the viewing distance.
- **cjk (W3C CLREQ):** prohibited line-start and line-end punctuation (blocking), single-character last
  lines and Han–Latin spacing (advisory).
- **glyphs:** every character has a glyph in the poster's fonts (glyphs patched from the full fonts pass,
  noted as CLI-only).

A blocking failure can't be offset by any aesthetic score. `generate` excludes such candidates, and
appends them only as `flagged` (ranked after all passing ones) when too few pass; `--strict` never returns them.

**Aesthetic dimensions** (0–10, with `null` meaning not judged):
- `classical`: order, clarity, alignment, and hierarchy, including whether size order follows `context.priority`.
- `expressive`: tension (scale contrast plus asymmetry). `idea` and `originality` are always `null`, because they need a human eye.
- `color`: harmony, palette discipline, tone structure and headline separation.
- `craft`: engine soft gates, collisions, subject protection, CJK typesetting and thumbnail readability.
- `overall`: the taste selector's score minus the engine gate penalty.

**Issues** each have a `dimension`, a `region` ([x, y, w, h] in poster px), `evidence` (the measured value),
an `impact` (legibility / finding-info / expression / craft), and a `fix`, which is a concrete
`refine --set …` / `--text …` / `variations …` command where one exists.

**Methodology note.** The aesthetic numbers are relative, model- and heuristic-based signals for ranking
candidates of the same brief. They are not absolute quality judgments. The taste selector is a learned model
trained on one rater's ratings so far, so treat it as one opinion that needs human calibration (rate more
posters and retrain). The correctness gates are measurements, but approximate ones: text boxes are layout
boxes, contrast is pixel-sampled, and display sizes are modelled. A human should still look at the result.

## Fidelity and limits

- With the Chrome backend, a CLI poster imported into the web app renders identically: the SVG is
  identical apart from element ids and the PNG is pixel-identical. `tests/test_full_e2e.py::TestAppRoundTrip`
  checks this.
- If the copy contains characters missing from the app's subset fonts, `generate` and `export` add fallback
  subsets cut from the full fonts. These glyphs are not in the web app, which shows its own fallback face
  for those characters after import. Use `--no-font-fix` for strict parity, and `fonts check` to see what is missing.
- User images (`images add`) are stored in `~/.poster-printer`. The web app does not have them, so posters
  that use them only round-trip if the same image is uploaded in the app.
- Deck pages share the copy of the cover; the engine has no per-page copy.
- `--backend node` uses approximate text measurement and resvg, so layout can differ slightly from the app.
