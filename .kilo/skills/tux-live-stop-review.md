---
name: tux-live-stop-review
description: Stop the live review proxy cleanly — check state first, report the session summary, preserve every feedback item.
---

# tux-live-stop-review

End a live review session deliberately: check the proxy state, hand over
a session summary, then stop. In proxy mode the application itself was
never modified and keeps serving untouched after the proxy is gone; in
spawn mode the spawned review application is shut down with the session
(SPC section 41).

## Resolve the CLI

TUX must exist as a deterministic CLI. Resolve it in this order and stop
at the first hit:

1. `tux --version` on PATH → use it.
2. `npx --yes --package=tux-review tux --version` → use `npx --yes --package=tux-review tux …`.
3. `pipx run tux-review tux --version` → prefix every command with `pipx run tux-review`.

All commands below are written as `tux <domain> <action>`; apply the
resolved prefix.

## Workflow

1. Check the current state: `tux live status --format json` — reports
   `running` with URL, session and feedback count, or `stopped`. Never
   stop blind.
2. Report the session summary before stopping: target URL, session name,
   feedback count.
3. Stop with `tux live stop-review --format json`. The output confirms
   `stopped: true` with the pid; `stopped: false` with reason
   `not running` means there was nothing to stop. In spawn mode the
   spawned application process is stopped together with the proxy.
4. Verify: `tux live status` now reports `stopped`, and the feedback
   store still contains every item — stopping MUST NOT delete feedback
   (SPC section 41).
5. Report the final state: review stopped, feedback count preserved,
   store path.
