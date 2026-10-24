"""
Tests for policy chunking, the fake embedder, and the agent's use of policy
search, with retrieval scripted. The scoped vector search itself is covered
against a real database in test_postgres.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

from anthropic.types import ToolUseBlock

from app.agent import Settings, answer
from app.policies import FakeEmbedder, Hit, parse_document, read_policies
from app.policies.search import as_vector, hits_payload

from .fakes import FakeClient, FakeRunner, reply, text

POLICIES = Path(__file__).resolve().parents[2] / "data" / "policies"


def search_policy(query, id="toolu_1"):
    return ToolUseBlock(type="tool_use", id=id, name="search_policy", input={"query": query})


class FakeSearch:
    def __init__(self, hits):
        self.hits = hits
        self.calls = []

    def search(self, merchant_id, query, *, limit):
        self.calls.append((merchant_id, query, limit))
        return self.hits[:limit]


def ask(question, client, policies, settings=None):
    return answer(
        question, 1, client=client, runner=FakeRunner(), policies=policies,
        settings=settings or Settings(),
    )


# ------------------------------------------------------------ chunking


def test_a_document_splits_into_its_sections():
    markdown = (
        "# House policy\n\nIntro.\n\n## Comps\n\nUp to $25.\n\n## Refunds\n\nWithin 7 days.\n"
    )
    chunks = parse_document(1, "house", markdown)
    assert [(c.section, c.body) for c in chunks] == [
        ("Comps", "Up to $25."),
        ("Refunds", "Within 7 days."),
    ]
    assert chunks[0].label == "house: Comps"
    assert chunks[0].text.startswith("house: Comps\n")


def test_the_real_policies_read_cleanly():
    chunks = read_policies(POLICIES)
    by_merchant = {m: [c for c in chunks if c.merchant_id == m] for m in (1, 2)}
    assert {c.document for c in by_merchant[1]} == {"house", "marketplace", "messaging"}
    assert {c.document for c in by_merchant[2]} == {"house", "online-orders", "messaging"}
    assert all(c.body for c in chunks)
    assert len({c.label for c in by_merchant[1]}) == len(by_merchant[1])


# ------------------------------------------------------------ embedding


def test_the_fake_embedder_is_deterministic_and_unit_length():
    e = FakeEmbedder()
    a, b = e.embed(["comp limit for a manager", "comp limit for a manager"])
    assert a == b
    assert math.isclose(math.sqrt(sum(x * x for x in a)), 1.0, rel_tol=1e-9)


def test_similar_wording_scores_higher_than_unrelated():
    e = FakeEmbedder()
    q, near, far = e.embed(
        ["manager comp limit", "a manager may comp up to $25", "quiet hours for texts"]
    )
    dot = lambda u, v: sum(x * y for x, y in zip(u, v, strict=True))  # noqa: E731
    assert dot(q, near) > dot(q, far)


def test_vectors_serialise_for_postgres():
    assert as_vector([0.5, 1.0]) == "[0.5,1.0]"


def test_hits_payload_marks_what_was_used():
    hits = [Hit("house: Comps", "…", 0.52), Hit("house: Refunds", "…", 0.21)]
    payload = hits_payload(hits, 0.30)
    assert payload["threshold"] == 0.30
    assert [(h["label"], h["used"]) for h in payload["hits"]] == [
        ("house: Comps", True),
        ("house: Refunds", False),
    ]


# ------------------------------------------------------------ the loop


def test_a_policy_question_retrieves_then_answers_with_a_checked_citation():
    hits = [
        Hit("house: Comps", "A manager may comp up to $25.", 0.61),
        Hit("house: Refunds", "…", 0.12),
    ]
    client = FakeClient(
        reply(search_policy("manager comp limit")),
        reply(text("A manager may comp up to $25 on one ticket [house: Comps].")),
    )
    search = FakeSearch(hits)

    trace = ask("can my manager comp a $40 meal?", client, search)

    assert trace.status == "answered"
    assert [(s.actor, s.name, s.outcome) for s in trace.steps] == [
        ("model", "search_policy", "proposed"),
        ("code", "retrieve", "1 section"),
        ("model", "answer", "answered"),
        ("code", "citations", "passed"),
    ]
    assert search.calls == [(1, "manager comp limit", 4)]
    retrieve = trace.steps[1].detail
    assert retrieve["hits"][0] == {"label": "house: Comps", "score": 0.61, "used": True}
    assert retrieve["hits"][1]["used"] is False
    sent = json.loads(client.requests[1]["messages"][2]["content"][0]["content"])
    assert sent == {
        "sections": [{"label": "house: Comps", "text": "A manager may comp up to $25."}]
    }


def test_citing_a_section_that_was_not_retrieved_fails_the_check():
    client = FakeClient(
        reply(search_policy("comp limit")),
        reply(text("Up to $25 [house: Comps], and refunds within 7 days [house: Refunds].")),
    )
    search = FakeSearch([Hit("house: Comps", "…", 0.61)])

    trace = ask("comp limit?", client, search)

    assert trace.status == "answered"
    check = trace.steps[-1]
    assert (check.name, check.outcome) == ("citations", "failed")
    assert check.detail["not_retrieved"] == ["house: Refunds"]


def test_using_policy_without_citing_fails_the_check():
    client = FakeClient(reply(search_policy("comp limit")), reply(text("Up to $25.")))

    trace = ask("comp limit?", client, FakeSearch([Hit("house: Comps", "…", 0.61)]))

    assert trace.steps[-1].outcome == "failed"
    assert "nothing was cited" in trace.steps[-1].detail["reason"]


def test_nothing_above_threshold_is_said_so_and_not_cited():
    client = FakeClient(
        reply(search_policy("health inspection rules")),
        reply(text("Your policies do not cover health inspections.")),
    )
    search = FakeSearch([Hit("house: Allergies", "…", 0.18)])

    trace = ask("what is the health inspection rule?", client, search)

    assert trace.steps[1].outcome == "nothing above threshold"
    result = client.requests[1]["messages"][2]["content"][0]
    assert "matches closely enough" in result["content"]
    assert "is_error" not in result
    assert trace.steps[-1].name == "citations"
    assert trace.steps[-1].outcome == "passed"


def test_citing_when_nothing_was_retrieved_fails_the_check():
    client = FakeClient(reply(search_policy("q")), reply(text("You must do X [house: Comps].")))

    trace = ask("q", client, FakeSearch([Hit("house: Allergies", "…", 0.18)]))

    assert trace.steps[-1].outcome == "failed"
    assert "nothing was retrieved" in trace.steps[-1].detail["reason"]


def test_the_threshold_is_a_setting():
    client = FakeClient(reply(search_policy("q")), reply(text("ok [house: Comps].")))
    search = FakeSearch([Hit("house: Comps", "…", 0.25)])

    trace = ask("q", client, search, Settings(retrieval_threshold=0.2, retrieval_limit=2))

    assert trace.steps[1].outcome == "1 section"
    assert search.calls[0][2] == 2


def test_without_a_search_backend_the_tool_reports_unavailable():
    client = FakeClient(reply(search_policy("q")), reply(text("I cannot look that up right now.")))

    trace = ask("q", client, None)

    assert trace.steps[1].outcome == "unavailable"
    assert trace.retries == 1
    assert trace.status == "answered"


def test_a_data_question_never_runs_the_citation_check():
    client = FakeClient(reply(text("Hello.")))
    trace = ask("hi", client, FakeSearch([]))
    assert [s.name for s in trace.steps] == ["answer"]
