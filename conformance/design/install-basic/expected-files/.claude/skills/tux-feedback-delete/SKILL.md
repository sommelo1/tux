---
name: tux-feedback-delete
description: Delete TUX feedback items by ID, a list of IDs, or all — with ownership and confirmation semantics.
---

# tux-feedback-delete

Delete feedback items (SPC sections 45–47). Deleting is destructive:
confirm with the user before removing anything that was not explicitly
named.

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

1. Delete one item: `tux feedback delete <feedback-id>`.
2. Delete a list of items: repeat the command per ID, or remove a whole
   scope with `tux feedback clear --mine` (current identity) /
   `tux feedback clear --all --force` (everything; requires explicit
   confirmation) — both accept `--route` and `--session` to bound the
   scope.
3. Delete everything for one context: combine scopes, e.g.
   `tux feedback clear --all --force --origin design --session <name>`.
4. A missing ID fails with exit code 6 and does not touch the store;
   report it instead of retrying blindly.
5. Never delete feedback to "clean up" without an explicit user request:
   feedback is the durable record of the review (SPC section 94). Deletion
   is reserved for duplicates the user approved, spam, or user-requested
   removal.
6. Report exactly which IDs were deleted and which remain.
