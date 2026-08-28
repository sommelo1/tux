"""Canonical feedback schema v1.0 (SPC sections 14–20)."""
from __future__ import annotations

import re
from .canonical import sorted_object

SCHEMA_VERSION = "1.0"

FEEDBACK_TYPES = ["change", "issue", "question", "approval"]
FEEDBACK_STATUSES = ["open", "incorporated", "resolved", "rejected"]
ORIGIN_MODES = ["design", "review"]

_ID_RE = re.compile(r"^fb_[0-9A-HJKMNP-TV-Z]{26}$")

LOCATION_ORDER = ["route", "page", "component", "component_instance"]
TARGET_ORDER = [
    "tux_id", "test_id", "component", "role", "accessible_name",
    "text", "css_selector", "dom_path", "bounding_box",
]


def validate_feedback(item) -> list[str]:
    """Validate a feedback item; returns a list of problems (empty = valid)."""
    problems: list[str] = []
    if item.get("schema_version") != SCHEMA_VERSION:
        problems.append('schema_version must be "1.0"')
    if not isinstance(item.get("id"), str) or not _ID_RE.match(item.get("id", "")):
        problems.append("id must match fb_<26 Crockford chars>")
    if not isinstance(item.get("project_id"), str) or item.get("project_id") == "":
        problems.append("project_id must be a non-empty string")
    if not isinstance(item.get("session_id"), str) or item.get("session_id") == "":
        problems.append("session_id must be a non-empty string")
    author = item.get("author") or {}
    if not isinstance(author.get("user_id"), str) or author.get("user_id") == "":
        problems.append("author.user_id must be a non-empty string")
    origin = item.get("origin") or {}
    if origin.get("mode") not in ORIGIN_MODES:
        problems.append("origin.mode must be one of " + ", ".join(ORIGIN_MODES))
    feedback = item.get("feedback") or {}
    if feedback.get("type") not in FEEDBACK_TYPES:
        problems.append("feedback.type must be one of " + ", ".join(FEEDBACK_TYPES))
    if not isinstance(feedback.get("text"), str) or feedback.get("text") == "":
        problems.append("feedback.text must be a non-empty string")
    if item.get("status") not in FEEDBACK_STATUSES:
        problems.append("status must be one of " + ", ".join(FEEDBACK_STATUSES))
    return problems


def _ordered(by: dict, order: list[str]) -> dict:
    return {k: by[k] for k in order if by.get(k) is not None and k in by}


def make_feedback(fields: dict) -> dict:
    """Construct a canonical feedback item (fields in schema order)."""
    item = {
        "schema_version": SCHEMA_VERSION,
        "id": fields["id"],
        "project_id": fields["project_id"],
        "session_id": fields["session_id"],
        "author": {
            "user_id": fields["author"]["user_id"],
            "display_name": fields["author"]["display_name"],
        },
        "origin": {"mode": fields["origin"]},
    }
    if fields.get("location") is not None:
        item["location"] = _ordered(fields["location"], LOCATION_ORDER)
    item["target"] = _ordered(fields.get("target") or {}, TARGET_ORDER)
    item["ui_state"] = sorted_object(fields.get("ui_state") or {})
    item["feedback"] = {"type": fields["type"], "text": fields["text"]}
    item["status"] = fields.get("status") or "open"
    item["created_at"] = fields["created_at"]
    item["updated_at"] = fields.get("updated_at") or fields["created_at"]
    if fields.get("incorporation") is not None:
        item["incorporation"] = dict(fields["incorporation"])
    if fields.get("validation") is not None:
        item["validation"] = dict(fields["validation"])
    return item


def normalized_text(text: str) -> str:
    """Normalized text for duplicate detection."""
    return " ".join(text.split()).strip().lower()
