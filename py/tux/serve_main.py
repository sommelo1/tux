"""Internal entry point for the detached server child process."""
from __future__ import annotations

import sys
from pathlib import Path

from .server import start_server


def _arg(name: str):
    argv = sys.argv
    return argv[argv.index(name) + 1] if name in argv else None


def main() -> None:
    cwd = _arg("--cwd") or str(Path.cwd())
    mode = _arg("--mode") or "design"
    host = _arg("--host") or "127.0.0.1"
    port = int(_arg("--port") or 4173)
    target = _arg("--target")
    session = _arg("--session") or "default"
    environment = _arg("--environment") or ("design" if mode == "design" else "development")
    store = _arg("--store") or ".tux/feedback.json"
    project_id = _arg("--project-id") or "default"

    import os
    config = {
        "project_id": project_id,
        "review": {"enabled": True, "store": store, "host": host, "port": port},
        "identity": {
            "provider": "local",
            "user_id": os.environ.get("TUX_USER_ID") or "anonymous",
            "display_name": os.environ.get("TUX_DISPLAY_NAME") or "Anonymous",
            "admins": [],
        },
    }
    server = start_server(
        mode=mode, host=host, port=port, root=_arg("--root"), target=target,
        cwd=cwd, config=config, session=session, environment=environment,
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
