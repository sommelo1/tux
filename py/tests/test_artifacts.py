"""Artifact identity tests: deployed skill copies and the synced Review
Client must be byte-identical with their canonical sources."""
from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SKILLS = REPO / "skills"


def _read(p: Path) -> bytes:
    return p.read_bytes()


def test_eleven_canonical_skills_exist():
    sources = sorted(p.name for p in SKILLS.glob("*.md"))
    assert len(sources) == 11, f"expected 11 canonical skills, found {sources}"


def test_skill_sources_follow_contract():
    required = ["## Resolve the CLI", "## Workflow"]
    for p in SKILLS.glob("*.md"):
        text = p.read_text(encoding="utf-8")
        slug = p.stem
        assert text.startswith("---\n"), f"{p.name}: frontmatter missing"
        assert f"name: {slug}" in text, f"{p.name}: frontmatter name mismatch"
        assert "description: " in text, f"{p.name}: description missing"
        assert f"# {slug}" in text, f"{p.name}: H1 title mismatch"
        for section in required:
            assert section in text, f"{p.name}: {section} missing"


def test_deployed_skill_copies_are_byte_identical():
    sources = sorted(SKILLS.glob("*.md"))
    targets = [
        REPO / "js" / "skills",
        REPO / "py" / "tux" / "skills",
        REPO / ".claude" / "skills",
        REPO / ".hermes" / "skills",
        REPO / ".kilo" / "skills",
    ]
    for t in targets:
        assert t.exists(), f"{t} missing"
        for src in sources:
            deployed = t / src.name
            assert deployed.exists(), f"{deployed} missing"
            assert _read(src) == _read(deployed), f"{deployed} differs from canonical source"


def test_client_is_byte_identical_in_py_package():
    js_client = REPO / "js" / "client"
    py_client = REPO / "py" / "tux" / "client"
    for f in sorted(js_client.iterdir()):
        assert _read(f) == _read(py_client / f.name), f"client/{f.name} differs in py package"


def test_design_templates_are_byte_identical_in_py_package():
    js_templates = REPO / "js" / "templates"
    py_templates = REPO / "py" / "tux" / "templates"
    frameworks = sorted(p.name for p in js_templates.iterdir() if p.is_dir())
    assert {"vanilla", "react", "vue", "angular"} <= set(frameworks)
    for fw in frameworks:
        js_files = sorted(p for p in (js_templates / fw).rglob("*") if p.is_file())
        assert js_files, f"template {fw} is empty"
        for src in js_files:
            mirror = py_templates / fw / src.relative_to(js_templates / fw)
            assert mirror.exists(), f"{mirror} missing"
            assert _read(src) == _read(mirror), f"template {fw}/{src.name} differs in py package"
