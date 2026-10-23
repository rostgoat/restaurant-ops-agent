from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from app.agent.trace import Step, Trace, Usage


@dataclass(frozen=True)
class Merchant:
    id: int
    name: str
    cuisine: str
    timezone: str


_INSERT_TRACE = """
INSERT INTO request_traces
    (id, merchant_id, created_at, question, status, answer, model,
     tokens_in, tokens_out, cost_usd, latency_ms, model_ms, tool_ms, retries)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""

_INSERT_STEP = """
INSERT INTO trace_steps (trace_id, seq, actor, name, outcome, detail, latency_ms)
VALUES (%s, %s, %s, %s, %s, %s, %s)
"""

_TRACE_COLUMNS = """
    id, merchant_id, created_at, question, status, answer, model,
    tokens_in, tokens_out, cost_usd, latency_ms, model_ms, tool_ms, retries
"""

_SELECT_TRACE = f"SELECT {_TRACE_COLUMNS} FROM request_traces WHERE id = %s AND merchant_id = %s"

_SELECT_RECENT = f"""
SELECT {_TRACE_COLUMNS} FROM request_traces
WHERE merchant_id = %s ORDER BY created_at DESC LIMIT %s
"""

_SELECT_STEPS = """
SELECT trace_id, seq, actor, name, outcome, detail, latency_ms
FROM trace_steps WHERE trace_id = ANY(%s) ORDER BY trace_id, seq
"""


class Store:
    def __init__(self, dsn: str, *, max_connections: int = 4):
        self._pool = ConnectionPool(dsn, open=False, min_size=0, max_size=max_connections)

    def open(self) -> None:
        self._pool.open()

    def close(self) -> None:
        self._pool.close()

    def merchants(self) -> list[Merchant]:
        with self._pool.connection() as conn:
            rows = conn.execute(
                "SELECT id, name, cuisine, timezone FROM merchants ORDER BY id"
            ).fetchall()
        return [Merchant(*row) for row in rows]

    def merchant_exists(self, merchant_id: int) -> bool:
        with self._pool.connection() as conn:
            row = conn.execute("SELECT 1 FROM merchants WHERE id = %s", (merchant_id,)).fetchone()
        return row is not None

    def save_trace(self, trace: Trace) -> None:
        with self._pool.connection() as conn, conn.transaction():
            conn.execute(
                _INSERT_TRACE,
                (
                    trace.id, trace.merchant_id, trace.created_at, trace.question,
                    trace.status, trace.answer, trace.model,
                    trace.usage.tokens_in, trace.usage.output_tokens, trace.cost_usd,
                    trace.latency_ms, trace.model_ms, trace.tool_ms, trace.retries,
                ),
            )
            conn.cursor().executemany(
                _INSERT_STEP,
                [
                    (
                        trace.id, s.seq, s.actor, s.name, s.outcome,
                        Jsonb(s.detail) if s.detail is not None else None, s.latency_ms,
                    )
                    for s in trace.steps
                ],
            )

    def get_trace(self, trace_id: UUID, merchant_id: int) -> Trace | None:
        with self._pool.connection() as conn:
            row = conn.execute(_SELECT_TRACE, (trace_id, merchant_id)).fetchone()
            if row is None:
                return None
            steps = conn.execute(_SELECT_STEPS, ([trace_id],)).fetchall()
        return _trace(row, [_step(s) for s in steps])

    def recent_traces(self, merchant_id: int, limit: int) -> list[Trace]:
        with self._pool.connection() as conn:
            rows = conn.execute(_SELECT_RECENT, (merchant_id, limit)).fetchall()
            ids = [row[0] for row in rows]
            steps = conn.execute(_SELECT_STEPS, (ids,)).fetchall() if ids else []
        by_trace: dict[UUID, list[Step]] = {}
        for s in steps:
            by_trace.setdefault(s[0], []).append(_step(s))
        return [_trace(row, by_trace.get(row[0], [])) for row in rows]


def _trace(row: tuple[Any, ...], steps: list[Step]) -> Trace:
    (
        id, merchant_id, created_at, question, status, answer, model,
        tokens_in, tokens_out, cost_usd, latency_ms, model_ms, tool_ms, retries,
    ) = row
    return Trace(
        id=id,
        merchant_id=merchant_id,
        question=question,
        created_at=created_at,
        model=model,
        status=status,
        answer=answer,
        usage=Usage(input_tokens=tokens_in or 0, output_tokens=tokens_out or 0),
        cost_usd=float(cost_usd or 0),
        latency_ms=latency_ms or 0,
        model_ms=model_ms or 0,
        tool_ms=tool_ms or 0,
        retries=retries,
        steps=steps,
    )


def _step(row: tuple[Any, ...]) -> Step:
    _, seq, actor, name, outcome, detail, latency_ms = row
    return Step(seq, actor, name, outcome, detail, latency_ms or 0)
