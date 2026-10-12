"""Rendering / export of a poster entry through the engine (PNG / JPG / SVG / PDF / Poster JSON)."""
from __future__ import annotations

import json
import os
from typing import Any, Optional

from cli_anything.poster_printer.utils import poster_backend as be

EXPORT_PRESETS: dict[str, dict[str, Any]] = {
    "png": {"formats": ["png"], "scale": 1, "desc": "PNG at canvas size (e.g. 1200×1600)"},
    "png@2x": {"formats": ["png"], "scale": 2, "desc": "PNG at 2× (the app's default export scale)"},
    "png@4x": {"formats": ["png"], "scale": 4, "desc": "PNG at 4× (print)"},
    "jpg": {"formats": ["jpeg"], "scale": 2, "desc": "JPEG 92 at 2×"},
    "svg": {"formats": ["svg"], "scale": 1, "embedFonts": True, "desc": "self-contained SVG: live text, embedded WOFF2 fonts and images"},
    "svg-light": {"formats": ["svg"], "scale": 1, "embedFonts": False, "desc": "SVG with embedded images, fonts referenced by family name"},
    "pdf": {"formats": ["pdf"], "scale": 2, "desc": "single-page PDF (JPEG page at 2×)"},
    "json": {"formats": ["json"], "scale": 1, "desc": "Poster JSON (import into the web app: Export ▸ Import JSON)"},
}


def render(entry: dict, out_base: str, preset: str = "png", backend: str = "chromium", scale: Optional[float] = None, extra_fonts: Optional[list] = None) -> dict[str, Any]:
    """Render ``entry`` with an export preset to ``out_base`` + extension; returns files and verification."""
    if preset not in EXPORT_PRESETS:
        raise ValueError(f"unknown export preset {preset}; one of {', '.join(EXPORT_PRESETS)}")
    p = EXPORT_PRESETS[preset]
    if preset == "json":
        os.makedirs(os.path.dirname(os.path.abspath(out_base)) or ".", exist_ok=True)
        path = out_base + ".json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"app": "poster-printer", "kind": "poster", "version": 1, "entry": entry}, f, ensure_ascii=False, indent=1)
        return {"files": {"json": path}, "verify": {"json": {"ok": True, "bytes": os.path.getsize(path)}}}
    payload = {"entry": entry, "formats": p["formats"], "scale": scale or p["scale"], "embedFonts": p.get("embedFonts", True), "base": os.path.abspath(out_base), "extraFonts": extra_fonts or []}
    return be.run("render", payload, backend=backend)


def list_presets() -> dict[str, str]:
    return {k: v["desc"] for k, v in EXPORT_PRESETS.items()}
