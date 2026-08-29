---
name: tux-design-install
description: Install TUX into the clickable design environment of the current project — discovery, config, review client wiring, tests, verification.
---

# tux-design-install

Establish a correct, tested, and accepted TUX design installation in the
current project (SPC sections 28–31, 79).

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
one-off variant. Never automate the visual review interface — the CLI and
the canonical JSON output are the machine interface.

## Workflow

1. **Discover** the project: design root (default `requirements/`),
   framework (vanilla, react, vue, angular), package manager, dev server,
   test framework.
2. Run `tux design install --framework <framework>` — this creates or
   updates `tux.config.json` with the canonical defaults
   (`design.root`, `review.store`, `review.host`, `review.port`,
   `identity.provider`).
3. If no clickable design exists yet, run the `tux-design-create` skill.
4. **Wire the review client**: the design is served through
   `tux design start-review` (static hosting + script injection). No
   manual script tags are required; a design may also include the client
   via `/__tux__/bootstrap.js` + `/__tux__/client.js` on its own.
5. **Route awareness**: verify the design exposes real routes (paths or
   History-API navigation). Add `data-tux-component`,
   `data-tux-instance`, `data-tux-id` attributes for component-level
   targeting where missing.
6. **Tests**: add the required integration checks (loading, default
   activation, config activation, URL override, feedback
   create→persist→reload→CLI retrieval, route awareness, SPA navigation,
   machine interface `tux feedback show --format json`).
7. **Run and verify** per SPC section 86: build/start, activate, create
   feedback on multiple routes, reload, verify persistence, verify CLI.
8. **Accept**: report `passed`, `partial`, or `failed`. Never report
   `passed` when only a dependency was added, feedback persistence
   failed, route tracking failed, CLI JSON failed, or the target design
   is broken (SPC section 87).
