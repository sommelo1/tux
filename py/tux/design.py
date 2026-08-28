"""``tux design <action>`` — integrate, create, serve (SPC sections 28–38)."""
from __future__ import annotations

import json
from pathlib import Path

from .canonical import canonical_json
from .config import CONFIG_FILE, default_config
from .errors import CliError, Exit
from .templates import SUPPORTED_FRAMEWORKS, design_template


def _text_report(lines: list[str]) -> dict:
    return {"stdout": "\n".join(lines) + "\n", "exit": Exit.OK}


def op_design_integrate(opts: dict, spec: dict) -> dict:
    cwd = opts["cwd"]
    framework = spec.get("framework") or opts["config"]["design"].get("framework") or "vanilla"
    if framework not in SUPPORTED_FRAMEWORKS:
        raise CliError(Exit.USAGE, f"unsupported framework: {framework} (expected {', '.join(SUPPORTED_FRAMEWORKS)})")
    config_path = opts.get("config_path") or str(Path(cwd) / CONFIG_FILE)
    if Path(config_path).exists():
        config = json.loads(Path(config_path).read_text(encoding="utf-8"))
    else:
        config = default_config(cwd)
    config.setdefault("design", {})
    config["design"]["framework"] = framework
    if spec.get("root"):
        config["design"]["root"] = spec["root"]
    root = config["design"].get("root") or "requirements"
    Path(config_path).write_text(canonical_json(config) + "\n", encoding="utf-8", newline="\n")
    report_config = config_path
    if opts.get("config_path") is None:
        report_config = CONFIG_FILE
    report = {
        "action": "integrate",
        "kind": "design",
        "framework": framework,
        "root": root,
        "config": report_config,
        "next": [f"tux design create --framework {framework}", "tux design serve"],
    }
    if opts.get("format") == "text":
        return _text_report([
            f"integrated design review (framework {framework})",
            f"config: {report['config']}",
            f"next: {' | '.join(report['next'])}",
        ])
    return {"stdout": canonical_json(report) + "\n", "exit": Exit.OK}


def op_design_create(opts: dict, spec: dict) -> dict:
    cwd = Path(opts["cwd"])
    framework = spec.get("framework")
    if not framework:
        raise CliError(Exit.USAGE, "--framework is required")
    if framework not in SUPPORTED_FRAMEWORKS:
        raise CliError(Exit.USAGE, f"unsupported framework: {framework} (expected {', '.join(SUPPORTED_FRAMEWORKS)})")
    name = spec.get("name") or ""
    import re
    if not re.match(r"^[a-z0-9][a-z0-9-]*$", name):
        raise CliError(Exit.USAGE, "--name must be a lowercase slug (letters, digits, dashes)")
    root = opts["config"]["design"].get("root") or "requirements"
    design_dir = cwd / root / name / "design"
    if design_dir.exists():
        raise CliError(Exit.CONFLICT, f"design directory already exists: {root}/{name}/design")
    for rel, content in design_template(framework).items():
        p = design_dir / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8", newline="\n")
    report = {
        "action": "create",
        "kind": "design",
        "framework": framework,
        "name": name,
        "root": f"{root}/{name}/design",
        "next": ["tux design serve", "review in the browser"],
    }
    if opts.get("format") == "text":
        return _text_report([
            f"created {report['root']} (framework {framework})",
            f"next: {' | '.join(report['next'])}",
        ])
    return {"stdout": canonical_json(report) + "\n", "exit": Exit.OK}
