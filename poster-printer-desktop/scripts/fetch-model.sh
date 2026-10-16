#!/usr/bin/env bash
# Download the IS-Net cut-out model (~170 MB) into models/ and check it against rembg's checksum.
set -euo pipefail
cd "$(dirname "$0")/.."
F=models/isnet-general-use.onnx
MD5=fc16ebd8b0c10d971d3513d564d01e29
URL=https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx
mkdir -p models
if [ -f "$F" ] && [ "$(md5 -q "$F")" = "$MD5" ]; then echo "model ok: $F"; exit 0; fi
curl -fL --retry 3 -o "$F.part" "$URL"
[ "$(md5 -q "$F.part")" = "$MD5" ] || { echo "checksum mismatch for $F"; rm -f "$F.part"; exit 1; }
mv "$F.part" "$F"
echo "model ok: $F"
