"""Shared fixtures: isolated ~/.poster-printer per test session, sample briefs."""
from __future__ import annotations

import os
import pytest

TALK = {
    "purpose": "talk",
    "content": {"title": "留白之后", "subtitle": "当代中文字体设计的六个问题", "date": "2026-11-21T19:30", "venue": "衡山路 12 号 · 二楼讲堂", "city": "上海",
                "speakers": ["林知远 · 字体设计师", "周木 · 编辑", "陈一禾 · 策展人"], "organizers": ["纸上工作室"], "price": "免费 · 需预约", "edition": "第07期", "language": "zh"},
    "style": {"mood": ["calm", "literary"], "density": "airy", "typography": {"voice": "serif"}, "color": {"background": "light"}},
}
MUSIC = {
    "purpose": "music",
    "content": {"title": "夜航", "title_alt": "NIGHT FERRY", "date": "2026-12-05T20:00", "venue": "九号仓库 Warehouse 9", "city": "杭州 Hangzhou", "language": "bilingual",
                "program": [{"time": "20:00", "act": "苔原 Tundra"}, {"time": "21:00", "act": "Soft Static"}, {"time": "22:00", "act": "流明 Lumen"}, {"time": "23:15", "act": "Harbor Choir"}],
                "price": "¥120"},
    "style": {"mood": ["bold", "playful"], "era": "90s", "color": {"background": "dark"}},
}
EXHIBITION = {
    "purpose": "exhibition",
    "content": {"title": "Low Tide", "subtitle": "Photographs by Mara Ellison", "date": "2026-10-30", "date_end": "2026-12-14", "venue": "Gallery Kōen", "city": "Tokyo", "price": "Free", "language": "en"},
    "style": {"mood": ["calm", "minimal"], "density": "airy", "imagery": {"use": "hero", "subject": ["landscape", "nature"]}, "color": {"background": "light"}},
}


@pytest.fixture(scope="session")
def pp_home(tmp_path_factory) -> str:
    home = str(tmp_path_factory.mktemp("pp-home"))
    os.environ["POSTER_PRINTER_HOME"] = home
    return home


@pytest.fixture
def briefs(tmp_path):
    import json
    out = {}
    for name, b in (("talk", TALK), ("music", MUSIC), ("exhibition", EXHIBITION)):
        p = tmp_path / f"{name}.json"
        p.write_text(json.dumps(b, ensure_ascii=False), encoding="utf-8")
        out[name] = str(p)
    return out
