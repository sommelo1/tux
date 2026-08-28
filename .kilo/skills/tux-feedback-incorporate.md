---
name: tux-feedback-incorporate
description: Process unresolved TUX feedback into the development workflow — validate, group, deduplicate, surface conflicts, preserve IDs, record traceability.
---

# tux-feedback-incorporate

Process unresolved feedback using the chosen methodology (SPC sections
49–55, 90). Feedback is not silently deleted after incorporation.

## Resolve the CLI

TUX must exist as a deterministic CLI. Resolve it in this order and stop
at the first hit:

1. `tux --version` on PATH → use it.
2. `npx --yes --package=tux-uix tux --version` → use `npx --yes --package=tux-uix tux …`.
3. `pipx run tux-uix tux --version` → prefix every command with `pipx run tux-uix`.

All commands below are written as `tux <domain> <action>`; apply the
resolved prefix.

## Workflow

1. Load the open feedback in scope:
   `tux feedback list --status open --format json`
   (optionally `--mine`, `--route <route>`, `--session <name>`). The
   default scope is all open feedback in the current review scope — not
   `--mine` (SPC section 52).
2. **Validate** every item against the schema (`tux feedback show <id>`
   for details). Malformed items are reported, never dropped.
3. **Group** by route/component/instance. The CLI pre-computes groups,
   duplicates, and conflicts: run
   `tux feedback incorporate --strategy export-only --format json` to
   inspect the report without changing anything.
4. **Duplicates** (identical normalized text on the same target): keep
   every original, consolidate the request, and preserve the source IDs
   in the traceability record (SPC section 53).
5. **Conflicts** (an approval contradicting a requested change on the
   same target): surface them with `requires_decision: true` and ask the
   user. Do not resolve explicit contradictions silently (SPC section 54).
6. **Choose the methodology** with the user when interactive:
   consolidate first · update requirements · create implementation tasks
   · apply actionable changes directly · review conflicts first · export
   only. Then run
   `tux feedback incorporate --strategy consolidate|requirements|tasks|direct --format json`.
   The CLI marks processed items `incorporated`, records the batch under
   `.tux/incorporations/`, and keeps every feedback ID.
7. **Record traceability**: requirements, tasks, and code changes must
   reference the source feedback IDs (SPC section 55). Include the
   `batch_id` and per-item IDs in whatever artifact you produce
   (requirements entry, task list, or commit plan).
8. Report what was incorporated, what needs a decision, and where the
   traceability lives. Feedback items are never deleted by this skill.
