"""JSON persistence backend (SPC section 22): a single canonical JSON
file at ``review.store`` (default ``.tux/feedback.json``), plus review
sessions under ``.tux/sessions/`` and incorporation batches under
``.tux/incorporations/``."""
from __future__ import annotations

import json
from pathlib import Path

from .canonical import canonical_json
from .schema import SCHEMA_VERSION


def store_file_path(cwd: str, config: dict) -> Path:
    return Path(cwd) / config["review"]["store"]


def load_store(cwd: str, config: dict) -> dict:
    p = store_file_path(cwd, config)
    if not p.exists():
        return {"schema_version": SCHEMA_VERSION, "project_id": config["project_id"], "feedback": []}
    store = json.loads(p.read_text(encoding="utf-8"))
    if "feedback" not in store:
        store["feedback"] = []
    return store


def save_store(cwd: str, config: dict, store: dict) -> None:
    p = store_file_path(cwd, config)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(canonical_json(store) + "\n", encoding="utf-8", newline="\n")


def store_exists(cwd: str, config: dict) -> bool:
    return store_file_path(cwd, config).exists()


def sessions_dir(cwd: str) -> Path:
    return Path(cwd) / ".tux" / "sessions"


def ensure_session(cwd: str, config: dict, session_id: str, environment: str, timestamp: str) -> dict:
    d = sessions_dir(cwd)
    d.mkdir(parents=True, exist_ok=True)
    p = d / f"{session_id}.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    session = {
        "session_id": session_id,
        "project_id": config["project_id"],
        "environment": environment,
        "status": "active",
        "created_at": timestamp,
    }
    p.write_text(canonical_json(session) + "\n", encoding="utf-8", newline="\n")
    return session


def incorporations_dir(cwd: str) -> Path:
    return Path(cwd) / ".tux" / "incorporations"


def count_incorporation_batches(cwd: str) -> int:
    d = incorporations_dir(cwd)
    return len([f for f in d.iterdir() if f.name.endswith(".json")]) if d.exists() else 0


def save_incorporation_batch(cwd: str, batch: dict) -> Path:
    d = incorporations_dir(cwd)
    d.mkdir(parents=True, exist_ok=True)
    p = d / f"{batch['batch_id']}.json"
    p.write_text(canonical_json(batch) + "\n", encoding="utf-8", newline="\n")
    return p
