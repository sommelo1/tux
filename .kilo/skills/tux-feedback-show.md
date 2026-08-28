---
name: tux-feedback-show
description: Show complete canonical feedback items by ID — single ID, a list of IDs, or all.
---

# tux-feedback-show

Show complete canonical feedback items (SPC section 43). The output is
the full item: location, target, UI state, author, status,
incorporation and validation metadata.

## Resolve the CLI

TUX must exist as a deterministic CLI. Resolve it in this order and stop
at the first hit:

1. `tux --version` on PATH → use it.
2. `npx --yes --package=tux-uix tux --version` → use `npx --yes --package=tux-uix tux …`.
3. `pipx run tux-uix tux --version` → prefix every command with `pipx run tux-uix`.

All commands below are written as `tux <domain> <action>`; apply the
resolved prefix.

## Workflow

1. Show one item: `tux feedback show <feedback-id>` — prints the
   complete canonical JSON of that item.
2. Show several items: repeat the command per ID
   (`tux feedback show <id-1>`, `tux feedback show <id-2>`), or collect
   the full set with `tux feedback list --format json` and read the
   matching entries.
3. Show everything: `tux feedback list --format json` returns all items
   as a canonical JSON array; narrow it with `--origin design|live`,
   `--route`, `--session`, `--status` or `--mine` instead of reading
   everything.
4. A missing ID fails with exit code 6 and
   `error: feedback not found: <id>` on stderr — report it, never
   guess.
5. Cite item IDs verbatim in your report; the ID is the stable
   reference across incorporation and validation.
