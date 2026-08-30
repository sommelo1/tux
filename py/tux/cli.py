"""``tux`` command-line interface (SPC sections 25, 74, 75).

Grammar: ``tux <domain> <action> [arguments] [options]``.
Machine output: canonical JSON on stdout; diagnostics on stderr as
``error: <message>`` lines with canonical exit codes. Mirrors
``js/src/cli.js`` byte-for-byte.
"""
from __future__ import annotations

from .config import load_config
from .errors import CliError, Exit
from .feedback import (op_clear, op_create, op_delete, op_export,
                       op_incorporate, op_show, op_update, op_validate)
from .design import op_design_create, op_design_install, op_design_start, op_design_status, op_design_stop, op_live_create
from .live import op_live_install, op_live_start, op_live_status, op_live_stop
from . import __version__ as VERSION

VALUE_FLAGS = {
    "config", "format", "type", "text", "route", "page", "component", "component-instance", "instance",
    "tux-id", "test-id", "session", "environment", "origin", "status", "strategy", "result", "note", "record",
    "url", "target-port", "port", "host", "store", "project-id", "name", "framework", "dir", "root", "out",
    "mode", "target",
}
BOOL_FLAGS = {"mine", "all", "force", "strict", "dry-run", "no-interactive", "foreground", "help", "version"}


def parse_args(args: list[str]) -> dict:
    flags: dict = {}
    positional: list[str] = []
    cmd: list[str] | None = None
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--":
            cmd = args[i + 1:]
            return {"flags": flags, "positional": positional, "cmd": cmd}
        if a.startswith("--"):
            name = a[2:]
            if name in VALUE_FLAGS:
                if i + 1 >= len(args):
                    raise CliError(Exit.USAGE, f"option --{name} requires a value")
                flags[name] = args[i + 1]
                i += 2
                continue
            if name in BOOL_FLAGS:
                flags[name] = True
                i += 1
                continue
            raise CliError(Exit.USAGE, f"unknown option: --{name}")
        positional.append(a)
        i += 1
    return {"flags": flags, "positional": positional, "cmd": None}


def run(argv: list[str], context: dict | None = None) -> dict:
    """Run the CLI; returns ``{"stdout", "stderr", "exit"}``."""
    context = context or {}
    cwd = context.get("cwd") or _os_cwd()
    try:
        parsed = parse_args(list(argv))
    except CliError as e:
        return _fail(e)
    flags = parsed["flags"]
    positional = parsed["positional"]

    try:
        if flags.get("version"):
            return {"stdout": f"tux {VERSION}\n", "stderr": "", "exit": Exit.OK}
        if flags.get("help") or not positional:
            return {"stdout": _help(), "stderr": "", "exit": Exit.OK}

        domain = positional[0] if positional else None
        action = positional[1] if len(positional) > 1 else None

        if domain == "feedback":
            config, config_path = load_config(cwd, flags)
            opts = {"cwd": cwd, "config": config, "config_path": config_path, "format": flags.get("format")}
            if action == "show":
                opts["format"] = flags.get("format") or "text"
                return _ok(op_show(opts, positional[2] if len(positional) > 2 else None, {
                    "status": flags.get("status"), "type": flags.get("type"),
                    "mine": bool(flags.get("mine")), "route": flags.get("route"),
                    "session": flags.get("session"), "origin": flags.get("origin"),
                }))
            if action == "create":
                return _ok(op_create(opts, {
                    "type": flags.get("type") or "issue",
                    "text": flags.get("text"),
                    "route": flags.get("route"),
                    "page": flags.get("page"),
                    "component": flags.get("component"),
                    "component_instance": flags.get("component-instance") or flags.get("instance"),
                    "tux_id": flags.get("tux-id"),
                    "test_id": flags.get("test-id"),
                    "session": flags.get("session"),
                    "environment": flags.get("environment"),
                    "origin": flags.get("origin"),
                }))
            if action == "update":
                if len(positional) < 3:
                    raise CliError(Exit.USAGE, "usage: tux feedback update <feedback-id>")
                return _ok(op_update(opts, positional[2], {
                    "text": flags.get("text"), "type": flags.get("type"), "status": flags.get("status"),
                }))
            if action == "delete":
                if len(positional) < 3:
                    raise CliError(Exit.USAGE, "usage: tux feedback delete <feedback-id>")
                opts["format"] = flags.get("format") or "text"
                return _ok(op_delete(opts, positional[2]))
            if action == "clear":
                opts["format"] = flags.get("format") or "text"
                scope = "all" if flags.get("all") else ("mine" if flags.get("mine") else None)
                return _ok(op_clear(opts, scope, {
                    "force": bool(flags.get("force")), "route": flags.get("route"),
                    "session": flags.get("session"),
                }))
            if action == "export":
                return _ok(op_export(opts, "jsonl" if flags.get("format") == "jsonl" else "json"))
            if action == "incorporate":
                return _ok(op_incorporate(opts, flags.get("strategy"), {
                    "mine": bool(flags.get("mine")), "route": flags.get("route"),
                    "session": flags.get("session"), "origin": flags.get("origin"),
                }))
            if action == "validate":
                return _ok(op_validate(opts, {
                    "record": flags.get("record"), "result": flags.get("result"),
                    "note": flags.get("note"), "strict": bool(flags.get("strict")),
                    "origin": flags.get("origin"),
                }))
            raise CliError(Exit.USAGE, f"unknown action: {action or '(missing)'} for domain {domain}")

        if domain in ("design", "live"):
            config, config_path = load_config(cwd, flags)
            opts = {"cwd": cwd, "config": config, "config_path": config_path,
                    "format": flags.get("format") or "json"}
            is_design = domain == "design"
            if action == "install":
                return _ok(op_design_install(opts, {"framework": flags.get("framework"), "root": flags.get("root")})
                           if is_design else op_live_install(opts))
            if action == "create":
                return _ok(op_design_create(opts, {"framework": flags.get("framework"), "name": flags.get("name")})
                           if is_design else op_live_create(opts, {"framework": flags.get("framework"), "name": flags.get("name")}))
            if action == "start-review":
                opts["format"] = flags.get("format") or "json"
                cmd = parsed.get("cmd") or (positional[2:] if len(positional) > 2 else None)
                if is_design:
                    return _ok(op_design_start(opts, {
                        "dir": flags.get("dir"),
                        "port": int(flags["port"]) if flags.get("port") else None,
                        "host": flags.get("host"),
                        "session": flags.get("session"),
                        "environment": flags.get("environment"),
                        "dry_run": bool(flags.get("dry-run")),
                        "foreground": bool(flags.get("foreground")),
                    }))
                return _ok(op_live_start(opts, {
                    "url": flags.get("url"),
                    "cmd": " ".join(cmd) if cmd else None,
                    "target_port": int(flags["target-port"]) if flags.get("target-port") else None,
                    "port": int(flags["port"]) if flags.get("port") else None,
                    "host": flags.get("host"),
                    "session": flags.get("session"),
                    "environment": flags.get("environment"),
                    "dry_run": bool(flags.get("dry-run")),
                    "foreground": bool(flags.get("foreground")),
                }))
            if action == "status":
                opts["format"] = flags.get("format") or "text"
                return _ok(op_live_status(opts))
            if action == "stop-review":
                opts["format"] = flags.get("format") or "text"
                return _ok(op_live_stop(opts))
            raise CliError(Exit.USAGE, f"unknown action: {action or '(missing)'} for domain {domain}")

        raise CliError(Exit.USAGE, f"unknown command: {domain}")
    except CliError as e:
        return _fail(e)
    except Exception as e:  # pragma: no cover
        return {"stdout": "", "stderr": f"error: internal: {e}\n", "exit": Exit.GENERAL}


def _ok(result: dict) -> dict:
    return {"stdout": result.get("stdout") or "", "stderr": result.get("stderr") or "",
            "exit": result.get("exit") or Exit.OK,
            **({"keep_alive": result["keep_alive"]} if result.get("keep_alive") else {})}


def _fail(e: CliError) -> dict:
    return {"stdout": "", "stderr": f"error: {e}\n", "exit": e.code}


def _help() -> str:
    return "\n".join([
        "tux <domain> <action> [arguments] [options]",
        "",
        "domains:",
        "  design    install | create | start-review | status | stop-review",
        "  live      install | create | start-review | status | stop-review",
        "  feedback  show | create | update | delete | clear | export | incorporate | validate",
        "",
        "options:",
        "  --config <path>     project config (default: tux.config.json)",
        "  --format json|text  output format",
        "  --version           print version",
        "  --help              this help",
        "",
    ])


def _os_cwd() -> str:
    import os
    return os.getcwd()


def console_main() -> None:
    """Console-script entry point."""
    import sys
    result = run(sys.argv[1:])
    if result["stdout"]:
        sys.stdout.write(result["stdout"])
    if result["stderr"]:
        sys.stderr.write(result["stderr"])
    if result.get("keep_alive"):
        try:
            result["keep_alive"].serve_forever()
        except KeyboardInterrupt:
            pass
    sys.exit(result["exit"])


if __name__ == "__main__":
    console_main()
