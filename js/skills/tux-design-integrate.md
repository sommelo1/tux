---
name: tux-design-integrate
description: Integrate TUX into the clickable design environment of the current project — discovery, config, review client wiring, tests, verification.
---

# tux-design-integrate

Establish a correct, tested, and accepted TUX design integration in the
current project (SPC sections 28–31, 79).

## Resolve the CLI

TUX must exist as a deterministic CLI. Resolve it in this order and stop
at the first hit:

1. `tux --version` on PATH → use it.
2. `npx --yes --package=tux-uix tux --version` → use `npx --yes --package=tux-uix tux …`.
3. `pipx run tux-uix tux --version` → prefix every command with `pipx run tux-uix`.

All commands below are written as `tux <domain> <action>`; apply the
resolved prefix. Never automate the visual review interface — the CLI and
the canonical JSON output are the machine interface.

## Workflow

1. **Discover** the project: design root (default `requirements/`),
   framework (vanilla, react), package manager, dev server, test
   framework.
2. Run `tux design integrate --framework <framework>` — this creates or
   updates `tux.config.json` with the canonical defaults
   (`design.root`, `review.store`, `review.host`, `review.port`,
   `identity.provider`).
3. If no clickable design exists yet, run the `tux-design-create` skill.
4. **Wire the review client**: the design is served through
   `tux design serve` (static hosting + script injection). No manual
   script tags are required; a design may also include the client via
   `/__tux__/bootstrap.js` + `/__tux__/client.js` on its own.
5. **Route awareness**: verify the design exposes real routes (paths or
   History-API navigation). Add `data-tux-component`,
   `data-tux-instance`, `data-tux-id` attributes for component-level
   targeting where missing.
6. **Tests**: add the required integration checks (loading, default
   activation, config activation, URL override, feedback
   create→persist→reload→CLI retrieval, route awareness, SPA navigation,
   machine interface `tux feedback list --format json`).
7. **Run and verify** per SPC section 86: build/start, activate, create
   feedback on multiple routes, reload, verify persistence, verify CLI.
8. **Accept**: report `passed`, `partial`, or `failed`. Never report
   `passed` when only a dependency was added, feedback persistence
   failed, route tracking failed, CLI JSON failed, or the target design
   is broken (SPC section 87).
