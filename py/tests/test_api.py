"""Server API tests (design mode) for the Python server — mirror of
js/test/api.test.js."""
from __future__ import annotations

import json
import threading
import urllib.request
from pathlib import Path

import pytest

from tux.server import start_server


@pytest.fixture()
def server(tmp_path: Path):
    (tmp_path / "index.html").write_text(
        '<!doctype html><html><head><title>D</title></head><body><h1 data-tux-id="hero">Hello</h1></body></html>',
        encoding="utf-8", newline="\n",
    )
    config = {
        "project_id": "p-api",
        "review": {"enabled": True, "store": ".tux/feedback.json", "host": "127.0.0.1", "port": 0},
        "identity": {"provider": "local", "user_id": "srv", "display_name": "Server", "admins": ["usr_admin"]},
    }
    srv = start_server(mode="design", host="127.0.0.1", port=0, root=str(tmp_path), target=None,
                       cwd=str(tmp_path), config=config, session="test-session", environment="design")
    thread = threading.Thread(target=srv.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    yield base, tmp_path
    srv.shutdown()
    srv.server_close()


def _call(base: str, path: str, method: str = "GET", user: str | None = None, body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if user:
        req.add_header("X-TUX-User-Id", user)
        req.add_header("X-TUX-Display-Name", "Admin" if user == "usr_admin" else "User")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode("utf-8")), r
    except urllib.error.HTTPError as e:
        payload = e.read().decode("utf-8")
        try:
            return e.code, json.loads(payload), e
        except json.JSONDecodeError:
            return e.code, None, e


def test_health_and_session(server):
    base, _ = server
    status, data, _ = _call(base, "/api/tux/health")
    assert status == 200 and data["status"] == "ok" and data["session_id"] == "test-session"
    status, data, _ = _call(base, "/api/tux/session")
    assert status == 200 and data["project_id"] == "p-api" and data["environment"] == "design"


def test_static_injection_and_bootstrap(server):
    base, _ = server
    with urllib.request.urlopen(base + "/") as r:
        html = r.read().decode("utf-8")
    assert '<script src="/__tux__/bootstrap.js"></script><script type="module" src="/__tux__/client.js"></script></head>' in html
    with urllib.request.urlopen(base + "/__tux__/bootstrap.js") as r:
        bootstrap = r.read().decode("utf-8")
    assert bootstrap.startswith('window.__TUX__ = {')
    assert '"enabled":true' in bootstrap and '"user":"srv"' in bootstrap and '"session":"test-session"' in bootstrap
    with urllib.request.urlopen(base + "/__tux__/client.js") as r:
        assert b"TUX Review Client" in r.read()


def test_static_unknown_route_returns_clean_404(server):
    base, _ = server
    try:
        urllib.request.urlopen(base + "/definitely-missing.png")
        raise AssertionError("expected HTTP 404")
    except urllib.error.HTTPError as e:
        assert e.code == 404
        body = e.read()
        assert body == b"not found"
        # regression: HTTP/1.1 keep-alive requires Content-Length on every response
        assert int(e.headers.get("Content-Length", "0")) == len(body)


def test_crud_and_authorization(server):
    base, root = server
    status, item, _ = _call(base, "/api/tux/feedback", "POST", "usr_a", {
        "type": "change", "text": "Make it pop", "location": {"route": "/checkout"},
        "target": {"tux_id": "cta"}, "ui_state": {"step": "1"},
    })
    assert status == 201
    assert item["author"]["user_id"] == "usr_a"
    assert item["origin"]["mode"] == "design"
    assert item["status"] == "open"

    status, listing, _ = _call(base, "/api/tux/feedback?route=%2Fcheckout")
    assert status == 200
    assert listing["schema_version"] == "1.0"
    assert len(listing["feedback"]) == 1
    assert listing["feedback"][0]["location"]["route"] == "/checkout"

    status, other, _ = _call(base, "/api/tux/feedback", "POST", "usr_a",
                             {"type": "issue", "text": "x"})
    assert status == 403 if False else status == 201
    fid = other["id"]
    status, _, _ = _call(base, f"/api/tux/feedback/{fid}", "PATCH", "usr_b", {"text": "hijack"})
    assert status == 403
    status, patched, _ = _call(base, f"/api/tux/feedback/{fid}", "PATCH", "usr_a", {"text": "updated"})
    assert status == 200 and patched["feedback"]["text"] == "updated"

    status, del_a, _ = _call(base, "/api/tux/feedback", "POST", "usr_a", {"type": "issue", "text": "del-a"})
    status, del_b, _ = _call(base, "/api/tux/feedback", "POST", "usr_b", {"type": "issue", "text": "del-b"})
    assert _call(base, f"/api/tux/feedback/{del_a['id']}", "DELETE", "usr_b")[0] == 403
    assert _call(base, f"/api/tux/feedback/{del_a['id']}", "DELETE", "usr_a")[0] == 200
    assert _call(base, f"/api/tux/feedback/{del_b['id']}", "DELETE", "usr_admin")[0] == 200

    status, bad, _ = _call(base, "/api/tux/feedback", "POST", "usr_a", {"type": "bogus", "text": "x"})
    assert status == 400


def test_clear_scopes(server):
    base, root = server
    _call(base, "/api/tux/feedback", "POST", "usr_a", {"type": "issue", "text": "ca"})
    _call(base, "/api/tux/feedback", "POST", "usr_b", {"type": "issue", "text": "cb"})
    status, mine, _ = _call(base, "/api/tux/feedback/clear", "POST", "usr_a", {"scope": "mine"})
    assert status == 200 and mine["cleared"] >= 1
    status, listing, _ = _call(base, "/api/tux/feedback")
    assert all(f["author"]["user_id"] != "usr_a" for f in listing["feedback"])
    status, _, _ = _call(base, "/api/tux/feedback/clear", "POST", "usr_a", {"scope": "all"})
    assert status == 403
    status, all_cleared, _ = _call(base, "/api/tux/feedback/clear", "POST", "usr_admin", {"scope": "all"})
    assert status == 200 and all_cleared["cleared"] >= 1
    status, empty, _ = _call(base, "/api/tux/feedback")
    assert empty["feedback"] == []
