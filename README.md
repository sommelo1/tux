# tux

[![npm](https://img.shields.io/npm/v/tux-uix?logo=npm)](https://www.npmjs.com/package/tux-uix)
[![PyPI](https://img.shields.io/pypi/v/tux-uix?logo=pypi)](https://pypi.org/project/tux-uix/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**TUX — TUX UIX Review System.** The running UI itself is the review artifact.

Reviewers attach structured, machine-readable feedback directly to running
web interfaces — pages, routes, components, component instances, elements,
and UI states — while humans, CLI tools, scripts, and LLM agents all work
with the same canonical data. No Figma, no annotation boards, no copy-paste
of comments into tickets.

```text
Requirements
    ↓
Clickable Design / Working Application
    ↓
Human Review directly in the UI      ← TUX Review Client (overlay)
    ↓
Structured Feedback                  ← canonical JSON, versioned schema
    ↓
LLM / Agent Processing              ← tux feedback incorporate (Skill)
    ↓
Updated UI
    ↓
Validation                          ← tux feedback validate
    ↓
Next Review Cycle
```

## Two byte-identical engines

| | |
|---|---|
| 🔁 **Duality** | `js/` (Node ≥ 20, npm `tux-uix`, zero runtime deps) and `py/` (Python ≥ 3.10, PyPI `tux-uix`, stdlib-only) agree byte-for-byte on every conformance fixture in `conformance/` |
| 🧩 **One Review Client** | a single Plain-JS ESM overlay (`js/client/tux-review.js`) shared by every framework — adapters stay thin, no logic is reimplemented per framework |
| 🗣️ **Canonical vocabulary** | CLI `tux <domain> <action>` ↔ Skills `tux-<domain>-<action>` — one vocabulary across CLI, skills, config, docs, and agent workflows |
| 🤖 **LLM-native** | skills under `skills/` describe agent workflows around the deterministic CLI; feedback stays structured, traceable, and consumable by machines |
| 🔒 **Removable** | complete build-time exclusion: a deployment without TUX ships no client, no API, no endpoints — runtime toggles are never a security boundary |

## Quick start

```bash
# Node (npm) — CLI without global installs
npx --yes --package=tux-uix tux design install --framework vanilla
npx --yes --package=tux-uix tux design create --framework vanilla --name checkout
npx --yes --package=tux-uix tux design start-review # → http://127.0.0.1:4173

# Python (PyPI)
pipx install tux-uix
tux live start-review --url http://localhost:3000      # proxy with live review
```

Review in the browser: click the ⬢ launcher (or press `Alt+T`), pick any
element, leave structured feedback. Then read it back deterministically:

```bash
tux feedback list --status open --format json
tux feedback incorporate --strategy tasks --format json
tux feedback validate --record fb_01M14502C04SWVHV231VZHZ4D6 --result passed --note "verified in browser"
```

## CLI surface

```text
tux design    install | create | start-review | status | stop
tux live      install | create | start-review | status | stop
tux feedback  list | show | create | update | delete | clear | export | incorporate | validate
```

Canonical grammar `tux <domain> <action>`; canonical JSON on stdout;
`error: …` diagnostics on stderr; frozen exit codes
(0 success · 1 general · 2 usage · 3 config · 4 server · 5 auth · 6 not
found · 7 conflict).

## Activation model (SPC sections 62–70)

```text
BUILD ABSENCE   >   URL RUNTIME OVERRIDE   >   STARTUP CONFIGURATION   >   DEFAULT ENABLED
(no TUX at all)     (?tux=on / ?tux=off)       (review.enabled)            (enabled)
```

## Repository layout

```text
SPC.md            normative specification
conformance/      byte-identical behavior fixtures (source of truth)
skills/           canonical skill sources → deployed to .claude/.hermes/.kilo/js/py
js/               npm package: CLI, server, Review Client, tests, Playwright E2E
py/               PyPI package: CLI + server (stdlib-only), pytest suite
tools/            gen-case-inputs, gen-expected, sync-artifacts
examples/         runnable vanilla design used by the E2E suite
```

## Development

```bash
cd js && npm test          # conformance + server API + review lifecycle + skills
cd js && npm run e2e       # Playwright: activation matrix, CRUD, SPA, persistence
.venv/Scripts/python.exe -m pytest py/tests -q   # Python mirror (via repo .venv)
```

Packaging and release — artifacts are built, content-inspected and verified
in dedicated environments (fresh `npm install` of the tarball, fresh venv
with the wheel, real react/vue/angular production builds served over HTTP):

```bash
node tools/package-js.mjs            # npm tarball → dist/ + inspection
node tools/package-py.mjs            # sdist + wheel → dist/ + inspection
node tools/install-test.mjs          # dedicated-env installation verification
node tools/release.mjs <x.y.z>       # bump + tests + packaging + install-test + tag/push
```

CI runs the same gates on every push/PR (ubuntu + windows): JS tests,
Python tests, packaging inspection, dedicated-environment install test
and the Playwright suite. Tagged releases (`v*`) publish to npm and PyPI
via GitHub Actions (`.github/workflows/`).

See `AGENTS.md` for the duality contract and the rules agents must follow.

## License

MIT — see [LICENSE](LICENSE).
