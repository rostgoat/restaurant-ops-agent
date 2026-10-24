"""
Tests for proposals: what code decides about each one before a person sees
it, how the loop records them, and how approval and rejection land in the
trace. The model and the database are scripted.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from anthropic.types import ToolUseBlock

from app.agent import Settings, answer
from app.agent.proposals import ProposalChecker, execute, load_limits

from .fakes import FakeClient, FakeRunner, reply, rows, text

POLICIES = Path(__file__).resolve().parents[2] / "data" / "policies"
LIMITS = load_limits(POLICIES)
NOW = datetime(2026, 10, 24, 15, 0, tzinfo=UTC)
TRACE = uuid4()


def proposed(**fields):
    base = {
        "kind": "other",
        "summary": "Do a thing",
        "reason": "because",
        "order_id": None,
        "customer_id": None,
        "amount_cents": None,
        "discount_pct": None,
        "audience_size": None,
        "draft_message": None,
    }
    return base | fields


def propose(id="toolu_1", **fields):
    return ToolUseBlock(type="tool_use", id=id, name="propose", input=proposed(**fields))


# ------------------------------------------------------------ the limits file


def test_both_restaurants_have_limits_that_match_their_policies():
    assert LIMITS[1]["disputes"]["window_days"] == {"doordash": 7, "uber_eats": 30, "grubhub": 14}
    assert LIMITS[2]["disputes"]["window_days"] == {}
    assert LIMITS[1]["sms"]["implied_consent_days"] == 0
    assert LIMITS[2]["sms"]["implied_consent_days"] == 90
    assert LIMITS[1]["comps"]["manager_limit_cents"] == 2500


# ------------------------------------------------------------ disputes


def test_a_dispute_inside_the_window_is_pending_with_a_due_date():
    placed = NOW - timedelta(days=4)
    runner = FakeRunner(rows(("doordash", placed), columns=("channel", "created_at")))
    checker = ProposalChecker(LIMITS, runner)

    p = checker.check(1, TRACE, NOW, proposed(kind="file_dispute", order_id=100660))

    assert p.status == "pending"
    assert p.payload["due_by"] == (placed + timedelta(days=7)).date().isoformat()
    assert [c["name"] for c in p.payload["checks"]] == ["order", "window"]
    assert "merchant_id = 1" in runner.sql[0]


def test_a_dispute_after_the_window_is_blocked_with_the_date():
    placed = NOW - timedelta(days=9)
    runner = FakeRunner(rows(("doordash", placed), columns=("channel", "created_at")))

    p = ProposalChecker(LIMITS, runner).check(
        1, TRACE, NOW, proposed(kind="file_dispute", order_id=1)
    )

    assert p.status == "blocked"
    assert "7-day window closed on" in p.blocked_reason


def test_a_dispute_on_someone_elses_order_is_blocked():
    runner = FakeRunner(rows(columns=("channel", "created_at")))

    p = ProposalChecker(LIMITS, runner).check(
        2, TRACE, NOW, proposed(kind="file_dispute", order_id=100660)
    )

    assert p.status == "blocked"
    assert "not this restaurant's" in p.blocked_reason


def test_a_dispute_on_a_counter_order_is_blocked():
    runner = FakeRunner(
        rows(("in_store", NOW - timedelta(days=1)), columns=("channel", "created_at"))
    )

    p = ProposalChecker(LIMITS, runner).check(
        1, TRACE, NOW, proposed(kind="file_dispute", order_id=5)
    )

    assert p.status == "blocked"
    assert "no dispute process" in p.blocked_reason


# ------------------------------------------------------------ campaigns


def test_a_campaign_audience_is_counted_by_code_not_the_model():
    runner = FakeRunner(rows((111,)))
    checker = ProposalChecker(LIMITS, runner)

    p = checker.check(
        1,
        TRACE,
        NOW,
        proposed(
            kind="sms_campaign",
            discount_pct=10,
            audience_size=2871,
            draft_message="10% off this week at Mekong. Reply STOP to opt out",
        ),
    )

    assert p.status == "pending"
    assert p.audience_size == 111
    audience = next(c for c in p.payload["checks"] if c["name"] == "audience")
    assert "the model said 2871" in audience["detail"]
    assert "c.sms_opt_in" in runner.sql[0] and "interval" not in runner.sql[0]


def test_the_coffee_counter_counts_recent_customers_as_consented():
    runner = FakeRunner(rows((93,)))

    p = ProposalChecker(LIMITS, runner).check(
        2,
        TRACE,
        NOW,
        proposed(
            kind="sms_campaign",
            discount_pct=20,
            draft_message="Half-price matcha. Text STOP to stop",
        ),
    )

    assert p.status == "pending"
    assert "interval '90 days'" in runner.sql[0]
    assert "90 days" in next(c for c in p.payload["checks"] if c["name"] == "audience")["detail"]


def test_a_discount_over_the_cap_is_blocked_before_any_lookup():
    runner = FakeRunner()

    p = ProposalChecker(LIMITS, runner).check(
        1,
        TRACE,
        NOW,
        proposed(kind="sms_campaign", discount_pct=20, draft_message="Reply STOP to opt out"),
    )

    assert p.status == "blocked"
    assert "over the 15% cap" in p.blocked_reason
    assert runner.sql == []


def test_a_message_without_the_opt_out_wording_is_blocked():
    p = ProposalChecker(LIMITS, FakeRunner()).check(
        1, TRACE, NOW, proposed(kind="sms_campaign", discount_pct=10, draft_message="10% off!")
    )

    assert p.status == "blocked"
    assert "Reply STOP to opt out" in p.blocked_reason


def test_an_audience_over_the_cap_needs_the_owner_but_is_not_blocked():
    p = ProposalChecker(LIMITS, FakeRunner(rows((1512,)))).check(
        1,
        TRACE,
        NOW,
        proposed(kind="sms_campaign", discount_pct=5, draft_message="x Reply STOP to opt out"),
    )

    assert p.status == "pending"
    assert p.payload["needs_owner"] is True


# ------------------------------------------------------------ comps


def test_a_comp_over_the_manager_limit_needs_the_owner():
    p = ProposalChecker(LIMITS, FakeRunner()).check(
        1, TRACE, NOW, proposed(kind="comp", amount_cents=4000)
    )
    assert p.status == "pending"
    assert p.payload["needs_owner"] is True
    assert "over the $25.00 manager limit" in p.payload["checks"][0]["detail"]


def test_a_comp_within_the_limit_is_plain_pending():
    p = ProposalChecker(LIMITS, FakeRunner()).check(
        2, TRACE, NOW, proposed(kind="comp", amount_cents=1500)
    )
    assert p.status == "pending"
    assert "needs_owner" not in p.payload


def test_a_comp_without_an_amount_is_blocked():
    p = ProposalChecker(LIMITS, FakeRunner()).check(1, TRACE, NOW, proposed(kind="comp"))
    assert p.status == "blocked"


# ------------------------------------------------------------ the loop


def test_a_proposal_is_checked_recorded_and_reported_back_to_the_model():
    placed = NOW - timedelta(days=2)
    runner = FakeRunner(rows(("doordash", placed), columns=("channel", "created_at")))
    client = FakeClient(
        reply(propose(kind="file_dispute", order_id=100660, summary="File the dispute")),
        reply(text("I have proposed filing the dispute; it is waiting for your approval.")),
    )

    trace = answer(
        "file the dispute",
        1,
        client=client,
        runner=runner,
        checker=ProposalChecker(LIMITS, runner),
        settings=Settings(),
        now=NOW,
    )

    assert trace.status == "answered"
    assert [(s.actor, s.name, s.outcome) for s in trace.steps] == [
        ("model", "propose", "proposed"),
        ("code", "check_proposal", "pending"),
        ("model", "answer", "answered"),
    ]
    assert len(trace.proposals) == 1
    assert trace.proposals[0].status == "pending"
    assert trace.steps[1].detail["due_by"] == (placed + timedelta(days=7)).date().isoformat()
    sent = client.requests[1]["messages"][2]["content"][0]["content"]
    assert "Nothing has happened" in sent and "pending" in sent


def test_a_blocked_proposal_is_still_recorded():
    runner = FakeRunner(
        rows(("doordash", NOW - timedelta(days=20)), columns=("channel", "created_at"))
    )
    client = FakeClient(
        reply(propose(kind="file_dispute", order_id=7, summary="File it")),
        reply(text("The window has closed, so that cannot be filed.")),
    )

    trace = answer(
        "file it", 1, client=client, runner=runner, checker=ProposalChecker(LIMITS, runner), now=NOW
    )

    assert trace.steps[1].outcome == "blocked"
    assert trace.proposals[0].status == "blocked"


def test_without_a_checker_the_tool_reports_unavailable():
    client = FakeClient(reply(propose()), reply(text("I cannot propose right now.")))
    trace = answer("do it", 1, client=client, runner=FakeRunner(), now=NOW)
    assert trace.steps[1].outcome == "unavailable"
    assert trace.proposals == []


# ------------------------------------------------------------ execution


def test_execution_is_a_record_and_says_so():
    p = ProposalChecker(LIMITS, FakeRunner(rows((40,)))).check(
        2,
        TRACE,
        NOW,
        proposed(kind="sms_campaign", discount_pct=10, draft_message="Hi. Text STOP to stop"),
    )
    result = execute(p)
    assert "40 customers" in result["result"]
    assert result["artifact"] == "Hi. Text STOP to stop"
    assert "No text is sent" in result["simulated"]
