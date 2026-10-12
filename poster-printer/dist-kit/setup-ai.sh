#!/usr/bin/env bash
# Optional: install the AI background-removal extras (rembg + onnxruntime) into ./.venv (~300 MB incl. model).
cd "$(dirname "$0")" || exit 1
PY=$(command -v python3 || command -v python) || { echo "Python 3.9+ is required."; exit 1; }
"$PY" -m venv .venv && .venv/bin/python -m pip install --upgrade pip && .venv/bin/python -m pip install -r server/requirements.txt \
  && echo "AI cut-out installed. Start with ./start.sh — the segmentation model (~170 MB) downloads on first use."
