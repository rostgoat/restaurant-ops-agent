# Restaurant ops agent

An AI agent that answers a restaurant owner's questions about their own sales
and their own written policies, and proposes actions a person approves before
anything happens. The model writes SQL, searches policy and drafts actions. Code
checks every query as a parse tree, limits it to one restaurant, runs it
read-only, and records every step with its cost. Nothing changes without a
person.

Two fictional restaurants, generated orders, no real sales data. Built as an
applied AI case study. The site walks through it:

- **Scenarios.** Five questions, simplest first, each with what should happen
  written down before it was asked, the captured answer, and the full trace.
  Each can be rerun live.
- **Evaluation.** 52 questions with a known right answer, graded by code,
  every failure shown in full, and the same cases on other models, efforts
  and retrieval thresholds.
- **Architecture.** The request path as a diagram, one section per step with
  a link to the file, the decisions, and what it does not do.

## Layout

```
api/     FastAPI. The agent loop, the SQL guard, policy retrieval, proposal
         checks, the evaluation harness and its cases and runs.
web/     Next.js. The site. Deploys to Vercel.
data/    Schema, restaurant profiles, the dataset generator, the policy
         documents.
infra/   Postgres init for docker compose.
```

## Run it

```bash
# the database and the API on :8000
cp .env.example .env            # add ANTHROPIC_API_KEY and OPENAI_API_KEY
python data/generate.py --out data/out --months 12 --seed 42
docker compose up -d --build --wait      # the api image builds from the repo root
cd api && .venv/bin/python -m app.policies.index --dsn "$DATABASE_URL" --dsn "$EVAL_DATABASE_URL"

# the site on :3000
cd web && pnpm install && pnpm dev     # NEXT_PUBLIC_SITE_URL sets the public address when deployed

# tests
cd api && .venv/bin/python -m pytest

# the evaluation set, against the frozen database
cd api && .venv/bin/python -m app.evals.run --dsn "$EVAL_DATABASE_URL"
```

Model: Claude Sonnet 5.5. Embeddings: OpenAI text-embedding-3-small. Database:
Postgres with pgvector.
