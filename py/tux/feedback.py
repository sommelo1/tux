"""Feedback operations — the deterministic primitives behind
``tux feedback <action>`` (SPC sections 42–57)."""
from __future__ import annotations

from .canonical import canonical_json, compact_json, sorted_object
from .errors import CliError, Exit
from .ids import canonical_timestamp, new_id, now_ms
from .schema import (FEEDBACK_STATUSES, FEEDBACK_TYPES, SCHEMA_VERSION,
                     make_feedback, normalized_text, validate_feedback)
from .store import (count_incorporation_batches, ensure_session, load_store,
                    save_incorporation_batch, save_store, store_exists)


def _ctx(opts: dict) -> dict:
    now = opts.get("now") or now_ms()
    identity = opts.get("identity") or _resolve_identity(opts["config"])
    return {
        "cwd": opts["cwd"],
        "config": opts["config"],
        "identity": identity,
        "format": opts.get("format") or "text",
        "timestamp": canonical_timestamp(now),
        "_now": now,
    }


def _resolve_identity(config):
    from .config import resolve_identity
    return resolve_identity(config)


def op_list(opts: dict, filters: dict) -> dict:
    c = _ctx(opts)
    store = load_store(c["cwd"], c["config"])
    items = store["feedback"]
    if filters.get("status"):
        items = [f for f in items if f["status"] == filters["status"]]
    if filters.get("type"):
        items = [f for f in items if f["feedback"]["type"] == filters["type"]]
    if filters.get("mine"):
        items = [f for f in items if f["author"]["user_id"] == c["identity"]["user_id"]]
    if filters.get("route"):
        items = [f for f in items if (f.get("location") or {}).get("route") == filters["route"]]
    if filters.get("session"):
        items = [f for f in items if f["session_id"] == filters["session"]]
    if c["format"] == "json":
        return {"stdout": canonical_json(items) + "\n", "exit": Exit.OK}
    lines = [
        "\t".join([f["id"], f["status"], f["feedback"]["type"],
                   (f.get("location") or {}).get("route") or "-",
                   str(f["feedback"]["text"]).split("\n")[0]])
        for f in items
    ]
    return {"stdout": ("\n".join(lines) + "\n") if lines else "", "exit": Exit.OK}


def op_show(opts: dict, feedback_id: str) -> dict:
    c = _ctx(opts)
    store = load_store(c["cwd"], c["config"])
    for item in store["feedback"]:
        if item["id"] == feedback_id:
            return {"stdout": canonical_json(item) + "\n", "exit": Exit.OK}
    raise CliError(Exit.NOT_FOUND, f"feedback not found: {feedback_id}")


def op_create(opts: dict, spec: dict) -> dict:
    c = _ctx(opts)
    ftype = spec.get("type") or "issue"
    if ftype not in FEEDBACK_TYPES:
        raise CliError(Exit.USAGE, f"invalid feedback type: {ftype} (expected {', '.join(FEEDBACK_TYPES)})")
    text = spec.get("text")
    if not text or str(text).strip() == "":
        raise CliError(Exit.USAGE, "--text is required")
    store = load_store(c["cwd"], c["config"])
    session = spec.get("session") or "default"
    seq = len(store["feedback"]) + 1
    feedback_id = new_id("fb", store["project_id"], session, seq, "feedback", c["_now"])
    location = {}
    for key, value in (("route", spec.get("route")), ("page", spec.get("page")),
                       ("component", spec.get("component")),
                       ("component_instance", spec.get("component_instance") or spec.get("instance"))):
        if value:
            location[key] = value
    target = {}
    for key, value in (("tux_id", spec.get("tux_id") or spec.get("tuxId")),
                       ("test_id", spec.get("test_id") or spec.get("testId"))):
        if value:
            target[key] = value
    item = make_feedback({
        "id": feedback_id,
        "project_id": store["project_id"],
        "session_id": session,
        "author": {"user_id": c["identity"]["user_id"], "display_name": c["identity"]["display_name"]},
        "origin": spec.get("origin") or "design",
        "location": location,
        "target": target,
        "ui_state": spec.get("ui_state") or {},
        "type": ftype,
        "text": text,
        "created_at": c["timestamp"],
    })
    problems = validate_feedback(item)
    if problems:
        raise CliError(Exit.GENERAL, "created item invalid: " + "; ".join(problems))
    store["feedback"].append(item)
    save_store(c["cwd"], c["config"], store)
    if spec.get("session"):
        ensure_session(c["cwd"], c["config"], spec["session"], spec.get("environment") or "design", c["timestamp"])
    return {"stdout": canonical_json(item) + "\n", "exit": Exit.OK}


def op_update(opts: dict, feedback_id: str, patch: dict) -> dict:
    c = _ctx(opts)
    store = load_store(c["cwd"], c["config"])
    item = next((f for f in store["feedback"] if f["id"] == feedback_id), None)
    if item is None:
        raise CliError(Exit.NOT_FOUND, f"feedback not found: {feedback_id}")
    if "status" in patch and patch["status"] is not None and patch["status"] not in FEEDBACK_STATUSES:
        raise CliError(Exit.USAGE, f"invalid status: {patch['status']} (expected {', '.join(FEEDBACK_STATUSES)})")
    if "type" in patch and patch["type"] is not None and patch["type"] not in FEEDBACK_TYPES:
        raise CliError(Exit.USAGE, f"invalid feedback type: {patch['type']} (expected {', '.join(FEEDBACK_TYPES)})")
    if patch.get("text") is not None:
        item["feedback"]["text"] = patch["text"]
    if patch.get("type") is not None:
        item["feedback"]["type"] = patch["type"]
    if patch.get("status") is not None:
        item["status"] = patch["status"]
    if patch.get("incorporation") is not None:
        item["incorporation"] = patch["incorporation"]
    item["updated_at"] = c["timestamp"]
    save_store(c["cwd"], c["config"], store)
    return {"stdout": canonical_json(item) + "\n", "exit": Exit.OK}


def op_delete(opts: dict, feedback_id: str) -> dict:
    c = _ctx(opts)
    store = load_store(c["cwd"], c["config"])
    idx = next((i for i, f in enumerate(store["feedback"]) if f["id"] == feedback_id), None)
    if idx is None:
        raise CliError(Exit.NOT_FOUND, f"feedback not found: {feedback_id}")
    store["feedback"].pop(idx)
    save_store(c["cwd"], c["config"], store)
    if c["format"] == "json":
        return {"stdout": canonical_json({"deleted": [feedback_id]}) + "\n", "exit": Exit.OK}
    return {"stdout": f"deleted {feedback_id}\n", "exit": Exit.OK}


def op_clear(opts: dict, scope: str | None, filters: dict) -> dict:
    c = _ctx(opts)
    if scope == "all" and not filters.get("force"):
        raise CliError(Exit.USAGE, "--all requires explicit confirmation (--force)")
    if not scope:
        raise CliError(Exit.USAGE, "specify --mine or --all")
    store = load_store(c["cwd"], c["config"])
    before = len(store["feedback"])

    def keep(f):
        if scope == "mine" and f["author"]["user_id"] != c["identity"]["user_id"]:
            return True
        if filters.get("route") and (f.get("location") or {}).get("route") != filters["route"]:
            return True
        if filters.get("session") and f["session_id"] != filters["session"]:
            return True
        return False

    store["feedback"] = [f for f in store["feedback"] if keep(f)]
    cleared = before - len(store["feedback"])
    save_store(c["cwd"], c["config"], store)
    if c["format"] == "json":
        return {"stdout": canonical_json({"cleared": cleared}) + "\n", "exit": Exit.OK}
    return {"stdout": f"cleared {cleared}\n", "exit": Exit.OK}


def op_export(opts: dict, fmt: str) -> dict:
    c = _ctx(opts)
    store = load_store(c["cwd"], c["config"])
    if fmt == "jsonl":
        lines = [compact_json(f) for f in store["feedback"]]
        return {"stdout": ("\n".join(lines) + "\n") if lines else "", "exit": Exit.OK}
    return {"stdout": canonical_json(store["feedback"]) + "\n", "exit": Exit.OK}


def target_key(item) -> str:
    loc = item.get("location") or {}
    target = item.get("target") or {}
    return "|".join([
        loc.get("route") or "", loc.get("page") or "",
        loc.get("component") or "", loc.get("component_instance") or "",
        target.get("tux_id") or "", target.get("test_id") or "",
    ])


def op_incorporate(opts: dict, strategy: str | None, filters: dict) -> dict:
    c = _ctx(opts)
    strategies = ["consolidate", "requirements", "tasks", "direct", "export-only"]
    if strategy is None:
        raise CliError(Exit.USAGE, f"--strategy is required in non-interactive mode (one of {', '.join(strategies)})")
    if strategy not in strategies:
        raise CliError(Exit.USAGE, f"invalid strategy: {strategy} (expected {', '.join(strategies)})")
    store = load_store(c["cwd"], c["config"])
    open_items = [f for f in store["feedback"] if f["status"] == "open"]
    if filters.get("mine"):
        open_items = [f for f in open_items if f["author"]["user_id"] == c["identity"]["user_id"]]
    if filters.get("route"):
        open_items = [f for f in open_items if (f.get("location") or {}).get("route") == filters["route"]]
    if filters.get("session"):
        open_items = [f for f in open_items if f["session_id"] == filters["session"]]

    groups: list[dict] = []
    by_key: dict[str, dict] = {}
    for item in open_items:
        key = target_key(item)
        if key not in by_key:
            group = {"key": key, "items": []}
            by_key[key] = group
            groups.append(group)
        by_key[key]["items"].append(item)

    report_groups = []
    incorporated = []
    conflicts = []
    for group in groups:
        items = group["items"]
        kinds = {i["feedback"]["type"] for i in items}
        is_conflict = "approval" in kinds and bool(kinds & {"change", "issue", "question"})
        if is_conflict:
            report_groups.append({"key": group["key"], "kind": "conflict",
                                  "requires_decision": True, "feedback_ids": [i["id"] for i in items]})
            conflicts.extend(i["id"] for i in items)
            continue
        kind = "unique"
        if len(items) > 1:
            first = normalized_text(items[0]["feedback"]["text"])
            kind = "duplicate" if all(normalized_text(i["feedback"]["text"]) == first for i in items) else "unique"
        report_groups.append({"key": group["key"], "kind": kind,
                              "requires_decision": False, "feedback_ids": [i["id"] for i in items]})
        if strategy != "export-only":
            for i in items:
                i["status"] = "incorporated"
                i["incorporation"] = {"strategy": strategy, "batch_id": None, "recorded_at": c["timestamp"]}
                incorporated.append(i["id"])

    seq = count_incorporation_batches(c["cwd"]) + 1
    batch_id = new_id("batch", store["project_id"], "default", seq, "batch", c["_now"])
    report = {
        "schema_version": SCHEMA_VERSION,
        "batch_id": batch_id,
        "strategy": strategy,
        "created_at": c["timestamp"],
        "groups": report_groups,
        "incorporated": incorporated,
        "conflicts": conflicts,
    }
    if strategy != "export-only":
        for item in store["feedback"]:
            inc = item.get("incorporation")
            if inc is not None and inc.get("batch_id") is None and item["id"] in incorporated:
                inc["batch_id"] = batch_id
        save_store(c["cwd"], c["config"], store)
        save_incorporation_batch(c["cwd"], report)
    return {"stdout": canonical_json(report) + "\n", "exit": Exit.OK}


def op_validate(opts: dict, args: dict) -> dict:
    c = _ctx(opts)
    if args.get("record") is not None:
        result = args.get("result")
        if result not in ("passed", "failed"):
            raise CliError(Exit.USAGE, f"invalid validation result: {result} (expected passed, failed)")
        store = load_store(c["cwd"], c["config"])
        item = next((f for f in store["feedback"] if f["id"] == args["record"]), None)
        if item is None:
            raise CliError(Exit.NOT_FOUND, f"feedback not found: {args['record']}")
        validation = {"result": result, "checked_at": c["timestamp"]}
        if args.get("note"):
            validation["note"] = args["note"]
        item["validation"] = validation
        item["updated_at"] = c["timestamp"]
        save_store(c["cwd"], c["config"], store)
        return {"stdout": canonical_json(item) + "\n", "exit": Exit.OK}
    store = load_store(c["cwd"], c["config"])
    items = [
        {"id": f["id"],
         "location_route": (f.get("location") or {}).get("route"),
         "validation_result": (f.get("validation") or {}).get("result") or "unvalidated"}
        for f in store["feedback"] if f["status"] == "incorporated"
    ]
    summary = {
        "total": len(items),
        "passed": len([i for i in items if i["validation_result"] == "passed"]),
        "failed": len([i for i in items if i["validation_result"] == "failed"]),
        "unvalidated": len([i for i in items if i["validation_result"] == "unvalidated"]),
    }
    exit_code = Exit.OK
    if args.get("strict") and (summary["failed"] > 0 or summary["unvalidated"] > 0):
        exit_code = Exit.GENERAL
    if c["format"] == "json":
        payload = {"schema_version": SCHEMA_VERSION, "summary": summary, "items": items}
        return {"stdout": canonical_json(payload) + "\n", "exit": exit_code}
    lines = [f"{i['id']}\t{i['validation_result']}" for i in items]
    text = ("\n".join(lines) + "\n") if lines else ""
    text += (f"total {summary['total']}, passed {summary['passed']}, "
             f"failed {summary['failed']}, unvalidated {summary['unvalidated']}\n")
    return {"stdout": text, "exit": exit_code}
