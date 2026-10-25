from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

from app.agent import DEFAULT, Settings

_DEFAULT_POLICIES = Path(__file__).resolve().parents[2] / "data" / "policies"


@dataclass(frozen=True)
class Config:
    database_url: str
    web_origin: str
    # Required on every request but /health when set. Unset means open, for local work.
    api_token: str | None
    openai_api_key: str | None
    policies_root: Path
    settings: Settings


def load() -> Config:
    load_dotenv()

    return Config(
        database_url=os.environ["DATABASE_URL"],
        web_origin=os.environ.get("WEB_ORIGIN", "http://localhost:3000"),
        api_token=os.environ.get("API_TOKEN") or None,
        openai_api_key=os.environ.get("OPENAI_API_KEY") or None,
        policies_root=Path(os.environ.get("POLICIES_ROOT", str(_DEFAULT_POLICIES))),
        settings=Settings(
            model=os.environ.get("MODEL", DEFAULT.model),
            effort=os.environ.get("EFFORT", DEFAULT.effort),
            workspace_id=os.environ.get("ANTHROPIC_WORKSPACE_ID") or None,
        ),
    )
