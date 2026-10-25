"""
Run the evaluation set against the frozen database and write a run file.

    .venv/bin/python -m app.evals.run --dsn $EVAL_DATABASE_URL
    .venv/bin/python -m app.evals.run --dsn $EVAL_DATABASE_URL --check-gold
    .venv/bin/python -m app.evals.run --dsn $EVAL_DATABASE_URL --only sql-03 --reps 3

Every case goes through answer(), the same entry point the API uses, with
the same prompt, tools, model and settings. A run file holds every trace in
full so a surprising grade can be traced without re-running.
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import subprocess
import sys
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import anthropic
from dotenv import load_dotenv

from app.agent import DEFAULT, Settings, answer
from app.agent.proposals import ProposalChecker, load_limits
from app.policies import OpenAIEmbedder, PostgresPolicySearch
from app.sql.execute import PostgresRunner
from app.sql.guard import guard

from .grade import Grade, grade, trace_from_json

ROOT = Path(__file__).resolve().parents[3]
CASES = ROOT / "api" / "evals" / "cases.json"
RUNS = ROOT / "api" / "evals" / "runs"
SITE_COPY = ROOT / "web" / "src" / "content" / "eval-run.json"


def load_cases() -> dict[str, Any]:
    return json.loads(CASES.read_text())


def gold_value(runner: PostgresRunner, case: dict[str, Any]) -> Any:
    sql = case.get("gold_sql")

    if not sql:
        return None
    verdict = guard(sql, case.get("gold_merchant_id", case["merchant_id"]))

    if not verdict.ok:
        raise RuntimeError(f"{case['id']}: gold SQL fails the guard: {verdict.reason}")
    rows = runner.run(verdict.sql).rows

    return rows[0][0] if rows else None


def check_gold(runner: PostgresRunner, cases: list[dict[str, Any]]) -> None:
    for case in cases:
        if case.get("gold_sql"):
            value = gold_value(runner, case)
            print(f"{case['id']:8} {case['value_kind']:6} {value}")


def run_case(
    case: dict[str, Any],
    *,
    client: anthropic.Anthropic,
    runner: PostgresRunner,
    policies: PostgresPolicySearch,
    checker: ProposalChecker,
    settings: Settings,
    now: datetime,
) -> dict[str, Any]:
    gold = gold_value(runner, case)
    trace = answer(
        case["question"],
        case["merchant_id"],
        client=client,
        runner=runner,
        policies=policies,
        checker=checker,
        settings=settings,
        now=now,
    )
    served = trace.model
    g: Grade = grade(case, trace, gold)

    if trace.status != "error" and served != settings.model:
        g = Grade("error", [f"served by {served}, not {settings.model}"])
    payload = asdict(trace)
    payload["id"] = str(trace.id)

    for p in payload["proposals"]:
        p["id"] = str(p["id"])
        p["trace_id"] = str(p["trace_id"])

    return {
        "case": case,
        "gold": _jsonable(gold),
        "grade": asdict(g) | {"expected": _jsonable(g.expected), "found": _jsonable(g.found)},
        "trace": _jsonable(payload),
    }


def summarise(
    results: list[dict[str, Any]], cases: dict[str, Any], settings: Settings
) -> dict[str, Any]:
    scored = [r for r in results if r["grade"]["outcome"] != "error"]
    errors = [r for r in results if r["grade"]["outcome"] == "error"]
    suites: dict[str, dict[str, int]] = {}

    for r in scored:
        s = suites.setdefault(r["case"]["suite"], {"passed": 0, "total": 0})
        s["total"] += 1
        s["passed"] += r["grade"]["outcome"] == "pass"
    answered = [r for r in results if r["trace"]["status"] == "answered"]
    costs = [r["trace"]["cost_usd"] for r in answered]
    latencies = [r["trace"]["latency_ms"] for r in results if r["trace"]["status"] != "error"]
    retrieval = _retrieval_metrics(results)

    return {
        "ran_at": datetime.now(UTC).isoformat(),
        "model": settings.model,
        "effort": settings.effort,
        "retrieval_threshold": settings.retrieval_threshold,
        "commit": _commit(),
        "dataset": "ops_eval, data/generate.py seed 42",
        "frozen_now": cases["frozen_now"],
        "ground_truth": cases["ground_truth"],
        "cases": len(results),
        "scored": len(scored),
        "passed": sum(r["grade"]["outcome"] == "pass" for r in scored),
        "errors": len(errors),
        "suites": suites,
        "cost_total_usd": round(sum(r["trace"]["cost_usd"] for r in results), 4),
        "cost_per_answered_median_usd": round(statistics.median(costs), 4) if costs else None,
        "cost_per_answered_p90_usd": round(_p(costs, 0.9), 4) if costs else None,
        "latency_median_ms": int(statistics.median(latencies)) if latencies else None,
        "latency_p90_ms": int(_p(latencies, 0.9)) if latencies else None,
        "retrieval": retrieval,
    }


def _retrieval_metrics(results: list[dict[str, Any]]) -> dict[str, Any]:
    used_total = relevant_used = expected_total = expected_found = 0

    for r in results:
        case = r["case"]

        if case["suite"] != "policy":
            continue
        expected = set(case.get("expected_citations", []))
        used: set[str] = set()

        for s in r["trace"]["steps"]:
            if s["name"] == "retrieve":
                for h in (s["detail"] or {}).get("hits", []):
                    if h.get("used"):
                        used.add(h["label"])
        used_total += len(used)
        relevant_used += len(used & expected)
        expected_total += len(expected)
        expected_found += len(used & expected)

    return {
        "precision": round(relevant_used / used_total, 3) if used_total else None,
        "recall": round(expected_found / expected_total, 3) if expected_total else None,
        "sections_shown": used_total,
        "sections_expected": expected_total,
    }


def _p(values: list[float], q: float) -> float:
    ordered = sorted(values)
    index = min(len(ordered) - 1, int(round(q * (len(ordered) - 1))))

    return ordered[index]


def _commit() -> str | None:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True
        ).strip()
    except Exception:
        return None


def _jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}

    if isinstance(value, list | tuple):
        return [_jsonable(v) for v in value]

    if isinstance(value, datetime):
        return value.isoformat()

    if hasattr(value, "isoformat"):
        return value.isoformat()

    if isinstance(value, float | int | str | bool) or value is None:
        return value

    return str(value)


def regrade(path: Path, cases: dict[str, Any]) -> None:
    run = json.loads(path.read_text())
    by_id = {c["id"]: c for c in cases["cases"]}
    settings = Settings(
        model=run["summary"]["model"],
        effort=run["summary"]["effort"],
        retrieval_threshold=run["summary"]["retrieval_threshold"],
    )
    for r in run["results"]:
        case = by_id.get(r["case"]["id"], r["case"])

        if r["trace"].get("status") == "error" and not r["trace"].get("steps"):
            continue
        g = grade(case, trace_from_json(r["trace"]), r.get("gold"))
        r["grade"] = asdict(g) | {"expected": _jsonable(g.expected), "found": _jsonable(g.found)}
    summary = summarise(run["results"], cases, settings)
    summary["ran_at"] = run["summary"]["ran_at"]
    summary["commit"] = run["summary"]["commit"]
    summary["regraded_at"] = datetime.now(UTC).isoformat()
    run["summary"] = summary
    path.write_text(json.dumps(run, indent=1) + "\n")
    SITE_COPY.write_text(json.dumps(run, indent=1) + "\n")
    print(f"regraded {len(run['results'])} results: {summary['passed']}/{summary['scored']} pass")


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dsn", default=os.environ.get("EVAL_DATABASE_URL"))
    ap.add_argument("--only", action="append", default=[])
    ap.add_argument("--reps", type=int, default=1)
    ap.add_argument("--check-gold", action="store_true")
    ap.add_argument("--regrade", type=Path, help="re-apply the graders to a stored run file")
    ap.add_argument("--model", default=DEFAULT.model)
    ap.add_argument("--effort", default=DEFAULT.effort)
    ap.add_argument("--threshold", type=float, default=DEFAULT.retrieval_threshold)
    ap.add_argument(
        "--no-site-copy",
        action="store_true",
        help="keep the run file but leave the site's main run alone (comparison runs)",
    )

    return ap.parse_args()


def harness_error(case: dict[str, Any], error: Exception, model: str) -> dict[str, Any]:
    """The harness itself failed. Reported apart, never as a model failure."""

    return {
        "case": case,
        "gold": None,
        "grade": {
            "outcome": "error",
            "reasons": [f"harness: {error}"],
            "expected": None,
            "found": None,
        },
        "trace": {
            "status": "error",
            "cost_usd": 0.0,
            "latency_ms": 0,
            "steps": [],
            "proposals": [],
            "model": model,
        },
    }


def print_result(case: dict[str, Any], r: dict[str, Any]) -> None:
    g = r["grade"]
    t = r["trace"]
    secs = t["latency_ms"] / 1000
    head = f"{case['id']:8} {g['outcome']:5} ${t['cost_usd']:.4f} {secs:5.1f}s"
    print(f"{head}  {'; '.join(g['reasons'])[:110]}")


def run_all(
    selected: list[dict[str, Any]], reps: int, settings: Settings, **harness: Any
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []

    for rep in range(reps):
        for case in selected:
            try:
                r = run_case(case, settings=settings, **harness)
            except Exception as e:
                r = harness_error(case, e, settings.model)
            r["rep"] = rep
            results.append(r)
            print_result(case, r)

    return results


def write_run(run: dict[str, Any], *, site_copy: bool) -> Path:
    RUNS.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    path = RUNS / f"{stamp}.json"
    path.write_text(json.dumps(run, indent=1) + "\n")

    if site_copy:
        SITE_COPY.write_text(json.dumps(run, indent=1) + "\n")

    return path


def print_summary(s: dict[str, Any], path: Path) -> None:
    print(f"\n{s['passed']}/{s['scored']} passed, {s['errors']} errors")
    print(f"${s['cost_total_usd']} total, median ${s['cost_per_answered_median_usd']} per answer")
    print(f"p50 {s['latency_median_ms']} ms, p90 {s['latency_p90_ms']} ms")

    for suite, v in s["suites"].items():
        print(f"  {suite:8} {v['passed']}/{v['total']}")
    print(f"  retrieval precision {s['retrieval']['precision']} recall {s['retrieval']['recall']}")
    print(f"wrote {path}")


def main() -> None:
    load_dotenv(ROOT / ".env")
    args = parse_args()

    if not args.dsn:
        sys.exit("set EVAL_DATABASE_URL or pass --dsn")
    cases = load_cases()
    selected = [c for c in cases["cases"] if not args.only or c["id"] in args.only]

    if args.regrade:
        regrade(args.regrade, cases)

        return
    runner = PostgresRunner(args.dsn)

    if args.check_gold:
        check_gold(runner, selected)

        return
    settings = Settings(model=args.model, effort=args.effort, retrieval_threshold=args.threshold)
    results = run_all(
        selected,
        args.reps,
        settings,
        client=anthropic.Anthropic(),
        runner=runner,
        policies=PostgresPolicySearch(args.dsn, OpenAIEmbedder(os.environ["OPENAI_API_KEY"])),
        checker=ProposalChecker(load_limits(ROOT / "data" / "policies"), runner),
        now=datetime.fromisoformat(cases["frozen_now"].replace("Z", "+00:00")),
    )
    summary = summarise(results, cases, settings)
    path = write_run({"summary": summary, "results": results}, site_copy=not args.no_site_copy)
    print_summary(summary, path)


if __name__ == "__main__":
    main()
