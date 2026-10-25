from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request

from app.tenancy.merchant import Merchant

from .schemas import QuestionStatsOut, TraceOut

router = APIRouter()


@router.get("/traces/{trace_id}", response_model=TraceOut)
def get_trace(trace_id: UUID, merchant_id: Merchant, request: Request) -> TraceOut:
    trace = request.app.state.store.get_trace(trace_id, merchant_id)
    if trace is None:
        raise HTTPException(status_code=404, detail="unknown trace")
    return TraceOut.from_trace(trace)


@router.get("/questions/stats", response_model=QuestionStatsOut)
def question_stats(
    merchant_id: Merchant, request: Request, question: str = Query(min_length=1)
) -> QuestionStatsOut:
    stats = request.app.state.store.question_stats(merchant_id, question)
    return QuestionStatsOut.model_validate(stats, from_attributes=True)
