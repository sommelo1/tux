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
