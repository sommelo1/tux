---
name: tux-design-serve
description: Serve the clickable design with TUX review functionality and verify the review loop end to end.
---

# tux-design-serve

Serve the clickable design with TUX review functionality and verify the
review loop (SPC sections 38, 88).

## Resolve the CLI

TUX must exist as a deterministic CLI. Resolve it in this order and stop
at the first hit:

1. `tux --version` on PATH → use it.
2. `npx --yes --package=tux-uix tux --version` → use `npx --yes --package=tux-uix tux …`.
3. `pipx run tux-uix tux --version` → prefix every command with `pipx run tux-uix`.

All commands below are written as `tux <domain> <action>`; apply the
resolved prefix.

## Workflow

1. Run `tux design serve --session <name>` from the project root (or the
   design directory). Use `--port` when the canonical port 4173 is taken.
   The server hosts the design, injects the Review Client, exposes the
   feedback API, and persists to the configured store.
2. Verify activation: the client must load without `?tux=on` when the
   config is default-enabled (SPC section 64), and must stay inert with
   `?tux=off`.
3. Walk the acceptance scenario (SPC section 88): navigate to
   `/products`, comment on a component, navigate to `/checkout`, comment
   on a button, open the modal, comment inside the modal, reload,
   revisit the routes — all markers must reappear in the correct
   context.
4. Verify the machine interface: `tux feedback list --format json` must
   return all feedback created in the browser, with routes, components,
   and UI state attached.
5. Report the review URL, session name, feedback count, and the
   verification result.
