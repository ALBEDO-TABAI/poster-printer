# What the macOS app bundles / macOS 版额外附带的组件

The desktop app (`Ready Poster Printer.app`) is the same web app as the local package, wrapped in Electron, with the
AI cut-out built in. Besides everything listed in `FONTS.md`, `IMAGES.md`, `PALETTES.md` and `MODELS.md`, it ships:

| Component | Use | Licence | Source |
|---|---|---|---|
| Electron (Chromium + Node.js) | app shell | MIT; Chromium's licences are in `LICENSES.chromium.html` next to the app's resources | https://github.com/electron/electron |
| IS-Net `isnet-general-use.onnx` (DIS), **model weights included** | AI cut-out | Apache-2.0 (`Apache-2.0.txt`) | https://github.com/xuebinqin/DIS · file from https://github.com/danielgatis/rembg/releases/tag/v0.0.0 (md5 `fc16ebd8b0c10d971d3513d564d01e29`) |
| ONNX Runtime for Node.js (`onnxruntime-node`) | model inference | MIT | https://github.com/microsoft/onnxruntime |
| sharp | image decode / encode | Apache-2.0 | https://github.com/lovell/sharp |
| libvips and its dependencies (`@img/sharp-libvips-darwin-arm64`, dynamically linked) | used by sharp | LGPL-3.0-or-later, plus the licences listed in that package's README | https://github.com/libvips/libvips |

The cut-out pipeline follows rembg (MIT, https://github.com/danielgatis/rembg) and Pillow's Lanczos resampler
(MIT-CMU, https://github.com/python-pillow/Pillow); both were re-implemented in JavaScript, no code is bundled from them.

Ready Poster Printer itself is AGPL-3.0 (`LICENSE.txt`); the full source is at
https://github.com/ALBEDO-TABAI/ready-poster-printer (desktop wrapper: `poster-printer-desktop/`).
