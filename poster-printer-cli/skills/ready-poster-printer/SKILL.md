---
name: >-
  ready-poster-printer
description: >-
  Make finished posters from the user's real copy and pictures with the Ready Poster Printer engine (CLI). Read the
  pictures and copy, choose a Swiss-grid layout (one hero picture, a set of pictures of different sizes on a modular
  grid, or a full-bleed edge-to-edge picture grid), write a content brief, generate ranked candidates, check them, refine,
  and export PNG/SVG/PDF or app-compatible Poster JSON. Use for event, exhibition, talk, music, product, menu and
  announcement posters in Chinese, English or both, especially when the user hands over several photos.
---

# ready-poster-printer

**Ready Poster Printer** is a generative typographic poster app. This CLI runs the app's real engine (headless
Chrome/Edge; every image matches the web app). Posters are saved as the app's Poster JSON: import it in the app
(Export ▸ Import JSON) to keep editing by hand.

Commands: `ready-poster-printer` (aliases `cli-anything-ready-poster-printer` and the older `poster-printer`).
Always pass `--json` when you parse the output.

**Before choosing a layout, read [LAYOUT_METHOD.md](LAYOUT_METHOD.md)** (in this folder). It is the method for turning
the user's pictures and copy into a layout decision.

## Install

```bash
cd poster-printer-cli/engine && npm ci && npm run build      # needs the app checkout next to it (REA_POSTER)
python3 -m venv ../agent-harness/.venv && ../agent-harness/.venv/bin/pip install -e ../agent-harness
ready-poster-printer doctor     # node, browser, engine bundle, app assets, fonts
```

Requirements: Python ≥ 3.10, Node ≥ 20, and Chrome, Chromium, Edge or Brave (found automatically on Linux, macOS and
Windows; or set `POSTER_PRINTER_CHROME`). `--backend node` works without a browser, but approximately.

## Workflow: material → layout decision → brief → resolve → generate → check → refine → export

### 1. Collect the real content
Never invent facts: ask for anything that is missing.
- **Must have:** the title (in every language that should appear).
- **Usually needed:** date and time (plus an end date for a run), venue and city, price or ticket, organiser.
- **The list that makes the poster:** a programme with times, a lineup, or speakers with roles.
- **Optional:** subtitle or slogan, a short body or quote, edition, URL, hashtags.
- **Where it will be seen:** print size, phone, screen. This drives `context.display`.
- **Intent in plain words:** mood, light or dark, how much air.

### 2. Read the pictures
If the user has pictures, add them and read the summary:
```bash
ready-poster-printer --json images add hero.jpg a.jpg b.jpg c.jpg   # stable ids (content hash); ratio, orientation, subject, busyness, palette
ready-poster-printer --json images inspect ID1 ID2 ID3 ID4          # the set: orientation mix, proportion spread, series, busyness
ready-poster-printer --json catalog layouts                         # the grid layouts and when each fits
```
Decide with the user which picture is the **hero** (it goes first) and whether all of them belong on the poster.
Then pick the layout type with **LAYOUT_METHOD.md §3**, or let the resolver recommend it (step 4).
Without pictures from the user, `imagery.use` = `none` / `accent` / `hero` draws from the bundled library.

### 3. Write the brief
`ready-poster-printer brief template --lang zh > brief.json` (or `--lang en`), then fill it in.
- Only `content.title` is required.
- Write lists as arrays: `"program": ["20:00 苔原 Tundra — opening set", …]`, or `[{"time":"20:00","title":"…","who":"…"}]`.
- Set `content.language` (`zh`, `en` or `bilingual`). Use `title_alt` for the title in the second language.
- Pictures go in `style.imagery`:
  ```json
  "imagery": { "use": "hero", "files": ["hero.jpg", "a.jpg", "b.jpg"], "layout": "auto" }
  ```
  - `files` are added automatically. `ids` from `images add` work too.
  - Order = importance: the first is the hero.
  - `layout` is one of `auto | hero | flow | steps | strip | blocks | mosaic | rows | single`.
  - `use: "full-bleed"` leans to the edge-to-edge bleed grid.
  - `count: N` asks for N library pictures when the user gives none.
- Check it with `ready-poster-printer --json brief validate brief.json`. Exit code 2 means errors; warnings name ignored fields.

### 4. Resolve (look before you render)
`ready-poster-printer --json brief resolve brief.json` returns:
- `analysis`: language, field hierarchy, the detected list, dates, title shape, copy load.
- `copy_slots`: exactly which copy goes where.
- `layouts.set`: the picture-set analysis.
- `layouts.recommendations[]`: `composition / layout / score / reasons`, best first.
- `directions[]`: style × layout (or idea), with params (`composition`, `gridLayout`) and `reasons`.
- `palette`, `format`, `reasons`, `warnings`.

Several pictures make every direction a grid layout, because the other compositions show only the first picture.
If the recommendation contradicts the user's intent, set `imagery.layout` and resolve again.

### 5. Generate
```bash
ready-poster-printer --json generate --brief brief.json --count 6 -o out/
# quick mode, no brief file:
ready-poster-printer --json generate --title "边缘观测" --date 2026-11-21 --venue "南岸美术馆" \
  --image hero.jpg --image a.jpg --image b.jpg --layout auto -n 6 -o out/
```
- The result has `posters[]`, ranked. Each poster has `rank`, `style`, `comp`, `layout` (the grid layout used), `idea`, `taste`, `files.png` / `files.json`, `reasons` and `report`.
- `sheet` is a contact sheet of all candidates.
- Options: `--ratio 9:16`, `--direction d2`, `--format png,svg`, `--scale 2`, `--seed`, `--min-score 6.5`.

### 6. Check (correctness before beauty)
Each poster has a `report`; `ready-poster-printer --json audit FILE` gives the same for any poster.
- **`gates`** are pass / fail / n/a, with measured values and regions:
  - `content`: the copy is drawn verbatim.
  - `contrast`: checked text contrast (WCAG thresholds).
  - `min_size`: text size at the display set in `context.display`.
  - `cjk`: CLREQ line rules.
  - `glyphs`: missing characters.
  - `images`: every given picture is drawn and readable. Per picture it gives `crop_loss` and `subject_visible`.
- `flagged: true` means a blocking gate failed. Never present a flagged poster as finished.
- **`issues[]`** carry a `region`, `evidence` and a ready `fix.command`.
- Then look at the images yourself with LAYOUT_METHOD.md §5:
  - the hero reads first;
  - there is no empty band in the middle;
  - the type is large on its fields;
  - the colour is disciplined.

### 7. Show
Show the contact sheet (`sheet`) or the top 2–3 PNGs. For each, give the layout (`comp/layout`), the style and the
one-line reason. Let the user pick; don't just report scores.

### 8. Refine
Work on the chosen poster as a project. It is saved after every change, and undo/redo is stored in the file.
```bash
P="--project out/01-….json"
ready-poster-printer --json $P refine --set gridLayout=steps            # another grid layout, same pictures
ready-poster-printer --json $P refine --set composition=bleedgrid --set gridLayout=mosaic
ready-poster-printer --json $P refine --set composition=build --set archetype=masthead     # 构成编排: pin a page archetype
ready-poster-printer --json $P refine --set composition=build --set construction=ticket   # … or the main text construction
ready-poster-printer --json $P refine --set titleScale=130 --set margin=6
ready-poster-printer --json $P refine --text sub="新的副标题" --text groups.0.note="opening"
ready-poster-printer --json $P refine --style zh-song-edit             # new style, same copy / palette / pictures
ready-poster-printer --json $P refine --ratio 9:16
ready-poster-printer --json $P variations --vary layout -n 6 -o var/ --pick 3   # layout|structure|color|image|decor|tendency
ready-poster-printer --json $P variations --vary type -n 4 -o var-type/          # 排字 only: every picture frame stays
ready-poster-printer --json $P variations --vary place -n 4 -o var-place/        # 图位: pictures move, type re-set around them
ready-poster-printer --json $P variations --vary grid -n 4 -o var-grid/          # 网格: a new grid system, same layout idea
ready-poster-printer --json $P audit
ready-poster-printer --json $P undo        # / redo / history
ready-poster-printer --json $P export --format png@2x -o final.png      # png png@2x png@4x jpg svg svg-light pdf json
ready-poster-printer --json $P deck --pages 6 -o deck/
```
- `refine` writes a PNG next to the project; show it after each change. Use `--dry-run` to try without saving.
- **Change one layer of the structure when the user likes the rest.** The structure has three layers, and each can be re-rolled alone:
  - "I like where the pictures are / that they run full bleed, but the text…" → `--vary type`. Breaks, alignment, headline size, colour and where the info sits change; every picture frame is kept (`layer.picturesKept`).
  - "The text is good, move the pictures" → `--vary place`. In full-bleed / set-plate layouts (`layer.fixedPlacement: true`) the picture position is part of the design; use `--vary structure` or change `composition`.
  - "Same idea, different rhythm / margins" → `--vary grid`.
  - `--vary structure` / `layout` re-does all three. Use it only when the user wants a different layout.
  - On a 构成编排 poster (`comp: build`, `picked.kind: build:<archetype>`) every layer variation shows something new:
    - `--vary type` sets the copy in another construction;
    - `--vary place` moves to another page archetype and keeps the construction where it fits;
    - `--vary grid` moves the page onto another grid (margins, columns, rows) and keeps archetype and construction.
  - Show the variations side by side and let the user pick (`--pick N` puts one into the project, undoable).
- **The loop:** audit → apply the most important fix (blocking first, then by impact) → audit again. Stop when the gates pass and the user is happy.

## Reference
- Catalogues: `styles list [--mood calm]`, `styles show ID`, `palettes search --light dark --tag noir --near '#c33'`, `fonts list --cjk`, `fonts pairings --mood literary`, `fonts check --brief brief.json [--fix]`, `images list [--user]`, `images add FILE…`, `images inspect ID…`, `catalog layouts|ideas|comps|params|ratios|exports`.
- Grid params for `refine --set`: `composition` (`build`, `modular`, `bleedgrid`, …), `gridLayout`, `cols`, `rows`, `margin`, `gutter`, `imageCount`, `titleScale`, `smallScale`.
- Construction params (composition `build`): `archetype` (`photoBand`, `fullBleed`, `openSide`, `masthead`, `centreFrame`, `windowInset`, `split`, `plate`, `strip`, `mosaic`, `giantBlock`, `typeFill`, `latinArch`, `gate`, `scattered`, `quietEmblem`, `totem`, `infoForm`, `colourMass`) and `construction` (34 ids: `catalog params`). `auto` draws. LAYOUT_METHOD.md §8 says which fits which copy.
- Text slots for `--text`: `headline`, `sub`, `note`, `groups.N.main|sub|note`, `prose.N`, `meta.N`, `words.N`.
- Exit codes: 0 ok · 1 engine · 2 usage / invalid · 3 missing file · 4 output verification failed · 5 nothing reached min-score.

## Brief context (drives the checks)
```json
"context": {"use": "promo", "audience": "…", "display": {"kind": "print", "print_size": "A2", "viewing_distance_m": 1.5}, "priority": ["title", "date", "venue", "program"]}
```
- `display.kind` is `phone-thumbnail | phone | screen | print`. It sets the large-text contrast threshold and the minimum text size. `resolve` raises the small-text scale to meet it.
- `priority`: the first four entries are the required fields, and the size order is compared against it.

## Good practice
- **Content first.** A poster with the real timetable beats a prettier one with placeholder text. Never pad with invented copy.
- **The user's pictures are the user's.** Use the ones they give, in their order of importance. Suggest cuts; don't make them silently.
- **Few strong pictures beat many weak ones.** 2–6 is the comfortable range for one poster.
- **Keep copy short.** A long `body` makes small type; offer a shorter version.
- **Bilingual posters:** give both titles, and pick the hero language with `language` and field order.
- **Fix blocking failures first.** Taste ≥ 7 is strong for this engine, 6–7 decent, but look at the images yourself.
- **Hand-off:** give a human designer the Poster JSON; it opens in the web app unchanged.

## Limits
- User pictures and patched glyphs don't exist in a different machine's web app, so those posters don't round-trip there exactly.
- The subject box of user pictures comes from a simple saliency model. For a clean cut-out subject, run the optional cut-out server.
- Deck pages repeat the cover's copy.
- `--backend node` is approximate: it has no browser, so text measurement differs.

## Version
0.4.0 (phase 18: the construction engine — composition `build`, `archetype` / `construction` params)
0.3.0 (phase 17: the structure in layers — `variations --vary grid|place|type`)
0.2.0 (phase 16: Swiss modular grid, several pictures, bleed grid)
