"""CLI error carrying a canonical exit code (SPC section 75)."""
from __future__ import annotations


class Exit:
    OK = 0
    GENERAL = 1
    USAGE = 2
    CONFIG = 3
    SERVER = 4
    AUTHORIZATION = 5
    NOT_FOUND = 6
    CONFLICT = 7


class CliError(Exception):
    """Error with a canonical exit code; message printed as ``error: …``."""

    def __init__(self, code: int, message: str) -> None:
        super().__init__(message)
        self.code = code
