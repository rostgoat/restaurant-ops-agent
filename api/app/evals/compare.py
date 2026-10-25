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
        "outcomes": {
            r["case"]["id"]: {
                "outcome": r["grade"]["outcome"],
                "reasons": r["grade"]["reasons"],
                "cost_usd": r["trace"]["cost_usd"],
            }
            for r in run["results"]
        },
    }


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
