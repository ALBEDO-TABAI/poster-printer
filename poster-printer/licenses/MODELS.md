# Background-removal models & libraries

Poster Printer's AI cut-out runs **locally** (no third-party API) through `server/cutout_server.py`.

| Component | Use | Licence | Source |
|---|---|---|---|
| rembg 2.0.x | inference wrapper / session management | MIT | https://github.com/danielgatis/rembg |
| IS-Net `isnet-general-use` (DIS) — **default** | salient-object segmentation | Apache-2.0 | https://github.com/xuebinqin/DIS |
| BiRefNet `birefnet-general` / `birefnet-general-lite` — optional (`CUT_MODEL=…`) | high-resolution dichotomous segmentation | MIT | https://github.com/ZhengPeng7/BiRefNet |
| ONNX Runtime | CPU inference | MIT | https://github.com/microsoft/onnxruntime |

Model weights are downloaded by rembg on first use into `~/.u2net/` and are **not** redistributed in this repository.
The pre-computed cut-outs in `public/images/cut/` were produced with IS-Net from CC0 / original source images (see `IMAGES.md`).
