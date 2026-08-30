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
