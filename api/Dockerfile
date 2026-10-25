# Built from the repository root so the policy documents ship inside the
# image: docker build -f api/Dockerfile .
FROM python:3.12-slim AS base
WORKDIR /srv
COPY api/pyproject.toml ./
COPY api/app ./app
RUN pip install --no-cache-dir .

# The API as deployed.
FROM base AS runtime
COPY data/policies /data/policies
ENV POLICIES_ROOT=/data/policies
EXPOSE 8000
HEALTHCHECK --interval=5s --timeout=3s --retries=20 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# Tests, the evaluation, the policy index and the generator, run against a
# bind mount of the repository: docker compose run --rm tools ...
FROM base AS tools
RUN pip install --no-cache-dir ".[dev]" numpy
WORKDIR /repo/api
