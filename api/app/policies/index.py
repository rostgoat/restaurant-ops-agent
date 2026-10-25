"""
Embed every policy section under data/policies and write it to one or more
databases. Run after a policy changes, with the OpenAI key in the environment:

    .venv/bin/python -m app.policies.index --dsn $DATABASE_URL --dsn $EVAL_DATABASE_URL
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

from .chunks import read_policies
from .embed import Embedder, OpenAIEmbedder
from .search import as_vector

_UPSERT = """
INSERT INTO policy_chunks (merchant_id, document, section, body, embedding)
VALUES (%s, %s, %s, %s, %s::vector)
ON CONFLICT (merchant_id, document, section)
DO UPDATE SET body = EXCLUDED.body, embedding = EXCLUDED.embedding
"""


def index(root: Path, dsns: list[str], embedder: Embedder) -> int:
    chunks = read_policies(root)
    vectors = embedder.embed([c.text for c in chunks])
    for dsn in dsns:
        with psycopg.connect(dsn) as conn, conn.transaction():
            conn.execute("DELETE FROM policy_chunks")
            conn.cursor().executemany(
                _UPSERT,
                [
                    (c.merchant_id, c.document, c.section, c.body, as_vector(v))
                    for c, v in zip(chunks, vectors, strict=True)
                ],
            )
    return len(chunks)


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    default_root = Path(__file__).resolve().parents[3] / "data" / "policies"
    ap.add_argument("--policies", type=Path, default=default_root)
    ap.add_argument("--dsn", action="append", required=True)
    args = ap.parse_args()
    embedder = OpenAIEmbedder(os.environ["OPENAI_API_KEY"])
    n = index(args.policies, args.dsn, embedder)
    print(f"indexed {n} sections with {embedder.model} into {len(args.dsn)} database(s)")


if __name__ == "__main__":
    main()
