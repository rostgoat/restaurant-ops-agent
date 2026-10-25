"""
Run every scenario in data/scenarios.json through a live API and save each
trace next to its definition for the site to render.

    .venv/bin/python scripts/capture.py --api http://127.0.0.1:8000
"""

from __future__ import annotations

import argparse
import json
import os
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def auth(headers: dict[str, str]) -> dict[str, str]:
    """Adds the API token when the API is configured to require one."""
    token = os.environ.get("API_TOKEN")

    return headers | {"X-API-Token": token} if token else headers


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://127.0.0.1:8000")
    ap.add_argument("--only", action="append", default=[])
    args = ap.parse_args()

    scenarios = json.loads((ROOT / "data" / "scenarios.json").read_text())
    out = ROOT / "web" / "src" / "content" / "scenarios"
    out.mkdir(parents=True, exist_ok=True)

    for s in scenarios:
        if args.only and s["slug"] not in args.only:
            continue
        req = urllib.request.Request(
            f"{args.api}/ask",
            data=json.dumps({"question": s["question"]}).encode(),
            headers=auth(
                {"content-type": "application/json", "X-Merchant-Id": str(s["merchant_id"])}
            ),
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=300) as r:
            trace = json.load(r)
        # A scenario marked "approve" has its first pending proposal approved
        # here, standing in for the owner, so the capture shows the Human step.
        pending = [p for p in trace.get("proposals", []) if p["status"] == "pending"]

        if s.get("approve") and pending:
            headers = auth({"X-Merchant-Id": str(s["merchant_id"])})
            urllib.request.urlopen(
                urllib.request.Request(
                    f"{args.api}/proposals/{pending[0]['id']}/approve",
                    headers=headers,
                    method="POST",
                ),
                timeout=60,
            ).read()
            with urllib.request.urlopen(
                urllib.request.Request(f"{args.api}/traces/{trace['id']}", headers=headers),
                timeout=60,
            ) as r:
                trace = json.load(r)
        (out / f"{s['slug']}.json").write_text(json.dumps(s | {"trace": trace}, indent=2) + "\n")
        steps = ", ".join(f"{x['name']}:{x['outcome']}" for x in trace["steps"])
        head = f"{s['slug']:22} {trace['status']:8} ${trace['cost_usd']:.4f}"
        print(f"{head} {trace['latency_ms'] / 1000:5.1f}s  {steps}")


if __name__ == "__main__":
    main()
