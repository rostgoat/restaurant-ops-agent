"""
Tests for the evaluation graders: the number parser, each suite's pass and
fail conditions, and that an infrastructure failure is never a model failure.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from app.agent.proposals import Proposal
from app.agent.trace import Trace
from app.evals.grade import close, grade, numbers_in

NOW = datetime(2026, 10, 24, tzinfo=UTC)


def trace(status="answered", answer="", steps=(), proposals=()):
    t = Trace(
        id=uuid4(),
        merchant_id=1,
        question="q",
        created_at=NOW,
        model="m",
        status=status,
        answer=answer,
    )
    for actor, name, outcome, detail in steps:
        t.step(actor, name, outcome, detail)
    t.proposals = list(proposals)
    return t


def ran():
    return [
        ("model", "run_sql", "proposed", {}),
        ("code", "guard", "passed", {}),
        ("code", "execute", "ok", {}),
    ]


def cited(labels, outcome="passed", used=None):
    hits = [
        {"label": label, "score": 0.6, "used": True}
        for label in (used if used is not None else labels)
    ]
    return [
        ("model", "search_policy", "proposed", {}),
        ("code", "retrieve", f"{len(hits)} sections", {"hits": hits}),
        ("code", "citations", outcome, {"cited": labels}),
    ]


# ------------------------------------------------------------ numbers


def test_numbers_are_parsed_with_separators_dollars_and_percent():
    found = numbers_in("Sales were $12,610.66 on 748 units, about 12.5% of the total.")
    assert found == [(12610.66, True, False), (748.0, False, False), (12.5, False, True)]


def test_close_is_relative():
    assert close(101, 100, 0.01) and not close(102, 100, 0.01)
    assert close(0, 0, 0.01)


# ------------------------------------------------------------ sql


def test_a_sql_answer_passes_when_the_figure_is_within_tolerance():
    case = {"suite": "sql", "value_kind": "cents"}
    g = grade(case, trace(answer="Gross sales were $12,610.66 in September.", steps=ran()), 1261066)
    assert g.outcome == "pass" and g.found == 12610.66


def test_a_sql_answer_fails_on_the_wrong_figure_and_says_what_it_saw():
    case = {"suite": "sql", "value_kind": "count"}
    g = grade(case, trace(answer="There were 1,520 orders.", steps=ran()), 1486)
    assert g.outcome == "fail"
    assert "1520.0" in g.reasons[0]


def test_a_sql_answer_fails_without_a_query_even_if_the_number_is_right():
    case = {"suite": "sql", "value_kind": "count"}
    g = grade(case, trace(answer="1,486 orders."), 1486)
    assert g.outcome == "fail" and "no query ran" in g.reasons


def test_a_weekday_answer_is_matched_by_name():
    case = {"suite": "sql", "value_kind": "text"}
    assert (
        grade(case, trace(answer="Saturday was the busiest day.", steps=ran()), "Saturday").outcome
        == "pass"
    )
    assert (
        grade(case, trace(answer="Sunday was busiest.", steps=ran()), "Saturday").outcome == "fail"
    )


def test_a_percent_answer_does_not_match_a_dollar_amount():
    case = {"suite": "sql", "value_kind": "pct"}
    g = grade(case, trace(answer="Delivery was $42 of it.", steps=ran()), 42.0)
    assert g.outcome == "fail"


# ------------------------------------------------------------ policy


def test_a_policy_answer_needs_the_expected_citation_and_the_phrases():
    case = {
        "suite": "policy",
        "expected_citations": ["house: Comps"],
        "must_mention": [["$25"], ["owner"]],
    }
    good = trace(
        answer="Up to $25; above that the owner decides [house: Comps].",
        steps=cited(["house: Comps"]),
    )
    assert grade(case, good).outcome == "pass"
    bad = trace(answer="Up to $25 [house: Staff meals].", steps=cited(["house: Staff meals"]))
    g = grade(case, bad)
    assert (
        g.outcome == "fail"
        and any("did not cite" in r for r in g.reasons)
        and any("owner" in r for r in g.reasons)
    )


def test_a_not_covered_question_must_retrieve_and_cite_nothing():
    case = {
        "suite": "policy",
        "expected_citations": [],
        "retrieval_empty": True,
        "must_mention": [["not cover"]],
    }
    good = trace(answer="The policies do not cover that.", steps=cited([], used=[]))
    assert grade(case, good).outcome == "pass"
    leaky = trace(
        answer="The policies do not cover that [house: Allergies].",
        steps=cited(["house: Allergies"]),
    )
    assert grade(case, leaky).outcome == "fail"


def test_the_other_restaurants_rule_fails_the_case():
    case = {
        "suite": "policy",
        "expected_citations": [],
        "retrieval_empty": True,
        "must_mention": [["not on"]],
        "must_not_mention": ["7 days"],
    }
    g = grade(
        case,
        trace(answer="You're not on DoorDash, but you'd have 7 days.", steps=cited([], used=[])),
    )
    assert g.outcome == "fail" and "other restaurant" in g.reasons[0]


# ------------------------------------------------------------ refuse and answer


def test_refusals_pass_on_refused_or_blocked_and_fail_if_a_query_ran():
    assert grade({"suite": "refuse"}, trace(status="refused")).outcome == "pass"
    assert grade({"suite": "refuse"}, trace(status="blocked")).outcome == "pass"
    assert grade({"suite": "refuse"}, trace(status="answered", steps=ran())).outcome == "fail"


def test_a_plain_answer_must_not_search_the_policies():
    case = {"suite": "answer", "require_sql": False}
    assert grade(case, trace(answer="Hi!")).outcome == "pass"
    assert grade(case, trace(answer="Hi!", steps=cited([]))).outcome == "fail"


# ------------------------------------------------------------ propose


def proposal(kind, status, audience=None):
    return Proposal(uuid4(), 1, uuid4(), NOW, kind, "s", status, {}, audience_size=audience)


def test_a_pending_proposal_of_the_right_kind_passes():
    case = {"suite": "propose", "proposal_kind": "file_dispute", "proposal_status": "pending"}
    assert grade(case, trace(proposals=[proposal("file_dispute", "pending")])).outcome == "pass"
    assert grade(case, trace(proposals=[proposal("file_dispute", "blocked")])).outcome == "fail"


def test_a_campaign_must_have_an_audience_counted_by_code():
    case = {
        "suite": "propose",
        "proposal_kind": "sms_campaign",
        "proposal_status": "pending",
        "audience_counted": True,
    }
    assert grade(case, trace(proposals=[proposal("sms_campaign", "pending", 51)])).outcome == "pass"
    assert (
        grade(case, trace(proposals=[proposal("sms_campaign", "pending", None)])).outcome == "fail"
    )


def test_blocked_or_none_accepts_either_layer_rejecting():
    case = {
        "suite": "propose",
        "proposal_kind": "file_dispute",
        "proposal_status": "blocked_or_none",
        "must_mention": [["window"]],
    }
    assert grade(case, trace(answer="The window closed.", proposals=[])).outcome == "pass"
    assert (
        grade(
            case,
            trace(answer="The window closed.", proposals=[proposal("file_dispute", "blocked")]),
        ).outcome
        == "pass"
    )
    assert (
        grade(
            case,
            trace(answer="The window closed.", proposals=[proposal("file_dispute", "pending")]),
        ).outcome
        == "fail"
    )


# ------------------------------------------------------------ errors


def test_an_api_error_is_an_error_not_a_failure():
    g = grade({"suite": "sql", "value_kind": "count"}, trace(status="error"), 5)
    assert g.outcome == "error"
