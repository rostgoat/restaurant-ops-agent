"""
Writes two files for the site from the runs the changelog lists:
runs.json, one slim record per run with every case's outcome, and
traces.json, every run's full trace per case. The latest run's complete
copy stays in eval-run.json.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
CHANGELOG = ROOT / "web" / "src" / "content" / "changelog.json"
RUNS = ROOT / "api" / "evals" / "runs"
OUT = ROOT / "web" / "src" / "content" / "runs.json"
TRACES = ROOT / "web" / "src" / "content" / "traces.json"


def slim(entry: dict[str, Any], run: dict[str, Any]) -> dict[str, Any]:
    outcomes = {}

    for r in run["results"]:
        grade, trace = r["grade"], r["trace"]
        outcomes[r["case"]["id"]] = {
            "outcome": grade["outcome"],
            "status": trace["status"],
            "reasons": grade["reasons"],
            "expected": grade.get("expected"),
            "found": grade.get("found"),
            "cost_usd": trace["cost_usd"],
            "latency_ms": trace["latency_ms"],
        }
    summary = run["summary"]

    return {
        "run": entry["run"],
        "date": entry["date"],
        "retrieval_threshold": summary["retrieval_threshold"],
        "model": summary["model"],
        "passed": summary["passed"],
        "scored": summary["scored"],
        "outcomes": outcomes,
    }


def traces(run: dict[str, Any]) -> dict[str, Any]:
    return {r["case"]["id"]: r["trace"] for r in run["results"]}


def main() -> None:
    entries = json.loads(CHANGELOG.read_text())
    loaded = [(e, json.loads((RUNS / f"{e['run']}.json").read_text())) for e in entries]
    OUT.write_text(json.dumps([slim(e, run) for e, run in loaded], indent=1) + "\n")
    TRACES.write_text(json.dumps({e["run"]: traces(run) for e, run in loaded}) + "\n")
    print(f"wrote {OUT} and {TRACES} with {len(loaded)} runs")


if __name__ == "__main__":
    main()
