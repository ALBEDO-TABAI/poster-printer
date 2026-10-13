# ready-poster-printer CLI (`poster-printer-cli/`)

Ready Poster Printer as a CLI, in CLI-Anything conventions.

- `engine/`: Node engine. It bundles `../poster-printer/src` and adds the brief schema, analyser, resolver,
  candidate generation and headless-Chrome / resvg rendering. Build it with `npm ci && npm run build`.
- `agent-harness/`: the Python Click CLI `ready-poster-printer` (also `cli-anything-ready-poster-printer`; the older names `poster-printer` and `cli-anything-poster-printer` stay as aliases). Install with `pip install -e agent-harness`.
- `skills/ready-poster-printer/`: the agent skill. `SKILL.md` is the workflow. `LAYOUT_METHOD.md` is the method for choosing a Swiss grid layout from the user's pictures and copy (a copy ships inside the Python package, `cli_anything/poster_printer/skills/`).
- `briefs/`: example briefs. `demo/`: demo output and contact sheet.

See `agent-harness/cli_anything/poster_printer/README.md`.

Original program code is licensed under [GNU AGPL v3.0 only](../LICENSE).

Environment variables keep the `POSTER_PRINTER_` prefix and user data stays in `~/.poster-printer`, so existing installs keep their images and settings.

Tests: install `agent-harness` with its `dev` extra (`python -m pip install -e ".[dev]"`), activate that Python environment, then run `npm test` in `engine/`.
