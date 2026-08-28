"""TUX review/design server (framework-agnostic, stdlib only).

Two modes:
- ``design``: serves a static design directory from disk, injecting the
  Review Client into every HTML response.
- ``review``: reverse-proxies an existing application, injecting the
  Review Client into HTML responses on the way through.

Endpoints mirror ``js/src/server.js`` byte-for-byte where responses are
data (canonical JSON, same bootstrap literal).
"""
from __future__ import annotations

import json
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .canonical import canonical_json, compact_json
from .ids import canonical_timestamp, new_id, now_ms
from .schema import FEEDBACK_TYPES, SCHEMA_VERSION, make_feedback
from .store import ensure_session, load_store, save_store


class ServerState:
    def __init__(self, mode, host, port, root, target, cwd, config, session, environment):
        self.mode = mode
        self.host = host
        self.port = port
        self.root = str(Path(cwd, root).resolve()) if root else None
        self.target = target
        self.cwd = cwd
        self.config = config
        self.session = session
        self.environment = environment
        self.started_at = canonical_timestamp(now_ms())
        from .config import resolve_identity
        self.identity = resolve_identity(config)

    def is_admin(self, user_id: str) -> bool:
        return user_id in (self.identity.get("admins") or [])


def start_server(mode, host, port, root, target, cwd, config, session, environment) -> ThreadingHTTPServer:
    state = ServerState(mode, host, port, root, target, cwd, config, session, environment)
    ensure_session(state.cwd, state.config, state.session, state.environment, state.started_at)

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *args):  # silence per-request stderr noise
            pass

        def do_GET(self):
            self._handle("GET")

        def do_POST(self):
            self._handle("POST")

        def do_PATCH(self):
            self._handle("PATCH")

        def do_DELETE(self):
            self._handle("DELETE")

        def _handle(self, method):
            try:
                _route(state, self, method)
            except BrokenPipeError:
                pass
            except Exception as exc:  # pragma: no cover
                _send_json(self, 500, {"error": {"code": "internal", "message": str(exc)}})

    server = ThreadingHTTPServer((host, port), Handler)
    return server


def _identity_of(state: ServerState, handler: BaseHTTPRequestHandler) -> dict:
    user_id = handler.headers.get("X-TUX-User-Id") or state.identity["user_id"]
    display_name = handler.headers.get("X-TUX-Display-Name") or state.identity["display_name"]
    return {"user_id": str(user_id), "display_name": str(display_name)}


def _route(state: ServerState, handler: BaseHTTPRequestHandler, method: str) -> None:
    url = urlparse(handler.path)
    path = url.path

    if path == "/api/tux/health" and method == "GET":
        return _send_json(handler, 200, {"status": "ok", "mode": state.mode, "session_id": state.session})
    if path.startswith("/api/tux/"):
        return _api(state, handler, method, path, url.query)
    if path.startswith("/__tux__/"):
        return _assets(state, handler, path)
    if state.mode == "design":
        return _static(state, handler, path)
    return _proxy(state, handler)


def _api(state, handler, method, path, query):
    from urllib.parse import parse_qs
    identity = _identity_of(state, handler)

    if path == "/api/tux/session" and method == "GET":
        return _send_json(handler, 200, {
            "session_id": state.session,
            "project_id": state.config["project_id"],
            "environment": state.environment,
            "status": "active",
        })

    if path == "/api/tux/feedback" and method == "GET":
        store = load_store(state.cwd, state.config)
        items = store["feedback"]
        q = parse_qs(query)
        if q.get("route"):
            items = [f for f in items if (f.get("location") or {}).get("route") == q["route"][0]]
        if q.get("status"):
            items = [f for f in items if f["status"] == q["status"][0]]
        if q.get("type"):
            items = [f for f in items if f["feedback"]["type"] == q["type"][0]]
        if q.get("session"):
            items = [f for f in items if f["session_id"] == q["session"][0]]
        if q.get("mine", [None])[0] in ("1", "true"):
            items = [f for f in items if f["author"]["user_id"] == identity["user_id"]]
        return _send_json(handler, 200, {
            "schema_version": SCHEMA_VERSION, "project_id": store["project_id"], "feedback": items,
        })

    if path == "/api/tux/feedback" and method == "POST":
        data = _read_json(handler)
        ftype = data.get("type") or "issue"
        if ftype not in FEEDBACK_TYPES:
            return _send_json(handler, 400, {"error": {"code": "invalid", "message": f"invalid feedback type: {ftype}"}})
        text = data.get("text") if isinstance(data.get("text"), str) else ""
        if text.strip() == "":
            return _send_json(handler, 400, {"error": {"code": "invalid", "message": "text is required"}})
        store = load_store(state.cwd, state.config)
        session = data.get("session_id") or state.session
        seq = len(store["feedback"]) + 1
        item = make_feedback({
            "id": new_id("fb", store["project_id"], session, seq, "feedback", now_ms()),
            "project_id": store["project_id"],
            "session_id": session,
            "author": identity,
            "origin": "design" if state.mode == "design" else "live",
            "location": data.get("location") or {},
            "target": data.get("target") or {},
            "ui_state": data.get("ui_state") or {},
            "type": ftype,
            "text": text,
            "created_at": canonical_timestamp(now_ms()),
        })
        store["feedback"].append(item)
        save_store(state.cwd, state.config, store)
        return _send_json(handler, 201, item)

    if path.startswith("/api/tux/feedback/"):
        rest = path[len("/api/tux/feedback/"):]
        if rest == "clear" and method == "POST":
            data = _read_json(handler)
            scope = data.get("scope")
            if scope not in ("mine", "all"):
                return _send_json(handler, 400, {"error": {"code": "invalid", "message": 'scope must be "mine" or "all"'}})
            if scope == "all" and not state.is_admin(identity["user_id"]):
                return _send_json(handler, 403, {"error": {"code": "forbidden", "message": "clearing all feedback requires admin"}})
            route = data.get("route")
            session = data.get("session")
            store = load_store(state.cwd, state.config)
            before = len(store["feedback"])

            def keep(f):
                if scope == "mine" and f["author"]["user_id"] != identity["user_id"]:
                    return True
                if route and (f.get("location") or {}).get("route") != route:
                    return True
                if session and f["session_id"] != session:
                    return True
                return False

            store["feedback"] = [f for f in store["feedback"] if keep(f)]
            cleared = before - len(store["feedback"])
            save_store(state.cwd, state.config, store)
            return _send_json(handler, 200, {"cleared": cleared})

        feedback_id = rest
        store = load_store(state.cwd, state.config)
        idx = next((i for i, f in enumerate(store["feedback"]) if f["id"] == feedback_id), None)
        if idx is None:
            return _send_json(handler, 404, {"error": {"code": "not_found", "message": f"feedback not found: {feedback_id}"}})
        item = store["feedback"][idx]
        if method == "GET":
            return _send_json(handler, 200, item)
        if method == "PATCH":
            if item["author"]["user_id"] != identity["user_id"]:
                return _send_json(handler, 403, {"error": {"code": "forbidden", "message": "only the author may update this feedback"}})
            patch = _read_json(handler)
            if isinstance(patch.get("text"), str):
                item["feedback"]["text"] = patch["text"]
            if "type" in patch and patch["type"] is not None:
                if patch["type"] not in FEEDBACK_TYPES:
                    return _send_json(handler, 400, {"error": {"code": "invalid", "message": f"invalid feedback type: {patch['type']}"}})
                item["feedback"]["type"] = patch["type"]
            item["updated_at"] = canonical_timestamp(now_ms())
            save_store(state.cwd, state.config, store)
            return _send_json(handler, 200, item)
        if method == "DELETE":
            owner = item["author"]["user_id"] == identity["user_id"]
            if not owner and not state.is_admin(identity["user_id"]):
                return _send_json(handler, 403, {"error": {"code": "forbidden", "message": "only the author or an admin may delete this feedback"}})
            store["feedback"].pop(idx)
            save_store(state.cwd, state.config, store)
            return _send_json(handler, 200, {"deleted": [feedback_id]})

    return _send_json(handler, 404, {"error": {"code": "not_found", "message": f"unknown API path: {path}"}})


def _assets(state, handler, path):
    client_dir = Path(__file__).resolve().parent / "client"
    if path == "/__tux__/bootstrap.js":
        payload = {
            "enabled": state.config.get("review", {}).get("enabled") is not False,  # startup configuration (SPC 64–65)
            "build": "included",
            "mode": state.mode,
            "apiBase": "/api/tux",
            "session": state.session,
            "environment": state.environment,
            "user": state.identity["user_id"],
            "displayName": state.identity["display_name"],
            "project": state.config["project_id"],
        }
        body = f"window.__TUX__ = {compact_json(payload)};\n"
        return _send_bytes(handler, 200, body.encode("utf-8"), "text/javascript; charset=utf-8")
    if path == "/__tux__/client.js" or path == "/__tux__/client.css":
        name = "tux-review.js" if path.endswith(".js") else "tux-review.css"
        f = client_dir / name
        if not f.exists():
            return _send_bytes(handler, 404, b"not found", "text/plain")
        ctype = "text/javascript; charset=utf-8" if name.endswith(".js") else "text/css; charset=utf-8"
        return _send_bytes(handler, 200, f.read_bytes(), ctype)
    return _send_bytes(handler, 404, b"not found", "text/plain")


def _static(state, handler, path):
    from urllib.parse import unquote
    rel = unquote(path).lstrip("/\\")
    if rel == "":
        rel = "index.html"
    base = Path(state.root)
    file = (base / rel).resolve()
    if not str(file).startswith(str(base)):
        return _send_bytes(handler, 403, b"forbidden", "text/plain")
    if not file.exists() or file.is_dir():
        for candidate in [file / "index.html", Path(str(file) + ".html")]:
            if candidate.exists() and candidate.is_file():
                file = candidate
                break
        else:
            if not Path(path).suffix:
                file = base / "index.html"  # SPA fallback
            if not file.exists():
                return _send_bytes(handler, 404, b"not found", "text/plain")
    ctype = _MIME.get(file.suffix, "application/octet-stream")
    body = file.read_bytes()
    if ctype.startswith("text/html"):
        return _send_bytes(handler, 200, inject(body.decode("utf-8")).encode("utf-8"), ctype)
    return _send_bytes(handler, 200, body, ctype)


def _proxy(state, handler):
    target = urlparse(state.target)
    length = int(handler.headers.get("Content-Length") or 0)
    body = handler.rfile.read(length) if length else None
    req = urllib.request.Request(
        state.target.rstrip("/") + handler.path,
        data=body,
        method=handler.command,
        headers={k: v for k, v in handler.headers.items() if k.lower() != "host"},
    )
    try:
        with urllib.request.urlopen(req) as up:
            ctype = up.headers.get("Content-Type") or ""
            payload = up.read()
            status = up.status
            headers = dict(up.headers)
    except Exception as exc:
        return _send_json(handler, 502, {"error": {"code": "bad_gateway", "message": f"target unreachable: {exc}"}})
    if ctype.startswith("text/html"):
        handler.send_response(status)
        handler.send_header("Content-Type", ctype)
        handler.send_header("Cache-Control", "no-store")
        handler.end_headers()
        handler.wfile.write(inject(payload.decode("utf-8", "replace")).encode("utf-8"))
        return
    handler.send_response(status)
    for k, v in headers.items():
        if k.lower() in ("content-type", "cache-control", "location"):
            handler.send_header(k, v)
    handler.end_headers()
    handler.wfile.write(payload)


def inject(html: str) -> str:
    """Inject the TUX bootstrap + client into an HTML document."""
    tags = '<script src="/__tux__/bootstrap.js"></script><script type="module" src="/__tux__/client.js"></script>'
    import re
    if re.search(r"</head>", html, re.I):
        return re.sub(r"</head>", f"{tags}</head>", html, count=1, flags=re.I)
    if re.search(r"</body>", html, re.I):
        return re.sub(r"</body>", f"{tags}</body>", html, count=1, flags=re.I)
    return html + tags


def _read_json(handler) -> dict:
    length = int(handler.headers.get("Content-Length") or 0)
    raw = handler.rfile.read(length) if length else b""
    if raw == b"":
        return {}
    try:
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError:
        return {"__error__": "invalid JSON"}


def _send_json(handler, status: int, data) -> None:
    _send_bytes(handler, status, canonical_json(data).encode("utf-8"), "application/json; charset=utf-8")


def _send_bytes(handler, status: int, body: bytes, ctype: str) -> None:
    handler.send_response(status)
    handler.send_header("Content-Type", ctype)
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    if handler.command != "HEAD":
        handler.wfile.write(body)


_MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".map": "application/json",
}
