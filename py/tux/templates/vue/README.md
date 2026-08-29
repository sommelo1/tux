# checkout (vue design)

This design itself uses npm. Choose one TUX CLI: Node users run
`npm install --save-dev tux-review` then `npx tux …`; Python users install
`tux-review` with `pipx` or `pip` then run `tux …`. The TUX commands below are
otherwise identical.

```bash
npm install

# Node.js/npm TUX variant — serves the design with TUX review
npx tux design start-review --foreground --dir .

# Python/PyPI TUX variant — same command after Python installation
tux design start-review --foreground --dir .

# Alternative for either variant: npm run dev + <tux command> live start-review --url http://localhost:5173
```
