"""Project configuration (``tux.config.json``) with canonical precedence:
CLI → environment → config file → defaults (SPC section 76)."""
from __future__ import annotations

import json
import os
from pathlib import Path

from .errors import CliError, Exit

CONFIG_FILE = "tux.config.json"


def default_config(cwd: str) -> dict:
    return {
        "project_id": Path(cwd).name,
        "design": {"root": "requirements", "framework": "vanilla"},
        "review": {"enabled": True, "store": ".tux/feedback.json", "host": "127.0.0.1", "port": 4173},
        "identity": {"provider": "local", "user_id": "anonymous", "display_name": "Anonymous", "admins": []},
    }


def _merge(target: dict, patch: dict) -> None:
    for key, value in (patch or {}).items():
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            _merge(target[key], value)
        else:
            target[key] = value


def load_config(cwd: str, cli_opts: dict | None = None):
    """Load configuration; returns ``(config, config_path)``."""
    cli_opts = cli_opts or {}
    config = default_config(cwd)
    config_path = cli_opts.get("config") or os.environ.get("TUX_CONFIG")
    if config_path is None and (Path(cwd) / CONFIG_FILE).exists():
        config_path = str(Path(cwd) / CONFIG_FILE)
    if config_path is not None:
        if not Path(config_path).exists():
            raise CliError(Exit.CONFIG, f"config file not found: {config_path}")
        try:
            parsed = json.loads(Path(config_path).read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise CliError(Exit.CONFIG, f"invalid config JSON in {config_path}: {e}")
        _merge(config, parsed)
    env = os.environ
    if env.get("TUX_PROJECT_ID") is not None:
        config["project_id"] = env["TUX_PROJECT_ID"]
    if env.get("TUX_STORE") is not None:
        config["review"]["store"] = env["TUX_STORE"]
    if env.get("TUX_HOST") is not None:
        config["review"]["host"] = env["TUX_HOST"]
    if env.get("TUX_PORT") is not None:
        config["review"]["port"] = int(env["TUX_PORT"])
    if env.get("TUX_USER_ID") is not None:
        config["identity"]["user_id"] = env["TUX_USER_ID"]
    if env.get("TUX_DISPLAY_NAME") is not None:
        config["identity"]["display_name"] = env["TUX_DISPLAY_NAME"]
    return config, config_path


def resolve_identity(config: dict) -> dict:
    identity = config["identity"]
    return {
        "user_id": identity.get("user_id") or "anonymous",
        "display_name": identity.get("display_name") or "Anonymous",
        "admins": identity.get("admins") or [],
    }
