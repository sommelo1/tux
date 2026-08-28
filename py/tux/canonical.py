"""Canonical JSON serialization.

Canonical JSON is UTF-8, 2-space indented, ``\\n`` line endings, keys in
the fixed schema order (objects are built in that order; free-form
``ui_state`` keys are sorted alphabetically). Both reference
implementations (Node, Python) emit byte-identical bytes.
"""
import json


def canonical_json(value) -> str:
    """Serialize a value as canonical JSON text (no trailing newline)."""
    return json.dumps(value, indent=2, ensure_ascii=False)


def compact_json(value) -> str:
    """Serialize a value as a compact single-line JSON text (no newline)."""
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def sorted_object(obj) -> dict:
    """Sort the keys of a free-form object alphabetically (one level)."""
    return {k: obj[k] for k in sorted(obj)}
