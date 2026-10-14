# Phase 18: the construction engine (构成编排)

## Why

After phase 17 the structure could be re-rolled in three layers (网格 grid / 图位 placement / 排字 type). On their own,
none of the layers gave good results. A grid re-roll barely showed, a placement re-roll often looked like the same page,
and a type re-roll changed little more than line breaks. Across draws there was little variety.

The underlying algorithm was the limit. Each composition hard-coded where a picture goes and how its headline is set.
There was no model of what a designer actually varies. This phase rebuilds that model from the material the
designer collected (阿冲's course and reference library) and puts a new composition, `build` (构成编排), on top of it.

## The study

**Sources:**
- The course 《零基础版式入门课》: 17 lessons, transcribed.
- The designer's own PSD boards: 文字组全流程拆解 and Design Note, about 55 boards. The layer dump covers 10,681
  layers in 1,665 groups, with sizes, gaps and attachments measured from the layer boxes.
- Reference sets, read as contact sheets:
  - book covers by 王志弘 (Wang Zhi-Hong);
  - Sports Graphic Number magazine covers;
  - WeChat article and e-commerce titles (研习公众号标题, 详情标题);
  - micro typesetting (微排版), pure constructions (纯构成), 豆腐块 modules, coupons, spec tables and icons;
  - a design-history picture library.

The rules below are the ones the engine implements. The numbers are measured or estimated from those sources.

### A layout has four parts

背景 background + 主体 subject (a picture or giant type) + 主信息编排 the main text group + 辅助信息编排 the
auxiliary info.

The auxiliary info fills the secondary space, usually a band at the top or bottom edge. It adds point, line and plane
elements. Its wording barely matters, but with real copy nothing is invented.

### A text group is a construction

Abstract a text group to grey bars, one per line or element. What remains is its construction:

- **Levels.** Sizes are multiples of the smallest size u, drawn from {1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 11}.
  - Measured ratios between adjacent levels peak at 1.5, 2, 3 and 3.5.
  - A display group's top / next ratio is 2.2–3.7. An information group stays within {1, 1.5, 2, 2.5}.
  - Levels must differ by at least 1.5×. Two sizes that are almost the same are a mistake.
- **Gaps are member heights**, never free numbers.
  - Stacked levels sit one line of the smaller level apart. A title and its own sub sit half a line apart. Two
    separate blocks sit 1.5 lines apart.
  - Measured: a stacked gap ≈ 0.42× the small size.
- **Leading and tracking.**
  - Display leading 0.9–1.0 (two-line interlocks down to 0.8); information 1.12–1.25.
  - Display tracking −20…−45/1000.
  - Positive tracking appears only on deliberately spaced lines, and then it is extreme (+300…+900), never +50.
- **Width rhythm.** 短长中, 中长短, 小大中, 中大小, 中小大, or equal (justified).
  - Han titles break on phrase boundaries: 写给 / 失眠街区的笔记, never 写给失 / 眠街区的笔记.
  - A two-line title is short-long about 60% of the time.
- **Attachment.**
  - Side by side is as common as stacking in the PSDs. Top-aligned attachment comes first.
  - A side stack spans exactly the big word's cap height (the **label lock**). A small block floating at mid-height
    beside a big word never occurs.
- **Closure.** A notch in the bbox is filled until the group reads as a rectangle (or a clean triangle or diamond):
  - a short last line gets a dot or `!!!`;
  - a short first line gets ✳;
  - an empty corner gets ©, ™ or #N;
  - an empty row end gets a rule;
  - a short line can also be letterspaced to the width (only with ≥ 4 characters).
- **Justified bricks.** Lines are rescaled so their widths match. The sizes then come from the character counts, and the
  shortest line becomes the giant.
- **Accent.** One spot colour, on one level only: the numeral, the bracketed part, or one word.
- **Font pairing.** By class: 黑体 humanist / transitional / modern with the matching sans, 宋体 with serifs.
  - The Latin face is set one weight lighter than the CJK.
  - Digits are set in the Latin face.

Designers keep a library of constructions and **transfer** them to new copy, then apply operators:

- **refine**: split a level, re-break, justify by size, letterspace to width, promote or demote, rotate to a spine,
  set vertical, colour split, swap faces;
- **combine**: stack on one axis, side-lock, flank, hang an under-row, interlock, overlap, enclose, frame, stamp,
  backdrop;
- **add**: a date, an English line or a label, or a graphic (a dot, a rule, a tag) to complete the target rhythm.

### Covers, and pictures with type

- **Title scale is bimodal.** It is quiet (0.06–0.13 W) or giant (0.19–0.42 W), never in between. Small text runs
  0.014–0.03 W.
- **Every small item aligns to a big item's edge.** Hairlines connect zones. The empty field is one contiguous block.
- **No gradient scrims.** Type sits on a flat zone of the picture, otherwise on a solid band.
  - Titles never touch the face.
  - Text is placed on the open side of the subject.
- **Masthead occlusion.** The subject may cover at most 35% of a masthead, and never its first or last letter.
- **Cover-line entries.** Tag 0.5 / name 1 / quote 0.65.

### Auxiliary info

- **Bands.** 0.04–0.12 H at the top or bottom edge, on a 4–5 column pitch with one pitch left empty.
- **Sizes.** At most 3 per band: anchor, label, tiny.
- **Tiny paragraphs.** A tiny paragraph is a line element: its block stands 1.0–1.3× as tall as the label beside it.
- **Marks.** Role leaders (`name —— role`), mirrored corner groups, a dot or a barcode as the point.

### Anti-patterns (the boards mark them as "before")

- every line at one size, flush left;
- arbitrary gaps;
- ragged bboxes in compact groups;
- side stacks not locked to the cap height;
- more than one accent;
- loose display leading (> 1.0);
- positive tracking on big Han titles;
- satellites in the middle of nowhere;
- decoration without a bar structure underneath.

## What was built (`src/engine/build/`)

| File | Role |
|---|---|
| `types.ts` | The construction DSL. A tree of boxes (`col` / `row`, alignment, gap, frame, label `lock`, `fill` rows, indent `dx`, raise `dy`). Text leaves (slot or literal, size in u, face, weight, case, tracking, leading, wrap, `fit: 'width' / 'track'`, vertical / rotated, accent). Marks (rule, dot, arrow, star, barcode…). |
| `copy.ts` | The copy as slots: title, its CN / EN forms, sub, number + unit, date (parsed into parts; a weekday only with a year), year, items, meta, paragraph, index. Real copy is never padded with invented words or numbers. |
| `lines.ts` | Title breaking: phrase-aware Han breaks with profiles (ascending, descending, balanced, middle-longest); Latin short-long / long-short / balanced; reference shares. |
| `realize.ts` | The realiser. Script runs (Han in the CJK face, Latin and digits in the Latin face), measured lines, cap heights and descenders, wrap. Justified lines (scaled or letterspaced to the column), label lock, filling rows (cells spread, or a rule takes the rest), baseline-to-baseline stacking of same-size lines (size × leading), indents and raised cells inside the box. `fitGroup` realises linearly at a base unit A and scales exactly, rejecting a fit whose smallest text would be illegible. `emit` writes scene nodes. |
| `library.ts` | 34 constructions (below). Each is a generator over the copy, drawing its breaks, closures and accents from its own stream. |
| `aux.ts` | Auxiliary bands: columns on the page grid's pitch, pairs (a number anchor + label / value), handle (a label + a tiny paragraph as tall as it), leaders, mirrored corners, centred; plus a rotated edge strip. Shrink-to-fit or drop; nothing is repeated across bands. |
| `grid.ts` | The grid layer: a modular page grid (below). |
| `page.ts`, `pages2.ts` | 19 page archetypes (below), `placeMain` (choose and fit the main group in a room), `calmBox` (is a picture region fit for type?). |
| `compose.ts` | The `build` composition: grid, archetype, signature. |

### The 34 constructions

The first 19 come from the course and the reference sets; the rest come from the designer's PSD boards (T-numbers in
the study's catalogue).

| id | zh | en | needs | shape |
|---|---|---|---|---|
| `flush-stack` | 单边 | Flush stack | title | square |
| `centred-stack` | 居中 | Centred stack | title | square |
| `justified-brick` | 两端齐 | Justified brick | title | square |
| `cn-en-justify` | 中英等宽 | CN / EN justified | title.cn, title.en | square |
| `two-level` | 二层级 | Two levels | title | square |
| `display-en` | 西文叠 | Display EN stack | title.en | square |
| `kicker-title` | 小大中 | Kicker-title-EN | title | square |
| `badge-close` | 闭合矩形 | Closed rectangle | title | square |
| `staircase` | 阶梯 | Staircase | title | wide |
| `number-lock` | 数字锚 | Number + locked stack | num | wide |
| `date-group` | 时间组 | Date group | date | wide |
| `price` | 价格 | Price lockup | num | wide |
| `vertical` | 竖排 | Vertical columns | title | tall |
| `side-note` | 扁横向 | Title + side note | title | band |
| `bracketed` | 括号组 | Bracketed | title | wide |
| `general-specific` | 总分 | Title + items row | title, item | wide |
| `stamp-grid` | 印章格 | Stamp grid | title | square |
| `single-axis` | 单轴 | Single axis | title | tall |
| `latin-short-long` | 西文短长 | Latin short-long | title.en | wide |
| `sandwich` | 小大小夹心 | Small-BIG-small (T05) | title | square |
| `rule-sandwich` | 双线夹心 | Rule sandwich (T07) | title | wide |
| `numeral-hero` | 大数字主体 | Numeral hero (T08) | num | square |
| `side-lock` | 等高侧栏 | Cap-locked side stack (T09) | title | wide |
| `flank` | 左右护翼 | Flanked centre (T10) | title | band |
| `two-col` | 两端双栏 | Two columns, both ends (T11) | title | wide |
| `spine-split` | 中轴分栏 | Spine split (T12) | title.cn, title.en | square |
| `title-para` | 标题段落同行 | Title + paragraph (T14) | title | band |
| `under-row` | 等宽下挂行 | Justified under-row (T15) | title | wide |
| `ticket` | 票据框 | Ticket frame (T16) | title | wide |
| `rule-fill` | 规线补齐 | Rule-filled rows (T17) | title | wide |
| `split-spread` | 拆字撑宽 | Split spread (T31) | title | band |
| `inline-chain` | 单行串联 | Inline chain (T32) | title | band |
| `emblem` | 徽标压顶 | Emblem over text (T25) | title | square |
| `corner-sat` | 四角卫星 | Corner satellites (T34) | title | square |

A construction declines copy it cannot set well and returns nothing. For example, `side-lock` needs a short title,
`split-spread` needs 2 or 4 Han characters, and `title-para` needs a paragraph.

### The 19 page archetypes

| Archetype | Needs | What it does |
|---|---|---|
| `photoBand` | a picture | Photo bleeds off the top (left / right on wide formats) and stops on a row line; the type hangs from the next row line, its measure in whole columns |
| `fullBleed` | a picture | The type sits on a calm, high-contrast zone of the photo; otherwise the page becomes a photo band |
| `openSide` | a picture | Subject on one side, type column on the open side, cover lines above |
| `masthead` | a picture | Full-width wordmark; a cut-out subject may occlude its middle letters (≤ 35%) |
| `centreFrame` | a picture | Centred frame over whole columns; a vertical Han title in the flank; aux under the frame's left edge |
| `windowInset` | a picture | A picture window on a colour field; the vertical title in the margin columns |
| `split` | a picture | Picture bleeds over half the page, stopping on a column / row line; type on the other half |
| `plate` | a picture | A small framed picture at an optical point; quiet type (beside it on wide formats) |
| `strip` | ≥ 2 pictures | 2–4 equal frames in one row band, captions from the programme, type above or below |
| `mosaic` | ≥ 2 pictures | One large frame and one or two small ones on the same row lines |
| `giantBlock` | — | A 2×2 block for four Han characters, a vertical pair for two, else a giant group |
| `typeFill` | — | The title fills 55–80% of the page as a justified or closed block |
| `latinArch` | — | A Latin title as architecture: short line, then the long line justified; Han name small and vertical |
| `gate` | — | Title letterspaced across the top, a hairline, two verticals on column lines, vertical side texts |
| `scattered` | — | Title characters on a sparse module grid; empty cells hold a circle |
| `quietEmblem` | — | A circle-family emblem as the subject; quiet type under it (beside it on wide formats) |
| `totem` | — | A centred axis: one full-width band and narrower centred bars |
| `infoForm` | — | A hairline form for ≥ 4 info groups, its middle line on a column edge |
| `colourMass` | — | Colour masses (blobs or rotated squares) behind a closed text block |

### The three layers in `build`

**网格 Grid (`ctx.rg` → `makeGrid`).** The grid stream draws a modular page grid:

- side margins (0.045–0.08 of the short side), and an even, deep-foot or deep-head top and bottom;
- columns: 4 / 5 / 6 / 8 / 12, or 6–12 on landscape;
- a gutter of 0.5–1× the margin, never more than 0.3 of a column;
- rows of near-square or half-square modules, each at least 1.5 gutters tall.

Every archetype reads its geometry from this grid:

- a photo stops on a row's bottom line, and the type hangs from the next row line;
- frames, rooms and the group's measure span whole columns (a centred frame keeps the grid's parity);
- aux columns sit on the column starts.

A grid re-roll keeps the archetype and, wherever it still fits, the construction. It moves both onto another grid.

**图位 Placement (`ctx.rng`).** The archetype and where the subject sits. A placement re-roll draws another archetype
(the one it had is avoided). The type layer's choices travel with it, so the same construction is kept when it suits
the new room.

**排字 Type (`ctx.rt`).** Which construction, its breaks, closures, accents and alignment, and the aux kinds.

- Each main group draws from its own fork of the type stream (`main0`, `main1`…). That fork gives a weighted order
  over the whole library. The first construction in that order that suits the room and fills it well is kept.
- A type re-roll moves away from the constructions the poster used. They go to the end of the order.
- Every picture frame stays exactly where it is.

What a re-roll moved away from is stored with the poster (`Picked.avoid`) and passed back on replay. History, undo
and the CLI therefore replay a re-rolled poster exactly.

### Type on pictures (`calmBox`)

The covers never use scrims, so type goes on a picture only where the picture itself can carry it:

1. The group is first fitted dry (`placeMain(…, { dry: true })`).
2. The box it would really cover is judged, not the room's average. A room's average hides a bright head or a busy
   corner.
3. The box is split into 12 parts (4 × 3).
   - The box must be calm on the detail map (busyness ≤ 0.45), and no part may exceed 0.6.
   - The same ink must read on every part: light ink needs every part's lum ≤ 0.42, dark ink needs ≥ 0.55.
4. The type stays off the subject: the subject may take at most 8% of the box, and the box at most 6% of the
   subject.

The same check guards a masthead's lower group, an open side's cover lines and a full bleed's rotated edge strip. When
no candidate passes, the page falls back to a solid band (a masthead keeps its picture and adds a solid band at the
foot).

### Real copy: shown whole, readable, findable

Real copy is the app's custom copy, or copy that arrives with facts (the CLI's briefs). Three rules keep it intact.

- **Never cut.** A fact (date, venue, price, programme line, subtitle) that is too long for a leaf is not shortened.
  The leaf drops it instead.
- **Never dropped (`ensureFacts`).** After the page is composed, every meta entry and the date must be on the page
  verbatim. Anything missing is set as a small block in a free corner:
  - on the paper when a corner is free;
  - on a picture, always on a solid tag.
- **Never unreadable (`backSmallText`).** Text set on a picture must reach WCAG contrast (4.5:1 small, 3:1 large,
  with a margin) at the darkest or lightest point under it.
  - The picture is read from a coarse brightness map. On a busy part of the picture, fine detail makes any ink
    unsafe, so the text gets a solid tag (one per cluster of adjacent lines, never over other text).
  - On a calm part, the unit gets the one ink that passes.
  - Headlines are never tagged.

**Units.** A construction sets each line and script run as its own node: Han in the CJK face, Latin and digits in
the Latin face. Nodes that show the same copy share a `unit` id. The CLI's content gate reads a unit as one text, so
a broken title or a mixed-script fact is found verbatim.

### Several pictures

`strip` and `mosaic` show 2–4 pictures on the grid. A build draw with one selected picture takes 2–3 companions from
the pool about a quarter of the time. This uses its own stream, never applies when pictures are locked or given, and
stores the ids with the draw. With two or more pictures, the multi-picture archetypes are 4× as likely.

### Selection

- `build` takes 70% of new automatic draws (50% when the draw has several pictures). The other compositions share
  the rest.
- Session variety works on page archetypes: `Picked.kind = 'build:<archetype>'`. The last archetype is 8× less likely,
  and the one before 2.5×.
- The `archetype` and `construction` params (Advanced › Layout / Type, CLI `refine --set`) pin either one. `auto`
  draws.

## Compatibility

`build` is new, so no stored poster used it. Posters of every other composition replay exactly as before:

- `tests/layers.test.ts` checks the phase-16 fingerprints;
- legacy single-stream posters are unaffected;
- every change outside `build/` is guarded by `comp === 'build'` or by a field that older posters do not have
  (`kind`, `avoid`).

## Tests and QA

**`tests/build.test.ts`:**
- 60 pages over 6 formats, 6 styles, custom copy and type-only pages. On each, the title is set, no line appears
  twice, and all text is on the canvas and legible (≥ 0.0095 S).
- Exact replay.
- < 15% gate failures.
- A type re-roll keeps every picture frame and changes the type (≥ 17/20).
- A type re-roll changes the construction, and a placement re-roll changes the archetype. Both replay exactly.
- A grid re-roll keeps the archetype and mostly the construction (≥ 60%), and moves the page (≥ 85%).
- Every archetype × every format keeps its text on the canvas.
- Title breaks (a break never splits a common two-character word); date parsing; every construction instantiates; the
  params list every archetype and construction.

**CLI, real copy:** three briefs (Chinese event, English event, Chinese exhibition with a date range), 8 candidates
each. Build posters pass every blocking gate (content, contrast, minimum size), and one ranks first. `gate_failed`
entries now carry each blocking issue's evidence and region (`why`).

**By eye:**
- a gallery of all 34 constructions on a type-only page and a photo band;
- every archetype at 3:4 and 16:9;
- full-bleed and open-side pages over 18 seeds;
- strip / mosaic;
- 24 automatic draws in the app;
- 网格 / 图位 / 排字 re-roll sequences in the app.

**Lab:**
```
lab.html?n=1&comp=build&ratio=3:4&w=300&seed=x&p=archetype:masthead,construction:ticket
```

## Limits

- Constructions are realised from the copy the engine has. A construction that needs a paragraph or a number does not
  appear without one.
- Picture analysis is a 16 × 16 detail map and a luminance sample. Illustrations with large flat areas can read calmer
  than they look.
- The older compositions remain in the mix (30%) and keep their own quality.
