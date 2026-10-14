# Layout method: from the user's pictures and copy to a Swiss grid layout

This is the reasoning to do before you write a brief. The engine applies the same rules (the resolver's `layouts`
recommendations and `reasons` come from them), so you can predict and explain what it does, override it when the
user's intent says so, and judge the results.

Layout names: `modular` (模块网格) with `hero` 主图卫星 · `flow` 悬挂线 · `steps` 尺度递进 · `strip` 图片横条 ·
`blocks` 模块分区; `bleedgrid` (满版拼图) with `mosaic` 满版拼贴 · `rows` 满版行列; `single` = the one-picture compositions;
`build` (构成编排) = a page archetype plus a text construction (§8).

---

## 1. Read the material

Add every picture first (`ready-poster-printer --json images add a.jpg b.jpg …`). The summary gives what you need:

| Field | Meaning | Why it matters |
|---|---|---|
| `ratio`, `orientation` | w/h: tall < 0.6 · portrait < 0.88 · square ≤ 1.14 · landscape ≤ 1.9 · panorama | spans are fitted to it; extreme ones (panorama, tall) crop hard in equal cells |
| `subject` | box (0–1) of the salient subject | the crop always keeps it; a small subject tolerates tighter spans |
| `busy` / `detail` | calm < 0.25 · moderate · busy > 0.45 | busy pictures need gutters or seams between them; never set text on them |
| `palette` | five colours | series coherence; the poster palette comes from the hero by default |

Then `ready-poster-printer --json images inspect ID…` reads the **set**: orientation mix, proportion `spread` (0 =
alike, > 0.35 = clearly mixed), `series` (alike proportions and related colour), mean busyness.

Read the copy the same way:

- **Title length** sets the display. Short titles (≤ 4 Han / ≤ 2 words) want big type in a band. Long titles set on 2–3 lines.
- **A list** (programme, lineup, speakers) of 4 or more items needs its own column.
- **Body copy** over about 2 lines needs room. Ask whether it can be cut.
- **Mood and density**: calm / minimal / elegant / airy, or bold / loud / packed.

## 2. Decide what the pictures are for

Ask the user, or infer and say so:

1. **Is there a hero?** Is there one picture that carries the message (the product, the main work, the venue)? It goes first in `imagery.ids`.
   Without a hero, the pictures form a **series** (same shoot, same proportion, related colour) or a **collection**
   (different things, mixed proportions).
2. **How many should really be on the poster?** 2–6 read well, and the engine shows at most 8. Cut pictures that
   repeat a subject, fight the hero's colour or are low resolution. Suggest this to the user; don't silently drop
   their pictures.
3. **Order = importance.** The first id is the hero. In `steps` the order is the progression (hero last and largest).
   In `strip` and `rows` the order is the reading order.

## 3. Choose the structure

Start from the count, then adjust by proportions, copy and intent.

| Pictures | Default | Also good | Avoid |
|---|---|---|---|
| 1 | `hero` (one picture on a field span, bleeding) | `flow`; `single` for idea-led posters (cover, interleave, knockout…) | — |
| 2 | `hero` (a big–small pair) | `steps` (a direction), `strip` (a pair at one height) | `blocks` |
| 3–4 | `hero` when one picture leads | `strip` for a series, `blocks` for a catalogue, `mosaic` for mixed proportions | `steps` with 4 |
| 5–8 | `blocks` or `mosaic` | `rows`, `strip` (two rows) | `hero` unless one picture truly dominates; `flow` |

Adjust:

- **Mixed proportions** (spread > 0.35, or any panorama / tall picture) → `mosaic`. It keeps every picture whole. Equal modules crop hard.
- **A series** → `strip`, `rows` or `blocks`: the repetition is the point.
- **Busy pictures, 3 or more** → modular layouts (gutters separate them); in a bleed grid ask for seams.
- **Calm / minimal / airy / luxurious** → `flow`, `steps`, `hero` (white fields). A bleed grid reads loud.
- **Bold / loud / packed / playful** → `mosaic`, `rows`.
- **Editorial / technical** → `hero`, `flow`, `blocks` on a strict grid.
- **List ≥ 4 items or heavy copy** → `hero` or `flow` (an info column). A bleed grid needs a big type cell.
- **Long formats (16:9, 21:9)** → `hero` (hero | satellite grid | text column), `strip`, `mosaic`. No `steps`.
- **Tall formats (9:16)** → `hero` (a hero band and stacked satellites), `blocks`. Rows get thin.

## 4. Choose the format

- Use the user's medium first: print → 3:4 (A-series is close), phone story → 9:16, feed → 1:1 or 4:5 (use 3:4), screen / banner → 16:9 / 21:9.
- Most pictures landscape on a portrait sheet: `hero` (the landscape hero becomes a full-width band) or `strip` / `rows`.
- Most pictures portrait on a long sheet: `hero` with the hero as a full-height column, or `mosaic`.
- A single panorama: a full-width band on 3:4 (`hero`), or a long format.

## 5. What the engine guarantees, and what to check

**Guaranteed:**

- Every picture spans whole fields, at a span fitted to its proportion.
- The subject box stays in frame.
- The hero is the largest picture (by ≥ 1.8× in hero / steps).
- Text never sits on a picture.
- Small text shares one baseline grid and keeps ≥ 6:1 contrast on its ground.
- No text collisions.
- Every given picture is drawn (images gate).

**Check by eye (and in the report):**

- `report.gates.images.items[]`: `crop_loss` (> 0.4 warns) and `subject_visible` (< 0.85 warns), per picture.
- **The hero reads first.** If a satellite steals attention (colour, contrast), reorder the ids or drop it.
- **No hole in the middle.** White space should sit at an edge or around the type, not in a band between groups.
- **Type size.** The title should be large on its fields; info text must pass `min_size` for the display.
- **Colour.** One hue family plus the pictures; the accent is at most one spot (a colour field or a word).

## 6. Fixes

| Problem | Command |
|---|---|
| Wrong layout type | `refine --set gridLayout=hero` (modular: hero / flow / steps / strip / blocks) |
| Want edge to edge | `refine --set composition=bleedgrid --set gridLayout=mosaic` (or `rows`) |
| Back to white space | `refine --set composition=modular --set gridLayout=flow` |
| The wrong picture is the hero | change the order of `style.imagery.ids` and generate again |
| A picture crops too hard | `refine --set composition=bleedgrid --set gridLayout=mosaic`, or `variations --vary layout -n 6` |
| A tighter / looser grid | `refine --set cols=6 --set rows=8` (major grid; a strip or a large block set doubles it) |
| More breathing room | `refine --set margin=5` (percent of the short side) |
| Seams / gutters | `refine --set gutter=0` (butt-joined bleed grid) or `--set gutter=24` (px) |
| More options from the same pictures | `variations --vary layout -n 6` (new grid / template, same pictures, palette and copy) |
| The pictures are right, the typesetting is not | `variations --vary type -n 4` (every picture frame stays; breaks, alignment, size, colour and the info position change) |
| The type is right, the pictures should move | `variations --vary place -n 4` (not in full-bleed / set-plate layouts: `layer.fixedPlacement`) |
| Same layout, another grid rhythm (margins, columns, module size) | `variations --vary grid -n 4` |
| A different colour mood | `variations --vary color -n 6` |
| Title too small or large | `refine --set titleScale=130` |
| Info text too small for the display | `refine --set smallScale=120` (the gutter and baseline grow with it) |

## 7. The Swiss grid, in short (to explain choices to the user)

- The sheet is divided into **fields** by gutters. Pictures and text take whole fields, so their edges line up on
  few axes. That alignment is the calm in a Swiss poster.
- **Scale contrast** carries the hierarchy: one large picture or word, then a clear step down. Never "almost the same".
- **Bleed** gives a picture scale, but it starts from a field edge.
- **White fields** are active space, chosen per layout. A gap with no reason is a mistake.
- **Full bleed** (满版) is still a grid: pictures meet at their own proportions, and the type takes the remaining cell.

## 8. The construction composition (构成编排, `build`)

`build` sets the copy as a designed text group (a construction) on a page archetype, on a modular grid. Most automatic
draws use it. Pin it when the copy is the point (a title with a few facts), when a cover look is wanted, or when the
user wants the typesetting to feel designed rather than placed.

**Archetype by material** (`--set archetype=…`):

| Material | Good archetypes |
|---|---|
| One photo with a clear subject and open space | `openSide`, `fullBleed` (type only on a calm zone; else it becomes a band), `masthead` with a short word |
| One busy photo | `photoBand`, `split`, `centreFrame`, `windowInset` |
| One small or precious picture (object, artwork) | `plate`, `centreFrame` |
| 2–4 pictures | `strip` (a series), `mosaic` (one leads) |
| No picture, short title | `giantBlock` (2 or 4 Han characters), `typeFill`, `colourMass` |
| No picture, Latin title of 2+ words | `latinArch`, `typeFill` |
| No picture, calm / literary | `quietEmblem`, `totem`, `gate` |
| A list of ≥ 4 info groups | `infoForm` |

**Construction by copy** (`--set construction=…`):
- **Short Han title (≤ 4) + 2–4 small facts:** `side-lock` (a stack as tall as the title's cap height) or `corner-sat`.
- **A numeral is the message** (price, date, count): `numeral-hero`, `number-lock`, `price`, `date-group`.
- **≥ 3 lines of different length:** `justified-brick`, or `centred-stack` / `staircase`.
- **Bilingual title, same meaning:** `cn-en-justify`, `spine-split`, `display-en`.
- **≥ 4 small facts:** `under-row`, `ticket`, `general-specific` (not stacked).
- **A long one-line title:** `title-para`, `rule-sandwich`, `two-col` (never `side-lock`).
- **Promo / event:** `sandwich`, `bracketed`, `inline-chain`, `emblem`.

**What the engine guarantees:**
- Sizes step by at least 1.5×.
- Gaps are line heights, display leading is 0.9–1.0, and the accent sits on one level only.
- Text never sits on a busy or low-contrast part of a photo, and never on the subject.
- Real copy is never padded with invented words or numbers.
