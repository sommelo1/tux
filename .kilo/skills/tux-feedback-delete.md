---
name: tux-feedback-delete
description: Delete TUX feedback items by ID, a list of IDs, or all — with ownership and confirmation semantics.
---

# tux-feedback-delete

Delete feedback items (SPC sections 45–47). Deleting is destructive:
confirm with the user before removing anything that was not explicitly
named.

## Resolve the CLI

TUX must exist as a deterministic CLI. Resolve it in this order and stop
at the first hit:

1. `tux --version` on PATH → use it.
2. `npx --yes --package=tux-review tux --version` → use `npx --yes --package=tux-review tux …`.
3. `pipx run tux-review tux --version` → prefix every command with `pipx run tux-review`.

All commands below are written as `tux <domain> <action>`; apply the
resolved prefix.

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
