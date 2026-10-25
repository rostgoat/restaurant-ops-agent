"""
Tests for the HTTP layer, with the model, database, and store replaced.

What they prove: the caller's merchant comes from the request and never from
the model, and a trace is stored whichever way the request ends.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

import anthropic
import httpx2
from fastapi.testclient import TestClient

from app.agent import Settings
from app.main import create_app
from app.store import Merchant

from .fakes import FakeClient, FakeRunner, reply, rows, run_sql, text

MERCHANTS = [
    Merchant(1, "Mekong Noodle House", "Vietnamese", "America/Chicago"),
    Merchant(2, "Corner Counter", "Cafe", "America/New_York"),
]


class FakeStore:
    def __init__(self):
        self.traces = {}

    def merchants(self):
        return list(MERCHANTS)

    def merchant_exists(self, merchant_id):
        return any(m.id == merchant_id for m in MERCHANTS)

    def save_trace(self, trace):
        self.traces[trace.id] = trace

    def question_stats(self, merchant_id, question):
        from app.store import QuestionStats

        mine = [
            t
            for t in self.traces.values()
            if t.merchant_id == merchant_id and t.question == question
        ]
        costs = [t.cost_usd for t in mine]

        return QuestionStats(
            asked=len(mine),
            answered=sum(t.status == "answered" for t in mine),
            cost_avg_usd=sum(costs) / len(costs) if costs else None,
            latency_avg_ms=None,
            first_asked_at=min((t.created_at for t in mine), default=None),
        )

    def get_trace(self, trace_id, merchant_id):
        trace = self.traces.get(trace_id)

        return trace if trace and trace.merchant_id == merchant_id else None


@asynccontextmanager
async def no_lifespan(app):
    yield


def make(client=None, runner=None):
    app = create_app(lifespan=no_lifespan)
    app.state.store = FakeStore()
    app.state.settings = Settings()
    app.state.model = client or FakeClient()
    app.state.runner = runner or FakeRunner()
    app.state.policies = None
    app.state.checker = None

    return TestClient(app), app.state.store


def as_merchant(merchant_id):
    return {"X-Merchant-Id": str(merchant_id)}


def counting_client():
    return FakeClient(reply(run_sql("SELECT count(*) AS n FROM orders")), reply(text("412.")))


# ------------------------------------------------------------ plumbing


def test_health():
    api, _ = make()
    assert api.get("/health").json() == {"ok": True}


def test_merchants_are_listed_for_the_picker():
    api, _ = make()
    body = api.get("/merchants").json()
    assert [m["id"] for m in body] == [1, 2]
    assert body[0]["name"] == "Mekong Noodle House"


# ------------------------------------------------------------ who is asking


def test_ask_without_a_merchant_is_rejected():
    api, _ = make()
    assert api.post("/ask", json={"question": "hi"}).status_code == 422


def test_ask_as_an_unknown_merchant_is_rejected():
    api, _ = make()
    r = api.post("/ask", json={"question": "hi"}, headers=as_merchant(99))
    assert r.status_code == 404


def test_the_header_decides_the_tenant_whatever_the_question_says():
    runner = FakeRunner(rows((0,)))
    api, _ = make(counting_client(), runner)

    api.post("/ask", json={"question": "orders for merchant 1"}, headers=as_merchant(2))

    executed = " ".join(runner.sql[0].lower().split())
    assert "merchant_id = 2" in executed
    assert "merchant_id = 1" not in executed


def test_an_empty_question_is_rejected():
    api, _ = make()
    assert api.post("/ask", json={"question": ""}, headers=as_merchant(1)).status_code == 422


# ------------------------------------------------------------ the trace


def test_ask_returns_the_trace_and_stores_it():
    api, store = make(counting_client(), FakeRunner(rows((412,))))

    r = api.post("/ask", json={"question": "how many orders?"}, headers=as_merchant(1))

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "answered"
    assert body["answer"] == "412."
    assert body["merchant_id"] == 1
    assert [s["actor"] for s in body["steps"]] == ["model", "code", "code", "model"]
    assert body["usage"]["output_tokens"] == 40
    assert body["cost_usd"] > 0
    assert len(store.traces) == 1


def test_a_failed_request_is_still_a_stored_trace():
    boom = anthropic.APIConnectionError(request=httpx2.Request("POST", "https://example.test"))
    api, store = make(FakeClient(boom))

    r = api.post("/ask", json={"question": "how many orders?"}, headers=as_merchant(1))

    assert r.status_code == 200
    assert r.json()["status"] == "error"
    assert len(store.traces) == 1


def test_a_trace_can_be_fetched_by_its_owner_only():
    api, _ = make(counting_client(), FakeRunner(rows((412,))))
    trace_id = api.post("/ask", json={"question": "q"}, headers=as_merchant(1)).json()["id"]

    assert api.get(f"/traces/{trace_id}", headers=as_merchant(1)).status_code == 200
    assert api.get(f"/traces/{trace_id}", headers=as_merchant(2)).status_code == 404


def test_a_trace_is_only_readable_by_the_restaurant_that_asked():
    api, _ = make(FakeClient(reply(text("hi"))))
    trace_id = api.post("/ask", json={"question": "a"}, headers=as_merchant(1)).json()["id"]
    assert api.get(f"/traces/{trace_id}", headers=as_merchant(1)).status_code == 200
    assert api.get(f"/traces/{trace_id}", headers=as_merchant(2)).status_code == 404


def test_question_stats_count_every_time_this_restaurant_asked_it():
    api, _ = make(FakeClient(reply(text("hi")), reply(text("hi")), reply(text("hi"))))
    api.post("/ask", json={"question": "a"}, headers=as_merchant(1))
    api.post("/ask", json={"question": "a"}, headers=as_merchant(1))
    api.post("/ask", json={"question": "a"}, headers=as_merchant(2))
    stats = api.get("/questions/stats", params={"question": "a"}, headers=as_merchant(1)).json()
    assert (stats["asked"], stats["answered"]) == (2, 2)
    assert (
        api.get("/questions/stats", params={"question": "zzz"}, headers=as_merchant(1)).json()[
            "asked"
        ]
        == 0
    )


def test_a_configured_token_is_required_on_everything_but_health():
    api, _ = make()
    api.app.state.api_token = "s3cret"
    assert api.get("/health").status_code == 200
    assert api.get("/merchants").status_code == 401
    assert api.get("/merchants", headers={"X-API-Token": "wrong"}).status_code == 401
    assert api.get("/merchants", headers={"X-API-Token": "s3cret"}).status_code == 200


def test_without_a_token_the_api_is_open_for_local_work():
    api, _ = make()
    assert api.get("/merchants").status_code == 200
