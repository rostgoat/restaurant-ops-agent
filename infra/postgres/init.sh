#!/bin/bash
# The postgres image runs this once, on an empty volume. To reload after
# regenerating data/out: docker compose down -v && docker compose up -d
set -euo pipefail

cd /data/out
# ops_test is for the test suite, which rewrites the policy index with fake
# embeddings; keep that away from the databases the site and the eval read.
for db in ops_demo ops_eval ops_test; do
    createdb -U "$POSTGRES_USER" "$db"
    psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$db" -f /data/schema.sql
    psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$db" -f load.sql
done
