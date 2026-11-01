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
    word_rank: int | None = None


class PolicySearch(Protocol):
    def search(self, merchant_id: int, query: str, *, limit: int) -> list[Hit]: ...


# Every section of one restaurant, scored two ways: how close its meaning is to
# the search (cosine similarity of the embeddings) and how well its words match.
# A word counts by how rare it is in this restaurant's policies, so "DoorDash"
# in one section of twenty-five outweighs "order" in fifteen of them.
_SCORED = """
WITH asked AS (
    SELECT DISTINCT lexeme FROM unnest(to_tsvector('english', %(text)s))
),
present AS (
    SELECT id, lexeme FROM policy_chunks, unnest(search)
    WHERE merchant_id = %(merchant_id)s
),
rarity AS (
    SELECT lexeme,
           ln((SELECT count(*) FROM policy_chunks WHERE merchant_id = %(merchant_id)s)::float
              / count(*)) AS weight
    FROM present
    WHERE lexeme IN (SELECT lexeme FROM asked)
    GROUP BY lexeme
),
words AS (
    SELECT present.id, sum(rarity.weight) AS words
    FROM present JOIN rarity USING (lexeme)
    GROUP BY present.id
)
SELECT document, section, body,
       1 - (embedding <=> %(q)s::vector) AS score,
       coalesce(words.words, 0) AS words
FROM policy_chunks
LEFT JOIN words ON words.id = policy_chunks.id
WHERE merchant_id = %(merchant_id)s
"""

RRF_K = 60


class PostgresPolicySearch:
    def __init__(self, dsn: str, embedder: Embedder, *, max_connections: int = 2):
        self._pool = ConnectionPool(dsn, open=False, min_size=0, max_size=max_connections)
        self._embedder = embedder

    def search(self, merchant_id: int, query: str, *, limit: int) -> list[Hit]:
        vector = self._embedder.embed([query])[0]
        self._pool.open()

        with self._pool.connection() as conn:
            rows = conn.execute(
                _SCORED,
                {"q": as_vector(vector), "text": query, "merchant_id": merchant_id},
            ).fetchall()

        return fuse(rows, limit)

    def close(self) -> None:
        self._pool.close()


# Reciprocal rank fusion: a section's place in the meaning list and its place in
# the words list each count, so the best word match surfaces even when its
# meaning score is low.
def fuse(rows: list[tuple[Any, ...]], limit: int) -> list[Hit]:
    by_meaning = sorted(rows, key=lambda r: -float(r[3]))
    by_words = [r for r in sorted(rows, key=lambda r: -float(r[4])) if float(r[4]) > 0]
    word_rank = {id(r): i + 1 for i, r in enumerate(by_words)}

    def fused(r: tuple[Any, ...]) -> float:
        total = 1 / (RRF_K + by_meaning.index(r) + 1)

        if id(r) in word_rank:
            total += 1 / (RRF_K + word_rank[id(r)])

        return total

    ordered = sorted(rows, key=lambda r: -fused(r))[:limit]

    return [
        Hit(label_for(document, section), body, float(score), word_rank.get(id(row)))
        for row in ordered
        for document, section, body, score, _ in [row]
    ]


def as_vector(values: list[float]) -> str:
    return "[" + ",".join(repr(float(v)) for v in values) + "]"


def shown_by(hit: Hit, threshold: float) -> str | None:
    meaning = hit.score >= threshold
    words = hit.word_rank == 1

    if meaning and words:
        return "both"
    if meaning:
        return "meaning"
    if words:
        return "words"

    return None


def hits_payload(hits: list[Hit], threshold: float) -> dict[str, Any]:
    return {
        "threshold": threshold,
        "hits": [
            {
                "label": h.label,
                "score": round(h.score, 4),
                "word_rank": h.word_rank,
                "used": shown_by(h, threshold) is not None,
                "shown_by": shown_by(h, threshold),
            }
            for h in hits
        ],
    }
