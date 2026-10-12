"""Session: the current poster project held in memory, with undo / redo and locked saves.

The project file is the web app's own *Poster JSON* (``{"app": "poster-printer", "kind": "poster", "version": 1,
"entry": {...}}``) so it imports into the app unchanged. CLI state (history for undo/redo, provenance) lives in the
extra ``x_cli`` key, which the app ignores.
"""
from __future__ import annotations

import copy
import json
import os
from typing import Any, Optional

MAX_HISTORY = 50


def _locked_save_json(path: str, data: Any, **dump_kwargs: Any) -> None:
    """Atomically write JSON with exclusive file locking (CLI-Anything session-locking pattern)."""
    try:
        f = open(path, "r+", encoding="utf-8")
    except FileNotFoundError:
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        f = open(path, "w", encoding="utf-8")
    with f:
        locked = False
        try:
            import fcntl
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            locked = True
        except (ImportError, OSError):
            pass
        try:
            f.seek(0)
            f.truncate()
            json.dump(data, f, **dump_kwargs)
            f.flush()
        finally:
            if locked:
                import fcntl
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)


class Session:
    """Holds one poster project; every mutation goes through :meth:`snapshot` so it can be undone."""

    def __init__(self) -> None:
        self.project: Optional[dict] = None
        self.project_path: Optional[str] = None
        self._modified = False

    # -- state
    def has_project(self) -> bool:
        return self.project is not None

    def get_project(self) -> dict:
        if self.project is None:
            raise RuntimeError("no poster loaded: pass --project poster.json, or run generate first")
        return self.project

    def set_project(self, project: dict, path: Optional[str] = None) -> None:
        self.project = project
        self.project_path = path or self.project_path
        self._modified = False

    def _x(self) -> dict:
        p = self.get_project()
        x = p.setdefault("x_cli", {})
        x.setdefault("undo", [])
        x.setdefault("redo", [])
        return x

    # -- history
    def snapshot(self, label: str) -> None:
        """Push the current entry onto the undo stack before a mutation."""
        x = self._x()
        x["undo"].append({"label": label, "before": x.get("last", ""), "entry": copy.deepcopy(self.get_project()["entry"])})
        x["undo"] = x["undo"][-MAX_HISTORY:]
        x["redo"] = []

    def apply(self, entry: dict, label: str, extra: Optional[dict] = None) -> None:
        """Replace the current entry (after a snapshot) and mark the project modified."""
        if self.project is None:
            self.project = {"app": "poster-printer", "kind": "poster", "version": 1, "entry": entry, "x_cli": {"undo": [], "redo": []}}
        else:
            self.snapshot(label)
            self.project["entry"] = entry
        if extra:
            self._x().update(extra)
        self._x()["last"] = label
        self._modified = True

    def undo(self) -> str:
        x = self._x()
        if not x["undo"]:
            raise RuntimeError("nothing to undo")
        step = x["undo"].pop()
        x["redo"].append({"label": step["label"], "before": step.get("before", ""), "entry": self.get_project()["entry"]})
        self.project["entry"] = step["entry"]
        x["last"] = step.get("before", "")
        self._modified = True
        return step["label"]

    def redo(self) -> str:
        x = self._x()
        if not x["redo"]:
            raise RuntimeError("nothing to redo")
        step = x["redo"].pop()
        x["undo"].append({"label": step["label"], "before": step.get("before", ""), "entry": self.get_project()["entry"]})
        self.project["entry"] = step["entry"]
        x["last"] = step["label"]
        self._modified = True
        return step["label"]

    def history(self) -> dict:
        x = self._x()
        return {"undo": [s["label"] for s in x["undo"]], "redo": [s["label"] for s in x["redo"]], "current": x.get("last", "")}

    # -- io
    def save_session(self, path: Optional[str] = None) -> str:
        target = path or self.project_path
        if not target:
            raise RuntimeError("no project path: pass --project FILE or save PATH")
        _locked_save_json(target, self.get_project(), indent=1, ensure_ascii=False)
        self.project_path = target
        self._modified = False
        return target
