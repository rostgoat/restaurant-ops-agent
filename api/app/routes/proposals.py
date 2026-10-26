from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from app.agent.proposals import execute
from app.agent.trace import Step
from app.tenancy.merchant import Merchant

from .schemas import ProposalOut

router = APIRouter()


@router.post("/proposals/{proposal_id}/approve", response_model=ProposalOut)
def approve(proposal_id: UUID, merchant_id: Merchant, request: Request) -> ProposalOut:
    """A person approves a pending proposal. Code then records the action as a
    simulated execution; nothing outside this database changes."""
    store = request.app.state.store
    proposal = store.get_proposal(proposal_id, merchant_id)

    if proposal is None:
        raise HTTPException(status_code=404, detail="unknown proposal")

    if proposal.status != "pending":
        raise HTTPException(status_code=409, detail=f"proposal is already {proposal.status}")
    trace = store.get_trace(proposal.trace_id, merchant_id)

    if trace is None:
        raise HTTPException(status_code=404, detail="unknown trace")
    proposal.status = "approved"
    proposal.decided_at = datetime.now(UTC)
    result = execute(proposal)
    proposal.payload["execution"] = result
    seq = len(trace.steps)
    about = {"proposal_id": str(proposal.id), "kind": proposal.kind}
    steps = [
        Step(seq + 1, "human", "approve", "approved", about | {"summary": proposal.summary}),
        Step(seq + 2, "code", "execute", "done", about | result),
    ]
    store.decide_proposal(proposal)
    store.append_steps(trace.id, steps)

    return ProposalOut.model_validate(proposal, from_attributes=True)
