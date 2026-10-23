from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.agent import answer
from app.tenancy.merchant import Merchant

from .schemas import TraceOut

router = APIRouter()


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


@router.post("/ask", response_model=TraceOut)
def ask(body: AskIn, merchant_id: Merchant, request: Request) -> TraceOut:
    deps = request.app.state
    trace = answer(
        body.question,
        merchant_id,
        client=deps.model,
        runner=deps.runner,
        settings=deps.settings,
    )
    deps.store.save_trace(trace)
    return TraceOut.from_trace(trace)
