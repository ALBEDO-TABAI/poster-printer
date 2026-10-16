#!/usr/bin/env bash
# Build dist/Ready-Poster-Printer-<version>-mac-arm64.dmg: web app build → model → Electron app (ad-hoc signed) → DMG.
set -euo pipefail
cd "$(dirname "$0")/.."
(cd ../poster-printer && npm run build)
bash scripts/fetch-model.sh
[ -x node_modules/electron/dist/Electron.app/Contents/MacOS/Electron ] || node node_modules/electron/install.js
rm -rf dist
npx electron-builder --mac dmg --arm64 --publish never
APP="dist/mac-arm64/Ready Poster Printer.app"
codesign --verify --deep --strict "$APP" && echo "signature ok (ad-hoc)"
# recompress with LZMA (macOS 10.15+; electron-builder only offers zlib / bzip2 / lzfse); layout and background are kept
DMG=$(ls dist/*.dmg)
hdiutil convert "$DMG" -format ULMO -o "${DMG%.dmg}-lzma.dmg" -quiet && mv "${DMG%.dmg}-lzma.dmg" "$DMG" && rm -f "$DMG.blockmap"
hdiutil verify "$DMG" -quiet && echo "dmg ok"
ls -lh dist/*.dmg
