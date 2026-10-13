"""User images: analysed by the engine (palette, luminance and detail grids, focus) and stored under
~/.poster-printer/images/index.json, the CLI counterpart of the app's IndexedDB image store."""
from __future__ import annotations

import hashlib
import json
import os
from typing import Any

from cli_anything.poster_printer.core.session import _locked_save_json
from cli_anything.poster_printer.utils import poster_backend as be


def _index() -> str:
    return str(be.home_dir() / "images" / "index.json")


def list_user_images() -> list[dict]:
    p = _index()
    if not os.path.isfile(p):
        return []
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def _orient(ar: float) -> str:
    return "tall" if ar < 0.6 else "portrait" if ar < 0.88 else "square" if ar <= 1.14 else "landscape" if ar <= 1.9 else "panorama"


def image_id(fp: str) -> str:
    """Stable id from the file's content: adding the same picture again reuses its id."""
    h = hashlib.sha1()
    with open(fp, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    stem = "".join(c if c.isalnum() or c in "-_" else "_" for c in os.path.splitext(os.path.basename(fp))[0])[:24]
    return f"u-{h.hexdigest()[:10]}-{stem}"


def summary(asset: dict, fp: str | None = None) -> dict[str, Any]:
    """What a layout decision needs to know about a picture: proportion, orientation, subject, busyness, colours."""
    ar = asset["w"] / max(1, asset["h"])
    det = asset.get("detail") or []
    busy = round(sum(det) / len(det), 2) if det else None
    out = {"id": asset["id"], "w": asset["w"], "h": asset["h"], "ratio": round(ar, 3), "orientation": _orient(ar), "subject": asset.get("subject"), "focus": asset.get("focus"),
           "busy": busy, "detail": None if busy is None else ("busy" if busy > 0.45 else "calm" if busy < 0.25 else "moderate"), "palette": asset.get("palette")}
    if fp:
        out["file"] = os.path.abspath(fp)
    return out


def add_images(files: list[str], category: str = "mine") -> list[dict[str, Any]]:
    """Analyse and store image files; returns what a layout decision needs (id, proportion, subject, busyness, palette)."""
    lst = list_user_images()
    added = []
    for fp in files:
        if not os.path.isfile(fp):
            raise FileNotFoundError(fp)
        iid = image_id(fp)
        asset = be.run("images.analyse", {"file": os.path.abspath(fp), "id": iid}, backend="node")
        asset["category"] = category
        lst = [a for a in lst if a["id"] != iid] + [asset]
        added.append(summary(asset, fp))
    _locked_save_json(_index(), lst)
    return added


def prepare_brief(b: dict) -> dict:
    """style.imagery.files → user images, their ids prepended to style.imagery.ids (importance order kept)."""
    im = ((b.get("style") or {}).get("imagery") or {})
    files = im.get("files") or []
    if not files:
        return b
    ids = [a["id"] for a in add_images([str(f) for f in files])]
    rest = [i for i in (im.get("ids") or []) if i not in ids]
    b = json.loads(json.dumps(b))
    b["style"]["imagery"]["ids"] = ids + rest
    del b["style"]["imagery"]["files"]
    return b


def remove_image(image_id: str) -> bool:
    lst = list_user_images()
    new = [a for a in lst if a["id"] != image_id]
    if len(new) == len(lst):
        raise ValueError(f"no user image {image_id}")
    _locked_save_json(_index(), new)
    return True
