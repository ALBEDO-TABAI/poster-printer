"""Glyph coverage of the app's WOFF2 subsets, and on-demand fallback subsets from the full font files.

The web app ships subset fonts (Latin + GB2312 level 1 + the characters of its own copy). Real content can contain
characters outside the subset; the browser then silently falls back to another face. ``check`` finds those
characters per family; ``fix`` cuts a small WOFF2 with exactly the missing glyphs from the full font in the font
library (default /workspace/fonts) and returns ``extraFonts`` entries the chromium backend registers with a
``unicode-range`` under the same family name.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import unicodedata
from functools import lru_cache
from typing import Any, Iterable

from cli_anything.poster_printer.utils.poster_backend import home_dir


def _is_cjk(ch: str) -> bool:
    o = ord(ch)
    return 0x3040 <= o <= 0x30FF or 0x3400 <= o <= 0x9FFF or 0xF900 <= o <= 0xFAFF or 0x3000 <= o <= 0x303F or 0xFF00 <= o <= 0xFFEF


def relevant_chars(text: str, cjk_family: bool) -> list[str]:
    """Characters a family is expected to draw.

    The app stacks every text run as ``'<Latin family>', '<CJK family>'``, so Latin faces draw the
    non-CJK part and CJK faces only need the CJK part (hanzi, kana, fullwidth punctuation).
    """
    out = []
    for ch in sorted(set(text)):
        if ch.isspace() or unicodedata.category(ch).startswith("C"):
            continue
        if _is_cjk(ch) != cjk_family:
            continue
        out.append(ch)
    return out


@lru_cache(maxsize=256)
def _cmap(path: str) -> frozenset:
    from fontTools.ttLib import TTFont
    f = TTFont(path, lazy=True, fontNumber=0)
    return frozenset(f.getBestCmap().keys())


def _manifest(public: str) -> list[dict]:
    with open(os.path.join(public, "fonts", "manifest.json"), encoding="utf-8") as f:
        return json.load(f)


def check(text: str, families: Iterable[str], public: str) -> dict[str, Any]:
    """Coverage of ``text`` in each family's WOFF2 subset (missing code points per family)."""
    man = {m["family"]: m for m in _manifest(public)}
    res: dict[str, Any] = {}
    for fam in families:
        m = man.get(fam)
        if not m:
            res[fam] = {"known": False, "missing": [], "note": "not an app font"}
            continue
        chars = relevant_chars(text, bool(m.get("cjk")))
        cov: set[int] = set()
        for fl in m["files"]:
            cov |= _cmap(os.path.join(public, fl["url"].lstrip("/")))
        missing = [c for c in chars if ord(c) not in cov]
        res[fam] = {"known": True, "cjk": bool(m.get("cjk")), "checked": len(chars), "missing": "".join(missing), "missing_codepoints": [f"U+{ord(c):04X}" for c in missing]}
    return res


def _full_files(family: str, fonts_root: str) -> list[str]:
    cat_p = os.path.join(fonts_root, "catalog.json")
    if not os.path.isfile(cat_p):
        return []
    with open(cat_p, encoding="utf-8") as f:
        cat = json.load(f)
    for fam in cat.get("families", []):
        if fam.get("name") == family or fam.get("slug") == family.lower().replace(" ", "-"):
            return [os.path.join(cat.get("root") or fonts_root, p) for p in fam.get("files", []) if p.lower().endswith((".ttf", ".otf"))]
    return []


def _weight_of(path: str) -> int:
    from fontTools.ttLib import TTFont
    try:
        return int(TTFont(path, lazy=True)["OS/2"].usWeightClass)
    except Exception:  # noqa: BLE001 - unreadable OS/2: treat as regular
        return 400


def _urange(chars: str) -> str:
    return ",".join(f"U+{ord(c):04X}" for c in sorted(set(chars)))


def fix(report: dict[str, Any], public: str, fonts_root: str) -> dict[str, Any]:
    """Cut WOFF2 subsets with the missing glyphs from the full fonts; returns {extraFonts, unresolved}."""
    from fontTools import subset
    from fontTools.ttLib import TTFont
    man = {m["family"]: m for m in _manifest(public)}
    out_dir = home_dir() / "fonts"
    out_dir.mkdir(parents=True, exist_ok=True)
    extra: list[dict] = []
    unresolved: dict[str, str] = {}
    for fam, r in report.items():
        if not r.get("known") or not r.get("missing"):
            continue
        files = _full_files(fam, fonts_root)
        if not files:
            unresolved[fam] = r["missing"]
            continue
        for mf in man[fam]["files"]:
            italic = mf.get("style") == "italic"
            cands = [p for p in files if ("italic" in os.path.basename(p).lower()) == italic] or files
            w = mf.get("weight", "400").split()[0]
            best = min(cands, key=lambda p: abs(_weight_of(p) - int(w))) if len(cands) > 1 else cands[0]
            have = _cmap(best)
            chars = "".join(c for c in r["missing"] if ord(c) in have)
            lost = "".join(c for c in r["missing"] if ord(c) not in have)
            if lost:
                unresolved[fam] = unresolved.get(fam, "") + lost
            if not chars:
                continue
            key = hashlib.sha1(f"{fam}|{mf['url']}|{chars}".encode()).hexdigest()[:12]
            dst = out_dir / f"{man[fam]['slug']}-{key}.woff2"
            if not dst.exists():
                font = TTFont(best, fontNumber=0)
                opts = subset.Options()
                opts.flavor = "woff2"
                opts.layout_features = ["*"]
                opts.name_IDs = ["*"]
                opts.notdef_outline = False
                sub = subset.Subsetter(options=opts)
                sub.populate(unicodes=[ord(c) for c in chars])
                sub.subset(font)
                buf = io.BytesIO()
                font.flavor = "woff2"
                font.save(buf)
                dst.write_bytes(buf.getvalue())
            extra.append({"family": fam, "url": f"/__pp/home/fonts/{dst.name}", "weight": mf.get("weight", "400"), "style": mf.get("style", "normal"), "unicodeRange": _urange(chars), "chars": chars, "source": best, "file": str(dst)})
    return {"extraFonts": extra, "unresolved": {k: "".join(sorted(set(v))) for k, v in unresolved.items()}}


def brief_text(brief: dict) -> str:
    """All copy of a brief (what can end up on the poster)."""
    parts: list[str] = []

    def walk(v: Any) -> None:
        if isinstance(v, str):
            parts.append(v)
        elif isinstance(v, dict):
            for x in v.values():
                walk(x)
        elif isinstance(v, list):
            for x in v:
                walk(x)
    walk(brief.get("content", {}))
    # labels the resolver adds (weekday names, When/Where, 主办 …)
    parts.append("周一周二周三周四周五周六周日时间地点票价主办另有项 MON TUE WED THU FRI SAT SUN When Where Tickets Presented by more 0123456789.:—·#+")
    return "".join(parts)


def project_text(project: dict) -> str:
    t = project["entry"]["picked"].get("texts", {})
    parts: list[str] = []

    def walk(v: Any) -> None:
        if isinstance(v, dict):
            if "t" in v and isinstance(v["t"], str):
                parts.append(v["t"])
            for x in v.values():
                walk(x)
        elif isinstance(v, list):
            for x in v:
                walk(x)
        elif isinstance(v, str):
            parts.append(v)
    walk(t)
    return "".join(parts)


def extra_for(text: str, families: Iterable[str], paths: dict, enabled: bool = True) -> tuple[list[dict], dict]:
    """check + fix in one go; returns (extraFonts, report)."""
    rep = check(text, families, paths["public"])
    if not enabled:
        return [], {"coverage": rep}
    fx = fix(rep, paths["public"], paths["fonts"])
    return [{k: v for k, v in e.items() if k in ("family", "url", "weight", "style", "unicodeRange")} for e in fx["extraFonts"]], {"coverage": rep, **fx}


def glyph_gate(families: Iterable[str], rep: dict) -> dict[str, Any]:
    """Correctness gate: every character of the copy has a glyph in the poster's fonts.

    ``rep`` is the report from :func:`extra_for` (coverage, extraFonts, unresolved). Characters missing from
    the app's subset fonts but patched from the full fonts pass, flagged as CLI-only. Characters with no
    glyph anywhere fail, because the renderer falls back to another face or draws tofu.
    """
    cov = rep.get("coverage", {}) or {}
    fixed: dict[str, set] = {}
    for e in rep.get("extraFonts", []) or []:
        fixed.setdefault(e["family"], set()).update(e.get("chars", ""))
    items = []
    for fam in families:
        miss = list((cov.get(fam) or {}).get("missing") or [])
        if not miss:
            if fam in cov:
                items.append({"family": fam, "status": "pass"})
            continue
        patched = [c for c in miss if c in fixed.get(fam, set())]
        unres = [c for c in miss if c not in fixed.get(fam, set())]
        items.append({"family": fam, "status": "fail" if unres else "pass", "missing_in_app_font": "".join(miss),
                      "patched_cli_only": "".join(patched), "unresolved": "".join(unres)})
    status = "n/a" if not items else ("fail" if any(i["status"] == "fail" for i in items) else "pass")
    note = ""
    if any(i.get("patched_cli_only") for i in items):
        note = "patched glyphs come from the full fonts and exist only in CLI renders; the web app shows its fallback face for them"
    return {"status": status, "items": items, "note": note}


def merge_glyph_gate(report: dict, gate: dict) -> dict:
    """Put the glyph gate into an engine evaluation report; a failure is blocking."""
    report.setdefault("gates", {})["glyphs"] = gate
    for it in gate["items"]:
        if it["status"] != "fail":
            continue
        dim = f"glyph coverage: {it['family']}"
        report.setdefault("issues", []).append({
            "id": f"g{len(report.get('issues', [])) + 1}", "gate": "glyphs", "dimension": dim, "blocking": True, "region": None,
            "evidence": f"no glyph for {it['unresolved']!r} in {it['family']} (app subset or full font)", "impact": ["legibility", "craft"],
            "fix": {"command": "refine --style <a style with another CJK face>  (see: styles list)", "why": "pick a face that has these characters, or rewrite the copy"}})
        report.setdefault("blocking_failures", []).append(dim)
        report["gates_passed"] = False
    return report
