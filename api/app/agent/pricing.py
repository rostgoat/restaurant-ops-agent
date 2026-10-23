from __future__ import annotations

from dataclasses import dataclass

from .trace import Usage


@dataclass(frozen=True)
class Price:
    input: float
    output: float
    cache_read: float
    cache_write: float


# USD per million tokens, Anthropic list prices as of 2026-10-06; cache_write is
# the 5-minute rate. An unlisted model raises rather than getting a guessed cost.
PRICES: dict[str, Price] = {
    "claude-opus-5-5": Price(input=4.00, output=20.00, cache_read=0.20, cache_write=5.00),
    "claude-sonnet-5-5": Price(input=2.00, output=10.00, cache_read=0.20, cache_write=2.50),
}


def cost_usd(model: str, usage: Usage) -> float:
    price = PRICES[model]
    per_million = (
        usage.input_tokens * price.input
        + usage.output_tokens * price.output
        + usage.cache_read_tokens * price.cache_read
        + usage.cache_write_tokens * price.cache_write
    )
    return round(per_million / 1_000_000, 6)
