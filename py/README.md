# TUX Review

TUX turns a running web UI into a review artifact. Reviewers attach
structured, machine-readable feedback to pages, routes, components, element
instances, and UI states directly in the browser.

This package is the Python reference implementation of the TUX CLI and local
review server. It is stdlib-only and requires Python 3.10 or newer.

## Install

```bash
python -m pip install tux-review
tux --help
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
- A local review/design server and embedded plain-JavaScript Review Client
- Vanilla, React, Vue, and Angular design templates
- Canonical JSON feedback and agent skills

## Documentation and support

The complete guide, examples, and normative specification are in the
[GitHub repository](https://github.com/sommelo1/tux). Report issues at
[github.com/sommelo1/tux/issues](https://github.com/sommelo1/tux/issues).

## License

[MIT](https://github.com/sommelo1/tux/blob/main/LICENSE)
