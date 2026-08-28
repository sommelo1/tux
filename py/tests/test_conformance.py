"""Conformance runner (mirror of js/test/conformance.test.js).

Walks every directory under ``conformance/`` containing a ``case.json``,
materializes the case in a fresh temp directory, runs the CLI and
compares exit code, stdout, stderr and post-run files byte-for-byte with
the frozen expectations. The fixtures are the source of truth.
"""
from __future__ import annotations

import json
import os
import shutil
import tempfile
from pathlib import Path

from tux.cli import run

CONF_ROOT = Path(__file__).resolve().parents[2] / "conformance"


def collect_cases(root: Path) -> list[Path]:
    out: list[Path] = []
    for p in sorted(root.rglob("case.json")):
        out.append(p.parent)
    return sorted(set(out))


def diff_tree(want: Path, got: Path, prefix: str = "") -> list[str]:
    problems: list[str] = []
    if not want.exists():
        return problems
    for e in sorted(want.iterdir()):
        w = want / e
        g = got / e.name
        rel = f"{prefix}/{e.name}" if prefix else e.name
        if w.is_dir():
            if not g.exists():
                problems.append(f"missing file: {rel}")
            else:
                problems.extend(diff_tree(w, g, rel))
        else:
            if not g.exists():
                problems.append(f"missing file: {rel}")
                continue
            if w.read_bytes() != g.read_bytes():
                problems.append(f"byte-diff: {rel}")
    return problems


def test_conformance():
    cases = collect_cases(CONF_ROOT)
    assert cases, "no conformance cases found"
    failures: list[tuple[str, list[str]]] = []
    passed = 0
    for case_dir in cases:
        rel = str(case_dir.relative_to(CONF_ROOT))
        case_def = json.loads((case_dir / "case.json").read_text(encoding="utf-8"))
        work = Path(tempfile.mkdtemp(prefix="tux-conf-")) / "work"
        work.mkdir()
        for f, content in (case_def.get("files") or {}).items():
            p = work / f
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content, encoding="utf-8", newline="\n")
        for f, src in (case_def.get("include") or {}).items():
            p = work / f
            p.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(CONF_ROOT / src, p)
        prev_env = {}
        for k, v in (case_def.get("env") or {}).items():
            prev_env[k] = os.environ.get(k)
            os.environ[k] = v
        try:
            result = run(case_def["args"], {"cwd": str(work)})
        finally:
            for k in case_def.get("env") or {}:
                if prev_env[k] is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = prev_env[k]
        problems: list[str] = []
        expected = (case_dir / "expected.txt").read_text(encoding="utf-8")
        nl = expected.index("\n")
        want_exit = int(expected[:nl].replace("exit ", ""))
        want_out = expected[nl + 1:]
        if result["exit"] != want_exit:
            problems.append(f"exit: want {want_exit}, got {result['exit']}")
        if result["stdout"] != want_out:
            problems.append("stdout differs:")
            problems.append(f"  --- want ---\n{want_out}  --- got ----\n{result['stdout']}")
        err_path = case_dir / "expected.err"
        if err_path.exists():
            expected_err = err_path.read_text(encoding="utf-8")
            nl2 = expected_err.index("\n")
            want_err = expected_err[nl2 + 1:]
            if (result.get("stderr") or "") != want_err:
                problems.append("stderr differs:")
                problems.append(f"  --- want ---\n{want_err}  --- got ----\n{result.get('stderr') or ''}")
        elif result.get("stderr"):
            problems.append(f"unexpected stderr: {result['stderr']!r}")
        problems.extend(diff_tree(case_dir / "expected-files", work))
        shutil.rmtree(work.parent, ignore_errors=True)
        if problems:
            failures.append((rel, problems))
        else:
            passed += 1
    report = "\n".join(f"FAIL {rel}\n" + "\n".join("  " + p for p in probs) for rel, probs in failures)
    assert not failures, f"{len(failures)} conformance case(s) failed:\n{report}\n{passed}/{len(cases)} passed"
