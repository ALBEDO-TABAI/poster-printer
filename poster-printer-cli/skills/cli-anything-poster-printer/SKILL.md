---
name: >-
  cli-anything-poster-printer
description: >-
  Make posters from real content with the Poster Printer engine: interview the user, write a content brief,
  resolve it into a design (styles, ideas, type scale, copy slots, each with a reason), generate ranked candidates,
  show them, refine, export PNG/SVG/PDF or app-compatible Poster JSON. Use for event, talk, music, exhibition,
  launch and announcement posters in Chinese, English or both.
---

# cli-anything-poster-printer

A CLI for **Poster Printer**, a generative typographic poster app. The real app engine runs underneath:
headless Chrome by default, so every image is identical to what the web app draws. Posters are saved
as the app's Poster JSON, which can be imported in the app (Export ▸ Import JSON) to keep editing by hand.

Commands: `poster-printer` or `cli-anything-poster-printer`. Always pass `--json` when you parse the output.

## Installation

```bash
cd poster-printer-cli/engine && npm install && node build.mjs
pip install -e poster-printer-cli/agent-harness
poster-printer doctor          # node, Chrome, engine bundle, app assets, fonts
```

Prerequisites: Python ≥ 3.10, Node ≥ 20, Chrome/Chromium, and the Poster Printer repo (`REA_POSTER`).

## Agent workflow: interview → brief → resolve → generate → show → refine

### 1. Interview
Collect the **real content**. Never invent facts: ask for anything that is missing.
- Must have: the title (in every language that should appear).
- Usually needed: date and time (and an end date for runs), venue and city, price or ticket info, organiser.
- The list that makes the poster: a programme with times, a lineup, or speakers with roles.
- Optional: subtitle or slogan, a short body or quote, edition number, URL, hashtags.
- Style intent in plain words: the mood (calm, bold, playful, elegant, raw, warm, loud…), any era, a light or dark
  background, how much text versus air, and whether to use photos/images (none / accent / hero).

### 2. Write the brief
`poster-printer brief template --lang zh > brief.json` (or `--lang en`), then fill it in.
Only `content.title` is required. Write lists as arrays:
`"program": ["20:00 苔原 Tundra — opening set", …]` or `[{"time":"20:00","title":"…","who":"…"}]`;
`"speakers": ["林知远 · 字体设计师", …]`.
Set `content.language` (`zh`, `en` or `bilingual`) and use `title_alt` for the second-language title.
Check it with `poster-printer --json brief validate brief.json`; exit code 2 means errors, and warnings name ignored fields.

### 3. Resolve (look before you render)
`poster-printer --json brief resolve brief.json` returns:
- `analysis`: language, field hierarchy, the detected list (timetable / lineup / speakers), dates, numerals, title shape, copy load.
- `copy_slots`: exactly which copy goes where (headline, sub, note, groups, meta, prose, facts).
- `directions`: style × idea × composition, with params and `reasons`.
- `palette`, `format`, `reasons`, `warnings`.

Check that the copy slots show what the user cares about. If not, fix the brief (for example move text from
`body` into `subtitle`, or force an idea or style with `style.ideas` / `style.styles`).

### 4. Generate
```bash
poster-printer --json generate --brief brief.json --count 6 --min-score 6.5 -o out/
```
- Returns `posters[]`, already ranked (`score = taste − gate penalty`). Each poster has `rank`, `style`, `comp`,
  `idea`, `taste`, `files.png` / `files.json`, `reasons` and `replayExact`.
- `sheet` is a contact sheet of all candidates.
- `--min-score` oversamples up to 3×count. If fewer posters pass, `warning` says so; exit code 5 means none passed.
- Other options: `--ratio 9:16`, `--direction d2` (from resolve), `--format png,svg`, `--scale 2`, `--seed` (to reproduce).
- Missing CJK glyphs are patched automatically from the full fonts (reported in `fonts`). Use `--no-font-fix` for strict app parity.

### 4b. Read the reports (correctness before beauty)
Each poster has a `report`, and `poster-printer --json audit FILE` gives the same for any poster:
- `gates`: content drawn verbatim, checked text contrast (WCAG 2.2 thresholds), min_size at `context.display`,
  cjk (CLREQ) and glyphs. Each is pass / fail / n/a with measured values and regions. `gates_passed` and
  `blocking_failures` summarise them. A poster with `flagged: true` failed a blocking gate. Never present it
  as finished, however high its taste.
- `aesthetic`: classical / expressive / color / craft facets plus `overall` (taste − penalty). `null` means not judged.
- `issues[]`: `dimension`, `region` [x, y, w, h], `evidence`, `impact`, and `fix.command` (a ready
  `refine …` / `variations …` command).

### 5. Show
Show the user the contact sheet (`sheet`) or the top 2–3 PNGs, with the style, idea and one-line reason for each.
Let them pick. Don't just report scores.

### 6. Refine
The refine loop: audit → apply the fix command of the most important issue (blocking first, then by impact)
→ audit again → stop when the gates pass and the user is happy. Work on the chosen poster as a project. It is saved after every change, and undo/redo is stored in the file:
```bash
P="--project out/01-….json"
poster-printer --json $P refine --set titleScale=130 --set margin=6   # params: catalog params
poster-printer --json $P refine --text sub="新的副标题" --text groups.0.note="opening"
poster-printer --json $P refine --style zh-song-edit      # new style, same copy / palette / pictures
poster-printer --json $P refine --ratio 9:16
poster-printer --json $P variations --vary color -n 6 -o var/ --pick 3   # layout|structure|color|image|decor|tendency
poster-printer --json $P audit                             # gates, overlaps, contrast, type sizes
poster-printer --json $P undo        # / redo / history
poster-printer --json $P export --format png@2x -o final.png   # png png@2x png@4x jpg svg svg-light pdf json
poster-printer --json $P deck --pages 6 -o deck/                # multi-page PDF, shared palette and grid
```
`refine` writes a PNG next to the project; show it after each change. Use `--dry-run` to try without saving.

## Reference
- Catalogues: `styles list [--mood calm]`, `styles show ID`, `palettes search --light dark --tag noir --near '#c33'`,
  `fonts list --cjk`, `fonts pairings --mood literary`, `fonts check --brief brief.json [--fix]`,
  `images list --category landscape --cutout`, `images add photo.jpg`, `catalog ideas|comps|params|ratios|exports`.
- Text slots for `--text`: `headline`, `sub`, `note`, `groups.N.main|sub|note`, `prose.N`, `meta.N`, `words.N`.
- Exit codes: 0 ok · 1 engine · 2 usage / invalid · 3 missing file · 4 output verification failed · 5 nothing reached min-score.
- The REPL (`poster-printer` with no arguments) holds one poster in memory: `open`, `generate`, `refine`, `undo`, `save`.

## Brief context (drives the checks)
`"context": {"use": "promo", "audience": "…", "display": {"kind": "print", "print_size": "A2", "viewing_distance_m": 1.5}, "priority": ["title","date","venue","program"]}`
- `display.kind`: phone-thumbnail | phone | screen | print. It sets the large-text contrast threshold and the
  minimum text size. `resolve` raises the small-text scale to meet it.
- `priority`: the first four entries are the required fields (they must be drawn, legible and in contrast), and
  the size order is compared against it.
Ask the user where the poster will be seen and what must be found first.

## Methodology note
The aesthetic scores are relative, model- and heuristic-based signals for comparing candidates of one brief.
They are not absolute quality judgments. The taste selector was trained on a single rater's ratings so far:
treat it as one opinion that needs human calibration. The gates are approximate measurements (layout boxes,
pixel-sampled contrast, modelled display sizes). "Checked text contrast" is not WCAG compliance. Always look
at the images and let the user judge.

## Good practice
- Content first: a poster with the real timetable beats a prettier poster with placeholder text. Never pad with invented copy.
- Keep copy short. A long `body` produces small type, so offer a shorter version.
- For bilingual posters, give both titles and pick the hero language with `language` and field order.
- Fix blocking gate failures before polishing aesthetics. Treat taste ≥ 7 as strong and 6–7 as decent for this engine, but look at the images yourself.
- Hand off to a human designer by giving them the Poster JSON: it opens in the web app unchanged.

## Limits
- User images and patched glyphs don't exist in the web app, so those posters don't round-trip exactly.
- Deck pages repeat the cover's copy.
- `--backend node` is approximate: it has no browser, so text measurement differs.

## Version
0.1.0
