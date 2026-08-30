---
name: tux-live-install
description: Install TUX live review into an existing application — discovery, least-invasive strategy, activation controls, build exclusion, tests.
---

# tux-live-install

Establish a correct, tested, and accepted TUX live-review installation in
an existing application (SPC sections 32–35, 80).

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

1. **Discover** the application: runtime, framework (Vanilla, React,
   Next.js, Vue, Nuxt, Angular, Svelte/SvelteKit, Vite, Webpack,
   FastAPI, Flask, Django), build system, dev server, router, SPA vs
   multi-page, middleware, proxy setup, configuration system, test
   framework. Report unsupported setups explicitly (SPC section 33).
2. Run `tux live install` — it detects the setup and selects the
   least-invasive valid strategy (proxy injection by default: zero
   application changes; the reverse proxy injects the Review Client into
   HTML responses).
3. **Configure** the review service: `tux.config.json`
   (`review.enabled`, `review.store`, `review.host`, `review.port`,
   `identity`). Identity may come from local config, environment, or
   application authentication (SPC section 21).
4. **Activation controls**: implement the three-layer model (SPC
   sections 62–67): build-time inclusion, startup configuration, URL
   runtime override (`?tux=on`, `?tux=off`), with the normative
   precedence BUILD ABSENCE > URL OVERRIDE > CONFIG > DEFAULT ENABLED.
5. **Build exclusion**: verify a deployment without TUX contains no
   Review Client, no bootstrap, no review API, no feedback endpoints,
   and no TUX assets (SPC section 63). `?tux=on` on such a build must
   change nothing.
6. **Tests**: add the required integration tests (SPC section 85):
   loading included/excluded, default activation, config activation, URL
   override both directions, build exclusion, feedback
   create→persist→reload→retrieve, editing, deletion (`delete one`,
   `clear --mine`, `clear --all`), route awareness, SPA navigation,
   component instance identity, UI state, persistence across restart,
   and `tux feedback show --format json` producing valid canonical JSON.
7. **Run and verify** per SPC sections 86–87, then security-check
   (section 70): runtime disabling is not removal; recommend build
   exclusion for environments that do not need TUX.
8. **Accept**: report `passed`, `partial`, or `failed` — never `passed`
   when runtime was not tested, persistence failed, CLI JSON failed,
   URL precedence failed, or build exclusion failed.
