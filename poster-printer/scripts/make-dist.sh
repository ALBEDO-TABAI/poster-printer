#!/usr/bin/env bash
# Build the portable distributable: release/ready-poster-printer-dist.zip (override with OUT=/path/file.zip)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${OUT:-release/ready-poster-printer-dist.zip}
npm run build
R=release/ready-poster-printer
rm -rf release && mkdir -p "$R/server"
cp -r dist "$R/app"
cp server/serve.py server/cutout_server.py "$R/server/"
cp dist-kit/requirements-ai.txt "$R/server/requirements.txt"
cp dist-kit/start.sh dist-kit/start.command dist-kit/setup-ai.sh "$R/"
for f in start.bat setup-ai.bat; do sed 's/$/\r/' "dist-kit/$f" > "$R/$f"; done   # CRLF for cmd.exe
cp dist-kit/README-DIST.md "$R/README.md"
cp -r licenses "$R/licenses"
cp ../LICENSE "$R/LICENSE"
chmod +x "$R/start.sh" "$R/start.command" "$R/setup-ai.sh"
rm -f "$OUT"
python3 - "$OUT" <<'PY'
import os, sys, zipfile, stat
out = sys.argv[1]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for root, dirs, files in os.walk('release/ready-poster-printer'):
        dirs.sort()
        for f in sorted(files):
            p = os.path.join(root, f); arc = os.path.relpath(p, 'release')
            zi = zipfile.ZipInfo.from_file(p, arc)
            zi.create_system = 3  # unix, so start.sh / start.command keep their exec bit
            zi.external_attr = (os.stat(p).st_mode & 0xFFFF) << 16
            already = f.endswith(('.woff2', '.jpg', '.png', '.webp'))
            zi.compress_type = zipfile.ZIP_STORED if already else zipfile.ZIP_DEFLATED
            with open(p, 'rb') as fh: z.writestr(zi, fh.read())
PY
echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
