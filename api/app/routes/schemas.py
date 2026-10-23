from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.agent.trace import Trace


class StepOut(BaseModel):
    seq: int
    actor: str
    name: str
    outcome: str
    detail: dict[str, Any] | None
    latency_ms: int


class UsageOut(BaseModel):
    input_tokens: int
    cache_read_tokens: int
    cache_write_tokens: int
    output_tokens: int


class TraceOut(BaseModel):
    id: UUID
    merchant_id: int
    question: str
    created_at: datetime
    model: str
    status: str
    answer: str | None
    usage: UsageOut
    cost_usd: float
    latency_ms: int
    model_ms: int
    tool_ms: int
    retries: int
    steps: list[StepOut]

    @classmethod
    def from_trace(cls, trace: Trace) -> TraceOut:
        return cls.model_validate(asdict(trace))


class MerchantOut(BaseModel):
    id: int
    name: str
    cuisine: str
    timezone: str
