---
name: tux-feedback-export
description: Export TUX feedback as canonical JSON or JSONL — serialize without interpretation for handoff to humans, tools or agents.
---

# tux-feedback-export

Export feedback as a file or stream, serialized without interpretation
(SPC section 46). Export never mutates the store.

## Resolve the CLI

TUX must exist as a deterministic CLI. Resolve it in this order and stop
at the first hit:

1. `tux --version` on PATH → use it.
2. `npx --yes --package=tux-uix tux --version` → use `npx --yes --package=tux-uix tux …`.
3. `pipx run tux-uix tux --version` → prefix every command with `pipx run tux-uix`.

All commands below are written as `tux <domain> <action>`; apply the
resolved prefix.

## Workflow

1. Export the full store as canonical JSON:
   `tux feedback export --format json` (array, fixed key order,
   2-space indent, UTF-8, `\n`).
2. Export line-delimited for streaming/line tools:
   `tux feedback export --format jsonl` — one compact JSON object per
   line, keys in schema order.
3. Scope the export the same way as listing: `--origin design|live`,
   `--route`, `--session`, `--status`, `--mine` (export composes with
   the list filters; use `tux feedback list` first if you need the
   filtered view for orientation).
4. Redirect the stream to a file when the user asked for an artifact:
   `tux feedback export --format json > tux-feedback.json`. The output
   is deterministic — the same store always produces byte-identical
   files on Node and Python.
5. Never edit exported content: the export is the record. Corrections
   happen in the store (`feedback update`, `feedback validate --record`)
   and are exported again.
6. Report the export path, format and item count.
