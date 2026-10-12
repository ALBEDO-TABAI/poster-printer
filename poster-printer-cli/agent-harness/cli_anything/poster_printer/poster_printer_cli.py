#!/usr/bin/env python3
"""Poster Printer CLI — content-driven poster generation for agents and humans.

The real Poster Printer generator runs underneath (Node engine; headless Chrome by default, so every
poster is pixel-identical to the web app). Write a brief with the real content, resolve it, generate
ranked candidates, refine, export. Poster files are the app's own Poster JSON.

Usage:
    poster-printer brief template --lang zh > brief.json      # fill it with the real content
    poster-printer --json brief resolve brief.json             # see the chosen params + reasons
    poster-printer --json generate --brief brief.json --count 6 --min-score 6.5 --out out/
    poster-printer --project out/01-….json refine --set titleScale=130 -o v2.json
    poster-printer                                             # interactive REPL
"""
from __future__ import annotations

import json
import os
import shlex
import sys
from typing import Any, Callable, Optional

import click

from cli_anything.poster_printer import __version__
from cli_anything.poster_printer.core import export as export_mod
from cli_anything.poster_printer.core import fonts as fonts_mod
from cli_anything.poster_printer.core import images as images_mod
from cli_anything.poster_printer.core import project as proj_mod
from cli_anything.poster_printer.core.session import Session
from cli_anything.poster_printer.utils import poster_backend as be

_session: Optional[Session] = None
_json_output = False
_repl_mode = False
_auto_save = False
_dry_run = False
_backend = "chromium"
_paths_cache: Optional[dict] = None


def get_session() -> Session:
    global _session
    if _session is None:
        _session = Session()
    return _session


def paths() -> dict:
    global _paths_cache
    if _paths_cache is None:
        _paths_cache = be.run("paths", {}, backend="node")
    return _paths_cache


# ── output / errors ─────────────────────────────────────────────
def output(data: Any, message: str = "") -> None:
    if _json_output:
        click.echo(json.dumps(data, indent=2, ensure_ascii=False, default=str))
        return
    if message:
        click.echo(message)
    if isinstance(data, dict):
        _print_dict(data)
    elif isinstance(data, list):
        _print_list(data)
    elif data is not None:
        click.echo(str(data))


def _short(v: Any) -> str:
    s = (json.dumps(v, ensure_ascii=False) if not isinstance(v, str) else v).replace("\n", " ⏎ ")
    return s if len(s) <= 160 else s[:157] + "…"


def _print_dict(d: dict, indent: int = 0) -> None:
    pre = "  " * indent
    for k, v in d.items():
        if isinstance(v, dict) and indent < 2:
            click.echo(f"{pre}{k}:")
            _print_dict(v, indent + 1)
        elif isinstance(v, list) and v and isinstance(v[0], dict) and indent < 2:
            click.echo(f"{pre}{k}:")
            _print_list(v, indent + 1)
        else:
            click.echo(f"{pre}{k}: {_short(v)}")


def _print_list(items: list, indent: int = 0) -> None:
    pre = "  " * indent
    for i, it in enumerate(items):
        if isinstance(it, dict):
            click.echo(f"{pre}[{i}]")
            _print_dict(it, indent + 1)
        else:
            click.echo(f"{pre}- {_short(it)}")


def handle_error(func: Callable[..., Any]) -> Callable[..., Any]:
    """Consistent errors: JSON {error, type, code} with --json; exit code from the engine (2 usage, 3 missing, 4 verify, 5 gate)."""
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        try:
            return func(*args, **kwargs)
        except be.EngineError as e:
            _fail(str(e), "engine_error", e.code, e.issues)
        except FileNotFoundError as e:
            _fail(str(e), "file_not_found", 3)
        except (ValueError, KeyError, IndexError, RuntimeError, json.JSONDecodeError) as e:
            _fail(str(e), type(e).__name__, 2)
    wrapper.__name__ = func.__name__
    wrapper.__doc__ = func.__doc__
    return wrapper


def _fail(msg: str, kind: str, code: int, issues: Any = None) -> None:
    if _json_output:
        click.echo(json.dumps({"error": msg, "type": kind, "code": code, **({"issues": issues} if issues else {})}, ensure_ascii=False))
    else:
        click.echo(f"Error: {msg}", err=True)
    if not _repl_mode:
        sys.exit(code)


def _load_json(path: str) -> Any:
    if path == "-":
        return json.load(sys.stdin)
    if not os.path.exists(path):
        raise FileNotFoundError(f"no such file: {path}")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _entry_from(src: Optional[str]) -> dict:
    """A poster entry from a file argument, else the session project."""
    if src:
        return proj_mod.open_project(src)["entry"]
    return get_session().get_project()["entry"]


def _carry_x(src: Optional[str]) -> Optional[dict]:
    """The brief (and direction) to carry into derived poster files, so audit keeps checking the same content."""
    proj = proj_mod.open_project(src) if src else (get_session().get_project() if get_session().has_project() else None)
    x = (proj or {}).get("x_cli") or {}
    keep = {k: x[k] for k in ("brief", "direction") if k in x}
    return keep or None


def _stamp_brief(files: list[str], x: Optional[dict]) -> None:
    if not x:
        return
    for f in files:
        d = json.load(open(f, encoding="utf-8"))
        d.setdefault("x_cli", {}).update(x)
        proj_mod.save_project(d, f)


def _parse_sets(sets: tuple) -> dict:
    out = {}
    for s in sets:
        if "=" not in s:
            raise ValueError(f"--set expects key=value, got {s!r}")
        k, v = s.split("=", 1)
        out[k.strip()] = v.strip()
    return out


def _fonts_for_entry(entry: dict, fix: bool) -> tuple[list, dict]:
    if _backend != "chromium":
        return [], {}
    fams = be.run("fonts.families", {"fonts": entry["fonts"]}, backend="node")
    return fonts_mod.extra_for(fonts_mod.project_text({"entry": entry}), fams, paths(), enabled=fix)


# ── main group ──────────────────────────────────────────────────
@click.group(invoke_without_command=True)
@click.option("--json", "use_json", is_flag=True, help="Machine-readable JSON output")
@click.option("--project", "project_path", type=str, default=None, help="Poster JSON project file (the app's format; undo/redo kept inside)")
@click.option("-s", "--save", "auto_save", is_flag=True, help="Save the project after a mutating command (one-shot; on by default with --project)")
@click.option("--dry-run", "dry_run", is_flag=True, default=False, help="Run without writing the project file")
@click.option("--backend", type=click.Choice(be.BACKENDS), default=lambda: os.environ.get("POSTER_PRINTER_BACKEND", "chromium"), help="chromium = exact app renderer (default); node = resvg, approximate")
@click.version_option(__version__, prog_name="cli-anything-poster-printer")
@click.pass_context
def cli(ctx, use_json, project_path, auto_save, dry_run, backend):
    """Poster Printer CLI — content-driven poster generation (the real app engine underneath).

    Run without a subcommand to enter the interactive REPL.
    """
    global _json_output, _auto_save, _dry_run, _backend
    _json_output, _auto_save, _dry_run, _backend = use_json, auto_save, dry_run, backend
    if project_path:
        sess = get_session()
        if not sess.has_project() or sess.project_path != project_path:
            if os.path.exists(project_path):
                try:
                    sess.set_project(proj_mod.open_project(project_path), project_path)
                except (ValueError, json.JSONDecodeError) as e:
                    _fail(f"--project: {e}", "bad_project", 2)
                    return
            else:
                sess.project_path = project_path
    ctx.call_on_close(_auto_save_callback)
    if ctx.invoked_subcommand is None:
        ctx.invoke(repl, project_path=None)


def _auto_save_callback() -> None:
    """One-shot mode: save the project after a mutation unless --dry-run (CLI-Anything auto-save pattern)."""
    if _dry_run or _repl_mode:
        return
    s = _session
    if s and s.has_project() and s._modified and s.project_path:
        try:
            saved = s.save_session()
            if not _json_output:
                click.echo(f"Saved project: {saved}", err=True)
        except OSError as e:
            click.echo(f"Auto-save failed: {e}", err=True)


# ── doctor / catalogue ──────────────────────────────────────────
@cli.command()
@handle_error
def doctor():
    """Check node, chrome, the engine bundle, app assets, fonts and the optional cutout server."""
    r = be.run("doctor", {}, backend="node")
    if not _json_output:
        for c in r["checks"]:
            click.echo(f"  {'✓' if c['ok'] else '✗'} {c['name']:<40} {c['detail']}")
        click.echo("OK" if r["ok"] else "NOT READY")
        return
    output(r)


@cli.group()
def styles():
    """The app's built-in styles (tendencies)."""


@styles.command("list")
@click.option("--lib", type=click.Choice(["zh", "en"]), default=None)
@click.option("--mood", default=None, help="filter by curated mood tag (calm, bold, playful, …)")
@handle_error
def styles_list(lib, mood):
    """List styles with curated tags and key fonts."""
    r = be.run("catalog", {"what": "styles", "lib": lib, "mood": mood}, backend="node")
    if _json_output:
        return output(r)
    for s in r:
        t = s.get("tags") or {}
        click.echo(f"  {s['id']:<18} {s['lib']}  {s['name']['en']:<20} {s['fonts']['en']} / {s['fonts']['zh']:<22} {' '.join(t.get('mood', []))}")


@styles.command("show")
@click.argument("style_id")
@handle_error
def styles_show(style_id):
    """Full style definition (fonts, params, comp weights)."""
    output(be.run("catalog", {"what": "style", "id": style_id}, backend="node"))


@cli.group()
def palettes():
    """The palette library (Wada traditional + nice palettes)."""


@palettes.command("search")
@click.option("--src", type=click.Choice(["wada", "nice"]), default=None)
@click.option("--light", type=click.Choice(["bright", "calm", "luminous", "dark"]), default=None)
@click.option("--chroma", type=click.Choice(["soft", "mid", "rich"]), default=None)
@click.option("--contrast", type=click.Choice(["gentle", "clear", "strong"]), default=None)
@click.option("--tag", type=click.Choice(["vintage", "pop", "pastel", "noir", "muted"]), default=None)
@click.option("--near", default=None, help="sort by distance to a hex colour, e.g. '#c33'")
@click.option("--limit", type=int, default=20)
@handle_error
def palettes_search(src, light, chroma, contrast, tag, near, limit):
    """Filter / rank palettes."""
    if near and len(near) == 4:
        near = "#" + "".join(c * 2 for c in near[1:])
    r = be.run("catalog", {"what": "palettes", "src": src, "light": light, "chroma": chroma, "contrast": contrast, "tag": tag, "near": near, "limit": limit}, backend="node")
    if _json_output:
        return output(r)
    click.echo(f"{r['total']} palettes")
    for p in r["palettes"]:
        click.echo(f"  {p['id']:<7} {p['src']:<5} {p['light']:<9} {p['chroma']:<5} {p['contrast']:<7} {' '.join(p['colors'])}  {' '.join(p.get('tags', []))}")


@palettes.command("show")
@click.argument("palette_id")
@handle_error
def palettes_show(palette_id):
    """One palette."""
    output(be.run("catalog", {"what": "palette", "id": palette_id}, backend="node"))


@cli.group()
def fonts():
    """Fonts: library, curated pairings, glyph coverage."""


@fonts.command("list")
@click.option("--cjk/--latin", "cjk", default=None)
@click.option("--group", default=None)
@handle_error
def fonts_list(cjk, group):
    """The app's font library (WOFF2 subsets)."""
    r = be.run("catalog", {"what": "fonts", "cjk": cjk, "group": group}, backend="node")
    if _json_output:
        return output(r)
    for f in r:
        click.echo(f"  {f['family']:<28} {f['group']:<18} {'CJK' if f['cjk'] else '   '} {f['weights']}  {' '.join(f['tags'])}")


@fonts.command("pairings")
@click.option("--mood", type=click.Choice(["literary", "editorial", "swiss", "poster", "geometric", "technical", "avant"]), default=None)
@handle_error
def fonts_pairings(mood):
    """Curated CN + EN pairings by mood."""
    output(be.run("catalog", {"what": "pairings", "mood": mood}, backend="node"))


@fonts.command("check")
@click.option("--text", default=None, help="text to check")
@click.option("--brief", "brief_path", default=None, help="check all copy of a brief against the fonts its directions use")
@click.option("--family", "families", multiple=True, help="font family (repeatable); default: from --brief or the project")
@click.option("--fix", is_flag=True, help="cut fallback WOFF2 subsets for missing glyphs from the full fonts")
@handle_error
def fonts_check(text, brief_path, families, fix):
    """Glyph coverage of the app's subset fonts (and the full-font fallback with --fix)."""
    fams = list(families)
    if brief_path:
        brief = _load_json(brief_path)
        text = (text or "") + fonts_mod.brief_text(brief)
        if not fams:
            r = be.run("resolve", {"brief": brief}, backend="node")
            fams = sorted({f for d in r["directions"] for f in d["families"]})
    elif text is None and get_session().has_project():
        text = fonts_mod.project_text(get_session().get_project())
        fams = fams or be.run("fonts.families", {"fonts": get_session().get_project()["entry"]["fonts"]}, backend="node")
    if text is None:
        raise ValueError("give --text, --brief or --project")
    if not fams:
        fams = ["Noto Sans SC", "Noto Serif SC"]
    rep = fonts_mod.check(text, fams, paths()["public"])
    res: dict = {"families": len(rep), "missing": {k: v["missing"] for k, v in rep.items() if v.get("missing")}, "coverage": rep}
    if fix:
        fx = fonts_mod.fix(rep, paths()["public"], paths()["fonts"])
        res.update({"fixed": [{"family": e["family"], "chars": e["chars"], "file": e["file"]} for e in fx["extraFonts"]], "unresolved": fx["unresolved"]})
    if _json_output:
        return output(res)
    if not res["missing"]:
        click.echo(f"all glyphs covered in {len(rep)} families")
    for k, v in res["missing"].items():
        click.echo(f"  {k:<28} missing {len(v)}: {v}")
    for e in res.get("fixed", []):
        click.echo(f"  fixed {e['family']}: {e['chars']} → {e['file']}")
    for k, v in res.get("unresolved", {}).items():
        click.echo(f"  unresolved {k}: {v} (not in the full font either; the browser falls back to Noto Sans SC)")


@cli.group()
def images():
    """Image library: the app's presets plus your own images."""


@images.command("list")
@click.option("--category", default=None)
@click.option("--cutout", is_flag=True, help="only images with a cut-out subject")
@click.option("--user/--preset", "user", default=None)
@handle_error
def images_list(category, cutout, user):
    """List images (id, category, size, palette)."""
    r = be.run("catalog", {"what": "images", "category": category, "cutout": cutout, "user": user}, backend="node")
    if _json_output:
        return output(r)
    for a in r:
        click.echo(f"  {a['id']:<34} {a['category']:<13} {a['w']}×{a['h']} {'cut ' if a['cutout'] else '    '}{'user ' if a['user'] else ''}{' '.join(a['palette'][:4])}")


@images.command("add")
@click.argument("files", nargs=-1, required=True)
@click.option("--category", default="mine")
@handle_error
def images_add(files, category):
    """Analyse and add image files (palette, luminance, detail map) to ~/.poster-printer/images."""
    output(images_mod.add_images(list(files), category), f"Added {len(files)} image(s)")


@images.command("remove")
@click.argument("image_id")
@handle_error
def images_remove(image_id):
    """Remove a user image."""
    images_mod.remove_image(image_id)
    output({"removed": image_id})


@cli.group()
def catalog():
    """Ideas, compositions, params, ratios, export presets."""


@catalog.command("ideas")
@handle_error
def catalog_ideas():
    """The generator's 14 ideas and the compositions that realise them."""
    output(be.run("catalog", {"what": "ideas"}, backend="node"))


@catalog.command("comps")
@handle_error
def catalog_comps():
    """All compositions."""
    output(be.run("catalog", {"what": "compositions"}, backend="node"))


@catalog.command("params")
@click.option("--section", default=None)
@handle_error
def catalog_params(section):
    """Every generator parameter (key, type, range/options, default) — the keys refine --set accepts."""
    r = be.run("catalog", {"what": "params", "section": section}, backend="node")
    if _json_output:
        return output(r)
    for p in r:
        rng = f"[{p['min']}, {p['max']}]" if p.get("min") is not None else ("{" + "|".join(p["options"]) + "}" if p.get("options") else p["type"])
        click.echo(f"  {p['key']:<16} {p['section']:<8} {rng:<40} default {p['default']}   {p['en']}")


@catalog.command("ratios")
@handle_error
def catalog_ratios():
    """Canvas ratios (profiles)."""
    output(proj_mod.list_profiles())


@catalog.command("exports")
@handle_error
def catalog_exports():
    """Export presets."""
    output(export_mod.list_presets())


# ── brief ───────────────────────────────────────────────────────
@cli.group()
def brief():
    """The content brief: schema, template, validate, analyze, resolve."""


@brief.command("schema")
@handle_error
def brief_schema():
    """JSON Schema of the brief."""
    click.echo(json.dumps(be.run("schema", {}, backend="node"), indent=2, ensure_ascii=False))


@brief.command("template")
@click.option("--lang", type=click.Choice(["zh", "en"]), default="en")
@handle_error
def brief_template(lang):
    """An empty brief to fill with the real content."""
    click.echo(json.dumps(be.run("template", {"lang": lang}, backend="node"), indent=2, ensure_ascii=False))


@brief.command("validate")
@click.argument("path")
@handle_error
def brief_validate(path):
    """Validate a brief (errors are fatal, warnings name ignored fields)."""
    r = be.run("validate", {"brief": _load_json(path)}, backend="node")
    output({"ok": not r["errors"], **r})
    if r["errors"] and not _repl_mode:
        sys.exit(2)


@brief.command("analyze")
@click.argument("path")
@handle_error
def brief_analyze(path):
    """Content analysis: hierarchy, lists, numerals, CJK/Latin mix, copy load."""
    output(be.run("analyze", {"brief": _load_json(path)}, backend="node"))


@brief.command("resolve")
@click.argument("path")
@click.option("--top", type=int, default=6, help="directions to show")
@click.option("--full", is_flag=True, help="include the full params of every direction")
@handle_error
def brief_resolve(path, top, full):
    """Resolve a brief into generator params: styles, ideas, directions, copy slots — each with reasons."""
    r = be.run("resolve", {"brief": _load_json(path)}, backend="node")
    keys = ["titleScale", "smallScale", "smallGroups", "metaCount", "proseCount", "whitespace", "blockBudget", "decorBudget", "imageCount", "typeOnlyShare", "imageShare", "bgPref", "colorMode", "paletteSource", "composition", "idea", "englishBias"]
    dirs = [{"id": d["id"], "style": d["styleId"], "idea": d["idea"], "composition": d["composition"], "fonts": d["fontsLabel"], "score": d["score"], "plan": d["planPatch"],
             "params": d["params"] if full else {k: d["params"].get(k) for k in keys}, "reasons": d["reasons"]} for d in r["directions"][:top]]
    t = r["texts"]
    slots = {"headline": t["headline"]["t"], "sub": t["sub"]["t"], "note": t["note"]["t"], "groups": [[g["main"]["t"], g["sub"]["t"], g["note"]["t"]] for g in t["groups"] if g["main"]["t"]],
             "prose": [p["t"] for p in t["prose"] if p["t"]], "meta": [m["t"] for m in t["meta"] if m["t"]], "words": [w["t"] for w in t["words"] if w["t"]], "glyph": t["glyph"], "facts": t.get("facts")}
    a = r["analysis"]
    res = {"analysis": {"language": a["lang"], "hierarchy": [{"key": f["key"], "tier": f["tier"], "importance": f["importance"], "text": f["text"]} for f in a["fields"]], "list": {"kind": a["list"]["kind"], "items": len(a["list"]["items"]), "why": a["list"]["why"]},
                        "date": a["date"], "numerals": a["numerals"], "title": a["title"], "quote": a["quote"], "copy": a["copy"]},
           "styles": r["styles"][:5], "ideas": r["ideas"], "directions": dirs, "copy_slots": slots, "palette": r["palette"], "images": r["images"], "format": r["format"], "context": _load_json(path).get("context"), "seed": r["seed"], "reasons": r["reasons"], "warnings": r["warnings"]}
    if _json_output:
        return output(res)
    click.echo(f"language {a['lang']['overall']} ({a['lang']['why']}); list: {a['list']['why']}; copy {a['copy']['load']}")
    click.echo("hierarchy: " + " > ".join(f"{f['key']}({f['tier'][0]})" for f in a["fields"]))
    click.echo("copy slots:")
    for k in ("headline", "sub", "note"):
        click.echo(f"  {k:<9} {slots[k]!r}")
    click.echo(f"  groups    {slots['groups']}\n  meta      {slots['meta']}\n  facts     {slots['facts']}")
    click.echo("directions:")
    for d in dirs:
        click.echo(f"  {d['id']:<4} {d['style']:<18} idea {d['idea']:<20} comp {d['composition']:<9} TS {d['params']['titleScale']}  {d['fonts']}")
        for why in d["reasons"]:
            click.echo(f"         · {why}")
    click.echo("palette: " + "; ".join(r["palette"]["reasons"]))
    click.echo("reasons:")
    for x in r["reasons"]:
        click.echo(f"  {x['field']:<34} {_short(x['value'])[:60]:<60} {x['why']}")
    for w in r["warnings"]:
        click.echo(f"  warning {w['path']}: {w['msg']}")


# ── generate ────────────────────────────────────────────────────
def _inline_brief(title, subtitle, date, venue, lines, body, lang, mood, ratio) -> dict:
    content = {k: v for k, v in {"title": title, "subtitle": subtitle, "date": date, "venue": venue, "body": body, "language": lang}.items() if v}
    if lines:
        content["program"] = list(lines)
    b: dict = {"content": content}
    if mood:
        b["style"] = {"mood": [m.strip() for m in mood.split(",") if m.strip()]}
    if ratio:
        b["format"] = {"ratio": ratio}
    return b


@cli.command()
@click.option("--brief", "brief_path", default=None, help="brief JSON (see: brief template)")
@click.option("--title", default=None, help="quick mode: title (instead of --brief)")
@click.option("--subtitle", default=None)
@click.option("--date", default=None)
@click.option("--venue", default=None)
@click.option("--line", "lines", multiple=True, help="quick mode: program / lineup line (repeatable)")
@click.option("--body", default=None)
@click.option("--lang", type=click.Choice(["zh", "en", "bilingual", "auto"]), default=None)
@click.option("--mood", default=None, help="quick mode: comma-separated moods")
@click.option("--count", "-n", type=int, default=None, help="candidates to keep (default: brief format.count or 6)")
@click.option("--min-score", type=float, default=None, help="minimum taste score 1–10 (oversamples up to 3×count)")
@click.option("--max-tries", type=int, default=None)
@click.option("--ratio", type=click.Choice(["3:4", "9:16", "1:1", "4:3", "16:9", "21:9"]), default=None)
@click.option("--seed", default=None, help="seed base (default: hash of the content)")
@click.option("--direction", "directions", multiple=True, help="restrict to direction ids (d1…) or style ids")
@click.option("--format", "formats", default="png,json", help="png,svg,jpeg (json is always written)")
@click.option("--scale", type=float, default=1.0)
@click.option("--out", "-o", "out_dir", default="poster-out", help="output directory")
@click.option("--no-font-fix", is_flag=True, help="do not add fallback glyph subsets for characters missing from the app fonts")
@click.option("--sheet/--no-sheet", default=True, help="write a contact sheet (sheet.jpg)")
@click.option("--strict", is_flag=True, help="never return candidates that fail a correctness gate (default: fill up with flagged ones)")
@handle_error
def generate(brief_path, title, subtitle, date, venue, lines, body, lang, mood, count, min_score, max_tries, ratio, seed, directions, formats, scale, out_dir, no_font_fix, sheet, strict):
    """Render N content-driven candidates from a brief.

    Correctness gates come first (content rendered verbatim, checked text contrast, minimum size at the
    target display, CJK line rules, glyphs). Candidates that fail a blocking gate are excluded, or appended
    as flagged when too few pass (never with --strict). The passing ones are ranked by the taste selector
    (taste − engine gate penalty). Each poster carries a report with gates, aesthetic dimensions and issues.
    """
    if brief_path:
        b = _load_json(brief_path)
    elif title:
        b = _inline_brief(title, subtitle, date, venue, lines, body, lang, mood, ratio)
    else:
        raise ValueError("give --brief FILE or --title …")
    fmts = [f.strip().replace("jpg", "jpeg") for f in formats.split(",") if f.strip() and f.strip() != "json"]
    extra, font_rep = [], {}
    if _backend == "chromium":
        r = be.run("resolve", {"brief": b}, backend="node")
        fams = sorted({f for d in r["directions"] for f in d["families"]})
        extra, font_rep = fonts_mod.extra_for(fonts_mod.brief_text(b), fams, paths(), enabled=not no_font_fix)
    payload = {"brief": b, "count": count, "minScore": min_score, "maxTries": max_tries, "ratio": ratio, "seed": seed, "directions": list(directions) or None,
               "formats": fmts or ["png"], "scale": scale, "out": os.path.abspath(out_dir), "extraFonts": extra, "includeFlagged": not strict}
    res = be.run("generate", payload, backend=_backend)
    for p in res["posters"]:
        if _backend == "chromium":
            fams = be.run("fonts.families", {"fonts": json.load(open(p["files"]["json"], encoding="utf-8"))["entry"]["fonts"]}, backend="node")
            fonts_mod.merge_glyph_gate(p["report"], fonts_mod.glyph_gate(fams, font_rep))
        else:
            p["report"]["gates"]["glyphs"] = {"status": "n/a", "why": "node backend renders with the full fonts"}
        p["gates_passed"], p["blocking_failures"] = p["report"]["gates_passed"], p["report"]["blocking_failures"]
        if not p["gates_passed"]:
            p["flagged"] = True
    res["fonts"] = {"fallback_subsets": [{"family": e["family"], "chars": e.get("unicodeRange")} for e in extra], "unresolved": font_rep.get("unresolved", {}),
                    "note": "fallback glyphs are not in the web app's fonts: those characters render with the app's fallback face after import" if extra else ""}
    if sheet and res["posters"] and "png" in (fmts or ["png"]):
        imgs = [p["files"]["png"] for p in res["posters"]]
        labels = [f"#{p['rank']} {p['style']} · {p['comp']}/{p['idea'] or '-'} · taste {p['taste']:.2f}{'' if p['gates_passed'] else ' · FLAGGED'}" for p in res["posters"]]
        res["sheet"] = be.run("sheet", {"images": imgs, "labels": labels, "out": os.path.join(os.path.abspath(out_dir), "sheet.jpg"), "cols": min(6, len(imgs)), "cell": 260, "title": (b.get("content") or {}).get("title", "")}, backend="node")["file"]
    sess = get_session()
    if sess.project_path and res["posters"]:
        best = proj_mod.open_project(res["posters"][0]["files"]["json"])
        sess.apply(best["entry"], f"generate #{1} {res['posters'][0]['name']}", {"reasons": res["posters"][0]["reasons"], "brief": b})
    if len(res["posters"]) < (res["count"] or 0):
        res["warning"] = f"only {len(res['posters'])} of {res['count']} candidates reached min-score {res['minScore']} in {res['tries']} tries"
    if _json_output:
        output(res)
    else:
        click.echo(f"{len(res['posters'])} posters ({res['backend']}, {res['tries']} tries, {len(res['rejected'])} below min-score) → {out_dir}")
        for p in res["posters"]:
            a = p["report"]["aesthetic"]
            facets = " ".join(f"{k[:4]} {a[k]['value'] if a[k]['value'] is not None else '–'}" for k in ("classical", "expressive", "color", "craft"))
            gate = "GATES OK" if p["gates_passed"] else "FLAGGED: " + "; ".join(p["blocking_failures"][:3])
            click.echo(f"  #{p['rank']} {p['style']:<18} {p['comp']:<9} {str(p['idea'] or '-'):<10} taste {p['taste']:.2f} − {p['penalty']:.2f}  [{facets}]  {gate}")
            click.echo(f"      {p['files'].get('png', p['files']['json'])}  ({len(p['report']['issues'])} issues: poster-printer audit FILE)")
        for g in res.get("gate_failed", []):
            click.echo(f"  excluded {g['name']} ({g['comp']}, taste {g['taste']:.2f}): {'; '.join(g['blocking_failures'][:3])}")
        if res.get("sheet"):
            click.echo(f"  sheet: {res['sheet']}")
        if res.get("warning"):
            click.echo("  warning: " + res["warning"])
    if res.get("warning") and min_score is not None and not res["posters"] and not _repl_mode:
        sys.exit(5)


# ── iterate ─────────────────────────────────────────────────────
@cli.command()
@click.argument("src", required=False)
@click.option("--set", "sets", multiple=True, help="param=value (see: catalog params), repeatable")
@click.option("--text", "texts", multiple=True, help="slot=value: headline, sub, note, groups.N.main|sub|note, prose.N, meta.N, words.N")
@click.option("--style", "style_id", default=None, help="switch style, keep copy / palette / pictures")
@click.option("--ratio", type=click.Choice(["3:4", "9:16", "1:1", "4:3", "16:9", "21:9"]), default=None)
@click.option("--output", "-o", "out", default=None, help="write the refined poster JSON (and PNG next to it)")
@click.option("--png/--no-png", default=True)
@handle_error
def refine(src, sets, texts, style_id, ratio, out, png):
    """Change params / copy / style / ratio of a poster, keeping the draw (like the app's sliders)."""
    entry = _entry_from(src)
    tx = _parse_sets(texts) if texts else None
    r = be.run("refine", {"entry": entry, "set": _parse_sets(sets), "texts": tx, "styleId": style_id, "ratio": ratio}, backend=_backend)
    label = "refine " + " ".join(list(sets) + list(texts) + ([f"style={style_id}"] if style_id else []) + ([f"ratio={ratio}"] if ratio else []))
    res: dict = {"summary": r["summary"]}
    sess = get_session()
    if not src and sess.has_project():
        sess.apply(r["entry"], label)
    target = out or (None if (not src and sess.has_project()) else (src[:-5] if src.endswith(".json") else src) + ".refined.json")
    if target:
        proj_mod.save_project(proj_mod.create_project(r["entry"], _carry_x(src)), target)
        res["json"] = target
    base = (target or sess.project_path or "poster")
    base = base[:-5] if base.endswith(".json") else base
    if png and not _dry_run:
        extra, _ = _fonts_for_entry(r["entry"], True)
        res["render"] = export_mod.render(r["entry"], base, "png", backend=_backend, extra_fonts=extra)
    output(res, label)


@cli.command()
@click.argument("src", required=False)
@click.option("--vary", type=click.Choice(["layout", "structure", "color", "image", "decor", "tendency"]), default="layout")
@click.option("--count", "-n", type=int, default=6)
@click.option("--seed", default=None)
@click.option("--out", "-o", "out_dir", default="variations")
@click.option("--pick", type=int, default=None, help="put variation N into the project (undoable)")
@handle_error
def variations(src, vary, count, seed, out_dir, pick):
    """The app's variant buttons (换结构 / 换色调 / 换图片 / 换倾向 …); copy always stays."""
    entry = _entry_from(src)
    r = be.run("variations", {"entry": entry, "vary": vary, "count": count, "seed": seed, "out": os.path.abspath(out_dir), "formats": ["png"]}, backend=_backend)
    items = [{k: v for k, v in it.items() if k != "entry"} for it in r["items"]]
    _stamp_brief([it["files"]["json"] for it in items if it.get("files", {}).get("json")], _carry_x(src))
    if pick:
        get_session().apply(r["items"][pick - 1]["entry"], f"variation {vary} #{pick}")
    output({"backend": r["backend"], "items": items}, f"{len(items)} {vary} variations → {out_dir}")


@cli.command()
@click.argument("src", required=False)
@click.option("--brief", "brief_path", default=None, help="brief to check the content against (default: the brief stored in the poster by generate)")
@click.option("--display", type=click.Choice(["phone-thumbnail", "phone", "screen", "print"]), default=None, help="override the brief's display condition")
@click.option("--print-size", default=None, help="with --display print: A0–A5 or 'WxH mm'")
@click.option("--distance", type=float, default=None, help="viewing distance in metres (print)")
@click.option("--full", is_flag=True, help="include every measured item, not only failures")
@handle_error
def audit(src, brief_path, display, print_size, distance, full):
    """Correctness gates (pass / fail / n/a, measured) and aesthetic dimensions (separate), plus actionable issues.

    Gates: content drawn verbatim (no missing / truncated / clipped / overlapped text), checked text contrast
    (WCAG 2.2 thresholds), minimum text size at the display, CJK line rules (CLREQ), glyph coverage.
    Aesthetics: classical (order, clarity, alignment, hierarchy), expressive (tension; idea / originality
    are null, i.e. not judged), color, craft, plus the taste selector's overall score. Each issue has a region,
    evidence, impact and a refine command.
    """
    proj = proj_mod.open_project(src) if src else get_session().get_project()
    entry = proj["entry"]
    brief = _load_json(brief_path) if brief_path else (proj.get("x_cli") or {}).get("brief")
    if brief and (display or print_size or distance):
        brief = json.loads(json.dumps(brief))
        d = brief.setdefault("context", {}).setdefault("display", {})
        if display:
            d["kind"] = display
        if print_size:
            d["print_size"] = print_size
        if distance:
            d["viewing_distance_m"] = distance
    elif not brief and display:
        brief = None
        click.echo("note: --display needs a brief (content to check); using the poster's own copy", err=True)
    r = be.run("audit", {"entry": entry, "brief": brief}, backend=_backend)
    if _backend == "chromium":
        extra, rep = _fonts_for_entry(entry, True)
        fams = be.run("fonts.families", {"fonts": entry["fonts"]}, backend="node")
        fonts_mod.merge_glyph_gate(r, fonts_mod.glyph_gate(fams, rep))
    if not full:
        for g in ("content", "min_size", "contrast"):
            gg = r["gates"].get(g) or {}
            if "items" in gg:
                gg["items_total"] = len(gg["items"])
                gg["items"] = [i for i in gg["items"] if i.get("status") == "fail"]
        r.pop("textsBySize", None)
    if _json_output:
        return output(r)
    _print_report(r)


def _print_report(r: dict) -> None:
    """Human-readable gates / aesthetics / issues."""
    g = r["gates"]
    click.echo(f"CORRECTNESS GATES  ({'all blocking gates pass' if r['gates_passed'] else 'BLOCKING FAILURES: ' + str(len(r['blocking_failures']))})   display: {r['display']['note']}")
    for k in ("content", "min_size", "contrast", "glyphs"):
        v = g.get(k) or {}
        extra = f" (optional fields: {v['optional_status']})" if "optional_status" in v else ""
        click.echo(f"  {k:<10} {v.get('status', 'n/a'):<5}{extra}")
    cj = g.get("cjk") or {}
    if "status" in cj:
        click.echo(f"  {'cjk':<10} {cj['status']}")
    else:
        click.echo("  cjk        " + "  ".join(f"{k}: {v['status']}" for k, v in cj.items()))
    a = r["aesthetic"]
    click.echo("AESTHETIC (relative, needs human calibration; – = not judged)")
    click.echo(f"  overall    taste {a['overall']['taste']}  − gate penalty {a['overall']['gate_penalty']}  = {a['overall']['score']}")
    for k in ("classical", "expressive", "color", "craft"):
        v = a[k]
        facets = "  ".join(f"{kk} {('–' if vv is None else vv)}" for kk, vv in v.items() if kk not in ("value", "basis", "idea_assigned"))
        click.echo(f"  {k:<10} {('–' if v['value'] is None else v['value'])!s:<5} {facets}")
    click.echo(f"ISSUES ({len(r['issues'])})")
    for i in r["issues"]:
        click.echo(f"  [{'BLOCKING' if i['blocking'] else 'advisory'}] {i['dimension']}  region {i['region']}  impact {'/'.join(i['impact'])}")
        click.echo(f"      evidence: {i['evidence']}")
        if i["fix"]["command"]:
            click.echo(f"      fix:      poster-printer {i['fix']['command']}   ({i['fix']['why']})")


@cli.command()
@click.argument("src", required=False)
@handle_error
def info(src):
    """Summary of a poster file or the project (no render)."""
    proj = proj_mod.open_project(src) if src else get_session().get_project()
    output(proj_mod.get_project_info(proj))


@cli.command()
@handle_error
def undo():
    """Undo the last change to the project."""
    output({"undone": get_session().undo(), **get_session().history()})


@cli.command()
@handle_error
def redo():
    """Redo."""
    output({"redone": get_session().redo(), **get_session().history()})


@cli.command()
@handle_error
def history():
    """Undo / redo stacks of the project."""
    output(get_session().history())


@cli.command("save")
@click.argument("path", required=False)
@handle_error
def save_cmd(path):
    """Save the project (to PATH or --project)."""
    output({"saved": get_session().save_session(path)})


@cli.command("open")
@click.argument("path")
@handle_error
def open_cmd(path):
    """Open a poster JSON as the project (REPL)."""
    get_session().set_project(proj_mod.open_project(path), path)
    output(proj_mod.get_project_info(get_session().get_project()), f"Opened {path}")


# ── export / deck ───────────────────────────────────────────────
@cli.command()
@click.argument("src", required=False)
@click.option("--format", "fmt", type=click.Choice(sorted(export_mod.EXPORT_PRESETS)), default="png")
@click.option("--out", "-o", "out", required=True, help="output path (extension optional)")
@click.option("--scale", type=float, default=None)
@click.option("--no-font-fix", is_flag=True)
@handle_error
def export(src, fmt, out, scale, no_font_fix):
    """Export a poster: png | png@2x | png@4x | jpg | svg | svg-light | pdf | json."""
    entry = _entry_from(src)
    base = os.path.splitext(out)[0] if os.path.splitext(out)[1].lower() in (".png", ".jpg", ".jpeg", ".svg", ".pdf", ".json") else out
    extra, _ = _fonts_for_entry(entry, not no_font_fix) if fmt != "json" else ([], {})
    output(export_mod.render(entry, base, fmt, backend=_backend, scale=scale, extra_fonts=extra), f"Exported {fmt}")


@cli.command()
@click.argument("src", required=False)
@click.option("--pages", type=int, default=6)
@click.option("--out", "-o", "out_dir", default="deck")
@click.option("--format", "formats", default="pdf", help="pdf,zip,png")
@click.option("--folio/--no-folio", default=True)
@click.option("--repeat-images", is_flag=True)
@click.option("--seed", default=None)
@handle_error
def deck(src, pages, out_dir, formats, folio, repeat_images, seed):
    """Multi-page deck from a cover poster: shared palette, grid and copy; folio; PDF / ZIP."""
    entry = _entry_from(src)
    r = be.run("deck", {"entry": entry, "pages": pages, "folio": folio, "noRepeat": not repeat_images, "seed": seed, "out": os.path.abspath(out_dir), "formats": formats.split(",")}, backend=_backend)
    output({"backend": r["backend"], "pages": [{k: v for k, v in it.items() if k != "entry"} for it in r["items"]], "pdf": _file_of(r.get("pdf")), "zip": _file_of(r.get("zip"))}, f"deck → {out_dir}")


def _file_of(v: Any) -> Any:
    return v.get("file") if isinstance(v, dict) else v


# ── REPL ────────────────────────────────────────────────────────
@cli.command()
@click.option("--project", "project_path", type=str, default=None)
@handle_error
def repl(project_path):
    """Interactive REPL (the same commands, the current poster held in memory)."""
    from cli_anything.poster_printer.utils.repl_skin import ReplSkin
    global _repl_mode
    _repl_mode = True
    skin = ReplSkin("poster_printer", version=__version__)
    if project_path:
        get_session().set_project(proj_mod.open_project(project_path), project_path)
    skin.print_banner()
    pt = skin.create_prompt_session()
    while True:
        try:
            s = get_session()
            name = ""
            if s.has_project():
                e = s.get_project()["entry"]
                name = f"{e['styleId']} {e['ratio']} {e['picked'].get('comp', '')}"
            line = skin.get_input(pt, project_name=name, modified=s._modified).strip()
            if not line:
                continue
            if line.lower() in ("quit", "exit", "q"):
                if s._modified:
                    skin.warning("unsaved changes (use: save [path])")
                skin.print_goodbye()
                break
            if line.lower() == "help":
                skin.help(REPL_HELP)
                continue
            try:
                args = shlex.split(line)
            except ValueError:
                args = line.split()
            try:
                cli.main(args, standalone_mode=False)
            except SystemExit:
                pass
            except click.exceptions.UsageError as e:
                skin.error(f"Usage error: {e}")
            except Exception as e:  # noqa: BLE001 - keep the REPL alive
                skin.error(str(e))
        except (EOFError, KeyboardInterrupt):
            skin.print_goodbye()
            break
    # _repl_mode stays True: the outer one-shot context must not auto-save what the REPL left unsaved


REPL_HELP = {
    "brief template|validate|analyze|resolve|schema": "write and resolve a content brief",
    "generate --brief B --count N --min-score S": "ranked candidates (best goes into the project)",
    "open FILE / save [PATH] / info / history": "project",
    "refine --set k=v --text slot=v --style ID": "change the current poster",
    "variations --vary layout|color|image|structure|tendency --pick N": "app variant buttons",
    "undo / redo": "history",
    "audit": "design audit",
    "export --format png|png@2x|svg|pdf|json -o PATH": "export",
    "deck --pages 6 -o DIR": "multi-page PDF",
    "styles|palettes|fonts|images|catalog …": "catalogues",
    "doctor": "environment check",
    "quit": "exit",
}


def main() -> None:
    cli()


if __name__ == "__main__":
    main()
