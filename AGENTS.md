# AGENTS.md — TUX repository guide

Instructions for coding agents working in this repository
(any AGENTS.md-compatible tool).

## Project

TUX — TUX UIX Review System. A framework-agnostic UI review system: the
running UI itself is the review artifact. Reviewers attach structured,
machine-readable feedback directly to pages, routes, components,
component instances, elements, and UI states. Normative specification:
`SPC.md`. Reference implementations:

- `js/`  — Node ≥20, zero runtime dependencies, ESM, npm package `tux-review`,
  binary `tux`, Review Client in `js/client/` (Plain JS ESM, no build)
- `py/`  — Python ≥3.10, stdlib-only, PyPI package `tux-review`,
  console script `tux`, review/design server in `py/tux/server.py`

Duality contract: both implementations MUST stay byte-identical on all
conformance fixtures (`conformance/**`). The fixtures are the source of
truth for behavior; never change one side alone. The Review Client exists
once (JavaScript); the Python server ships a byte-identical copy under
`py/tux/client/` (synced by `node tools/sync-artifacts.mjs`).

## Environment (isolated)

- Node work stays inside `js/node_modules` (npm workspaces are not used;
  never install globally). Playwright + Chromium are devDependencies of
  `js/` only.
- Python work runs exclusively inside the repo `.venv/`, never the global
  interpreter:

  ```bash
  .venv/Scripts/python.exe -m pip install -e py   # one-time setup
  .venv/Scripts/python.exe -m pytest py/tests -q
  .venv/Scripts/python.exe -m tux --version
  ```

## Commands

```bash
# JavaScript side
cd js && npm test                # conformance + API + review-process + skills
cd js && npm run e2e             # Playwright suite (starts its own servers)

# Python side — ALWAYS via the isolated venv
.venv/Scripts/python.exe -m pytest py/tests -q

# Regenerate artifacts after intentional changes (review the diff!)
node tools/gen-expected.mjs --force   # conformance expectations (JS reference)
node tools/gen-case-inputs.mjs        # fixture inputs (rarely; hand-authored)
node tools/sync-artifacts.mjs         # client/templates/skills → py package + deployments

# Packaging + release
node tools/package-js.mjs             # npm tarball → dist/ + content inspection
node tools/package-py.mjs             # sdist + wheel → dist/ + content inspection
node tools/install-test.mjs           # dedicated-env install verification
                                      # (real react/vue/angular builds served over HTTP)
node tools/release.mjs <x.y.z>        # bump + test + package + install-test + tag/push
```

## Rules for agents

1. Behavior changes require: SPC paragraph + both implementations +
   fixtures updated in the SAME change set.
2. Identical-output rule: JS and Python must produce byte-equal results
   on identical input. Canonical JSON = 2-space indent, `\n`, fixed key
   order (`ui_state` keys sorted), UTF-8. No locale, no timestamps (use
   `TUX_TIME_OVERRIDE`), no host paths in output.
3. IDs are deterministic ULIDs (`fb_…`, `batch_…`): timestamp from
   `TUX_TIME_OVERRIDE`, entropy from
   `SHA-256("<project_id>|<session_id>|<seq>|<kind>")`. Both sides must
   agree byte-for-byte (`js/src/ids.js` ↔ `py/tux/ids.py`).
4. Diagnostics go to stderr as `error: <message>`; machine-readable
   stdout must stay clean. Exit codes are frozen (SPC section 75):
   0 success · 1 general · 2 usage · 3 config · 4 server · 5 auth ·
   6 not found · 7 conflict.
5. Canonical vocabulary (SPC sections 3–5): `tux <domain> <action>` ↔
   `tux-<domain>-<action>`. Never introduce synonyms for an existing
   verb (`incorporate`, `validate`, `clear`, `export`, …).
6. Skills are deployed by `node tools/sync-artifacts.mjs` from the
   canonical sources `skills/<name>.md`. Every copy under `.claude/`,
   `.hermes/`, `.kilo/`, `js/skills/` and `py/tux/skills/` is a verbatim
   generated artifact; edit a source, regenerate, commit — never patch a
   deployed copy. Both test suites enforce byte-identity.
7. Documentation lives in JSDoc (JS) and Google-style docstrings (Py);
   update docs with code.
8. Spec keywords MUST/SHOULD/MAY follow RFC 2119 as used in `SPC.md`.
9. The Review Client is a single ESM module pair (`tux-review.js`,
   `tux-review.css`). Framework adapters stay thin (loading, routing
   hooks, build inclusion only) — never reimplement overlay, selection,
   markers, CRUD, or schema logic per framework (SPC section 35).
10. TUX test hooks (`TUX_TIME_OVERRIDE`) are for tests/fixtures only;
    never let them change production behavior beyond the documented
    determinism contract (`conformance/README.md`).
