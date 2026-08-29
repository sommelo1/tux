"""``tux design <action>`` — install, create, start-review, status, stop-review (SPC sections 28–38).
``tux live create`` (SPC section 32) shares the create primitive with ``"kind": "live"``."""
from __future__ import annotations

import json
import re
from pathlib import Path

from .canonical import canonical_json
from .config import CONFIG_FILE, default_config
from .errors import CliError, Exit
from .templates import SUPPORTED_FRAMEWORKS, design_template
from .live import start_server, op_live_status, op_live_stop


def _text_report(lines: list[str]) -> dict:
    return {"stdout": "\n".join(lines) + "\n", "exit": Exit.OK}


def _rel_path(cwd: str, p: str) -> str:
    """Return a portable project-relative path when *p* is inside *cwd*."""
    try:
        rel = Path(p).resolve().relative_to(Path(cwd).resolve())
    except ValueError:
        return p
    return "." if str(rel) == "." else rel.as_posix()


def op_design_install(opts: dict, spec: dict) -> dict:
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
        "action": "install",
        "kind": "design",
        "framework": framework,
        "root": root,
        "config": report_config,
        "next": [f"tux design create --framework {framework}", "tux design start-review"],
    }
    if opts.get("format") == "text":
        return _text_report([
            f"installed design review (framework {framework})",
            f"config: {report['config']}",
            f"next: {' | '.join(report['next'])}",
        ])
    return {"stdout": canonical_json(report) + "\n", "exit": Exit.OK}


DEV_PORT = {"vanilla": 4173, "react": 5173, "vue": 5173, "angular": 4200}


def op_design_create(opts: dict, spec: dict) -> dict:
    """Create the runnable design scaffold or the identical live-app scaffold (kind=live)."""
    kind = spec.get("kind") or "design"
    cwd = Path(opts["cwd"])
    framework = spec.get("framework")
    if not framework:
        raise CliError(Exit.USAGE, "--framework is required")
    if framework not in SUPPORTED_FRAMEWORKS:
        raise CliError(Exit.USAGE, f"unsupported framework: {framework} (expected {', '.join(SUPPORTED_FRAMEWORKS)})")
    name = spec.get("name") or ""
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
    domain = "live" if kind == "live" else "design"
    next_steps = (["tux live install", f"tux live start-review --url http://localhost:{DEV_PORT[framework]}"]
                  if kind == "live" else ["tux design start-review", "review in the browser"])
    report = {
        "action": "create",
        "kind": kind,
        "framework": framework,
        "name": name,
        "root": f"{root}/{name}/design",
        "next": next_steps,
    }
    if opts.get("format") == "text":
        return _text_report([
            f"created {report['root']} (framework {framework}, kind {kind})",
            f"next: {' | '.join(report['next'])}",
        ])
    return {"stdout": canonical_json(report) + "\n", "exit": Exit.OK}


def op_live_create(opts: dict, spec: dict) -> dict:
    return op_design_create(opts, {**spec, "kind": "live"})


def op_design_start(opts: dict, spec: dict) -> dict:
    config = opts["config"]
    host = spec.get("host") or config["review"]["host"]
    port = spec.get("port") or config["review"]["port"]
    session = spec.get("session") or "default"
    environment = spec.get("environment") or "design"
    root = Path(opts["cwd"], spec.get("dir") or config["design"].get("root")).resolve()
    url = f"http://{'127.0.0.1' if host == '0.0.0.0' else host}:{port}"
    plan = {
        "action": "start",
        "kind": "design",
        "mode": "design",
        "root": _rel_path(opts["cwd"], str(root)),
        "host": host,
        "port": port,
        "session_id": session,
        "environment": environment,
        "url": url,
    }
    return start_server(opts, {
        "mode": "design", "host": host, "port": port, "session": session, "environment": environment,
        "url": url, "root": _rel_path(opts["cwd"], str(root)), "target": None,
        "dry_run": spec.get("dry_run"), "foreground": spec.get("foreground"), "plan": plan,
    })


def op_design_status(opts: dict) -> dict:
    return op_live_status(opts)


def op_design_stop(opts: dict) -> dict:
    return op_live_stop(opts)
