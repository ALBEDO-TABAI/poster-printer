"""End-to-end tests: the installed command (subprocess), real renders, and the web-app round trip.

Requires node, the built engine (engine/dist) and Chrome (skipped where Chrome is missing).
Set CLI_ANYTHING_FORCE_INSTALLED=1 to insist on the installed ``cli-anything-ready-poster-printer``.
Set POSTER_PRINTER_APP_URL to reuse a running web app for the round trip (otherwise it is built and served).
"""
from __future__ import annotations

import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import pytest

from cli_anything.poster_printer.utils import poster_backend as be

PNG = b"\x89PNG\r\n\x1a\n"


def _resolve_cli(name: str) -> list[str]:
    """Resolve the CLI entry point: installed command first, ``python -m`` fallback unless forced."""
    force = os.environ.get("CLI_ANYTHING_FORCE_INSTALLED", "").strip() == "1"
    sibling = Path(sys.executable).parent / name
    if sibling.exists():
        print(f"[_resolve_cli] Using sibling command: {sibling}")
        return [str(sibling)]
    path = shutil.which(name)
    if path:
        print(f"[_resolve_cli] Using installed command: {path}")
        return [path]
    if force:
        raise RuntimeError(f"{name} not found in PATH. Install with: python3 -m pip install -e .")
    module = "cli_anything.poster_printer.poster_printer_cli"
    print(f"[_resolve_cli] Falling back to: {sys.executable} -m {module}")
    return [sys.executable, "-m", module]


def _paths() -> dict:
    return be.run("paths", {}, backend="node")


def _have_chrome() -> bool:
    """The engine's own browser discovery (Linux, macOS and Windows paths, or POSTER_PRINTER_CHROME)."""
    try:
        return bool(be.run("paths", {}, backend="node").get("chrome"))
    except Exception:  # engine not built
        return bool(shutil.which("google-chrome") or shutil.which("chromium"))


HAVE_CHROME = _have_chrome()


def _have_full_fonts() -> bool:
    """The glyph fixer subsets the full (unsubset) font files: POSTER_PRINTER_FONTS, default /workspace/fonts."""
    try:
        return os.path.isfile(os.path.join(be.run("paths", {}, backend="node").get("fonts", ""), "catalog.json"))
    except Exception:
        return False


needs_full_fonts = pytest.mark.skipif(not _have_full_fonts(), reason="full font files not available (set POSTER_PRINTER_FONTS)")
needs_chrome = pytest.mark.skipif(not HAVE_CHROME, reason="Chrome/Chromium not installed")


class TestCLISubprocess:
    CLI_BASE = _resolve_cli("cli-anything-ready-poster-printer")

    def _run(self, args: list[str], check: bool = True, env: dict | None = None) -> subprocess.CompletedProcess:
        e = os.environ.copy()
        e.update(env or {})
        r = subprocess.run(self.CLI_BASE + args, capture_output=True, text=True, env=e, timeout=600)
        if check and r.returncode != 0:
            raise AssertionError(f"{args} exited {r.returncode}\nstdout: {r.stdout[-2000:]}\nstderr: {r.stderr[-2000:]}")
        return r

    def _json(self, args: list[str], **kw) -> dict:
        return json.loads(self._run(["--json", *args], **kw).stdout)

    # ── basics ──
    def test_help_and_version(self):
        r = self._run(["--help"])
        assert "Ready Poster Printer CLI" in r.stdout and "generate" in r.stdout
        from cli_anything.poster_printer import __version__
        assert __version__ in self._run(["--version"]).stdout

    def test_alias_command_installed(self):
        if os.environ.get("CLI_ANYTHING_FORCE_INSTALLED") == "1":
            for name in ("ready-poster-printer", "poster-printer"):  # the name before the rename stays as an alias
                assert shutil.which(name) or (Path(sys.executable).parent / name).exists(), name

    def test_doctor(self):
        d = self._json(["doctor"])
        assert d["ok"], d
        assert any("engine bundle" == c["name"] for c in d["checks"])

    def test_catalog_commands(self):
        assert len(self._json(["styles", "list"])) >= 60
        assert self._json(["palettes", "search", "--tag", "noir", "--limit", "3"])["total"] > 0
        assert any(f["cjk"] for f in self._json(["fonts", "list"]))
        assert len(self._json(["images", "list", "--cutout"])) > 0
        assert len(self._json(["catalog", "ideas"])) >= 10
        assert "png" in self._json(["catalog", "exports"])

    def test_brief_flow(self, briefs):
        assert self._json(["brief", "validate", briefs["music"]])["ok"]
        r = self._json(["brief", "resolve", briefs["music"]])
        assert r["analysis"]["list"]["kind"] == "timetable"
        assert r["copy_slots"]["headline"] == "夜航" and r["copy_slots"]["sub"] == "NIGHT FERRY"
        assert all(d["reasons"] for d in r["directions"])
        tpl = json.loads(self._run(["brief", "template", "--lang", "zh"]).stdout)
        assert tpl["content"]["language"] == "zh"

    def test_invalid_brief_exit_code(self, tmp_path):
        bad = tmp_path / "bad.json"
        bad.write_text(json.dumps({"content": {}}))
        r = self._run(["--json", "brief", "validate", str(bad)], check=False)
        assert r.returncode == 2 and json.loads(r.stdout)["errors"]

    def test_missing_file_exit_code(self):
        r = self._run(["--json", "info", "/nonexistent/x.json"], check=False)
        assert r.returncode == 3 and json.loads(r.stdout)["type"] == "file_not_found"

    # ── generation ──
    @needs_chrome
    def test_generate_ranked_with_min_score(self, briefs, tmp_path):
        out = tmp_path / "music"
        d = self._json(["generate", "--brief", briefs["music"], "--count", "3", "--min-score", "6", "-o", str(out), "--format", "png,svg"])
        print(f"[generate] backend={d['backend']} tries={d['tries']} posters={[(p['comp'], p['taste']) for p in d['posters']]}")
        assert d["backend"] == "chromium" and d["parity"] is True
        assert len(d["posters"]) == 3
        scores = [p["score"] for p in d["posters"]]
        assert scores == sorted(scores, reverse=True)
        assert all(p["taste"] >= 6 for p in d["posters"])
        for p in d["posters"]:
            assert p["replayExact"] is True and p["reasons"]
            png = Path(p["files"]["png"]).read_bytes()
            assert png[:8] == PNG and len(png) > 20000
            assert Path(p["files"]["svg"]).read_text()[:4] == "<svg"
            j = json.loads(Path(p["files"]["json"]).read_text())
            assert j["app"] == "ready-poster-printer" and j["kind"] == "poster"
            assert j["entry"]["picked"]["texts"]["headline"]["t"] == "夜航"
        assert Path(d["sheet"]).exists()
        # correctness gates are separate from aesthetics; passing candidates come first, flagged last
        flags = [p["flagged"] for p in d["posters"]]
        assert flags == sorted(flags)
        for p in d["posters"]:
            rep = p["report"]
            assert {"content", "min_size", "contrast", "cjk", "glyphs"} <= set(rep["gates"])
            assert rep["gates"]["content"]["status"] in ("pass", "fail", "n/a")
            assert "WCAG" in rep["gates"]["contrast"]["label"] and "not a WCAG compliance claim" in rep["gates"]["contrast"]["label"]
            a = rep["aesthetic"]
            assert {"overall", "classical", "expressive", "color", "craft"} <= set(a)
            assert a["expressive"]["originality"] is None and a["expressive"]["idea"] is None
            assert a["overall"]["taste"] == p["taste"]
            assert p["gates_passed"] == (not rep["blocking_failures"])
            for i in rep["issues"]:
                assert {"dimension", "region", "evidence", "impact", "fix", "blocking"} <= set(i)
                assert set(i["impact"]) <= {"legibility", "finding-info", "expression", "craft"}
        assert "gate_failed" in d

    @needs_chrome
    def test_quick_mode_generate(self, tmp_path):
        d = self._json(["generate", "--title", "Paper Weekend", "--date", "2026-11-08", "--venue", "Old Mill", "--line", "10:00 Opening", "--line", "13:00 Workshop",
                        "--line", "16:00 Swap", "-n", "2", "-o", str(tmp_path / "q"), "--no-sheet"])
        assert len(d["posters"]) == 2

    def test_generate_node_backend(self, briefs, tmp_path):
        d = self._json(["--backend", "node", "generate", "--brief", briefs["exhibition"], "-n", "2", "-o", str(tmp_path / "n"), "--no-sheet"])
        print(f"[generate] backend={d['backend']}")
        assert d["backend"] == "node" and d["parity"] is False
        assert all(Path(p["files"]["png"]).read_bytes()[:8] == PNG for p in d["posters"])

    # ── project workflow ──
    @needs_chrome
    def test_project_refine_undo_redo_export(self, briefs, tmp_path):
        proj = str(tmp_path / "talk-project.json")
        P = ["--project", proj]
        self._json([*P, "generate", "--brief", briefs["talk"], "-n", "2", "-o", str(tmp_path / "g"), "--no-sheet"])
        first = json.loads(Path(proj).read_text())
        assert first["kind"] == "poster" and first["entry"]["picked"]["texts"]["headline"]["t"] == "留白之后"
        r = self._json([*P, "refine", "--set", "titleScale=130", "--text", "sub=六个问题"])
        assert Path(r["render"]["files"]["png"]).exists()
        after = json.loads(Path(proj).read_text())
        assert after["entry"]["params"]["titleScale"] == 130 and after["entry"]["picked"]["texts"]["sub"]["t"] == "六个问题"
        assert self._json([*P, "history"])["undo"]
        self._json([*P, "undo"])
        assert json.loads(Path(proj).read_text())["entry"]["params"].get("titleScale") == first["entry"]["params"].get("titleScale")
        self._json([*P, "redo"])
        assert json.loads(Path(proj).read_text())["entry"]["params"]["titleScale"] == 130
        # --dry-run does not write
        self._json([*P, "--dry-run", "refine", "--set", "margin=7", "--no-png"])
        assert json.loads(Path(proj).read_text())["entry"]["params"].get("margin") != 7
        # params removed in app phase 13 (never read by the engine) are accepted and ignored: old scripts keep working
        self._json([*P, "--dry-run", "refine", "--set", "whitespace=70", "--no-png"])
        a = self._json([*P, "audit"])
        assert "gates" in a and "aesthetic" in a and "issues" in a
        info = self._json([*P, "info"])
        assert info["headline"] == "留白之后"
        for fmt, ext, magic in (("png@2x", "png", PNG), ("svg", "svg", b"<svg"), ("pdf", "pdf", b"%PDF-"), ("jpg", "jpg", b"\xff\xd8\xff")):
            e = self._json([*P, "export", "--format", fmt, "-o", str(tmp_path / f"x-{fmt}")])
            f = Path(e["files"][ext if ext != "jpg" else "jpg"])
            assert f.read_bytes()[: len(magic)] == magic, fmt
        size = self._json([*P, "export", "--format", "png@2x", "-o", str(tmp_path / "x2")])["verify"]["png"]
        assert size["w"] == 2400

    @needs_chrome
    def test_variations_and_deck(self, briefs, tmp_path):
        g = self._json(["generate", "--brief", briefs["exhibition"], "-n", "1", "-o", str(tmp_path / "g"), "--no-sheet"])
        src = g["posters"][0]["files"]["json"]
        v = self._json(["variations", src, "--vary", "color", "-n", "3", "-o", str(tmp_path / "v")])
        assert len(v["items"]) == 3 and len({tuple(it["palette"].values()) for it in v["items"]}) >= 2
        d = self._json(["deck", src, "--pages", "3", "-o", str(tmp_path / "d")])
        assert Path(d["pdf"]).read_bytes()[:5] == b"%PDF-" and len(d["pages"]) == 3

    @needs_chrome
    def test_layer_variations(self, briefs, tmp_path):
        # app phase 17: --vary type / place / grid re-roll one layer of the structure; type keeps every picture frame
        g = self._json(["generate", "--brief", briefs["exhibition"], "-n", "1", "-o", str(tmp_path / "g"), "--no-sheet"])
        src = g["posters"][0]["files"]["json"]
        t = self._json(["variations", src, "--vary", "type", "-n", "3", "-o", str(tmp_path / "t")])
        assert len(t["items"]) == 3
        assert all(it["layer"]["vary"] == "type" and it["layer"]["picturesKept"] is True for it in t["items"])
        assert any(it["layer"]["changed"] for it in t["items"])
        entry = json.loads(Path(t["items"][0]["files"]["json"]).read_text())["entry"]
        assert entry["picked"]["layers"]["v"] == 2 and entry["picked"]["layers"]["type"]
        p = self._json(["variations", src, "--vary", "place", "-n", "2", "-o", str(tmp_path / "p")])
        assert all(it["layer"]["vary"] == "place" and it["comp"] == g["posters"][0]["comp"] for it in p["items"])
        r = self._json(["variations", src, "--vary", "grid", "-n", "1", "-o", str(tmp_path / "r")])
        assert r["items"][0]["layer"]["vary"] == "grid"

    @needs_chrome
    def test_audit_gates_and_actionable_fix(self, briefs, tmp_path):
        g = self._json(["generate", "--brief", briefs["exhibition"], "-n", "1", "-o", str(tmp_path / "g"), "--no-sheet"])
        src = g["posters"][0]["files"]["json"]
        a = self._json(["audit", src, "--full"])
        assert a["brief_used"] is True
        venue = [i for i in a["gates"]["content"]["items"] if i["field"] == "venue"][0]
        assert venue["required"] and venue["status"] == "pass" and venue["rendered"].startswith("verbatim")
        # a field the poster cannot show → blocking content failure with a concrete fix
        b = json.loads(Path(briefs["exhibition"]).read_text())
        b["content"]["price"] = "¥ 4,200 members only"
        b["context"] = {"priority": ["title", "price"]}
        bp = tmp_path / "b2.json"; bp.write_text(json.dumps(b, ensure_ascii=False))
        a2 = self._json(["audit", src, "--brief", str(bp)])
        assert a2["gates_passed"] is False and any("price" in x for x in a2["blocking_failures"])
        iss = [i for i in a2["issues"] if "price" in i["dimension"]][0]
        assert iss["blocking"] and "finding-info" in iss["impact"] and iss["fix"]["command"]
        # phone display: small text fails min size; applying the suggested refine raises the measured size
        ph = self._json(["audit", src, "--display", "phone", "--full"])
        fails = [i for i in ph["issues"] if i.get("gate") == "min_size"]
        if fails:
            before = min(i["css_px"] for i in ph["gates"]["min_size"]["items"] if i["status"] == "fail")
            cmd = fails[0]["fix"]["command"].split()
            assert cmd[0] == "refine"
            out = str(tmp_path / "fixed.json")
            self._run(["refine", src, *cmd[1:], "-o", out, "--no-png"])
            ph2 = self._json(["audit", out, "--display", "phone", "--full"])
            after = [i["css_px"] for i in ph2["gates"]["min_size"]["items"] if i.get("label") == fails[0]["dimension"].split(": ", 1)[1]]
            assert not after or after[0] > before

    @needs_chrome
    @needs_full_fonts
    def test_fonts_check_fix(self, tmp_path):
        d = self._json(["fonts", "check", "--text", "鱻", "--family", "Noto Sans SC", "--fix"])
        assert "鱻" in d["missing"]["Noto Sans SC"]
        assert d["fixed"] and Path(d["fixed"][0]["file"]).exists()

    def test_images_add_list_remove(self, tmp_path):
        from PIL import Image
        img = tmp_path / "pic.jpg"
        Image.new("RGB", (640, 480), (40, 90, 160)).save(img)
        added = self._json(["images", "add", str(img)])
        iid = added[0]["id"]
        assert any(a["id"] == iid for a in self._json(["images", "list", "--user"]))
        self._json(["images", "remove", iid])
        assert not any(a["id"] == iid for a in self._json(["images", "list", "--user"]))


# ── web-app round trip ──
def _free_port() -> int:
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


@pytest.fixture(scope="module")
def app_url(tmp_path_factory):
    url = os.environ.get("POSTER_PRINTER_APP_URL")
    if url:
        yield url
        return
    rea = _paths()["rea"]
    out = str(tmp_path_factory.mktemp("app-dist"))
    subprocess.run(["npx", "vite", "build", "--outDir", out, "--emptyOutDir"], cwd=rea, check=True, capture_output=True, timeout=300)
    port = _free_port()
    proc = subprocess.Popen(["npx", "vite", "preview", "--outDir", out, "--port", str(port), "--strictPort", "--host", "127.0.0.1"], cwd=rea, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://127.0.0.1:{port}/"
    for _ in range(100):
        try:
            urllib.request.urlopen(url, timeout=1)
            break
        except OSError:
            time.sleep(0.2)
    yield url
    proc.terminate()


@needs_chrome
class TestAppRoundTrip:
    """A CLI poster JSON imported into the web app (its Import JSON input) must render identically."""

    CLI = _resolve_cli("cli-anything-ready-poster-printer")

    def test_import_renders_identically(self, briefs, tmp_path, app_url):
        out = tmp_path / "rt"
        files = []
        # a clean library: pictures other tests added (CLI user images) do not exist in the web app, so a draw that picks
        # one could never round-trip (a documented limit); this test is about the engine parity
        env = {**os.environ, "POSTER_PRINTER_HOME": str(tmp_path / "home")}
        for name in ("music", "exhibition", "talk"):
            d = json.loads(subprocess.run(self.CLI + ["--json", "generate", "--brief", briefs[name], "-n", "2", "-o", str(out / name), "--no-sheet", "--no-font-fix"],
                                          capture_output=True, text=True, check=True, timeout=600, env=env).stdout)
            files += [p["files"]["json"] for p in d["posters"]]
        for f in files:
            base = f[:-5]
            subprocess.run(self.CLI + ["export", f, "--format", "svg-light", "-o", base + ".cli", "--no-font-fix"], check=True, capture_output=True, timeout=300, env=env)
            subprocess.run(self.CLI + ["export", f, "--format", "png", "-o", base + ".cli", "--no-font-fix"], check=True, capture_output=True, timeout=300, env=env)
        script = Path(_paths()["engine"]).parent / "scripts" / "app_roundtrip.mjs"
        res = json.loads(subprocess.run(["node", str(script), app_url, str(out / "app"), *files], capture_output=True, text=True, check=True, timeout=900).stdout)
        from PIL import Image, ImageChops
        norm = lambda s: re.sub(r"\br[0-9a-z]+_", "ID_", s)  # noqa: E731 - per-render clip/gradient id prefix
        for r in res:
            base = r["file"][:-5]
            print(f"[roundtrip] {Path(r['file']).name}: import via {r['method']}, restored={r['restored']}")
            assert r["method"] == "file-input" and r["restored"]
            app_svg, cli_svg = Path(r["svg"]).read_text(), Path(base + ".cli.svg").read_text()
            assert norm(app_svg) == norm(cli_svg), f"SVG differs for {r['file']}"
            a, c = Image.open(r["png"]).convert("RGB"), Image.open(base + ".cli.png").convert("RGB")
            assert a.size == c.size
            diff = ImageChops.difference(a, c)
            # the SVG above is the exact parity check. Two Chromium pages may antialias the edges of very large glyphs
            # one level apart (seen: 134 px at ±1 on a 230 px CJK headline); anything visible is still a failure
            worst = max(hi for _, hi in diff.getextrema())
            assert worst <= 2, f"raster differs for {r['file']}: bbox {diff.getbbox()}, max level {worst}"
