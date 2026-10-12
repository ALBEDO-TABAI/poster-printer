#!/usr/bin/env bash
# Poster Printer — start the local app (macOS / Linux). Usage: ./start.sh [--port 5180] [--no-open]
cd "$(dirname "$0")" || exit 1
if [ -x ".venv/bin/python" ]; then PY=".venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then PY=python3
elif command -v python >/dev/null 2>&1; then PY=python
else
  echo "Python 3.9+ is required. macOS: install from https://www.python.org/downloads/ (or 'xcode-select --install')."
  exit 1
fi
exec "$PY" server/serve.py "$@"
