"""Poster projects: the app's Poster JSON format (create / open / save / info / list_profiles)."""
from __future__ import annotations

import json
import os
from typing import Any, Optional

from cli_anything.poster_printer.core.session import _locked_save_json

APP_SLUG = "ready-poster-printer"
PROFILES = {
    "3:4": {"size": [1200, 1600], "use": "classic poster / print (A-series approx.)"},
    "9:16": {"size": [1080, 1920], "use": "phone story / vertical screen"},
    "1:1": {"size": [1400, 1400], "use": "social square"},
    "4:3": {"size": [1600, 1200], "use": "landscape slide / flyer"},
    "16:9": {"size": [1920, 1080], "use": "screen / video cover"},
    "21:9": {"size": [2100, 900], "use": "banner / web header"},
}


def create_project(entry: dict, x_cli: Optional[dict] = None) -> dict:
    """Wrap an engine entry as Poster JSON (importable by the web app)."""
    return {"app": APP_SLUG, "kind": "poster", "version": 1, "entry": entry, **({"x_cli": x_cli} if x_cli else {})}


def open_project(path: str) -> dict:
    """Read a Poster JSON file (as exported by the app or written by this CLI)."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"no such poster file: {path}")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and data.get("kind") == "session" and data.get("entries"):
        data = create_project(data["entries"][-1])
    if not (isinstance(data, dict) and data.get("kind") == "poster" and isinstance(data.get("entry"), dict)):
        raise ValueError(f"{path} is not a Ready Poster Printer poster JSON (kind: poster)")
    if data.get("app") not in (APP_SLUG, None):
        raise ValueError(f"{path} was written by {data.get('app')}, not {APP_SLUG}")
    for k in ("seeds", "ratio", "styleId", "params", "picked", "fonts"):
        if k not in data["entry"]:
            raise ValueError(f"{path}: entry.{k} missing")
    return data


def save_project(project: dict, path: str) -> str:
    """Write Poster JSON atomically (file lock); returns the path."""
    _locked_save_json(path, project, indent=1, ensure_ascii=False)
    return path


def get_project_info(project: dict) -> dict[str, Any]:
    """Human / agent summary of a project without rendering."""
    e = project["entry"]
    p = e["picked"]
    t = p.get("texts", {})
    x = project.get("x_cli", {})
    return {
        "id": e.get("id"), "style": e.get("styleId"), "ratio": e.get("ratio"), "comp": p.get("comp"),
        "idea": (p.get("idea") or {}).get("id"), "taste": p.get("taste"), "seeds": e.get("seeds"),
        "palette": {k: p.get("palette", {}).get(k) for k in ("bg", "ink", "accent")},
        "images": p.get("imageIds", []),
        "headline": (t.get("headline") or {}).get("t"), "sub": (t.get("sub") or {}).get("t"),
        "facts": t.get("facts"), "history": {"undo": len(x.get("undo", [])), "redo": len(x.get("redo", []))},
        "reasons": (x.get("reasons") or [])[:12],
    }


def list_profiles() -> dict:
    """Canvas ratios the generator supports."""
    return PROFILES


def project_info(project: dict) -> dict[str, Any]:
    """Alias of :func:`get_project_info` (CLI-Anything checklist name)."""
    return get_project_info(project)
