---
name: tux-design-stop-review
description: Stop the design review server cleanly — check state first, report the session summary, preserve every feedback item.
---

# tux-design-stop-review

End a design review session deliberately: check the server state, hand
over a session summary, then stop the server without touching the
feedback store (SPC sections 38 and 41 — design status and stop-review
share the live semantics).

## Resolve the CLI

TUX must exist as a deterministic CLI. Resolve it in this order and stop
at the first hit:

1. `tux --version` on PATH → use it.
2. `npx --yes --package=tux-review tux --version` → use `npx --yes --package=tux-review tux …`.
3. `pipx run tux-review tux --version` → prefix every command with `pipx run tux-review`.

All commands below are written as `tux <domain> <action>`; apply the
resolved prefix.

## Workflow

1. Check the current state: `tux design status --format json` — reports
   `running` with URL, session and feedback count, or `stopped`. Never
   stop blind.
2. Report the session summary before stopping: review URL, session name,
   feedback count. Stopping ends the server, not the session data.
3. Stop with `tux design stop-review --format json`. The output confirms
   `stopped: true` with the pid; `stopped: false` with reason
   `not running` means there was nothing to stop.
4. Verify: `tux design status` now reports `stopped`, and the feedback
   store still contains every item — stopping MUST NOT delete feedback
   (SPC section 41).
5. Report the final state: server stopped, feedback count preserved,
   store path.
