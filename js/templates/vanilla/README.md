# checkout (vanilla design)

## Choose the TUX CLI

Choose one variant; the commands are identical. Node.js users install TUX in
this project with `npm install --save-dev tux-review` and run
`npx tux …`. Python users install `tux-review` with `pipx install tux-review`
(or `python -m pip install tux-review`) and run `tux …`. You do not need both.

## Start the review

From the project root (or this directory):

```bash
# Node.js/npm variant
npx tux design start-review --foreground --dir .

# Python/PyPI variant
tux design start-review --foreground --dir .
```

Routes: `/`, `/products` (tabs), `/checkout` (modal).
