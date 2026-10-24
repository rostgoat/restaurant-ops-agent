from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Any, Literal
from uuid import UUID

if TYPE_CHECKING:
    from .proposals import Proposal

Actor = Literal["model", "code", "human"]
Status = Literal["answered", "refused", "blocked", "error"]


@dataclass
class Step:
    seq: int
    actor: Actor
    name: str
    outcome: str
    detail: dict[str, Any] | None = None
    latency_ms: int = 0


@dataclass
class Usage:
    input_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    output_tokens: int = 0

    @property
    def tokens_in(self) -> int:
        return self.input_tokens + self.cache_read_tokens + self.cache_write_tokens

    def add(self, reply_usage: Any) -> None:
        self.input_tokens += reply_usage.input_tokens
        self.output_tokens += reply_usage.output_tokens
        self.cache_read_tokens += reply_usage.cache_read_input_tokens or 0
        self.cache_write_tokens += reply_usage.cache_creation_input_tokens or 0


@dataclass
class Trace:
    id: UUID
    merchant_id: int
    question: str
    created_at: datetime
    model: str
    status: Status | None = None
    answer: str | None = None
    usage: Usage = field(default_factory=Usage)
    cost_usd: float = 0.0
    latency_ms: int = 0
    model_ms: int = 0
    tool_ms: int = 0
    retries: int = 0
    steps: list[Step] = field(default_factory=list)
    proposals: list[Proposal] = field(default_factory=list)

    def step(
        self,
        actor: Actor,
        name: str,
        outcome: str,
        detail: dict[str, Any] | None = None,
        *,
        latency_ms: int = 0,
    ) -> Step:
        step = Step(len(self.steps) + 1, actor, name, outcome, detail, latency_ms)
        self.steps.append(step)
        return step

    def finish(self, status: Status, answer: str | None, *, latency_ms: int) -> Trace:
        self.status = status
        self.answer = answer
        self.latency_ms = latency_ms
        return self
