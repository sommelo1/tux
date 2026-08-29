# TUX Showcase — multipage design with example feedback

An isolated, interactive showcase of the TUX design review cycle: a
multipage clickable design (vanilla SPA, History-API routing) served by
`tux design start-review` with the Review Client injected, pre-seeded
with example comments.

Everything this folder produces at runtime stays here (`.tux/` is
gitignored) — the rest of the repository is untouched.

## Start

Run from this directory (double-click works for `start.cmd`):

| | Windows | macOS / Linux |
|---|---|---|
| Node (npm) | `start.cmd` → choose `1` | `./start.sh` → choose `1` |
| Python (PyPI) | `start.cmd` → choose `2` | `./start.sh` → choose `2` |
| Non-interactive | `start.cmd python` | `./start.sh node` |
| Fresh seed | `start.cmd node --fresh` | `./start.sh node --fresh` |
| Foreground | `start.cmd node --foreground` | `./start.sh node --foreground` |
| Stop server | `start.cmd stop` | `./start.sh stop` |

The scripts resolve the `tux` binary in this order — `node`: `tux` on
PATH → repo-local `js/bin/tux.js` → `npx --yes --package=tux-uix tux`;
`python`: repo-local `.venv` → `tux` on PATH → `pipx run tux-uix tux`.
So the showcase works both inside this repository and standalone.

## What it shows

- **4 routes** — Home, Products, Product detail, Checkout; markers
  restore across SPA navigation and reloads.
- **Component vs. instance targeting** — the product grid has three
  `ProductCard` instances; feedback on one never appears on another.
- **Tab state** — feedback on the Specs tab of the detail page.
- **Modal ui_state** — open the coupon modal on Checkout, click any
  element inside it and leave feedback: the item records the open modal
  as `ui_state`.
- **Machine interface** — the seed and everything you add is readable
  with `tux feedback show --format json` (run it from this directory).

The example comments are seeded on first start only (types: change,
question, issue, approval). `--fresh` wipes the local store and seeds
again.
