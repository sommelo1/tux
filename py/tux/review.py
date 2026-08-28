"""``tux review <action>`` — integrate, start, status, stop (SPC sections 32–41)."""
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


def op_review_integrate(opts: dict) -> dict:
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
        "action": "integrate",
        "kind": "review",
        "strategy": "proxy",
        "runtime": "node" if has_pkg else "static",
        "framework": framework,
        "dev_command": dev_command,
        "dev_port": dev_port if has_pkg else None,
        "next": [f"tux review start --url http://localhost:{dev_port if has_pkg else 8123}"],
    }
    if opts.get("format") == "text":
        lines = [
            f"integrated live review (strategy {report['strategy']}, framework {framework})",
            f"next: {' | '.join(report['next'])}",
        ]
        return {"stdout": "\n".join(lines) + "\n", "exit": Exit.OK}
    return {"stdout": canonical_json(report) + "\n", "exit": Exit.OK}


def op_review_start(opts: dict, spec: dict) -> dict:
    from .server import start_server
    config = opts["config"]
    host = spec.get("host") or config["review"]["host"]
    port = spec.get("port") or config["review"]["port"]
    session = spec.get("session") or "default"
    environment = spec.get("environment") or "development"
    mode = "spawn" if spec.get("cmd") else "proxy"
    target = spec.get("url") or f"http://127.0.0.1:{spec.get('target_port') or 3000}"
    url = f"http://{'127.0.0.1' if host == '0.0.0.0' else host}:{port}"
    plan = {
        "action": "start",
        "kind": "review",
        "mode": mode,
        "target": target,
        "host": host,
        "port": port,
        "session_id": session,
        "environment": environment,
        "url": url,
    }
    if spec.get("cmd"):
        plan["command"] = spec["cmd"]
    if spec.get("dry_run"):
        return {"stdout": canonical_json(plan) + "\n", "exit": Exit.OK}

    (Path(opts["cwd"]) / ".tux").mkdir(parents=True, exist_ok=True)
    app_pid = None
    if spec.get("cmd"):
        app_pid = _spawn_detached(spec["cmd"], opts["cwd"])
        if not _wait_until(lambda: _health(target), 30.0):
            _kill_tree(app_pid)
            raise CliError(Exit.SERVER, f"target application did not become reachable at {target}")

    if spec.get("foreground"):
        server = start_server(
            mode="review", host=host, port=port, root=None, target=target, cwd=opts["cwd"],
            session=session, environment=environment, config=config,
        )
        state = {
            "pid": os.getpid(),
            "mode": mode,
            "url": url,
            "target_url": target,
            "host": host,
            "port": port,
            "session_id": session,
            "environment": environment,
            "project_id": config["project_id"],
            "store": config["review"]["store"],
            "started_at": canonical_timestamp(int(time.time() * 1000)),
        }
        state_path = Path(opts["cwd"]) / SERVER_STATE_FILE
        state_path.write_text(canonical_json(state) + "\n", encoding="utf-8", newline="\n")
        return {"stdout": "", "exit": Exit.OK, "keep_alive": server}

    exe = Path(sys.executable)
    popen_kwargs = dict(stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if sys.platform == "win32":
        popen_kwargs["creationflags"] = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        popen_kwargs["start_new_session"] = True
    child = subprocess.Popen(
        [str(exe), "-m", "tux.serve_main", "--mode", "review", "--host", str(host), "--port", str(port),
         "--target", target, "--session", session, "--environment", environment,
         "--store", config["review"]["store"], "--project-id", config["project_id"], "--cwd", opts["cwd"]],
        **popen_kwargs,
    )
    deadline = 15.0
    ok = _wait_until(lambda: _health(url), deadline)
    if not ok:
        _kill_tree(child.pid)
        raise CliError(Exit.SERVER, f"review server did not become healthy at {url}")
    state = {
        "pid": child.pid,
        "mode": mode,
        "url": url,
        "target_url": target,
        "host": host,
        "port": port,
        "session_id": session,
        "environment": environment,
        "project_id": config["project_id"],
        "store": config["review"]["store"],
        "started_at": canonical_timestamp(int(time.time() * 1000)),
    }
    if app_pid is not None:
        full = {"pid": child.pid, "app_pid": app_pid, **{k: v for k, v in state.items() if k != "pid"}}
        state = full
    (Path(opts["cwd"]) / SERVER_STATE_FILE).write_text(canonical_json(state) + "\n", encoding="utf-8", newline="\n")
    if opts.get("format") == "text":
        return {"stdout": f"review server running at {url} (pid {child.pid})\n", "exit": Exit.OK}
    return {"stdout": canonical_json(state) + "\n", "exit": Exit.OK}


def op_review_status(opts: dict) -> dict:
    state_path = Path(opts["cwd"]) / SERVER_STATE_FILE
    if not state_path.exists():
        return {"stdout": "stopped\n", "exit": Exit.OK} if opts.get("format") != "json" \
            else {"stdout": canonical_json({"state": "stopped"}) + "\n", "exit": Exit.OK}
    state = json.loads(state_path.read_text(encoding="utf-8"))
    if not _health(state["url"]):
        return {"stdout": "stopped\n", "exit": Exit.OK} if opts.get("format") != "json" \
            else {"stdout": canonical_json({"state": "stopped"}) + "\n", "exit": Exit.OK}
    store = load_store(opts["cwd"], opts["config"])
    result = {"state": "running", **state, "feedback_count": len(store["feedback"])}
    if opts.get("format") == "json":
        return {"stdout": canonical_json(result) + "\n", "exit": Exit.OK}
    lines = [
        "state: running",
        f"url: {state['url']}",
        f"target: {state['target_url']}",
        f"session: {state['session_id']}",
        f"feedback: {len(store['feedback'])}",
    ]
    return {"stdout": "\n".join(lines) + "\n", "exit": Exit.OK}


def op_review_stop(opts: dict) -> dict:
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
