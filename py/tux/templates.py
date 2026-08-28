"""Design templates for ``tux design create --framework <framework>``.

Template content lives as real files under ``py/tux/templates/<framework>/``
— byte-identical copies of ``js/templates/<framework>/`` (synced by
``tools/sync-artifacts.mjs``, enforced by the artifact identity tests).

Every template is a runnable multi-route design (History-API routing,
tabs, a modal) annotated with TUX targeting attributes.
"""
from __future__ import annotations

from pathlib import Path

TEMPLATE_ROOT = Path(__file__).resolve().parent / "templates"

SUPPORTED_FRAMEWORKS = ["vanilla", "react", "vue", "angular"]


def design_template(framework: str) -> dict:
    """Files (relative path → content) for ``tux design create``."""
    if framework not in SUPPORTED_FRAMEWORKS:
        raise ValueError(f"unsupported framework: {framework}")
    base = TEMPLATE_ROOT / framework
    return _read_tree(base)


def _read_tree(directory: Path, prefix: str = "") -> dict:
    out: dict[str, str] = {}
    for entry in sorted(directory.iterdir()):
        rel = f"{prefix}/{entry.name}" if prefix else entry.name
        if entry.is_dir():
            out.update(_read_tree(entry, rel))
        else:
            out[rel] = entry.read_text(encoding="utf-8")
    return out
