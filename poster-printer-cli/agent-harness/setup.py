#!/usr/bin/env python3
"""setup.py for cli-anything-ready-poster-printer.

Install with: pip install -e .   (needs the Node engine: cd ../engine && npm install && npm run build)
"""
from setuptools import setup, find_namespace_packages

with open("cli_anything/poster_printer/README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="cli-anything-ready-poster-printer",
    version="0.4.0",
    license="AGPL-3.0-only",
    author="cli-anything contributors",
    author_email="",
    description="CLI harness for Ready Poster Printer — content-driven poster generation with the real app engine (Node + headless Chrome). Requires: node >= 20, Chrome/Chromium (or --backend node)",
    long_description=long_description,
    long_description_content_type="text/markdown",
    packages=find_namespace_packages(include=["cli_anything.*"]),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Multimedia :: Graphics",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.10",
    install_requires=["click>=8.0.0", "prompt-toolkit>=3.0.0", "fonttools>=4.40", "brotli>=1.0"],
    extras_require={"dev": ["pytest>=7.0.0", "pillow>=10"]},
    entry_points={
        "console_scripts": [
            "cli-anything-ready-poster-printer=cli_anything.poster_printer.poster_printer_cli:main",
            "ready-poster-printer=cli_anything.poster_printer.poster_printer_cli:main",
            # the names before the rename stay as aliases (scripts and agents written for them keep working)
            "cli-anything-poster-printer=cli_anything.poster_printer.poster_printer_cli:main",
            "poster-printer=cli_anything.poster_printer.poster_printer_cli:main",
        ],
    },
    package_data={"cli_anything.poster_printer": ["skills/*.md"]},
    include_package_data=True,
    zip_safe=False,
)
