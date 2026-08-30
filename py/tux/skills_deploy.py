"""Canonical skill deployment (SPC sections 28, 32): ``tux design install``,
``tux live install`` and the start-review commands deploy the packaged skills
verbatim into the project's agent skill directories, so a package installation
plus one CLI invocation leaves the project ready, and a package update
refreshes the deployed copies on the next invocation.

Duality with js/src/skills.js — same directories, same byte-verbatim copies.
"""
from __future__ import annotations

from pathlib import Path

from .errors import CliError, Exit

#: Agent skill directories relative to the project root (SPC 28/32).
AGENT_DIRS = (".kilo", ".claude", ".hermes")


def deploy_skills(root: str) -> list[str]:
    """Deploy every packaged ``tux-<name>.md`` skill verbatim into
    ``<root>/<agent>/skills/<name>/SKILL.md`` for each agent directory.

    Idempotent: deployed copies are rewritten on every run; files not
    shipped by this package are never touched.

    :param root: project root directory
    :returns: deployed skill names, sorted
    :raises CliError: exit 1 when the target directories are not writable
    """
    packaged = Path(__file__).parent / "skills"
    names = sorted(p.stem for p in packaged.glob("tux-*.md"))
    try:
        for agent in AGENT_DIRS:
            for name in names:
                dst = Path(root) / agent / "skills" / name / "SKILL.md"
                dst.parent.mkdir(parents=True, exist_ok=True)
                dst.write_bytes((packaged / f"{name}.md").read_bytes())
    except OSError as exc:
        raise CliError(Exit.GENERAL, f"skill deployment failed: {exc}") from exc
    return names
