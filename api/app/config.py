from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

from app.agent import DEFAULT, Settings


@dataclass(frozen=True)
class Config:
    database_url: str
    web_origin: str
    openai_api_key: str | None
    settings: Settings


def load() -> Config:
    load_dotenv()
    return Config(
        database_url=os.environ["DATABASE_URL"],
        web_origin=os.environ.get("WEB_ORIGIN", "http://localhost:3000"),
        openai_api_key=os.environ.get("OPENAI_API_KEY") or None,
        settings=Settings(
            model=os.environ.get("MODEL", DEFAULT.model),
            effort=os.environ.get("EFFORT", DEFAULT.effort),
            workspace_id=os.environ.get("ANTHROPIC_WORKSPACE_ID") or None,
        ),
    )
