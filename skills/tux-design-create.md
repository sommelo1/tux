---
name: tux-design-create
description: Create or update a clickable TUX design from project requirements — screens, routes, components, UI states, verification.
---

# tux-design-create

Create or update a clickable design from project requirements after the
design capability is available (SPC sections 36–37, 81).

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

1. **Read requirements** near the design (for example
   `requirements/<feature>/requirements.md`). Identify screens, routes,
   components, interactions, and UI states.
2. Choose the framework from the requirements or ask:
   `tux design create --framework vanilla|react|vue|angular`.
3. Run the command — it scaffolds `requirements/<slug>/design/` with a
   runnable multi-route design (vanilla: History-API SPA with tabs and a
   modal; react/vue: vite scaffolds; angular: standalone component
   scaffold) and TUX targeting attributes
   (`data-tux-id`, `data-tux-component`, `data-tux-instance`).
4. **Implement the screens**: replace placeholder content with the
   requirements-derived pages, keep the route structure, wire real
   interactions (tabs, modals, drawers, forms).
5. Mark component instances with `data-tux-instance` so feedback on one
   instance never appears on another (SPC section 85).
6. Run `tux design start-review`, navigate every route, and verify the
   review capability: create feedback on a component, reload, see the
   marker restored, and confirm
   `tux feedback show --format json` returns it.
7. Report the created routes, components, and UI states with the
   verification result.
