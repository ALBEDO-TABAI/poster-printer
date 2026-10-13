"""Bridge to the Node engine (engine/dist/engine.mjs).

The engine bundles the real Ready Poster Printer generator (rea-poster) and renders either in headless
Chrome (default, pixel-identical to the web app) or in Node (resvg, approximate). Every call is one
subprocess: JSON payload on stdin, one JSON document on stdout.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any, Optional

BACKENDS = ("chromium", "node")


class EngineError(RuntimeError):
    """An engine failure. ``code``: 2 usage/validation, 3 missing backend/asset, 4 render verification, 5 quality gate."""

    def __init__(self, message: str, code: int = 1, issues: Any = None):
        super().__init__(message)
        self.code = code
        self.issues = issues


def home_dir() -> Path:
    """User data directory (user images, glyph-fallback fonts, config)."""
    return Path(os.environ.get("POSTER_PRINTER_HOME", str(Path.home() / ".poster-printer")))


def _config() -> dict:
    p = home_dir() / "config.json"
    if p.is_file():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
    return {}


def find_engine() -> Path:
    """Locate engine/dist/engine.mjs: $POSTER_PRINTER_ENGINE, ~/.poster-printer/config.json, then the repo layout."""
    cands: list[Path] = []
    env = os.environ.get("POSTER_PRINTER_ENGINE")
    if env:
        cands.append(Path(env))
    cfg = _config().get("engine")
    if cfg:
        cands.append(Path(cfg))
    for parent in Path(__file__).resolve().parents:
        cands.append(parent / "engine")
    for c in cands:
        f = c / "dist" / "engine.mjs" if c.is_dir() else c
        if f.is_file():
            return f
    raise EngineError(
        "ready-poster-printer engine not found. Build it (cd engine && npm install && npm run build) and set "
        "POSTER_PRINTER_ENGINE=/path/to/engine, or add {\"engine\": \"/path/to/engine\"} to ~/.poster-printer/config.json",
        code=3,
    )


def find_node() -> str:
    node = os.environ.get("POSTER_PRINTER_NODE") or shutil.which("node")
    if not node:
        raise EngineError("Node.js (>= 20) is required: install node and make sure it is on PATH", code=3)
    return node


def run(op: str, payload: Optional[dict] = None, backend: str = "chromium", timeout: int = 900) -> Any:
    """Run one engine op and return its result (raises EngineError on failure)."""
    if backend not in BACKENDS:
        raise EngineError(f"backend must be one of {', '.join(BACKENDS)}", code=2)
    cmd = [find_node(), str(find_engine()), op, "--backend", backend]
    try:
        proc = subprocess.run(cmd, input=json.dumps({k: v for k, v in (payload or {}).items() if v is not None}), capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as e:
        raise EngineError(f"engine op {op} timed out after {timeout}s", code=1) from e
    out = proc.stdout.strip().splitlines()
    if not out:
        raise EngineError(f"engine op {op} produced no output (exit {proc.returncode}): {proc.stderr.strip()[-800:]}", code=proc.returncode or 1)
    try:
        doc = json.loads(out[-1])
    except json.JSONDecodeError as e:
        raise EngineError(f"engine op {op} returned invalid JSON: {out[-1][:300]}", code=1) from e
    if not doc.get("ok"):
        raise EngineError(doc.get("error", "engine error"), code=int(doc.get("code") or 1), issues=doc.get("issues"))
    return doc["result"]
