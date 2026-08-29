---
name: tux-feedback-export
description: Export TUX feedback as canonical JSON or JSONL — serialize without interpretation for handoff to humans, tools or agents.
---

# tux-feedback-export

Export feedback as a file or stream, serialized without interpretation
(SPC section 46). Export never mutates the store.

## Resolve the CLI

Choose one TUX CLI variant; both implement the same commands and canonical
JSON output, so do not install both:

1. **Node.js/npm** — use an existing `tux --version` on PATH, or run
   `npx --yes --package=tux-review tux --version` and prefix commands with
   `npx --yes --package=tux-review tux …`.
2. **Python/PyPI** — install with `pipx install tux-review` (or
   `python -m pip install tux-review` in the active virtual environment),
   then use `tux --version`. For a one-off run, use
   `pipx run tux-review tux --version`.

All commands below use the neutral form `tux <domain> <action>`. Replace
`tux` with the Node `npx … tux` prefix only when you chose the Node
one-off variant.

## Workflow

1. Export the full store as canonical JSON:
   `tux feedback export --format json` (array, fixed key order,
   2-space indent, UTF-8, `\n`).
2. Export line-delimited for streaming/line tools:
   `tux feedback export --format jsonl` — one compact JSON object per
   line, keys in schema order.
3. Scope the export the same way as the survey: `--origin design|live`,
   `--route`, `--session`, `--status`, `--mine` (export composes with
   the show filters; use `tux feedback show` first if you need the
   filtered view for orientation).
4. Redirect the stream to a file when the user asked for an artifact:
   `tux feedback export --format json > tux-feedback.json`. The output
   is deterministic — the same store always produces byte-identical
   files on Node and Python.
5. Never edit exported content: the export is the record. Corrections
   happen in the store (`feedback update`, `feedback validate --record`)
   and are exported again.
6. Report the export path, format and item count.
