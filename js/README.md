# TUX Review

TUX turns a running web UI into a review artifact. Reviewers can attach
structured, machine-readable feedback to pages, routes, components, element
instances, and UI states directly in the browser.

The package includes the `tux` CLI, a local review server, framework
templates, and the framework-agnostic Review Client. It has no runtime
dependencies and requires Node.js 20 or newer.

## Install

Run the CLI without a global installation:

```bash
npx --yes --package=tux-review tux --help
```

Or install it in a project:

```bash
npm install --save-dev tux-review
npx tux design install --framework vanilla
```

## Typical workflow

For a clickable design, install TUX, create a design, then start a review:

```bash
tux design install --framework vanilla
tux design create --framework vanilla --name checkout
tux design start-review
```

For an existing application, use the live-review workflow:

```bash
tux live install
tux live start-review --url http://localhost:3000
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
