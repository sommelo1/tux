---
name: tux-design-start-review
description: Start the clickable-mockup review server, gather design feedback, verify the review loop end to end.
---

# tux-design-start-review

Start the clickable-mockup server with TUX review functionality and
verify the review loop (SPC sections 38, 88).

## Resolve the CLI

TUX must exist as a deterministic CLI. Resolve it in this order and stop
at the first hit:

1. `tux --version` on PATH → use it.
2. `npx --yes --package=tux-uix tux --version` → use `npx --yes --package=tux-uix tux …`.
3. `pipx run tux-uix tux --version` → prefix every command with `pipx run tux-uix`.

All commands below are written as `tux <domain> <action>`; apply the
resolved prefix.

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
