from __future__ import annotations

import os
from contextlib import asynccontextmanager

import anthropic
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import config
from app.agent.proposals import ProposalChecker, load_limits
from app.policies import OpenAIEmbedder, PostgresPolicySearch
from app.routes import ask, health, proposals, traces
from app.sql.execute import PostgresRunner
from app.store import Store


@asynccontextmanager
async def lifespan(app: FastAPI):
    cfg = config.load()
    app.state.settings = cfg.settings
    app.state.api_token = cfg.api_token
    app.state.store = Store(cfg.database_url)
    app.state.store.open()
    app.state.runner = PostgresRunner(cfg.database_url)
    # Without an embeddings key the agent still answers data questions; a
    # policy question gets an honest "search is not available" instead.
    app.state.policies = (
        PostgresPolicySearch(cfg.database_url, OpenAIEmbedder(cfg.openai_api_key))
        if cfg.openai_api_key
        else None
    )
    # A missing key must not stop the site: pages still render, and an ask
    # ends as an error trace that names the 401 instead.
    app.state.model = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY") or "unset")
    app.state.checker = ProposalChecker(load_limits(cfg.policies_root), app.state.runner)

    yield
    app.state.store.close()
    app.state.runner.close()

    if app.state.policies:
        app.state.policies.close()


async def require_token(request: Request, call_next):
    """The site's server and the scripts send the token. Nothing else may ask."""
    expected = getattr(request.app.state, "api_token", None)

    required = bool(expected) and request.url.path != "/health"

    if required and request.headers.get("X-API-Token") != expected:
        return JSONResponse({"detail": "missing or wrong API token"}, status_code=401)

    return await call_next(request)


def create_app(lifespan=lifespan, web_origin: str = "http://localhost:3000") -> FastAPI:
    app = FastAPI(title="restaurant-ops-agent", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware, allow_origins=[web_origin], allow_methods=["*"], allow_headers=["*"]
    )
    app.middleware("http")(require_token)
    app.include_router(health.router)
    app.include_router(ask.router)
    app.include_router(traces.router)
    app.include_router(proposals.router)

    return app


app = create_app()
