from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request

from app.tenancy.merchant import Merchant

from .schemas import TraceOut

router = APIRouter()


@router.get("/traces", response_model=list[TraceOut])
def recent_traces(
    merchant_id: Merchant, request: Request, limit: int = Query(20, ge=1, le=100)
) -> list[TraceOut]:
    traces = request.app.state.store.recent_traces(merchant_id, limit)
    return [TraceOut.from_trace(t) for t in traces]


@router.get("/traces/{trace_id}", response_model=TraceOut)
def get_trace(trace_id: UUID, merchant_id: Merchant, request: Request) -> TraceOut:
    trace = request.app.state.store.get_trace(trace_id, merchant_id)
    if trace is None:
        raise HTTPException(status_code=404, detail="unknown trace")
    return TraceOut.from_trace(trace)
