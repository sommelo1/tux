---
name: tux-feedback-validate
description: Verify that incorporated changes actually satisfy the originating TUX feedback — run the UI, navigate, restore state, record results.
---

# tux-feedback-validate

Verify whether incorporated changes actually satisfy the originating
feedback (SPC sections 56–57, 91). Changing source code alone is not
sufficient proof of resolution.

## Resolve the CLI

TUX must exist as a deterministic CLI. Resolve it in this order and stop
at the first hit:

1. `tux --version` on PATH → use it.
2. `npx --yes --package=tux-uix tux --version` → use `npx --yes --package=tux-uix tux …`.
3. `pipx run tux-uix tux --version` → prefix every command with `pipx run tux-uix`.

All commands below are written as `tux <domain> <action>`; apply the
resolved prefix.

## Workflow

1. Load the incorporated feedback and its validation state:
   `tux feedback validate --format json` (add `--strict` to fail when
   any incorporated item lacks a passed validation).
2. For each item to verify: start or attach to the target design or
   application (`tux design serve` / `tux review start --url …`).
3. **Navigate** to the item's `location.route`, **restore** the relevant
   UI state (tab, modal, filter — from `ui_state`), and **identify** the
   target using the priority order `tux_id → test_id → component →
   role + accessible name → stable attributes → text → CSS selector →
   DOM path → coordinates` (SPC section 16). Coordinates are fallback
   context only.
4. **Verify** the requested behavior or change against the feedback text
   and type. A `change` requires the new behavior to be visible; an
   `issue` requires the problem to be gone; an `approval` is satisfied
   by the reviewed target being present and unchanged; a `question` is
   resolved by a documented answer.
5. **Record** the result per item:
   `tux feedback validate --record <feedback-id> --result passed|failed --note "<what was observed>"`.
6. Only successfully verified feedback may be considered resolved
   (Resolution Principle, SPC section 94). Failed items stay
   `incorporated` with a `failed` validation note describing what is
   still missing.
7. Report the validation summary (passed / failed / unvalidated) and the
   recorded notes.
