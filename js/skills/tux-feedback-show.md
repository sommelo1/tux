---
name: tux-feedback-show
description: Show TUX feedback — the complete canonical item by ID, or a filtered survey of all items with deterministic, machine-readable output.
---

# tux-feedback-show

Show feedback items (SPC section 42): `tux feedback show` without an ID
surveys all items with deterministic, machine-readable output;
`tux feedback show <id>` prints the complete canonical item — location,
target, UI state, author, status, incorporation and validation
metadata.

## Resolve the CLI

TUX must exist as a deterministic CLI. Resolve it in this order and stop
at the first hit:

1. `tux --version` on PATH → use it.
2. `npx --yes --package=tux-review tux --version` → use `npx --yes --package=tux-review tux …`.
3. `pipx run tux-review tux --version` → prefix every command with `pipx run tux-review`.

All commands below are written as `tux <domain> <action>`; apply the
resolved prefix.

## Workflow

1. Run `tux feedback show --format json` for the full survey. The output
   is a canonical JSON array: fixed key order, no locale, no timestamps
   beyond the stored ones.
2. Narrow the survey with filters — they compose:
   `--status open|incorporated|resolved|rejected`,
   `--type change|issue|question|approval`,
   `--origin design|live`,
   `--route <route>`,
   `--session <name>`,
   `--mine` (current identity).
3. Prefer explicit filters over post-filtering the JSON: the CLI output
   is byte-identical between the Node and Python implementations and
   safe to parse with any tool.
4. Show one item: `tux feedback show <feedback-id>` — prints the
   complete canonical JSON of that item. Filters and `--format` do not
   apply in ID mode.
5. A missing ID fails with exit code 6 and
   `error: feedback not found: <id>` on stderr — report it, never
   guess.
6. Cite item IDs verbatim in your report; the ID is the stable
   reference across incorporation and validation. Use `tux feedback
   incorporate --strategy export-only --format json` to see
   grouping/duplicates/conflicts before deciding.
