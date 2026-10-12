# poster-printer-cli

Poster Printer as a CLI, in CLI-Anything conventions.

- `engine/`: Node engine. It bundles `../poster-printer/src` and adds the brief schema, analyser, resolver,
  candidate generation and headless-Chrome / resvg rendering. Build it with `npm ci && npm run build`.
- `agent-harness/`: the Python Click CLI `cli-anything-poster-printer` (alias `poster-printer`). Install with `pip install -e agent-harness`.
- `skills/cli-anything-poster-printer/SKILL.md`: the agent skill.
- `briefs/`: example briefs. `demo/`: demo output and contact sheet.

See `agent-harness/cli_anything/poster_printer/README.md`.

Original program code is licensed under [GNU AGPL v3.0 only](../LICENSE).

Tests: install `agent-harness` with its `dev` extra (`python -m pip install -e ".[dev]"`), activate that Python environment, then run `npm test` in `engine/`.
