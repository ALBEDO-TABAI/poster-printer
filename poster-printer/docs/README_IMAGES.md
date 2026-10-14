# README images

How the images in the repository README (`.github/assets/`) are made, and what we learned making them (2026-10-14).

## What the README needs

- **Every image showcase-grade.** The author judges them by layout variety and richness, like the thumbnails in the Layout library. 25 posters in 24 different layouts beat 24 posters in a handful of photo-and-title layouts.
- **Liked:** a full-bleed photo with one huge condensed serif title (Instrument Serif, the 器乐衬线 `instrument` style), and 巨字 `giant` with a torn maroon band and a cream word.
- **Called weak:** photo on top and a flat colour block holding the title (the old Sugar Lab and 侧脸 shots).
- **Check every pick at full size.** A contact sheet hides collisions: one gallery pick set a dark title over a dark numeral, which only showed at full size.

## Pictures

- Upload the pictures in the real app through the Images panel (`#library input[type=file]`), in a persistent browser profile. Uploads live in that origin's IndexedDB, so keep the same host and port.
- Serve the release build (`release/ready-poster-printer`) on a spare port: `python3 server/serve.py --port 5193 --no-open`. Port 5180 is often the author's own running app.
- Drive it with Playwright and Edge (`/Applications/Microsoft Edge.app/…`); Chrome isn't installed on the author's Mac.

## Copy

Real event copy on a locked older layout puts sample words on almost every poster (see `QUALITY_LOG.md`, "Real copy in the web app"). For showcase posters, either:

- **lock one sample text set** (`pins.textSet`: `music`, `space`, `nature`, `city`, `exhibit`, `tea`, `grid`), so every line comes from one coherent set, or
- **use real copy with 构成编排 or the automatic layout**, and check each poster's text against the copy.

Never ship a poster that mixes real copy with stray sample lines.

## Drawing from the page

Everything goes through `window.__rea` (the store). Read `getState()` again after every await:

```js
const st = window.__rea.getState().styles.find((x) => x.id === 'instrument');
window.__rea.getState().set('imgPick', [imageId]);
window.__rea.getState().setRatio('3:4');
window.__rea.setState({ styleId: st.id, fonts: st.fonts, modes: st.modes ?? [] });  // a style, no re-draw
window.__rea.setState({ pins: { composition: 'giant', textSet: 'music' } });          // what the next draws keep
await window.__rea.getState().draw();
const jpg = await window.__reaRaster(0.6, 'image/jpeg');                              // data URL
const s = window.__rea.getState();
const entry = s.history[s.hIndex];   // keep it: restore(entry, true) replays this exact poster
```

- **Sweep, then choose.** Draw every composition (41) in three styles per picture. Make contact sheets, shortlist from them, compare the finalists large, then re-render the picks at scale 0.75 with `restore(entry, true)`.
- **Recolour one role** with the palette editor: `getState().setPalEdits({ accent: '#f7d6c8' })`. Roles are `bg ink inkSoft accent alt` plus block fills `f0…f5`. The big word of `giant` is `accent`. The edit is stored with the entry.

## The re-roll strip (只换不满意的那部分)

- **Start from 构成编排 `build`.** Its 排字 / 图位 / 网格 re-rolls change the poster visibly. `giant` re-rolls barely change anything. `fullbleed` and the other `FIXED_PLACE` layouts (`engine/layers.ts`) can't move the picture, so 图位 does nothing there.
- **Steps:** `await getState().variant('type' | 'place' | 'grid')`, saving after each: base → T → T → P → R. Run three sequences per base and keep the clearest.

## Screenshots

- **Setup:** set `rea.lang` and `rea.theme` in localStorage, restore the entry, and wait 900 ms (the session saves 300 ms after a change). Then reload with a query that opens the panel: `?open=adv&intent=layout`, `?open=lib:text`, `?open=lib:images`, `?open=lib:palettes`, `?open=export`, `?view=deck`. Viewport 1440×900 at 2× DPR.
- **Crops:** the hero is the whole window scaled to 1800 px wide (JPEG q 0.86). The Advanced shot is x 432, y 173, w 2275, h 1598, scaled to 1600 px wide.
- **Gallery and strips:** rows of posters, each row scaled to fill 1800 px, 40 px padding, 18–20 px gaps, on `#141414`, corner radius 3, JPEG q 86.
- **Languages:** every UI shot comes in a zh and an en version (`*-zh.jpg`, `*-en.jpg`).
