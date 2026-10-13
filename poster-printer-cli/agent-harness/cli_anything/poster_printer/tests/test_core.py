"""Unit tests for the core modules (no Chrome; the pure engine ops run on node)."""
from __future__ import annotations

import json
import os

import pytest
from click.testing import CliRunner

from cli_anything.poster_printer import poster_printer_cli as cli_mod
from cli_anything.poster_printer.core import export as export_mod
from cli_anything.poster_printer.core import fonts as fonts_mod
from cli_anything.poster_printer.core import project as proj_mod
from cli_anything.poster_printer.core.session import Session
from cli_anything.poster_printer.utils import poster_backend as be

from .conftest import MUSIC, TALK, EXHIBITION


def _entry(i: int = 0) -> dict:
    return {"id": f"e{i}", "seeds": {"layout": f"L{i}", "text": "T", "color": "C", "image": "I"}, "ratio": "3:4", "styleId": "swiss", "params": {"titleScale": 100 + i},
            "picked": {"comp": "swiss", "texts": {"headline": {"t": "A"}}}, "fonts": {"en": "Inter", "zh": "Noto Sans SC"}}


@pytest.fixture(autouse=True)
def _reset(pp_home):
    cli_mod._session = None
    cli_mod._json_output = False
    cli_mod._repl_mode = False
    yield


# ── project ──
class TestProject:
    def test_create_has_app_shape(self):
        p = proj_mod.create_project(_entry())
        assert p["app"] == "ready-poster-printer" and p["kind"] == "poster" and p["version"] == 1

    def test_save_open_roundtrip(self, tmp_path):
        f = str(tmp_path / "p.json")
        proj_mod.save_project(proj_mod.create_project(_entry()), f)
        assert proj_mod.open_project(f)["entry"]["id"] == "e0"

    def test_open_session_file_takes_last_entry(self, tmp_path):
        f = tmp_path / "s.json"
        f.write_text(json.dumps({"app": "ready-poster-printer", "kind": "session", "version": 1, "entries": [_entry(1), _entry(2)]}))
        assert proj_mod.open_project(str(f))["entry"]["id"] == "e2"

    def test_open_rejects_other_files(self, tmp_path):
        f = tmp_path / "x.json"
        f.write_text(json.dumps({"kind": "poster", "entry": {"id": 1}}))
        with pytest.raises(ValueError):
            proj_mod.open_project(str(f))
        with pytest.raises(FileNotFoundError):
            proj_mod.open_project(str(tmp_path / "missing.json"))

    def test_info_and_profiles(self):
        info = proj_mod.get_project_info(proj_mod.create_project(_entry()))
        assert info["style"] == "swiss" and info["ratio"] == "3:4"
        assert "16:9" in proj_mod.list_profiles()


# ── session ──
class TestSession:
    def test_undo_redo(self, tmp_path):
        s = Session()
        s.set_project(proj_mod.create_project(_entry(0)), str(tmp_path / "p.json"))
        s.apply(_entry(1), "one")
        s.apply(_entry(2), "two")
        assert s.get_project()["entry"]["id"] == "e2"
        assert s.undo() == "two" and s.get_project()["entry"]["id"] == "e1"
        assert s.history()["current"] == "one"
        assert s.redo() == "two" and s.get_project()["entry"]["id"] == "e2"
        s.undo(); s.undo()
        with pytest.raises(RuntimeError):
            s.undo()

    def test_new_change_clears_redo(self, tmp_path):
        s = Session()
        s.set_project(proj_mod.create_project(_entry(0)), str(tmp_path / "p.json"))
        s.apply(_entry(1), "one"); s.undo(); s.apply(_entry(3), "three")
        assert s.history()["redo"] == []

    def test_history_persists_in_file_and_app_shape_kept(self, tmp_path):
        f = str(tmp_path / "p.json")
        s = Session()
        s.set_project(proj_mod.create_project(_entry(0)), f)
        s.apply(_entry(1), "one")
        s.save_session()
        data = json.load(open(f))
        assert data["kind"] == "poster" and data["entry"]["id"] == "e1"
        assert data["x_cli"]["undo"][0]["label"] == "one"
        s2 = Session(); s2.set_project(proj_mod.open_project(f), f)
        assert s2.undo() == "one" and s2.get_project()["entry"]["id"] == "e0"

    def test_history_is_bounded(self, tmp_path):
        s = Session()
        s.set_project(proj_mod.create_project(_entry(0)), str(tmp_path / "p.json"))
        for i in range(70):
            s.apply(_entry(i + 1), f"s{i}")
        assert len(s.history()["undo"]) == 50


# ── export presets ──
class TestExport:
    def test_presets_cover_formats(self):
        assert {"png", "png@2x", "svg", "pdf", "json", "jpg"} <= set(export_mod.EXPORT_PRESETS)

    def test_json_export_needs_no_engine(self, tmp_path):
        r = export_mod.render(_entry(), str(tmp_path / "out"), "json")
        assert r["verify"]["json"]["ok"] and json.load(open(r["files"]["json"]))["kind"] == "poster"

    def test_unknown_preset(self, tmp_path):
        with pytest.raises(ValueError):
            export_mod.render(_entry(), str(tmp_path / "out"), "tiff")


# ── fonts ──
class TestFonts:
    def test_relevant_chars_split(self):
        assert fonts_mod.relevant_chars("夜航 Night", True) == ["航", "夜"] or set(fonts_mod.relevant_chars("夜航 Night", True)) == {"夜", "航"}
        assert set(fonts_mod.relevant_chars("夜航 Night", False)) == set("Night")

    def test_check_finds_missing_glyph(self):
        public = be.run("paths", {}, backend="node")["public"]
        rep = fonts_mod.check("鱻永", ["Noto Sans SC"], public)
        assert "永" not in rep["Noto Sans SC"]["missing"]
        assert "鱻" in rep["Noto Sans SC"]["missing"]

    def test_brief_text_collects_copy(self):
        t = fonts_mod.brief_text(MUSIC)
        assert "夜航" in t and "Harbor Choir" in t


# ── backend ──
class TestBackend:
    def test_paths_and_doctor(self):
        p = be.run("paths", {}, backend="node")
        assert os.path.isdir(p["public"])
        d = be.run("doctor", {}, backend="node")
        assert any(c["name"] == "node" and c["ok"] for c in d["checks"])

    def test_bad_backend(self):
        with pytest.raises(be.EngineError):
            be.run("paths", {}, backend="gpu")

    def test_unknown_op(self):
        with pytest.raises(be.EngineError) as ei:
            be.run("nope", {}, backend="node")
        assert ei.value.code == 2


# ── brief analysis & resolution (pure engine ops) ──
class TestBrief:
    def test_schema_and_template(self):
        s = be.run("schema", {}, backend="node")
        assert "content" in s["properties"] and "style" in s["properties"]
        t = be.run("template", {"lang": "zh"}, backend="node")
        assert "title" in t["content"]

    def test_validate_errors(self):
        r = be.run("validate", {"brief": {"content": {}}}, backend="node")
        assert r["errors"]
        r = be.run("validate", {"brief": {"content": {"title": "X"}, "style": {"mood": ["calm"], "bogus": 1}}}, backend="node")
        assert not r["errors"] and r["warnings"]

    def test_timetable_detected(self):
        a = be.run("analyze", {"brief": MUSIC}, backend="node")
        assert a["list"]["kind"] == "timetable" and len(a["list"]["items"]) == 4
        assert a["lang"]["overall"] == "bilingual"
        assert a["date"]["y"] == 2026 and a["date"]["m"] == 12

    def test_hierarchy_title_first(self):
        a = be.run("analyze", {"brief": TALK}, backend="node")
        assert a["fields"][0]["key"] == "title" and a["fields"][0]["tier"] == "hero"
        assert a["title"]["cjkShort"] is True

    def test_resolve_places_real_copy_and_reasons(self):
        r = be.run("resolve", {"brief": MUSIC}, backend="node")
        t = r["texts"]
        assert t["headline"]["t"] == "夜航" and t["sub"]["t"] == "NIGHT FERRY"
        assert [g["sub"]["t"] for g in t["groups"] if g["main"]["t"]] == ["20:00", "21:00", "22:00", "23:15"]
        assert t["facts"]["date"] == {"y": 2026, "m": 12, "d": 5}
        assert r["reasons"] and all(x.get("why") for x in r["reasons"])
        assert all(d["reasons"] for d in r["directions"])
        ideas = [d["idea"] for d in r["directions"]] + [d["composition"] for d in r["directions"]]
        assert "data" in ideas or "index" in ideas

    def test_resolve_respects_background_and_density(self):
        r = be.run("resolve", {"brief": EXHIBITION}, backend="node")
        d = r["directions"][0]["params"]
        assert d["bgPref"] == "light" and d["blockBudget"] <= 6 and "whitespace" not in d
        assert any(x["idea"] in ("immersion", "reveal", "specimen") for x in r["directions"])

    def test_resolve_seed_is_content_hash(self):
        a = be.run("resolve", {"brief": TALK}, backend="node")["seed"]
        b = be.run("resolve", {"brief": TALK}, backend="node")["seed"]
        assert a == b


class TestBriefContext:
    def test_context_validates(self):
        b = {"content": {"title": "X"}, "context": {"use": "promo", "display": {"kind": "print", "print_size": "A2", "viewing_distance_m": 1.2}, "priority": ["title", "date"]}}
        assert not be.run("validate", {"brief": b}, backend="node")["errors"]
        bad = {"content": {"title": "X"}, "context": {"display": {"kind": "billboard", "print_size": "huge"}, "priority": ["nope"]}}
        r = be.run("validate", {"brief": bad}, backend="node")
        assert len(r["errors"]) == 2 and any("priority" in w["path"] for w in r["warnings"])

    def test_priority_reorders_hierarchy(self):
        b = json.loads(json.dumps(TALK))
        b["context"] = {"priority": ["title", "venue", "date"]}
        keys = [f["key"] for f in be.run("analyze", {"brief": b}, backend="node")["fields"]]
        assert keys[:3] == ["title", "venue", "date"]

    def test_display_raises_small_text(self):
        far = json.loads(json.dumps(EXHIBITION))
        far["context"] = {"display": {"kind": "print", "print_size": "A3", "viewing_distance_m": 3}}
        r = be.run("resolve", {"brief": far}, backend="node")
        x = [x for x in r["reasons"] if x["field"] == "smallScale"]
        assert x[-1]["value"] > 110 and "print A3" in x[-1]["why"]


# ── in-process CLI ──
class TestCLIInProcess:
    def test_help_lists_commands(self):
        r = CliRunner().invoke(cli_mod.cli, ["--help"])
        assert r.exit_code == 0
        for c in ("generate", "brief", "refine", "variations", "audit", "deck", "export", "undo", "redo", "doctor"):
            assert c in r.output

    def test_brief_validate_json(self, briefs):
        r = CliRunner().invoke(cli_mod.cli, ["--json", "brief", "validate", briefs["talk"]])
        assert r.exit_code == 0 and json.loads(r.output)["ok"] is True

    def test_brief_resolve_json(self, briefs):
        r = CliRunner().invoke(cli_mod.cli, ["--json", "brief", "resolve", briefs["music"]])
        d = json.loads(r.output)
        assert d["analysis"]["list"]["kind"] == "timetable" and d["directions"] and d["copy_slots"]["headline"] == "夜航"

    def test_catalogs(self):
        for args in (["styles", "list"], ["palettes", "search", "--light", "dark"], ["fonts", "list"], ["images", "list"], ["catalog", "ideas"], ["catalog", "params"]):
            r = CliRunner().invoke(cli_mod.cli, ["--json", *args])
            assert r.exit_code == 0, (args, r.output)
            assert json.loads(r.output)

    def test_undo_without_project_errors(self):
        r = CliRunner().invoke(cli_mod.cli, ["--json", "undo"])
        assert r.exit_code != 0 and "error" in json.loads(r.output)
