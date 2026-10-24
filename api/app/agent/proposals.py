"""
What the model may propose, and what code decides about each proposal
before a person sees it. The numbers come from each restaurant's limits
file, the structured part of its written policy.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from app.sql.execute import QueryError, QueryRunner

KINDS = ("file_dispute", "sms_campaign", "comp", "notify_owner", "other")
MARKETPLACES = ("doordash", "uber_eats", "grubhub")


@dataclass
class Proposal:
    id: UUID
    merchant_id: int
    trace_id: UUID
    created_at: datetime
    kind: str
    summary: str
    status: str
    payload: dict[str, Any] = field(default_factory=dict)
    blocked_reason: str | None = None
    audience_size: int | None = None
    discount_pct: int | None = None
    draft_message: str | None = None
    decided_at: datetime | None = None


def load_limits(root: Path) -> dict[int, dict[str, Any]]:
    limits: dict[int, dict[str, Any]] = {}
    for path in sorted(root.glob("merchant_*/limits.json")):
        merchant_id = int(re.sub(r"\D", "", path.parent.name))
        limits[merchant_id] = json.loads(path.read_text())
    return limits


class ProposalChecker:
    def __init__(self, limits: dict[int, dict[str, Any]], runner: QueryRunner):
        self._limits = limits
        self._runner = runner

    def check(
        self, merchant_id: int, trace_id: UUID, now: datetime, proposed: dict[str, Any]
    ) -> Proposal:
        kind = str(proposed.get("kind", "other"))
        proposal = Proposal(
            id=uuid4(),
            merchant_id=merchant_id,
            trace_id=trace_id,
            created_at=now,
            kind=kind if kind in KINDS else "other",
            summary=str(proposed.get("summary", "")).strip(),
            status="pending",
            payload={k: v for k, v in proposed.items() if v is not None},
            discount_pct=_int(proposed.get("discount_pct")),
            draft_message=proposed.get("draft_message") or None,
        )
        limits = self._limits.get(merchant_id, {})
        checks: list[dict[str, Any]] = []
        try:
            if proposal.kind == "file_dispute":
                self._check_dispute(proposal, limits, now, checks)
            elif proposal.kind == "sms_campaign":
                self._check_campaign(proposal, limits, checks)
            elif proposal.kind == "comp":
                self._check_comp(proposal, limits, checks)
        except QueryError as e:
            checks.append({"name": "lookup", "passed": False, "detail": str(e)})
            proposal.status = "blocked"
            proposal.blocked_reason = f"could not look up the data: {e}"
        proposal.payload["checks"] = checks
        return proposal

    def _check_dispute(
        self, p: Proposal, limits: dict[str, Any], now: datetime, checks: list
    ) -> None:
        order_id = _int(p.payload.get("order_id"))
        if order_id is None:
            return _block(p, checks, "order", "no order id given")
        rows = self._runner.run(
            f"SELECT channel, created_at FROM orders "
            f"WHERE id = {order_id} AND merchant_id = {p.merchant_id}"
        ).rows
        if not rows:
            return _block(p, checks, "order", f"order {order_id} is not this restaurant's")
        channel, created_at = str(rows[0][0]), rows[0][1]
        checks.append({"name": "order", "passed": True, "detail": f"order {order_id}, {channel}"})
        windows = limits.get("disputes", {}).get("window_days", {})
        if channel not in MARKETPLACES or channel not in windows:
            return _block(
                p, checks, "marketplace", f"{channel} orders have no dispute process here"
            )
        deadline = created_at + timedelta(days=int(windows[channel]))
        if now > deadline:
            return _block(
                p,
                checks,
                "window",
                f"the {windows[channel]}-day window closed on {deadline.date()}",
            )
        checks.append({"name": "window", "passed": True, "detail": f"open until {deadline.date()}"})
        p.payload["due_by"] = deadline.date().isoformat()

    def _check_campaign(self, p: Proposal, limits: dict[str, Any], checks: list) -> None:
        sms = limits.get("sms", {})
        cap = int(sms.get("discount_cap_pct", 0))
        if p.discount_pct is not None and p.discount_pct > cap:
            return _block(p, checks, "discount", f"{p.discount_pct}% is over the {cap}% cap")
        checks.append(
            {
                "name": "discount",
                "passed": True,
                "detail": f"{p.discount_pct or 0}% within the {cap}% cap",
            }
        )
        wording = str(sms.get("stop_wording", ""))
        if wording and wording.lower() not in (p.draft_message or "").lower():
            return _block(p, checks, "wording", f'the message must end with "{wording}"')
        checks.append({"name": "wording", "passed": True, "detail": "opt-out wording present"})
        days = int(sms.get("implied_consent_days", 0))
        consent = "c.sms_opt_in"
        if days > 0:
            consent = (
                f"(c.sms_opt_in OR EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id "
                f"AND o.created_at > now() - interval '{days} days'))"
            )
        count = self._runner.run(
            f"SELECT count(*) FROM customers c WHERE c.merchant_id = {p.merchant_id} "
            f"AND c.has_phone AND c.unsubscribed_at IS NULL AND {consent}"
        ).rows[0][0]
        claimed = _int(p.payload.get("audience_size"))
        p.audience_size = int(count)
        basis = (
            "verified consent"
            if days == 0
            else f"verified consent or an order in the last {days} days"
        )
        detail = f"{count} customers with a phone, not unsubscribed, {basis}"
        if claimed is not None and claimed != count:
            detail += f"; the model said {claimed}"
        checks.append({"name": "audience", "passed": True, "detail": detail})
        audience_cap = int(sms.get("audience_cap", 0))
        if audience_cap and count > audience_cap:
            checks.append(
                {
                    "name": "audience cap",
                    "passed": True,
                    "detail": f"{count} is over the {audience_cap} cap, so the owner must approve",
                }
            )
            p.payload["needs_owner"] = True

    def _check_comp(self, p: Proposal, limits: dict[str, Any], checks: list) -> None:
        amount = _int(p.payload.get("amount_cents"))
        if amount is None or amount <= 0:
            return _block(p, checks, "amount", "no amount given")
        limit = int(limits.get("comps", {}).get("manager_limit_cents", 0))
        if amount > limit:
            checks.append(
                {
                    "name": "amount",
                    "passed": True,
                    "detail": f"${amount / 100:.2f} is over the ${limit / 100:.2f} manager "
                    "limit, so the owner must approve",
                }
            )
            p.payload["needs_owner"] = True
        else:
            checks.append(
                {
                    "name": "amount",
                    "passed": True,
                    "detail": f"${amount / 100:.2f} is within the ${limit / 100:.2f} manager limit",
                }
            )


def _block(p: Proposal, checks: list, name: str, reason: str) -> None:
    checks.append({"name": name, "passed": False, "detail": reason})
    p.status = "blocked"
    p.blocked_reason = reason


def _int(value: Any) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def outcome(p: Proposal) -> str:
    return (
        "blocked"
        if p.status == "blocked"
        else ("needs the owner" if p.payload.get("needs_owner") else "pending")
    )


def tool_message(p: Proposal) -> dict[str, Any]:
    return {
        "proposal_id": str(p.id),
        "status": p.status,
        "needs_owner": bool(p.payload.get("needs_owner")),
        "blocked_reason": p.blocked_reason,
        "checks": p.payload.get("checks", []),
        "audience_size": p.audience_size,
        "due_by": p.payload.get("due_by"),
        "note": "Nothing has happened. A person must approve this before anything is done.",
    }


def execute(p: Proposal) -> dict[str, Any]:
    """What approval produces. Every result is a record or a draft; nothing
    here reaches a marketplace, a phone, or a register."""
    if p.kind == "file_dispute":
        return {
            "result": f"Dispute recorded for order {p.payload.get('order_id')}, "
            f"due by {p.payload.get('due_by')}.",
            "artifact": None,
            "simulated": "The filing with the marketplace is simulated; this project has no "
            "account with one.",
        }
    if p.kind == "sms_campaign":
        return {
            "result": f"Campaign recorded for {p.audience_size} customers "
            f"at {p.discount_pct or 0}% off.",
            "artifact": p.draft_message,
            "simulated": "No text is sent; the draft and the audience count are what a real "
            "send would use.",
        }
    if p.kind == "comp":
        return {
            "result": f"Comp of ${(_int(p.payload.get('amount_cents')) or 0) / 100:.2f} recorded"
            + (f" against order {p.payload['order_id']}." if p.payload.get("order_id") else "."),
            "artifact": p.summary,
            "simulated": "The register is not touched; the comp is a record here.",
        }
    return {
        "result": "Recorded.",
        "artifact": p.summary,
        "simulated": "Nothing external is contacted.",
    }
