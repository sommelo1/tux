---
name: tux-live-incorporate
description: Process live-session feedback into the development workflow — validate, group, deduplicate, surface conflicts, verify the framework, preserve IDs.
---

# tux-live-incorporate

Process unresolved feedback of the live session using the user's
methodology, including the testing and verification methodology of the
framework in use (SPC sections 49–57, 90).

## Resolve the CLI

TUX must exist as a deterministic CLI. Resolve it in this order and stop
at the first hit:

1. `tux --version` on PATH → use it.
2. `npx --yes --package=tux-uix tux --version` → use `npx --yes --package=tux-uix tux …`.
3. `pipx run tux-uix tux --version` → prefix every command with `pipx run tux-uix`.

All commands below are written as `tux <domain> <action>`; apply the
resolved prefix.

## Workflow

1. Load the open live feedback in scope:
   `tux feedback show --status open --origin live --format json`
   (optionally `--mine`, `--route <route>`, `--session <name>`). The
   default scope is all open live feedback — not `--mine` (SPC
   section 52).
2. **Validate** every item against the schema (`tux feedback show <id>`
   for details). Malformed items are reported, never dropped.
3. **Group** by route/component/instance. The CLI pre-computes groups,
   duplicates, and conflicts: run
   `tux feedback incorporate --strategy export-only --origin live --format json`
   to inspect the report without changing anything.
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
   `tux feedback incorporate --strategy consolidate|requirements|tasks|direct --origin live --format json`.
   The CLI marks processed items `incorporated`, records the batch under
   `.tux/incorporations/`, and keeps every feedback ID.
7. **Implement and verify** using the methodology of the framework in
   use: apply the changes to the application, then verify each item in
   the running UI (`tux live start-review --url …`) and record the
   result with
   `tux feedback validate --record <id> --result passed|failed --note "<observed>"`.
   Only successfully verified feedback counts as resolved (SPC 94).
8. Report what was incorporated, what needs a decision, and where the
   traceability lives. Feedback items are never deleted by this skill.
