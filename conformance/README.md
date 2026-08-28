# TUX Conformance Fixtures

The fixtures under `conformance/` are the source of truth for cross-runtime
behavior. Both implementations (Node `js/`, Python `py/`) MUST produce
byte-identical results on every case. Never change one side alone.

## Case layout

```text
conformance/<group>/<case>/
├── case.json            # input: args, env, files, stdin
├── expected.txt         # first line "exit <n>", remainder = exact stdout
├── expected.err         # optional: first line "exit <n>", remainder = exact stderr
└── expected-files/      # optional: files compared byte-exact after the run
    └── <relative path>
```

`case.json` fields:

- `args` — argv after the `tux` binary name.
- `env` — extra environment variables layered over a stripped base env
  (all `TUX_*` variables are removed first, so cases are hermetic).
- `files` — map of relative path → file content materialized in the case
  working directory before the run.
- `stdin` — optional stdin string.

The runner copies `files` into a fresh temporary directory, runs the CLI
there, compares exit code, stdout (and stderr when `expected.err` exists),
then compares every file in `expected-files/` byte-exact. Trailing-newline
convention: `expected.txt` files end with exactly one newline; stdout is
compared as exact bytes (`expected.txt` content minus the first line plus
its trailing newline handling — the runner normalizes only the verdict
line, see the runners).

## Determinism contract

- IDs are ULIDs (Crockford base32, 26 chars): 48-bit millisecond timestamp
  from `TUX_TIME_OVERRIDE` (or the wall clock), 80-bit entropy from
  `SHA-256("<project_id>|<session_id>|<seq>|<kind>")` first 10 bytes,
  where `seq` is the 1-based next sequence number in the target store and
  `kind` is `feedback`, `batch` or `session`.
- Canonical timestamps are UTC with millisecond precision:
  `YYYY-MM-DDTHH:MM:SS.mmmZ`.
- Canonical JSON: 2-space indent, `\n` line endings, keys in the fixed
  schema order (free-form `ui_state` keys sorted alphabetically), UTF-8,
  single trailing newline. Compact JSONL: one line per item, no spaces,
  keys in schema order.
- CLI stdout carries machine data only; diagnostics go to stderr as
  `error: <message>` lines. Exit codes: 0 success · 1 general failure ·
  2 invalid arguments · 3 configuration error · 4 connection/server error ·
  5 authorization error · 6 entity not found · 7 conflict.
- Output never contains locales, absolute paths of the host machine, or
  wall-clock timestamps when `TUX_TIME_OVERRIDE` is set.
