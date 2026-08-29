# TUX Review

TUX turns a running web UI into a review artifact. Reviewers attach
structured, machine-readable feedback to pages, routes, components, element
instances, and UI states directly in the browser.

This is the **Python/PyPI variant** of the TUX CLI and local review server.
It is stdlib-only and requires Python 3.10 or newer.

Choose it when you want an isolated Python command-line tool or server
without Node.js. If your project uses npm/JavaScript or needs the
`tux-review/client` export, install the Node.js package instead. Do not
install both variants for one project: their `tux` commands and output are
the same.

## Install

For a globally isolated command-line tool, use `pipx`:

```bash
pipx install tux-review
tux --version
```

Or install into your active virtual environment:

```bash
python -m pip install tux-review
tux --version
```

## Typical workflow

After installation, all commands use `tux …`. For a clickable design:

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
