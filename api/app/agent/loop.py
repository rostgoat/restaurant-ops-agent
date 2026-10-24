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
from .tools import TOOLS
from .trace import Status, Trace


@dataclass(frozen=True)
class Settings:
    model: str = "claude-sonnet-5-5"
    effort: str = "medium"
    max_tokens: int = 8000
    max_queries: int = 3
    rows_to_model: int = 100
    row_limit: int = DEFAULT_ROW_LIMIT
    retrieval_limit: int = 4
    retrieval_threshold: float = 0.30
    workspace_id: str | None = None


DEFAULT = Settings()

_CITATION = re.compile(r"\[([a-z-]+: [^\]]+)\]")


def answer(
    question: str,
    merchant_id: int,
    *,
    client: anthropic.Anthropic,
    runner: QueryRunner,
    policies: PolicySearch | None = None,
    settings: Settings = DEFAULT,
    now: datetime | None = None,
) -> Trace:
    now = now or datetime.now(UTC)
    started = time.perf_counter()
    trace = Trace(
        id=uuid4(),
        merchant_id=merchant_id,
        question=question,
        created_at=now,
        model=settings.model,
    )
    messages: list[dict[str, Any]] = [{"role": "user", "content": user_turn(question, now)}]
    calls = 0
    executed = False
    blocked = False
    retrieved: set[str] | None = None

    def finish(status: Status, text: str | None = None) -> Trace:
        trace.cost_usd = cost_usd(settings.model, trace.usage)
        return trace.finish(status, text, latency_ms=_ms(started))

    while True:
        t0 = time.perf_counter()
        try:
            reply = client.messages.create(**request(settings, messages))
        except anthropic.APIError as e:
            trace.step("model", "respond", "error", {"error": str(e)}, latency_ms=_ms(t0))
            return finish("error")
        model_ms = _ms(t0)
        trace.model_ms += model_ms
        trace.usage.add(reply.usage)
        trace.model = reply.model
        usage = _usage(reply.usage)

        if reply.stop_reason == "refusal":
            detail = reply.stop_details.model_dump() if reply.stop_details else {}
            trace.step("model", "respond", "refusal", detail | usage, latency_ms=model_ms)
            return finish("refused")
        if reply.stop_reason == "max_tokens":
            trace.step("model", "respond", "max_tokens", usage, latency_ms=model_ms)
            return finish("error")

        text = "".join(b.text for b in reply.content if b.type == "text").strip()
        call = next((b for b in reply.content if b.type == "tool_use"), None)

        if call is None:
            trace.step("model", "answer", "answered", {"text": text} | usage, latency_ms=model_ms)
            if retrieved is not None:
                _check_citations(trace, text, retrieved)
            # Text after a block, with nothing executed, is the model talking
            # around the guard. The guard decided this request, not the model.
            return finish("blocked" if blocked and not executed else "answered", text)

        if call.name == "decline":
            reason = str(call.input.get("reason", "")).strip()
            detail = {"reason": reason} | usage
            trace.step("model", "decline", "declined", detail, latency_ms=model_ms)
            return finish("refused", reason)

        trace.step("model", call.name, "proposed", dict(call.input) | usage, latency_ms=model_ms)
        calls += 1
        if calls > settings.max_queries:
            trace.step("code", "query_limit", "reached", {"limit": settings.max_queries})
            return finish("blocked" if blocked and not executed else "error")

        if call.name == "run_sql":
            result, outcome = _run_sql(call, trace, merchant_id, runner, settings)
            executed = executed or outcome == "ok"
            blocked = blocked or outcome == "blocked"
        elif call.name == "search_policy":
            result, labels = _search_policy(call, trace, merchant_id, policies, settings)
            retrieved = (retrieved or set()) | labels
        else:
            result = _tool_result(call.id, f"There is no tool named {call.name}.", error=True)
        if result.get("is_error"):
            trace.retries += 1

        messages.append({"role": "assistant", "content": reply.content})
        messages.append({"role": "user", "content": [result]})


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
    sql = str(call.input.get("sql", ""))

    t0 = time.perf_counter()
    verdict = guard(sql, merchant_id, row_limit=settings.row_limit)
    checks = [{"name": c.name, "passed": c.passed, "detail": c.detail} for c in verdict.checks]
    if not verdict.ok:
        trace.step(
            "code", "guard", "blocked",
            {"checks": checks, "blocked_by": verdict.blocked_by, "reason": verdict.reason},
            latency_ms=_ms(t0),
        )
        message = (
            f"Blocked by the '{verdict.blocked_by}' check: {verdict.reason}. "
            "Rewrite the query, or decline if it cannot be done."
        )
        return _tool_result(call.id, message, error=True), "blocked"
    trace.step(
        "code", "guard", "passed", {"checks": checks, "sql": verdict.sql}, latency_ms=_ms(t0)
    )

    t0 = time.perf_counter()
    try:
        rows = runner.run(verdict.sql)
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
        "code", "retrieve", f"{len(used)} {'section' if len(used) == 1 else 'sections'}",
        detail, latency_ms=elapsed,
    )
    payload = {"sections": [{"label": h.label, "text": h.body} for h in used]}
    return _tool_result(call.id, json.dumps(payload)), {h.label for h in used}


def _check_citations(trace: Trace, text: str, retrieved: set[str]) -> None:
    cited = set(_CITATION.findall(text))
    missing = sorted(cited - retrieved)
    detail = {"cited": sorted(cited), "retrieved": sorted(retrieved), "not_retrieved": missing}
    if not cited:
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
