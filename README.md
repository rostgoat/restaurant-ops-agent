# Restaurant ops agent

**Live: https://restaurant-ops-agent.vercel.app**

An AI agent that answers a restaurant owner's questions about their own sales
and their own written policies, and proposes actions a person approves before
anything happens. The model writes SQL, searches policy and drafts actions. Code
checks every query as a parse tree, limits it to one restaurant, runs it
read-only, and records every step with its cost. Nothing changes without a
person.

Two fictional restaurants, generated orders, no real sales data. Built as an
applied AI case study. The site walks through it:

- **Evaluation.** 39 questions with the right answer written down first,
  graded by code, run again after every change. Ten runs, each changing one
  thing, with every failure named and every trace shown. Sonnet 5.5 ends on
  39 of 39; Haiku 5.5 on the same questions, 38 of 39 at a twelfth of the
  cost.
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

Docker runs the database and the API. The site runs with pnpm, as it does on
Vercel.

```bash
cp .env.example .env                         # add ANTHROPIC_API_KEY and OPENAI_API_KEY
docker compose up -d --build --wait          # Postgres (loaded from data/out) and the API on :8000
docker compose run --rm tools sh -c 'python -m app.policies.index --dsn "$DATABASE_URL" --dsn "$EVAL_DATABASE_URL"'
cd web && pnpm install && pnpm dev           # the site on :3000
```

Everything else runs in the same image against this checkout:

```bash
docker compose run --rm tools python -m pytest                       # the API tests, database included
docker compose run --rm tools python -m app.evals.run                # the evaluation set, against the frozen database
docker compose run --rm tools python ../data/generate.py --out ../data/out --profiles ../data/profiles --months 24 --seed 42
```

Model: Claude Sonnet 5.5. Embeddings: OpenAI text-embedding-3-small. Database:
Postgres, with pgvector for the policy embeddings and its full-text search for
their words.

## Licence

MIT.
