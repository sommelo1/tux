---
name: tux-feedback-list
description: Survey TUX feedback deterministically — canonical JSON with filters for status, type, origin (design/live), route, session and ownership.
---

# tux-feedback-list

List feedback items with deterministic, machine-readable output. This is
the survey primitive every incorporation and validation workflow starts
with (SPC section 42).

## Resolve the CLI

TUX must exist as a deterministic CLI. Resolve it in this order and stop
at the first hit:

1. `tux --version` on PATH → use it.
2. `npx --yes --package=tux-uix tux --version` → use `npx --yes --package=tux-uix tux …`.
3. `pipx run tux-uix tux --version` → prefix every command with `pipx run tux-uix`.

All commands below are written as `tux <domain> <action>`; apply the
resolved prefix.

## Workflow

1. Run `tux feedback list --format json` for the full survey. The output
   is a canonical JSON array: fixed key order, no locale, no timestamps
   beyond the stored ones.
2. Narrow the scope with filters — they compose:
   `--status open|incorporated|resolved|rejected`,
   `--type change|issue|question|approval`,
   `--origin design|live`,
   `--route <route>`,
   `--session <name>`,
   `--mine` (current identity).
3. Prefer explicit filters over post-filtering the JSON: the CLI output
   is byte-identical between the Node and Python implementations and
   safe to parse with any tool.
4. Use `tux feedback show <id>` for the complete canonical item of a
   single finding, and `tux feedback incorporate --strategy export-only
   --format json` to see grouping/duplicates/conflicts before deciding.
5. Report the counts per filter you used and cite item IDs, never
   paraphrased indices.
