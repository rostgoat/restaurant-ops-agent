from __future__ import annotations

import hashlib
import math
import re
from typing import Protocol

import httpx2

DIMENSIONS = 1536


class Embedder(Protocol):
    model: str

    def embed(self, texts: list[str]) -> list[list[float]]: ...


class OpenAIEmbedder:
    def __init__(self, api_key: str, model: str = "text-embedding-3-small", timeout: float = 30.0):
        self.model = model
        self._client = httpx2.Client(
            base_url="https://api.openai.com/v1",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout,
        )

    def embed(self, texts: list[str]) -> list[list[float]]:
        response = self._client.post("/embeddings", json={"model": self.model, "input": texts})
        response.raise_for_status()
        data = sorted(response.json()["data"], key=lambda d: d["index"])

        return [d["embedding"] for d in data]


class FakeEmbedder:
    """Bag of hashed words, unit length. Overlapping wording scores high, so the
    scoping and threshold behaviour can be tested without a network."""

    model = "fake-bag-of-words"

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._one(t) for t in texts]

    @staticmethod
    def _one(text: str) -> list[float]:
        vector = [0.0] * DIMENSIONS

        for word in re.findall(r"[a-z0-9']+", text.lower()):
            slot = int(hashlib.md5(word.encode()).hexdigest(), 16) % DIMENSIONS
            vector[slot] += 1.0
        norm = math.sqrt(sum(v * v for v in vector)) or 1.0

        return [v / norm for v in vector]
