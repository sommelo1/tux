# TUX Review

TUX turns a running web UI into a review artifact. Reviewers can attach
structured, machine-readable feedback to pages, routes, components, element
instances, and UI states directly in the browser.

This is the **Node.js/npm variant** of TUX. It includes the `tux` CLI, a
local review server, framework templates, and the framework-agnostic Review
Client. It has no runtime dependencies and requires Node.js 20 or newer.

Choose this package if your project uses npm/JavaScript or you need the
`tux-review/client` JavaScript export. If you only want a stdlib-only CLI and
server, install the separate but command-compatible Python package from PyPI
instead. Do not install both for one project.

## Install

Run the CLI without a global installation:

```bash
npx --yes --package=tux-review tux --help
```

Or install it in the project (recommended):

```bash
npm install --save-dev tux-review
npx tux --version
```

## Typical workflow

After installation, run every CLI command through `npx tux …` (or `tux …` if
you installed it globally). For a clickable design:

```bash
npx tux design install --framework vanilla
npx tux design create --framework vanilla --name checkout
npx tux design start-review
```

For an existing application, use the live-review workflow:

```bash
npx tux live install
npx tux live start-review --url http://localhost:3000
```

Feedback is stored in `.tux/feedback.json` by default and can be inspected or
exported with `tux feedback show` and `tux feedback export`.

## What is included

- A deterministic CLI for design and live UI reviews
- A plain-JavaScript browser Review Client (`tux-review/client`)
- Vanilla, React, Vue, and Angular design templates
- Canonical JSON feedback and agent skills

## Documentation and support

The complete guide, examples, and normative specification are in the
[GitHub repository](https://github.com/sommelo1/tux). Report issues at
[github.com/sommelo1/tux/issues](https://github.com/sommelo1/tux/issues).

## License

[MIT](https://github.com/sommelo1/tux/blob/main/LICENSE)
