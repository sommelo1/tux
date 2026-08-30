"""Process-level integration tests for `tux live start-review/status/stop-review`
— mirror of js/test/live.test.js."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
PY_ROOT = REPO / "py"


def tux(args: list[str], cwd: Path, timeout: int = 90):
    return subprocess.run(
        [sys.executable, "-m", "tux", *args],
        cwd=str(cwd), capture_output=True, text=True, timeout=timeout,
    )


def wait_for(url: str, timeout_s: float = 20.0) -> None:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status == 200:
                    return
        except Exception:
            time.sleep(0.2)
    raise RuntimeError(f"not ready: {url}")


@pytest.fixture()
def app_server():
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):
            body = b'<!doctype html><html><head><title>App</title></head><body><h1 id="h">App</h1></body></html>'
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield srv
    srv.shutdown()
    srv.server_close()


def test_review_lifecycle(app_server, tmp_path: Path):
    work = tmp_path
    port = 4188
    config = {
        "project_id": "review-test",
        "review": {"enabled": True, "store": ".tux/feedback.json", "host": "127.0.0.1", "port": port},
    }
    (work / "tux.config.json").write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8", newline="\n")
    target = f"http://127.0.0.1:{app_server.server_address[1]}"

    started = tux(["live", "start-review", "--url", target, "--port", str(port), "--session", "integration"], work)
    assert started.returncode == 0, started.stderr
    state = json.loads(started.stdout)
    assert state["session_id"] == "integration"
    try:
        wait_for(f"http://127.0.0.1:{port}/api/tux/health")

        with urllib.request.urlopen(f"http://127.0.0.1:{port}/") as r:
            html = r.read().decode("utf-8")
        assert '<h1 id="h">App</h1>' in html
        assert "/__tux__/bootstrap.js" in html

        req = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/tux/feedback", method="POST",
            data=json.dumps({"type": "issue", "text": "Persist me",
                             "location": {"route": "/"}, "target": {"tux_id": "h"}}).encode(),
            headers={"Content-Type": "application/json", "X-TUX-User-Id": "usr_it", "X-TUX-Display-Name": "IT"},
        )
        with urllib.request.urlopen(req) as r:
            assert r.status == 201
        assert (work / ".tux" / "feedback.json").exists()

        status1 = json.loads(tux(["live", "status", "--format", "json"], work).stdout)
        assert status1["state"] == "running"
        assert status1["feedback_count"] == 1
    finally:
        stopped = tux(["live", "stop-review", "--format", "json"], work)
        assert stopped.returncode == 0
    assert json.loads(stopped.stdout)["stopped"] is True
    time.sleep(0.5)
    status2 = json.loads(tux(["live", "status", "--format", "json"], work).stdout)
    assert status2["state"] == "stopped"
    store = json.loads((work / ".tux" / "feedback.json").read_text(encoding="utf-8"))
    assert store["feedback"][0]["feedback"]["text"] == "Persist me"

    # restart picks persisted feedback up (SPC 85)
    again = tux(["live", "start-review", "--url", target, "--port", str(port)], work)
    assert again.returncode == 0, again.stderr
    try:
        wait_for(f"http://127.0.0.1:{port}/api/tux/health")
        status3 = json.loads(tux(["live", "status", "--format", "json"], work).stdout)
        assert status3["feedback_count"] == 1
    finally:
        tux(["live", "stop-review"], work)


def test_review_start_dry_run(tmp_path: Path):
    r = tux(["live", "start-review", "--url", "http://localhost:3000", "--dry-run", "--format", "json"], tmp_path)
    assert r.returncode == 0
    plan = json.loads(r.stdout)
    assert plan["action"] == "start"
    assert plan["mode"] == "proxy"
    assert plan["target"] == "http://localhost:3000"
    assert not (tmp_path / ".tux" / "server.json").exists()


def test_proxy_forwards_target_errors_as_is(app_server, tmp_path: Path):
    """Target 4xx/5xx are valid responses - forwarded with client injection
    (only transport failures become 502). Py engine matches the JS engine
    (fetch-based), SPC transparency."""
    work = tmp_path
    port = 4189

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):
            if self.path.startswith("/missing"):
                body = b'<!doctype html><html><head><title>Oops</title></head><body><h1 id="e">Missing</h1></body></html>'
                self.send_response(404)
            else:
                body = b'<!doctype html><html><head><title>App</title></head><body><h1 id="h">App</h1></body></html>'
                self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    target = f"http://127.0.0.1:{srv.server_address[1]}"

    config = {
        "project_id": "proxy-err-test",
        "review": {"enabled": True, "store": ".tux/feedback.json", "host": "127.0.0.1", "port": port},
    }
    (work / "tux.config.json").write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8", newline="\n")

    started = tux(["live", "start-review", "--url", target, "--port", str(port)], work)
    assert started.returncode == 0, started.stderr
    try:
        wait_for(f"http://127.0.0.1:{port}/api/tux/health")

        # 200 page: injected as usual
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/") as r:
            html = r.read().decode("utf-8")
        assert "/__tux__/bootstrap.js" in html

        # 404 page: forwarded as 404 (NOT 502) and still carries the client
        raised = False
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/missing-page")
        except urllib.error.HTTPError as e:
            raised = True
            assert e.code == 404, f"expected passthrough 404, got {e.code}"
            html = e.read().decode("utf-8")
            assert "/__tux__/bootstrap.js" in html
        assert raised, "target 404 must pass through as HTTPError"
    finally:
        tux(["live", "stop-review"], work)
