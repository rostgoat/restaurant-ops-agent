from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from app.agent.proposals import Proposal
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

_INSERT_PROPOSAL = """
INSERT INTO proposals
    (id, merchant_id, trace_id, created_at, kind, summary, audience_size, discount_pct,
     draft_message, status, blocked_reason, decided_at, payload)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""

_PROPOSAL_COLUMNS = """
    id, merchant_id, trace_id, created_at, kind, summary, audience_size, discount_pct,
    draft_message, status, blocked_reason, decided_at, payload
"""

_SELECT_PROPOSALS_FOR = f"""
SELECT {_PROPOSAL_COLUMNS} FROM proposals WHERE trace_id = ANY(%s) ORDER BY created_at, id
"""

_SELECT_PROPOSAL = f"SELECT {_PROPOSAL_COLUMNS} FROM proposals WHERE id = %s AND merchant_id = %s"

_SELECT_PROPOSALS = f"""
SELECT {_PROPOSAL_COLUMNS} FROM proposals
WHERE merchant_id = %s ORDER BY (status = 'pending') DESC, created_at DESC LIMIT %s
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
            conn.cursor().executemany(_INSERT_PROPOSAL, [_proposal_row(p) for p in trace.proposals])

    def append_steps(self, trace_id: UUID, steps: list[Step]) -> None:
        with self._pool.connection() as conn, conn.transaction():
            conn.cursor().executemany(
                _INSERT_STEP,
                [
                    (
                        trace_id, s.seq, s.actor, s.name, s.outcome,
                        Jsonb(s.detail) if s.detail is not None else None, s.latency_ms,
                    )
                    for s in steps
                ],
            )

    def get_proposal(self, proposal_id: UUID, merchant_id: int) -> Proposal | None:
        with self._pool.connection() as conn:
            row = conn.execute(_SELECT_PROPOSAL, (proposal_id, merchant_id)).fetchone()
        return _proposal(row) if row else None

    def proposals(self, merchant_id: int, limit: int) -> list[Proposal]:
        with self._pool.connection() as conn:
            rows = conn.execute(_SELECT_PROPOSALS, (merchant_id, limit)).fetchall()
        return [_proposal(r) for r in rows]

    def decide_proposal(self, proposal: Proposal) -> None:
        with self._pool.connection() as conn, conn.transaction():
            conn.execute(
                "UPDATE proposals SET status = %s, decided_at = %s, payload = %s WHERE id = %s",
                (proposal.status, proposal.decided_at, Jsonb(proposal.payload), proposal.id),
            )

    def get_trace(self, trace_id: UUID, merchant_id: int) -> Trace | None:
        with self._pool.connection() as conn:
            row = conn.execute(_SELECT_TRACE, (trace_id, merchant_id)).fetchone()
            if row is None:
                return None
            steps = conn.execute(_SELECT_STEPS, ([trace_id],)).fetchall()
            proposals = conn.execute(_SELECT_PROPOSALS_FOR, ([trace_id],)).fetchall()
        trace = _trace(row, [_step(s) for s in steps])
        trace.proposals = [_proposal(p) for p in proposals]
        return trace

    def recent_traces(self, merchant_id: int, limit: int) -> list[Trace]:
        with self._pool.connection() as conn:
            rows = conn.execute(_SELECT_RECENT, (merchant_id, limit)).fetchall()
            ids = [row[0] for row in rows]
            steps = conn.execute(_SELECT_STEPS, (ids,)).fetchall() if ids else []
            proposals = conn.execute(_SELECT_PROPOSALS_FOR, (ids,)).fetchall() if ids else []
        by_trace: dict[UUID, list[Step]] = {}
        for s in steps:
            by_trace.setdefault(s[0], []).append(_step(s))
        proposals_by_trace: dict[UUID, list[Proposal]] = {}
        for p in proposals:
            proposal = _proposal(p)
            proposals_by_trace.setdefault(proposal.trace_id, []).append(proposal)
        traces = [_trace(row, by_trace.get(row[0], [])) for row in rows]
        for t in traces:
            t.proposals = proposals_by_trace.get(t.id, [])
        return traces


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


def _proposal_row(p: Proposal) -> tuple[Any, ...]:
    return (
        p.id, p.merchant_id, p.trace_id, p.created_at, p.kind, p.summary, p.audience_size,
        p.discount_pct, p.draft_message, p.status, p.blocked_reason, p.decided_at,
        Jsonb(p.payload),
    )


def _proposal(row: tuple[Any, ...]) -> Proposal:
    (
        id, merchant_id, trace_id, created_at, kind, summary, audience_size, discount_pct,
        draft_message, status, blocked_reason, decided_at, payload,
    ) = row
    return Proposal(
        id=id, merchant_id=merchant_id, trace_id=trace_id, created_at=created_at, kind=kind,
        summary=summary, status=status, payload=payload or {}, blocked_reason=blocked_reason,
        audience_size=audience_size, discount_pct=discount_pct, draft_message=draft_message,
        decided_at=decided_at,
    )


def _step(row: tuple[Any, ...]) -> Step:
    _, seq, actor, name, outcome, detail, latency_ms = row
    return Step(seq, actor, name, outcome, detail, latency_ms or 0)
