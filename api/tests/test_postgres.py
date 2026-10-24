"""
Tests that need a real database. Skipped unless TEST_DATABASE_URL is set.

    TEST_DATABASE_URL=postgresql://ops:ops@127.0.0.1:5432/ops_demo pytest
"""
from __future__ import annotations

import os
from datetime import UTC, datetime
from uuid import uuid4

import psycopg
import pytest

from app.agent import answer
from app.agent.trace import Trace, Usage
from app.sql.execute import PostgresRunner, QueryError
from app.sql.guard import guard
from app.store import Store

from .fakes import FakeClient, reply, run_sql, text

DSN = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DSN, reason="TEST_DATABASE_URL is not set")


@pytest.fixture(scope="module")
def runner():
    r = PostgresRunner(DSN, statement_timeout_ms=500)
    yield r
    r.close()


@pytest.fixture(scope="module")
def store():
    s = Store(DSN)
    s.open()
    yield s
    s.close()


def count_orders(runner, merchant_id):
    verdict = guard("SELECT count(*) AS n FROM orders", merchant_id)
    assert verdict.ok, verdict.reason
    return runner.run(verdict.sql).rows[0][0]


# ------------------------------------------------------------ the runner


def test_a_guarded_query_runs_and_returns_rows(runner):
    verdict = guard("SELECT channel, count(*) AS n FROM orders GROUP BY 1 ORDER BY 2 DESC", 1)
    result = runner.run(verdict.sql)
    assert result.columns == ["channel", "n"]
    assert len(result.rows) > 1
    assert all(n > 0 for _, n in result.rows)


def test_tenants_see_disjoint_rows_that_add_up(runner):
    total = runner.run("SELECT count(*) FROM orders").rows[0][0]
    one, two = count_orders(runner, 1), count_orders(runner, 2)
    assert one > 0 and two > 0
    assert one != two
    assert one + two == total


def test_the_connection_refuses_writes_even_without_the_guard(runner):
    with pytest.raises(QueryError) as e:
        runner.run("INSERT INTO merchants (id, name, cuisine, timezone, opened_at) "
                   "VALUES (9, 'x', 'x', 'UTC', '2026-01-01')")
    assert "read-only" in str(e.value)


def test_a_slow_query_is_cut_off(runner):
    with pytest.raises(QueryError) as e:
        runner.run("SELECT pg_sleep(5)")
    assert "statement timeout" in str(e.value)


def test_a_bad_column_is_a_query_error_with_the_database_message(runner):
    with pytest.raises(QueryError) as e:
        runner.run("SELECT nope FROM orders")
    assert "nope" in str(e.value)


# ------------------------------------------------------------ the store


def test_merchants_come_from_the_database(store):
    assert [m.id for m in store.merchants()] == [1, 2]
    assert store.merchant_exists(1)
    assert not store.merchant_exists(99)


def test_a_trace_survives_the_round_trip(store):
    trace = Trace(
        id=uuid4(), merchant_id=1, question="how many orders?",
        created_at=datetime.now(UTC), model="claude-opus-5-5", status="answered",
        answer="412.", usage=Usage(1000, 500, 300, 250), cost_usd=0.0096,
        latency_ms=1200, model_ms=1100, tool_ms=40, retries=1,
    )
    trace.step("model", "run_sql", "proposed", {"sql": "SELECT 1", "usage": {"input_tokens": 1}})
    trace.step("code", "guard", "passed", {"checks": [{"name": "parses", "passed": True}]})
    trace.step("code", "execute", "ok", {"rows": [[412]], "columns": ["n"]}, latency_ms=40)
    trace.step("model", "answer", "answered", {"text": "412."})
    try:
        store.save_trace(trace)

        loaded = store.get_trace(trace.id, 1)
        assert loaded is not None
        assert loaded.question == "how many orders?"
        assert (loaded.status, loaded.answer) == ("answered", "412.")
        assert loaded.usage.tokens_in == trace.usage.tokens_in
        assert loaded.usage.output_tokens == 250
        assert loaded.cost_usd == 0.0096
        assert loaded.retries == 1
        assert [(s.seq, s.actor, s.name, s.outcome) for s in loaded.steps] == [
            (1, "model", "run_sql", "proposed"),
            (2, "code", "guard", "passed"),
            (3, "code", "execute", "ok"),
            (4, "model", "answer", "answered"),
        ]
        assert loaded.steps[2].detail == {"rows": [[412]], "columns": ["n"]}
        assert loaded.steps[2].latency_ms == 40

        assert store.get_trace(trace.id, 2) is None
        assert trace.id in [t.id for t in store.recent_traces(1, 5)]
        assert trace.id not in [t.id for t in store.recent_traces(2, 5)]
    finally:
        with psycopg.connect(DSN) as conn:
            conn.execute("DELETE FROM request_traces WHERE id = %s", (trace.id,))


# ------------------------------------------------------------ policy search


def test_policy_search_is_scoped_to_the_merchant_before_similarity():
    from pathlib import Path

    from app.policies import FakeEmbedder, PostgresPolicySearch
    from app.policies.index import index

    policies = Path(__file__).resolve().parents[2] / "data" / "policies"
    index(policies, [DSN], FakeEmbedder())
    search = PostgresPolicySearch(DSN, FakeEmbedder())
    try:
        query = "missing items on a DoorDash order, dispute window and packing photo"
        noodle = search.search(1, query, limit=3)
        coffee = search.search(2, query, limit=3)
        assert noodle[0].label.startswith("marketplace:")
        assert all(not h.label.startswith("marketplace:") for h in coffee)
        assert noodle[0].score > coffee[0].score
        assert all(0.0 <= h.score <= 1.0 for h in noodle + coffee)
    finally:
        search.close()


# ------------------------------------------------------------ the loop, for real


def test_the_loop_answers_from_real_rows(runner):
    client = FakeClient(
        reply(run_sql("SELECT count(*) AS n FROM orders WHERE state = 'completed'")),
        reply(text("done")),
    )

    trace = answer("how many completed orders?", 2, client=client, runner=runner)

    assert trace.status == "answered"
    execute = trace.steps[2]
    assert execute.outcome == "ok"
    assert execute.detail["columns"] == ["n"]
    assert 0 < execute.detail["rows"][0][0] < count_orders(runner, 2)
    assert trace.tool_ms >= 0
