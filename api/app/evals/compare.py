"""
Put several run files side by side for the site.

    .venv/bin/python -m app.evals.compare \\
        "Sonnet 5.5"=evals/runs/a.json "Opus 5.5"=evals/runs/b.json

The first run named is the one the Evaluation page already shows in full;
the rest are the comparison. Output: web/src/content/eval-compare.json.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from .run import ROOT

OUT = ROOT / "web" / "src" / "content" / "eval-compare.json"


def load(label: str, path: Path) -> dict[str, Any]:
    run = json.loads(path.read_text())
    s = run["summary"]

    return {
        "label": label,
        "file": path.name,
        "model": s["model"],
        "effort": s["effort"],
        "retrieval_threshold": s["retrieval_threshold"],
        "cases": s["cases"],
        "scored": s["scored"],
        "passed": s["passed"],
        "errors": s["errors"],
        "suites": s["suites"],
        "cost_total_usd": s["cost_total_usd"],
        "cost_per_answered_median_usd": s["cost_per_answered_median_usd"],
        "latency_median_ms": s["latency_median_ms"],
        "latency_p90_ms": s["latency_p90_ms"],
        "retrieval": s["retrieval"],
        # Passed per repetition, when a run asked every case more than once.
        "reps": passes_per_rep(run["results"]),
        "outcomes": outcomes_by_case(run["results"]),
    }


def outcomes_by_case(results: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """One entry per case. With repetitions, the outcome is pass only if every rep passed."""
    out: dict[str, dict[str, Any]] = {}

    for r in results:
        case_id = r["case"]["id"]
        entry = out.setdefault(
            case_id, {"outcome": "pass", "reasons": [], "cost_usd": 0.0, "passes": 0, "reps": 0}
        )
        entry["reps"] += 1
        entry["passes"] += r["grade"]["outcome"] == "pass"
        entry["cost_usd"] += r["trace"]["cost_usd"]

        if r["grade"]["outcome"] != "pass":
            entry["outcome"] = r["grade"]["outcome"]
            entry["reasons"] = r["grade"]["reasons"]

    for entry in out.values():
        entry["cost_usd"] = round(entry["cost_usd"] / entry["reps"], 6)

    return out


def passes_per_rep(results: list[dict[str, Any]]) -> list[int]:
    by_rep: dict[int, int] = {}

    for r in results:
        rep = int(r.get("rep", 0))
        by_rep[rep] = by_rep.get(rep, 0) + (r["grade"]["outcome"] == "pass")

    return [by_rep[k] for k in sorted(by_rep)]


def compare(runs: list[dict[str, Any]]) -> dict[str, Any]:
    ids = list(dict.fromkeys(case_id for run in runs for case_id in run["outcomes"]))
    first = json.loads((ROOT / "api" / "evals" / "cases.json").read_text())["cases"]
    by_id = {c["id"]: c for c in first}
    cases = []

    for case_id in ids:
        outcomes = {r["label"]: r["outcomes"].get(case_id) for r in runs}
        verdicts = {o["outcome"] for o in outcomes.values() if o}
        cases.append(
            {
                "id": case_id,
                "suite": by_id.get(case_id, {}).get("suite"),
                "question": by_id.get(case_id, {}).get("question"),
                "outcomes": outcomes,
                "differs": len(verdicts) > 1,
            }
        )
    slim = [{k: v for k, v in r.items() if k != "outcomes"} for r in runs]

    return {"runs": slim, "cases": cases}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("runs", nargs="+", help='"Label"=path/to/run.json')
    args = ap.parse_args()
    runs = []

    for spec in args.runs:
        label, _, path = spec.partition("=")
        runs.append(load(label, Path(path)))
    out = compare(runs)
    OUT.write_text(json.dumps(out, indent=2) + "\n")

    for r in out["runs"]:
        print(f"{r['label']:24} {r['passed']}/{r['scored']}  ${r['cost_total_usd']}")
    print(f"{sum(c['differs'] for c in out['cases'])} cases differ; wrote {OUT}")


if __name__ == "__main__":
    main()
