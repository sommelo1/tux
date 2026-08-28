---
name: tux-live-create
description: Create or update clickable live pages in the target technology (vanilla, react, vue, angular) wired with TUX targeting attributes.
---

# tux-live-create

Create or update clickable live pages using the methodology and the
target technology chosen by the user (SPC section 32).

## Resolve the CLI

TUX must exist as a deterministic CLI. Resolve it in this order and stop
at the first hit:

1. `tux --version` on PATH → use it.
2. `npx --yes --package=tux-uix tux --version` → use `npx --yes --package=tux-uix tux …`.
3. `pipx run tux-uix tux --version` → prefix every command with `pipx run tux-uix`.

All commands below are written as `tux <domain> <action>`; apply the
resolved prefix.

## Workflow

1. **Clarify** the target technology (vanilla, react, vue, angular) and
   the pages to build. For a green-field live app run
   `tux live create --framework <framework> --name <slug>` — it
   scaffolds the same runnable multi-route application as
   `tux design create`, but as a live app (`"kind": "live"`, feedback
   gathered through it carries `"origin": "live"`).
2. For an existing application do not scaffold — extend the running app
   in its own idiom instead (components, routes, state) and keep the
   build system untouched.
3. **Wire targeting attributes** on the components under review:
   `data-tux-component` on component roots, `data-tux-instance` on
   component instances, `data-tux-id` on individual elements, and
   `data-tux-state` for bounded UI-state capture (SPC sections 13–15).
4. **Verify** with `tux live start-review --url <dev-server>`: create
   feedback on a page, a component instance and a modal; reload and
   confirm the markers restore; confirm
   `tux feedback show --format json` returns the items with
   `"origin": "live"`.
5. **Accept**: report pages, components, routes and the verification
   result. Never report `passed` when persistence or route tracking
   failed.
