"""Deterministic identifiers and timestamps.

IDs are ULIDs (Crockford base32, 26 chars): 48-bit millisecond timestamp
plus 80-bit entropy. For cross-runtime byte-identical output the
timestamp comes from ``TUX_TIME_OVERRIDE`` (ISO 8601; naive values are
treated as UTC) and the entropy is the first 10 bytes of
``SHA-256("<project_id>|<session_id>|<seq>|<kind>")`` where ``seq`` is
the 1-based next sequence number in the target store.
"""
from __future__ import annotations

import hashlib
import os
import re
from datetime import datetime, timedelta, timezone

from .errors import CliError, Exit

CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
_OFFSET_TAIL = re.compile(r"(?:[zZ]|[+-]\d{2}:?\d{2})$")


def now_ms() -> int:
    """Resolve the effective "now" in epoch milliseconds."""
    override = os.environ.get("TUX_TIME_OVERRIDE")
    if override is None:
        return int(datetime.now(tz=timezone.utc).timestamp() * 1000)
    s = override.strip()
    if not _OFFSET_TAIL.search(s):
        s += "Z"
    if s.endswith(("z", "Z")):
        s = s[:-1] + "+00:00"
    s = re.sub(r"([+-]\d{2})(\d{2})$", r"\1:\2", s)
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        raise CliError(Exit.CONFIG, f"invalid TUX_TIME_OVERRIDE: {override}")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return _to_ms(dt)


def _to_ms(dt: datetime) -> int:
    return (dt - _EPOCH) // timedelta(milliseconds=1)


def canonical_timestamp(ms: int) -> str:
    """Canonical UTC timestamp with millisecond precision."""
    dt = _EPOCH + timedelta(milliseconds=ms)
    return dt.strftime("%Y-%m-%dT%H:%M:%S") + f".{ms % 1000:03d}Z"


def deterministic_entropy(project_id: str, session_id: str, seq: int, kind: str) -> bytes:
    """80-bit entropy bytes derived deterministically from context."""
    material = f"{project_id}|{session_id}|{seq}|{kind}"
    return hashlib.sha256(material.encode("utf-8")).digest()[:10]


def ulid(time_ms: int, entropy: bytes) -> str:
    """Encode 16 bytes (6 time + 10 entropy) as a 26-char Crockford ULID."""
    buf = time_ms.to_bytes(6, "big") + entropy
    n = int.from_bytes(buf, "big")
    out = []
    for _ in range(26):
        out.append(CROCKFORD[n % 32])
        n //= 32
    return "".join(reversed(out))


def new_id(prefix: str, project_id: str, session_id: str, seq: int, kind: str, time_ms: int) -> str:
    """Deterministic prefixed ID (``fb_…``, ``batch_…``)."""
    return f"{prefix}_{ulid(time_ms, deterministic_entropy(project_id, session_id, seq, kind))}"
