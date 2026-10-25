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
cp .env.example .env            # add ANTHROPIC_API_KEY and OPENAI_API_KEY; API_TOKEN when deployed
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

## Deploy

Three services: the database on Neon, the API on Fly, the site on Vercel.

**Neon.** `neon.ts` at the root declares the project; `neon deploy` pulls the
connection strings into `.env`. Keep the local `DATABASE_URL` for compose and
hold Neon's under `NEON_DATABASE_URL` (pooled) and `NEON_DATABASE_URL_UNPOOLED`.
Load the database over the unpooled string:

```bash
psql "$NEON_DATABASE_URL_UNPOOLED" -f data/schema.sql
cd data/out && psql "$NEON_DATABASE_URL_UNPOOLED" -f load.sql && cd ../..
cd api && .venv/bin/python -m app.policies.index --dsn "$NEON_DATABASE_URL_UNPOOLED"
```

The API keeps a small connection pool open on a long-running machine, so give
Fly the unpooled string as `DATABASE_URL`; Neon's pooler is for serverless
callers that open a connection per request.

**Fly.** `fly.toml` at the root describes the API: built from `api/Dockerfile`
with the policy documents inside, one machine always running, health check
on `/health`.

```bash
fly launch --no-deploy --copy-config
fly secrets set DATABASE_URL="$NEON_DATABASE_URL_UNPOOLED" ANTHROPIC_API_KEY=... OPENAI_API_KEY=... API_TOKEN=...
fly deploy
```

After that, pushes to `main` that touch the API deploy through
`.github/workflows/deploy-api.yml`; it needs a `FLY_API_TOKEN` repository
secret from `fly tokens create deploy`. Set `WEB_ORIGIN` in `fly.toml` to the
site's address.

**Vercel.** Import the repository with the root directory set to `web`.
Environment variables: `API_URL` (the Fly app's URL), `API_TOKEN` (the same
value as on Fly), `NEXT_PUBLIC_SITE_URL` (the site's own address, needed at
build time for the sitemap and canonical links).

**Then.** Run `api/scripts/capture.py --api https://<fly app>` once with
`API_TOKEN` set, so the hosted database holds the scenario captures and the
approved dispute, and check `/robots.txt` and `/sitemap.xml` on the live site.

## Licence

MIT.
