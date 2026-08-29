# TUX

[![npm](https://img.shields.io/npm/v/tux-review?logo=npm)](https://www.npmjs.com/package/tux-review)
[![PyPI](https://img.shields.io/pypi/v/tux-review?logo=pypi)](https://pypi.org/project/tux-review/)
[![CI](https://github.com/sommelo1/tux/actions/workflows/ci.yml/badge.svg)](https://github.com/sommelo1/tux/actions/workflows/ci.yml)
[![E2E](https://github.com/sommelo1/tux/actions/workflows/e2e.yml/badge.svg)](https://github.com/sommelo1/tux/actions/workflows/e2e.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**TUX — TUX UIX Review System.** The running UI itself is the review artifact.

Reviewers attach structured, machine-readable feedback directly to running
web interfaces — pages, routes, components, component instances, elements,
and UI states — while humans, CLI tools, scripts, and LLM agents all work
with the same canonical data. No Figma, no annotation boards, no copy-paste
of comments into tickets.

TUX has **two distinct worlds** — design TUX reviews clickable mockups,
live TUX reviews running applications. Both attach structured,
machine-readable feedback to the running UI and share one canonical
feedback core (one store, one vocabulary); they differ in what is
reviewed and how the Review Client reaches the page.

## Contents

- [TUX Design — review clickable mockups](#tux-design--review-clickable-mockups)
- [TUX Live — review running applications](#tux-live--review-running-applications)
- [The shared feedback core](#the-shared-feedback-core)
- [Interactive showcase](#interactive-showcase)
- [Why TUX](#why-tux)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Skills for agents](#skills-for-agents)
- [How it works](#how-it-works)
- [Documentation](#documentation)
- [Repository layout](#repository-layout)
- [Development](#development)
- [License](#license)

## TUX Design — review clickable mockups

For requirements and design work: screens become runnable, clickable
designs (vanilla, react, vue, angular). TUX is installed into the design
environment, the design is served with the Review Client, and feedback
carries `origin: design`. Incorporation updates the design itself;
validation verifies every change in the running mockup.

```text
tux design    install | create | start-review | status | stop-review
```

```bash
npx --yes --package=tux-review tux design install --framework vanilla   # wire config + review
npx --yes --package=tux-review tux design create --framework vanilla --name checkout
npx --yes --package=tux-review tux design start-review                  # → http://127.0.0.1:4173
npx --yes --package=tux-review tux design status                        # running state + feedback count
npx --yes --package=tux-review tux design stop-review                   # end the session
```

```mermaid
flowchart TD
    REQ["Requirements"] --> DI["tux design install<br>config + review wiring"]
    DI --> DC["tux design create<br>clickable design (vanilla · react · vue · angular)"]
    DC --> DS["tux design start-review<br>design server + Review Client"]
    DS -- "origin: design" --> FB["Structured feedback<br>canonical JSON · canonical store"]
    FB --> INC["tux feedback incorporate<br>group · deduplicate · conflicts · traceability"]
    INC --> UPD["Design updated"]
    UPD --> VAL["tux feedback validate<br>verified in the running design"]
    VAL -. "next design cycle" .-> DS
```

## TUX Live — review running applications

For real applications in development, test, staging, or review
environments: TUX reaches the app without build changes — `tux live
install` selects the least-invasive strategy (reverse-proxy injection by
default) and `tux live start-review --url …` attaches the Review Client
through the proxy. Feedback carries `origin: live`; incorporation drives
implementation in the application's own codebase, and validation verifies
against the running app.

```text
tux live      install | create | start-review | status | stop-review
```

```bash
pipx install tux-review
tux live install                                   # detect setup, pick least-invasive strategy
tux live start-review --url http://localhost:3000  # proxy + Review Client
tux live status
tux live stop-review                               # app untouched, feedback kept
```

```mermaid
flowchart TD
    APP["Existing application<br>(dev · test · staging · review)"] --> LI["tux live install<br>least-invasive strategy (proxy injection by default)"]
    LI --> LS["tux live start-review --url …<br>proxy + Review Client"]
    LS -- "origin: live" --> FB["Structured feedback<br>canonical JSON · canonical store"]
    FB --> INC["tux feedback incorporate<br>group · deduplicate · conflicts · traceability"]
    INC --> IMPL["Implementation in the application"]
    IMPL --> VAL["tux feedback validate<br>verified against the running app"]
    VAL -. "next live cycle" .-> LS
```

## The shared feedback core

Both worlds write the same canonical store and speak the same verbs,
scoped with `--origin design|live`:

```bash
tux feedback show --status open --origin design --format json    # survey
tux feedback show fb_01M14502C04SWVHV231VZHZ4D6                  # one item, complete
tux feedback incorporate --strategy tasks --format json          # process + batch record
tux feedback validate --record fb_01M14502C04SWVHV231VZHZ4D6 --result passed --note "verified in browser"
```

Stopping a review server never deletes feedback. See [Usage](#usage) for
the full grammar and a complete canonical item.

## Interactive showcase

The fastest way to see TUX working: [`examples/showcase/`](examples/showcase)
is a multipage clickable design (Home, Products, Product detail, Checkout
with a coupon modal) served by the design server with the Review Client
injected and pre-seeded with five example comments. Fully isolated —
everything it writes stays in `examples/showcase/.tux/` (gitignored).

```bash
cd examples/showcase
start.cmd        # Windows — menu: 1) Node   2) Python
./start.sh       # macOS / Linux — same menu
```

| Task | Windows | macOS / Linux |
|---|---|---|
| Start (interactive menu) | `start.cmd` | `./start.sh` |
| Start with a specific engine | `start.cmd python` | `./start.sh node` |
| Reset the example comments | `start.cmd node --fresh` | `./start.sh node --fresh` |
| Keep the server in the foreground | `start.cmd node --foreground` | `./start.sh node --foreground` |
| Stop the server | `start.cmd stop` | `./start.sh stop` |

How it works: the scripts run inside the folder (all state stays local),
resolve the `tux` binary (repo-local `js/bin` / `.venv` first, then `tux`
on PATH, `npx`, `pipx`), seed the comments via the CLI on first start,
and start the design server on port 4321. Then click the ⬢ launcher (or
press `Alt+T`) — it shows the commenting state at all times — pick any
element, leave feedback, reload or navigate: markers restore. Read
everything back with `tux feedback show --format json` from that folder.

## Why TUX

- **Two byte-identical engines.** `js/` (Node ≥ 20, npm `tux-review`,
  zero runtime dependencies) and `py/` (Python ≥ 3.10, PyPI `tux-review`,
  stdlib-only) agree byte-for-byte on every fixture in `conformance/`.
  The fixtures are the source of truth — neither implementation may
  drift.
- **One Review Client.** A single Plain-JS ESM overlay
  (`js/client/tux-review.js`) is shared by every framework (vanilla,
  react, vue, angular). Adapters stay thin — overlay, selection,
  markers, CRUD, and schema logic are never reimplemented per framework.
- **Canonical vocabulary.** CLI `tux <domain> <action>` ↔ Skill
  `tux-<domain>-<action>` — one vocabulary across CLI, skills, config,
  docs, and agent workflows. No synonyms.
- **LLM-native.** Skills describe agent workflows around the
  deterministic CLI; feedback stays structured, traceable (stable ULIDs),
  and consumable by machines.
- **Removable.** Complete build-time exclusion: a deployment without TUX
  ships no client, no API, no endpoints. Runtime toggles are never a
  security boundary.
- **Deterministic.** Canonical JSON with fixed key order, deterministic
  ULIDs, frozen exit codes, no locale or host paths in output — identical
  input always produces identical bytes.

## Installation

| Engine | Requirement | Install | Entry point |
|---|---|---|---|
| Node | ≥ 20 | `npm install -g tux-review` or `npx --yes --package=tux-review tux …` | `tux` |
| Python | ≥ 3.10, stdlib-only | `pipx install tux-review` or `pip install tux-review` | `tux` |

Both engines implement the identical CLI and the identical conformance
contract — pick either, or use both (they write the same canonical store).

## Usage

The CLI follows one grammar: `tux <domain> <action>`.

```text
tux design    install | create | start-review | status | stop-review
tux live      install | create | start-review | status | stop-review
tux feedback  show | create | update | delete | clear | export | incorporate | validate
```

- **`design`** — the clickable mockup world: install TUX into a design
  environment, scaffold designs from requirements, serve them with the
  Review Client, manage the server lifecycle.
- **`live`** — the running application world: install TUX into an
  existing app, scaffold live review apps, proxy-inject the client, manage
  the lifecycle.
- **`feedback`** — the shared review store: survey and inspect items
  (`show` without an ID lists, with an ID prints the full item), mutate
  them, export them, and run the incorporation/validation pipeline.

Every command prints canonical JSON on stdout (or a deterministic text
table in `--format text` mode) and diagnostics on stderr as
`error: <message>` with frozen exit codes
(0 success · 1 general · 2 usage · 3 config · 4 server · 5 auth ·
6 not found · 7 conflict).

Example — feedback created in the browser, read back by the CLI:

```bash
$ tux feedback create --type change --text "The primary CTA should be more prominent." \
    --route /checkout/payment --component PaymentMethodCard --instance visa-ending-1234 \
    --tux-id payment-submit --session review_2026_08_28 --format json
```

```json
{
  "schema_version": "1.0",
  "id": "fb_01M14502C04SWVHV231VZHZ4D6",
  "project_id": "checkout-redesign",
  "session_id": "review_2026_08_28",
  "author": {
    "user_id": "usr_8f3a12",
    "display_name": "Lorenz"
  },
  "origin": {
    "mode": "design"
  },
  "location": {
    "route": "/checkout/payment",
    "component": "PaymentMethodCard",
    "component_instance": "visa-ending-1234"
  },
  "target": {
    "tux_id": "payment-submit"
  },
  "ui_state": {},
  "feedback": {
    "type": "change",
    "text": "The primary CTA should be more prominent."
  },
  "status": "open",
  "created_at": "2026-08-28T12:20:00.000Z",
  "updated_at": "2026-08-28T12:20:00.000Z"
}
```

## Configuration

`tux.config.json` in the project root (override per invocation with
`--config` or `TUX_CONFIG`; precedence: CLI flags → environment → config
file → defaults):

```json
{
  "project_id": "checkout-redesign",
  "design": {
    "root": "requirements",
    "framework": "vanilla"
  },
  "review": {
    "enabled": true,
    "store": ".tux/feedback.json",
    "host": "127.0.0.1",
    "port": 4173
  },
  "identity": {
    "provider": "local",
    "user_id": "anonymous",
    "display_name": "Anonymous",
    "admins": []
  }
}
```

`tux design install` and `tux live install` create this file with the
canonical defaults. Identity may come from local config, environment, or
application authentication (`identity.provider`).

Environment overrides (each beats the config file, CLI flags beat the
environment): `TUX_CONFIG`, `TUX_PROJECT_ID`, `TUX_STORE`, `TUX_HOST`,
`TUX_PORT`, `TUX_USER_ID`, `TUX_DISPLAY_NAME`.

## Skills for agents

Thirteen canonical skills in `skills/` describe agent workflows 1:1 on the
CLI — the naming rule is `tux <domain> <action>` ↔ `tux-<domain>-<action>`:

| Phase | Skills |
|---|---|
| Install | `tux-design-install` · `tux-live-install` |
| Create | `tux-design-create` · `tux-live-create` |
| Start review | `tux-design-start-review` · `tux-live-start-review` |
| Stop review | `tux-design-stop-review` · `tux-live-stop-review` |
| Incorporate (incl. verification) | `tux-design-incorporate` · `tux-live-incorporate` |
| Feedback read/cleanup | `tux-feedback-show` · `tux-feedback-delete` · `tux-feedback-export` |

The skills are deployed verbatim to `.claude/skills/`, `.hermes/skills/`,
`.kilo/skills/`, `js/skills/`, and `py/tux/skills/` by
`node tools/sync-artifacts.mjs` — edit the canonical source, regenerate,
never patch a deployed copy. Both test suites enforce byte-identity.

## How it works

**Activation** — four layers with normative precedence (SPC sections
62–70):

```mermaid
flowchart LR
    B["BUILD ABSENCE<br>no TUX at all"]
    U["URL RUNTIME OVERRIDE<br>?tux=on / ?tux=off"]
    C["STARTUP CONFIGURATION<br>review.enabled"]
    D["DEFAULT ENABLED<br>enabled"]

    B -- "beats" --> U -- "beats" --> C -- "beats" --> D
```

A build without TUX contains no client, no bootstrap, no API endpoints —
`?tux=on` on such a build changes nothing. Runtime disabling is a
convenience, not a security boundary.

**Review Client** — one Plain-JS ESM module (`tux-review.js` +
`tux-review.css`), injected by the TUX server or loaded directly. It
scopes itself to elements carrying `data-tux-ui`, captures bounded UI
state (modals, drawers, tabs), resolves targets via fingerprints
(`data-tux-id` / `data-tux-component` / `data-tux-instance`), and is
SPA-route-aware.

**Persistence** — feedback lives in the canonical store
(`.tux/feedback.json` by default) with sessions and incorporation
batches alongside. Stopping a review server never deletes feedback.

## Documentation

- [`SPC.md`](SPC.md) — the normative specification (94 sections): schema,
  taxonomy, activation, security, conformance, skills, MVP scope.
- [`conformance/README.md`](conformance/README.md) — how the byte-identical
  behavior fixtures work and the determinism contract
  (ULIDs, canonical JSON, `TUX_TIME_OVERRIDE`).
- [`AGENTS.md`](AGENTS.md) — the duality contract and the rules coding
  agents must follow in this repository.

## Repository layout

```text
SPC.md            normative specification
conformance/      byte-identical behavior fixtures (source of truth)
skills/           canonical skill sources → deployed to .claude/.hermes/.kilo/js/py
js/               npm package: CLI, server, Review Client, tests, Playwright E2E
py/               PyPI package: CLI + server (stdlib-only), pytest suite
tools/            gen-case-inputs, gen-expected, sync-artifacts, packaging, release
examples/         runnable designs: E2E fixture (design-vanilla) + interactive showcase (showcase)
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

## License

MIT — see [LICENSE](LICENSE).
