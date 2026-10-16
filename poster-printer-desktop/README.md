# Ready Poster Printer for macOS (`poster-printer-desktop/`)

The web app in `../poster-printer` as a double-click Mac app for Apple silicon (M1 and later), with the AI cut-out
built in: no Python, no Node, no setup.

## For the people you send it to / 给朋友的安装说明

1. 打开 `Ready-Poster-Printer-<版本>-mac-arm64.dmg`，把图标拖进「应用程序」。
2. 第一次打开时，macOS 会提示“无法验证开发者”（因为没有付费的 Apple 开发者签名）。点「完成」，然后打开
   **系统设置 → 隐私与安全性**，往下找到这条提示，点 **「仍要打开」**，输入开机密码。之后就和普通应用一样双击打开。
   会用终端的话，也可以运行一次：`xattr -dr com.apple.quarantine "/Applications/Ready Poster Printer.app"`
3. 数据（收藏、上传的图片、自定义风格）保存在本机 `~/Library/Application Support/Ready Poster Printer/`。
   导出时会弹出保存对话框。

Needs macOS 12 or later on an M-series Mac. Everything runs offline.

## Build

```bash
npm ci
npm run dmg      # → dist/Ready-Poster-Printer-<version>-mac-arm64.dmg
npm run smoke -- "dist/mac-arm64/Ready Poster Printer.app"   # 16 checks on the packaged app
```

`npm run dmg` (`scripts/build-dmg.sh`) builds the web app (`../poster-printer`, `npm run build`), downloads the IS-Net
model into `models/` (~170 MB, md5-checked, not in git), packs the Electron app, signs it ad hoc
(`scripts/adhoc-sign.cjs`), and makes an LZMA-compressed DMG. The version comes from `package.json`; keep it in step with
`../poster-printer/package.json`. `npm start` runs the unpackaged app against `../poster-printer/dist`.
`npm run icons` re-renders `build/icon.icns` and the DMG background from `build/icon.svg` and `scripts/make-dmg-background.mjs`.

## How it works

- **Why Electron, not Tauri.** The app is tuned and tested on Chromium: the poster layout is measured with Chromium's
  text engine, and the glass refraction (`backdrop-filter: url()`) only renders there. Tauri would run the app in
  WKWebView (Safari's engine), where the glass is switched off (`data-glass="none"`) and the layouts were never checked.
- **Serving.** `main.cjs` serves the built app from `rpp://app/`, a fixed origin, so IndexedDB and localStorage survive
  restarts and updates. External links open in the default browser. Downloads ask where to save.
- **AI cut-out.** `/api/cutout` and `/api/health` keep the contract of `server/serve.py`. `cutout.cjs` ports rembg 2.0.85's
  IS-Net pipeline to onnxruntime-node, with Pillow's Lanczos resampler re-implemented in JS. On 16 test pictures its masks are
  bit-identical to rembg's. It runs in a utility process (`cutout-worker.cjs`) that is
  killed after 5 idle minutes and on quit, so onnxruntime's teardown can't crash the app.
- **Signing.** No Apple Developer ID: the bundle is signed ad hoc, inside-out. That avoids the "damaged" error on Apple
  silicon. Gatekeeper still asks once (see above). A Developer ID certificate plus notarization would remove that step.

Licences of the bundled runtime and model: `licenses/DESKTOP.md` (copied into the app next to the web app's `licenses/`).
