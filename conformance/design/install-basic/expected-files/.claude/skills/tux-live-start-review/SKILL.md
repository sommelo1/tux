---
name: tux-live-start-review
description: Start the UIX framework (vanilla, react, vue, angular) with the feedback system attached and verify live review.
---

# tux-live-start-review

Start the user's framework — angular, vue, react or vanilla — with the
TUX feedback system attached, and verify live review (SPC sections
39–41, 82).

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

1. Attach to a running application with
   `tux live start-review --url http://localhost:3000`, or let TUX launch
   it: `tux live start-review -- npm run dev` (the command after `--` is
   spawned; its port defaults to 3000, override with `--target-port`).
   The command works for every framework — vanilla static servers,
   `ng serve`, `vite`, `next dev`. Use `--session <name>` to name the
   review session.
2. Verify: the application remains fully functional behind the proxy;
   the Review Client is active according to configuration; the feedback
   API answers; `tux live status` reports `running` with URL, target,
   session and feedback count.
3. Hand the review URL to the reviewers. Runtime activation follows the
   canonical rules: config-disabled start is enabled ad hoc with
   `?tux=on`, disabled again with `?tux=off` (SPC section 89).
4. Stop with `tux live stop-review` when the session ends. Stopping must never
   delete feedback (SPC section 41).
5. Report the review URL, session, target, and the verification result.
