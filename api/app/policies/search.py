from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from psycopg_pool import ConnectionPool

from .chunks import label_for
from .embed import Embedder


@dataclass(frozen=True)
class Hit:
    label: str
    body: str
    score: float


class PolicySearch(Protocol):
    def search(self, merchant_id: int, query: str, *, limit: int) -> list[Hit]: ...


_NEAREST = """
SELECT document, section, body, 1 - (embedding <=> %(q)s::vector) AS score
FROM policy_chunks
WHERE merchant_id = %(merchant_id)s
ORDER BY embedding <=> %(q)s::vector
LIMIT %(limit)s
"""


class PostgresPolicySearch:
    def __init__(self, dsn: str, embedder: Embedder, *, max_connections: int = 2):
        self._pool = ConnectionPool(dsn, open=False, min_size=0, max_size=max_connections)
        self._embedder = embedder

    def search(self, merchant_id: int, query: str, *, limit: int) -> list[Hit]:
        vector = self._embedder.embed([query])[0]
        self._pool.open()
        with self._pool.connection() as conn:
            rows = conn.execute(
                _NEAREST, {"q": as_vector(vector), "merchant_id": merchant_id, "limit": limit}
            ).fetchall()
        return [
            Hit(label_for(document, section), body, float(score))
            for document, section, body, score in rows
        ]

    def close(self) -> None:
        self._pool.close()


def as_vector(values: list[float]) -> str:
    return "[" + ",".join(repr(float(v)) for v in values) + "]"


def hits_payload(hits: list[Hit], threshold: float) -> dict[str, Any]:
    return {
        "threshold": threshold,
        "hits": [
            {"label": h.label, "score": round(h.score, 4), "used": h.score >= threshold}
            for h in hits
        ],
    }
