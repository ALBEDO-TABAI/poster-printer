"""User images: analysed by the engine (palette, luminance and detail grids, focus) and stored under
~/.poster-printer/images/index.json, the CLI counterpart of the app's IndexedDB image store."""
from __future__ import annotations

import json
import os
import time
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


def add_images(files: list[str], category: str = "mine") -> list[dict[str, Any]]:
    """Analyse and store image files; returns their summaries (id, size, palette)."""
    lst = list_user_images()
    added = []
    for fp in files:
        if not os.path.isfile(fp):
            raise FileNotFoundError(fp)
        iid = "u-" + time.strftime("%y%m%d%H%M%S") + "-" + os.path.splitext(os.path.basename(fp))[0][:24].replace(" ", "_")
        asset = be.run("images.analyse", {"file": os.path.abspath(fp), "id": iid}, backend="node")
        asset["category"] = category
        lst = [a for a in lst if a["id"] != iid] + [asset]
        added.append({"id": iid, "w": asset["w"], "h": asset["h"], "palette": asset["palette"], "file": os.path.abspath(fp)})
    _locked_save_json(_index(), lst)
    return added


def remove_image(image_id: str) -> bool:
    lst = list_user_images()
    new = [a for a in lst if a["id"] != image_id]
    if len(new) == len(lst):
        raise ValueError(f"no user image {image_id}")
    _locked_save_json(_index(), new)
    return True
