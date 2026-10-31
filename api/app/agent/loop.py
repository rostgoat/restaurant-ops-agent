from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import anthropic

from app.policies.search import Hit, PolicySearch, hits_payload
from app.sql.execute import QueryError, QueryRunner
from app.sql.guard import DEFAULT_ROW_LIMIT, guard

from .pricing import cost_usd
from .prompt import SYSTEM, user_turn
from .proposals import ProposalChecker, outcome, tool_message
from .tools import TOOLS
from .trace import Status, Trace


@dataclass(frozen=True)
class Settings:
    model: str = "claude-sonnet-5-5"
    effort: str = "medium"
    max_tokens: int = 8000
    max_tool_calls: int = 6
    rows_to_model: int = 100
    row_limit: int = DEFAULT_ROW_LIMIT
    retrieval_limit: int = 4
    # Set from ten captured cases: real matches scored 0.55 to 0.70, near misses
    # 0.37 to 0.49. The evaluation set is where this becomes a measured value.
    retrieval_threshold: float = 0.40
    workspace_id: str | None = None


DEFAULT = Settings()

_CITATION = re.compile(r"\[([^\[\]]*§\s*\d+[^\[\]]*)\]")


@dataclass
class _Session:
    """Everything one request carries between model turns."""

    trace: Trace
    settings: Settings
    merchant_id: int
    runner: QueryRunner
    policies: PolicySearch | None
    checker: ProposalChecker | None
    now: datetime
    started: float
    messages: list[dict[str, Any]]
    calls: int = 0
    executed: bool = False
    blocked: bool = False
    retrieved: set[str] | None = None

    def finish(self, status: Status, text: str | None = None) -> Trace:
        self.trace.cost_usd = cost_usd(self.settings.model, self.trace.usage)

        return self.trace.finish(status, text, latency_ms=_ms(self.started))

    def stopped_short(self) -> Status:
        """Nothing ran: if the guard blocked a query, the guard decided this request."""

        return "blocked" if self.blocked and not self.executed else "error"


def answer(
    question: str,
    merchant_id: int,
    *,
    client: anthropic.Anthropic,
    runner: QueryRunner,
    policies: PolicySearch | None = None,
    checker: ProposalChecker | None = None,
    settings: Settings = DEFAULT,
    now: datetime | None = None,
) -> Trace:
    now = now or datetime.now(UTC)
    session = _Session(
        trace=Trace(
            id=uuid4(),
            merchant_id=merchant_id,
            question=question,
            created_at=now,
            model=settings.model,
        ),
        settings=settings,
        merchant_id=merchant_id,
        runner=runner,
        policies=policies,
        checker=checker,
        now=now,
        started=time.perf_counter(),
        messages=[{"role": "user", "content": user_turn(question, now)}],
    )

    while True:
        done = _turn(session, client)

        if done is not None:
            return done


def _turn(s: _Session, client: anthropic.Anthropic) -> Trace | None:
    """One model call and whatever it asked for. A trace when the request is over."""
    reply, model_ms = _call_model(s, client)

    if reply is None:
        return s.finish("error")
    usage = _usage(reply.usage)
    stopped = _stopped_early(s, reply, usage, model_ms)

    if stopped is not None:
        return stopped
    text = "".join(b.text for b in reply.content if b.type == "text").strip()
    call = next((b for b in reply.content if b.type == "tool_use"), None)

    if call is None:
        return _answered(s, text, usage, model_ms)

    if call.name == "decline":
        return _declined(s, call, usage, model_ms)
    s.trace.step("model", call.name, "proposed", dict(call.input) | usage, latency_ms=model_ms)
    s.calls += 1

    if s.calls > s.settings.max_tool_calls:
        s.trace.step("code", "tool_limit", "reached", {"limit": s.settings.max_tool_calls})

        return s.finish(s.stopped_short())
    result = _dispatch(s, call)

    if result.get("is_error"):
        s.trace.retries += 1
    s.messages.append({"role": "assistant", "content": reply.content})
    s.messages.append({"role": "user", "content": [result]})

    return None


def _call_model(s: _Session, client: anthropic.Anthropic) -> tuple[Any, int]:
    t0 = time.perf_counter()

    try:
        reply = client.messages.create(**request(s.settings, s.messages))
    except anthropic.APIError as e:
        s.trace.step("model", "respond", "error", {"error": str(e)}, latency_ms=_ms(t0))

        return None, _ms(t0)
    model_ms = _ms(t0)
    s.trace.model_ms += model_ms
    s.trace.usage.add(reply.usage)
    s.trace.model = reply.model

    return reply, model_ms


def _stopped_early(s: _Session, reply: Any, usage: dict[str, Any], model_ms: int) -> Trace | None:
    if reply.stop_reason == "refusal":
        detail = reply.stop_details.model_dump() if reply.stop_details else {}
        s.trace.step("model", "respond", "refusal", detail | usage, latency_ms=model_ms)

        return s.finish("refused")

    if reply.stop_reason == "max_tokens":
        s.trace.step("model", "respond", "max_tokens", usage, latency_ms=model_ms)

        return s.finish("error")

    return None


def _answered(s: _Session, text: str, usage: dict[str, Any], model_ms: int) -> Trace:
    s.trace.step("model", "answer", "answered", {"text": text} | usage, latency_ms=model_ms)

    if s.retrieved is not None:
        _check_citations(s.trace, text, s.retrieved)
    # Text after a block, with nothing executed, is the model talking around
    # the guard. The guard decided this request, not the model.
    status: Status = "blocked" if s.blocked and not s.executed else "answered"

    return s.finish(status, text)


def _declined(s: _Session, call: Any, usage: dict[str, Any], model_ms: int) -> Trace:
    reason = str(call.input.get("reason", "")).strip()
    s.trace.step("model", "decline", "declined", {"reason": reason} | usage, latency_ms=model_ms)

    return s.finish("refused", reason)


def _dispatch(s: _Session, call: Any) -> dict[str, Any]:
    if call.name == "run_sql":
        result, outcome = _run_sql(call, s.trace, s.merchant_id, s.runner, s.settings)
        s.executed = s.executed or outcome == "ok"
        s.blocked = s.blocked or outcome == "blocked"

        return result

    if call.name == "search_policy":
        result, labels = _search_policy(call, s.trace, s.merchant_id, s.policies, s.settings)
        s.retrieved = (s.retrieved or set()) | labels

        return result

    if call.name == "propose":
        return _propose(call, s.trace, s.merchant_id, s.checker, s.now)

    return _tool_result(call.id, f"There is no tool named {call.name}.", error=True)


def request(settings: Settings, messages: list[dict[str, Any]]) -> dict[str, Any]:
    # No thinking parameter: on this model thinking is always on, and asking to
    # disable it is rejected. output_config.effort is the only depth control.
    params: dict[str, Any] = {
        "model": settings.model,
        "max_tokens": settings.max_tokens,
        "system": [{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
        "tools": TOOLS,
        "tool_choice": {"type": "auto", "disable_parallel_tool_use": True},
        "output_config": {"effort": settings.effort},
        "messages": messages,
    }
    # An organisation-level key is refused without this; a workspace key ignores it.
    if settings.workspace_id:
        params["workspace_id"] = settings.workspace_id

    return params


def _run_sql(
    call: Any,
    trace: Trace,
    merchant_id: int,
    runner: QueryRunner,
    settings: Settings,
) -> tuple[dict[str, Any], str]:
    verdict = _guarded(trace, str(call.input.get("sql", "")), merchant_id, settings)

    if not verdict.ok:
        message = (
            f"Blocked by the '{verdict.blocked_by}' check: {verdict.reason}. "
            "Rewrite the query, or decline if it cannot be done."
        )

        return _tool_result(call.id, message, error=True), "blocked"

    return _executed(call, trace, runner, verdict.sql, settings)


def _guarded(trace: Trace, sql: str, merchant_id: int, settings: Settings):
    t0 = time.perf_counter()
    verdict = guard(sql, merchant_id, row_limit=settings.row_limit)
    checks = [{"name": c.name, "passed": c.passed, "detail": c.detail} for c in verdict.checks]

    if not verdict.ok:
        detail = {"checks": checks, "blocked_by": verdict.blocked_by, "reason": verdict.reason}
        trace.step("code", "guard", "blocked", detail, latency_ms=_ms(t0))

        return verdict
    trace.step(
        "code", "guard", "passed", {"checks": checks, "sql": verdict.sql}, latency_ms=_ms(t0)
    )

    return verdict


def _executed(
    call: Any, trace: Trace, runner: QueryRunner, sql: str, settings: Settings
) -> tuple[dict[str, Any], str]:
    t0 = time.perf_counter()

    try:
        rows = runner.run(sql)
    except QueryError as e:
        elapsed = _ms(t0)
        trace.tool_ms += elapsed
        trace.step("code", "execute", "error", {"error": str(e)}, latency_ms=elapsed)
        message = f"The query failed: {e}. Fix it, or decline if it cannot be done."

        return _tool_result(call.id, message, error=True), "error"
    elapsed = _ms(t0)
    trace.tool_ms += elapsed
    payload = rows.to_payload(settings.rows_to_model)
    trace.step("code", "execute", "ok", payload, latency_ms=elapsed)

    return _tool_result(call.id, json.dumps(payload)), "ok"


def _search_policy(
    call: Any,
    trace: Trace,
    merchant_id: int,
    policies: PolicySearch | None,
    settings: Settings,
) -> tuple[dict[str, Any], set[str]]:
    query = str(call.input.get("query", "")).strip()

    if policies is None:
        trace.step("code", "retrieve", "unavailable", {"query": query})

        return _tool_result(call.id, "Policy search is not available.", error=True), set()

    t0 = time.perf_counter()
    hits: list[Hit] = policies.search(merchant_id, query, limit=settings.retrieval_limit)
    elapsed = _ms(t0)
    trace.tool_ms += elapsed
    used = [h for h in hits if h.score >= settings.retrieval_threshold]
    detail = {"query": query, "merchant_id": merchant_id} | hits_payload(
        hits, settings.retrieval_threshold
    )
    if not used:
        trace.step("code", "retrieve", "nothing above threshold", detail, latency_ms=elapsed)
        message = "No section of this restaurant's policies matches closely enough."

        return _tool_result(call.id, message), set()
    trace.step(
        "code",
        "retrieve",
        f"{len(used)} {'section' if len(used) == 1 else 'sections'}",
        detail,
        latency_ms=elapsed,
    )
    payload = {"sections": [{"label": h.label, "text": h.body} for h in used]}

    return _tool_result(call.id, json.dumps(payload)), {h.label for h in used}


def _propose(
    call: Any, trace: Trace, merchant_id: int, checker: ProposalChecker | None, now: datetime
) -> dict[str, Any]:
    if checker is None:
        trace.step("code", "check_proposal", "unavailable", dict(call.input))

        return _tool_result(call.id, "Proposals are not available.", error=True)
    t0 = time.perf_counter()
    proposal = checker.check(merchant_id, trace.id, now, dict(call.input))
    elapsed = _ms(t0)
    trace.tool_ms += elapsed
    trace.proposals.append(proposal)
    detail = {
        "proposal_id": str(proposal.id),
        "kind": proposal.kind,
        "summary": proposal.summary,
        "checks": proposal.payload.get("checks", []),
        "blocked_reason": proposal.blocked_reason,
        "audience_size": proposal.audience_size,
        "due_by": proposal.payload.get("due_by"),
        "needs_owner": bool(proposal.payload.get("needs_owner")),
    }
    trace.step("code", "check_proposal", outcome(proposal), detail, latency_ms=elapsed)

    return _tool_result(call.id, json.dumps(tool_message(proposal)))


def citations_in(text: str) -> set[str]:
    """Section labels cited in square brackets; "[A §1, X; B §2, Y]" cites two."""

    return {
        " ".join(part.split())
        for found in _CITATION.findall(text)
        for part in found.split(";")
        if part.strip()
    }


def _check_citations(trace: Trace, text: str, retrieved: set[str]) -> None:
    cited = citations_in(text)
    missing = sorted(cited - retrieved)
    detail = {"cited": sorted(cited), "retrieved": sorted(retrieved), "not_retrieved": missing}

    if not retrieved:
        outcome = "failed" if cited else "passed"
        reason = "cited a section although nothing was retrieved" if cited else None
        trace.step("code", "citations", outcome, detail | {"reason": reason})
    elif not cited:
        reason = "policy was used but nothing was cited"
        trace.step("code", "citations", "failed", detail | {"reason": reason})
    elif missing:
        reason = "cited a section that was not retrieved"
        trace.step("code", "citations", "failed", detail | {"reason": reason})
    else:
        trace.step("code", "citations", "passed", detail)


def _usage(reply_usage: Any) -> dict[str, Any]:
    return {
        "usage": {
            "input_tokens": reply_usage.input_tokens,
            "cache_read_tokens": reply_usage.cache_read_input_tokens or 0,
            "cache_write_tokens": reply_usage.cache_creation_input_tokens or 0,
            "output_tokens": reply_usage.output_tokens,
        }
    }


def _tool_result(tool_use_id: str, content: str, *, error: bool = False) -> dict[str, Any]:
    result: dict[str, Any] = {"type": "tool_result", "tool_use_id": tool_use_id, "content": content}

    if error:
        result["is_error"] = True

    return result


def _ms(since: float) -> int:
    return int((time.perf_counter() - since) * 1000)
