"""``tux live <action>`` — install, create, start-review, status, stop (SPC sections 32–41).
Also hosts the shared server lifecycle used by ``tux design start-review``."""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from .canonical import canonical_json
from .errors import CliError, Exit
from .ids import canonical_timestamp
from .store import load_store

SERVER_STATE_FILE = ".tux/server.json"


def _health(url: str, timeout: float = 2.0) -> bool:
    try:
        with urllib.request.urlopen(url.rstrip("/") + "/api/tux/health", timeout=timeout) as r:
            if r.status != 200:
                return False
            r.read()
            return True
    except Exception:
        return False


def op_live_install(opts: dict) -> dict:
    cwd = Path(opts["cwd"])
    pkg_path = cwd / "package.json"
    has_pkg = pkg_path.exists()
    has_index = (cwd / "index.html").exists()
    if not has_pkg and not has_index:
        raise CliError(Exit.CONFIG, "unsupported setup: no package.json or index.html found in the current directory")
    pkg = {}
    if has_pkg:
        try:
            pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            raise CliError(Exit.CONFIG, "invalid JSON in package.json")
    deps = {**(pkg.get("dependencies") or {}), **(pkg.get("devDependencies") or {})}
    framework = "vanilla"
    if "next" in deps:
        framework = "next"
    elif "@angular/core" in deps:
        framework = "angular"
    elif "vue" in deps:
        framework = "vue"
    elif "react" in deps:
        framework = "react"
    dev_command = (pkg.get("scripts") or {}).get("dev")
    dev_port = 3000
    if dev_command:
        m = re.search(r"--port[= ](\d+)", dev_command)
        if m:
            dev_port = int(m.group(1))
    report = {
        "action": "install",
        "kind": "live",
        "strategy": "proxy",
        "runtime": "node" if has_pkg else "static",
        "framework": framework,
        "dev_command": dev_command,
        "dev_port": dev_port if has_pkg else None,
        "next": [f"tux live start-review --url http://localhost:{dev_port if has_pkg else 8123}"],
    }
    if opts.get("format") == "text":
        lines = [
            f"installed live review (strategy {report['strategy']}, framework {framework})",
            f"next: {' | '.join(report['next'])}",
        ]
        return {"stdout": "\n".join(lines) + "\n", "exit": Exit.OK}
    return {"stdout": canonical_json(report) + "\n", "exit": Exit.OK}


def _server_state(spec: dict, opts: dict, pid: int) -> dict:
    state = {
        "pid": pid,
        "mode": spec["mode"],
        "url": spec["url"],
    }
    if spec.get("app_pid") is not None:
        state = {"pid": pid, "app_pid": spec["app_pid"], **{k: v for k, v in state.items() if k != "pid"}}
    if spec.get("target"):
        state["target_url"] = spec["target"]
    if spec.get("root"):
        state["root"] = spec["root"]
    state.update({
        "host": spec["host"],
        "port": spec["port"],
        "session_id": spec["session"],
        "environment": spec["environment"],
        "project_id": opts["config"]["project_id"],
        "store": opts["config"]["review"]["store"],
        "started_at": canonical_timestamp(int(time.time() * 1000)),
    })
    return state


def _write_state(cwd: str, state: dict) -> None:
    (Path(cwd) / SERVER_STATE_FILE).write_text(canonical_json(state) + "\n", encoding="utf-8", newline="\n")


def start_server(opts: dict, spec: dict) -> dict:
    """Shared server start for ``tux live start-review`` and ``tux design start-review``."""
    if spec.get("dry_run"):
        return {"stdout": canonical_json(spec["plan"]) + "\n", "exit": Exit.OK}

    (Path(opts["cwd"]) / ".tux").mkdir(parents=True, exist_ok=True)
    app_pid = None
    if spec.get("cmd"):
        app_pid = _spawn_detached(spec["cmd"], opts["cwd"])
        if not _wait_until(lambda: _health(spec["target"]), 30.0):
            _kill_tree(app_pid)
            raise CliError(Exit.SERVER, f"target application did not become reachable at {spec['target']}")

    if spec.get("foreground"):
        from .server import start_server as _start_in_process
        server = _start_in_process(
            mode=spec["mode"], host=spec["host"], port=spec["port"], root=spec.get("root"),
            target=spec.get("target"), cwd=opts["cwd"], session=spec["session"],
            environment=spec["environment"], config=opts["config"],
        )
        _write_state(opts["cwd"], _server_state(spec, opts, os.getpid()))
        return {"stdout": "", "exit": Exit.OK, "keep_alive": server}

    exe = Path(sys.executable)
    popen_kwargs = dict(stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if sys.platform == "win32":
        popen_kwargs["creationflags"] = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        popen_kwargs["start_new_session"] = True
    args = [str(exe), "-m", "tux.serve_main", "--mode", spec["mode"], "--host", str(spec["host"]),
            "--port", str(spec["port"]), "--session", spec["session"], "--environment", spec["environment"],
            "--store", opts["config"]["review"]["store"], "--project-id", opts["config"]["project_id"],
            "--cwd", opts["cwd"]]
    if spec.get("root"):
        args += ["--root", spec["root"]]
    if spec.get("target"):
        args += ["--target", spec["target"]]
    if spec.get("cmd"):
        args += ["--spawn", json.dumps(spec["cmd"])]
    child = subprocess.Popen(args, **popen_kwargs)
    if not _wait_until(lambda: _health(spec["url"]), 15.0):
        _kill_tree(child.pid)
        raise CliError(Exit.SERVER, f"server did not become healthy at {spec['url']}")
    state = _server_state(spec, opts, child.pid)
    _write_state(opts["cwd"], state)
    if opts.get("format") == "text":
        return {"stdout": f"server running at {spec['url']} (pid {child.pid})\n", "exit": Exit.OK}
    return {"stdout": canonical_json(state) + "\n", "exit": Exit.OK}


def op_live_start(opts: dict, spec: dict) -> dict:
    config = opts["config"]
    host = spec.get("host") or config["review"]["host"]
    port = spec.get("port") or config["review"]["port"]
    session = spec.get("session") or "default"
    environment = spec.get("environment") or "live"
    target = spec.get("url") or f"http://127.0.0.1:{spec.get('target_port') or 3000}"
    url = f"http://{'127.0.0.1' if host == '0.0.0.0' else host}:{port}"
    plan = {
        "action": "start",
        "kind": "live",
        "mode": "spawn" if spec.get("cmd") else "proxy",
        "target": target,
        "host": host,
        "port": port,
        "session_id": session,
        "environment": environment,
        "url": url,
    }
    if spec.get("cmd"):
        plan["command"] = spec["cmd"]
    return start_server(opts, {
        **spec, "mode": "live", "host": host, "port": port, "session": session,
        "environment": environment, "target": target, "url": url, "root": None, "plan": plan,
    })


def op_live_status(opts: dict) -> dict:
    state_path = Path(opts["cwd"]) / SERVER_STATE_FILE
    stopped = {"state": "stopped"}
    if not state_path.exists():
        return {"stdout": canonical_json(stopped) + "\n", "exit": Exit.OK} if opts.get("format") == "json" \
            else {"stdout": "stopped\n", "exit": Exit.OK}
    state = json.loads(state_path.read_text(encoding="utf-8"))
    if not _health(state["url"]):
        return {"stdout": canonical_json(stopped) + "\n", "exit": Exit.OK} if opts.get("format") != "json" \
            else {"stdout": canonical_json(stopped) + "\n", "exit": Exit.OK}
    store = load_store(opts["cwd"], opts["config"])
    result = {"state": "running", **state, "feedback_count": len(store["feedback"])}
    if opts.get("format") == "json":
        return {"stdout": canonical_json(result) + "\n", "exit": Exit.OK}
    lines = [
        "state: running",
        f"url: {state['url']}",
        f"session: {state['session_id']}",
        f"feedback: {len(store['feedback'])}",
    ]
    return {"stdout": "\n".join(lines) + "\n", "exit": Exit.OK}


def op_live_stop(opts: dict) -> dict:
    state_path = Path(opts["cwd"]) / SERVER_STATE_FILE
    if not state_path.exists():
        if opts.get("format") == "json":
            return {"stdout": canonical_json({"stopped": False, "reason": "not running"}) + "\n", "exit": Exit.OK}
        return {"stdout": "not running\n", "exit": Exit.OK}
    state = json.loads(state_path.read_text(encoding="utf-8"))
    _kill_tree(state.get("pid"))
    if state.get("app_pid"):
        _kill_tree(state.get("app_pid"))
    state_path.unlink()
    if opts.get("format") == "json":
        return {"stdout": canonical_json({"stopped": True, "pid": state["pid"]}) + "\n", "exit": Exit.OK}
    return {"stdout": f"stopped (pid {state['pid']})\n", "exit": Exit.OK}


def _spawn_detached(cmd: str, cwd: str) -> int:
    if sys.platform == "win32":
        child = subprocess.Popen(["cmd.exe", "/d", "/s", "/c", cmd], cwd=cwd,
                                 creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        child = subprocess.Popen(["/bin/sh", "-c", cmd], cwd=cwd, start_new_session=True,
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return child.pid


def _kill_tree(pid) -> None:
    if pid is None:
        return
    try:
        if sys.platform == "win32":
            subprocess.Popen(["taskkill", "/PID", str(pid), "/T", "/F"],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            try:
                os.killpg(os.getpgid(pid), 15)
            except Exception:
                os.kill(pid, 15)
    except Exception:
        pass


def _wait_until(fn, timeout_seconds: float) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while True:
        try:
            if fn():
                return True
        except Exception:
            pass
        if time.monotonic() > deadline:
            return False
        time.sleep(0.25)
