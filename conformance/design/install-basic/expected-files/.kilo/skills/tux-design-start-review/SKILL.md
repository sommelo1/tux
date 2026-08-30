---
name: tux-design-start-review
description: Start the clickable-mockup review server, gather design feedback, verify the review loop end to end.
---

# tux-design-start-review

Start the clickable-mockup server with TUX review functionality and
verify the review loop (SPC sections 38, 88).

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

1. Run `tux design start-review --session <name>` from the project root
   (or the design directory). It starts the server detached and returns
   the state (URL, pid, session); use `--foreground` to keep it in the
   foreground and `--port` when the canonical port 4173 is taken. The
   server hosts the design, injects the Review Client, exposes the
   feedback API, and persists to the configured store.
2. Manage the lifecycle: `tux design status` reports running state with
   URL, session and feedback count; `tux design stop-review` stops it. Stopping
   never deletes feedback.
3. Verify activation: the client must load without `?tux=on` when the
   config is default-enabled (SPC section 64), and must stay inert with
   `?tux=off`.
4. Walk the acceptance scenario (SPC section 88): navigate to
   `/products`, comment on a component, navigate to `/checkout`, comment
   on a button, open the modal, comment inside the modal, reload,
   revisit the routes — all markers must reappear in the correct
   context.
5. Verify the machine interface: `tux feedback show --format json` must
   return all feedback created in the browser, with routes, components,
   and UI state attached.
6. Report the review URL, session name, feedback count, and the
   verification result.
