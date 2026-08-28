---
name: tux-review-start
description: Start and verify a review-capable instance of an existing application, return the review URL and session information.
---

# tux-review-start

Start and verify a review-capable instance of an existing application
(SPC sections 39–41, 82).

## Resolve the CLI

TUX must exist as a deterministic CLI. Resolve it in this order and stop
at the first hit:

1. `tux --version` on PATH → use it.
2. `npx --yes --package=tux-uix tux --version` → use `npx --yes --package=tux-uix tux …`.
3. `pipx run tux-uix tux --version` → prefix every command with `pipx run tux-uix`.

All commands below are written as `tux <domain> <action>`; apply the
resolved prefix.

## Workflow

1. Attach to a running application with
   `tux review start --url http://localhost:3000`, or let TUX launch it:
   `tux review start -- npm run dev` (the command after `--` is spawned;
   its port defaults to 3000, override with `--target-port`). Use
   `--session <name>` to name the review session.
2. Verify: the application remains fully functional behind the proxy;
   the Review Client is active according to configuration; the feedback
   API answers; `tux review status` reports `running` with URL, target,
   session, and feedback count.
3. Hand the review URL to the reviewers. Runtime activation follows the
   canonical rules: config-disabled start is enabled ad hoc with
   `?tux=on`, disabled again with `?tux=off` (SPC section 89).
4. Stop with `tux review stop` when the session ends. Stopping must
   never delete feedback (SPC section 41).
5. Report the review URL, session, target, and the verification result.
