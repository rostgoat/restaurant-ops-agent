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
    return _decide(proposal_id, merchant_id, request, approve=True)


@router.post("/proposals/{proposal_id}/reject", response_model=ProposalOut)
def reject(proposal_id: UUID, merchant_id: Merchant, request: Request) -> ProposalOut:
    return _decide(proposal_id, merchant_id, request, approve=False)


def _decide(proposal_id: UUID, merchant_id: int, request: Request, *, approve: bool) -> ProposalOut:
    store = request.app.state.store
    proposal = store.get_proposal(proposal_id, merchant_id)

    if proposal is None:
        raise HTTPException(status_code=404, detail="unknown proposal")

    if proposal.status != "pending":
        raise HTTPException(status_code=409, detail=f"proposal is already {proposal.status}")
    trace = store.get_trace(proposal.trace_id, merchant_id)

    if trace is None:
        raise HTTPException(status_code=404, detail="unknown trace")

    now = datetime.now(UTC)
    proposal.status = "approved" if approve else "rejected"
    proposal.decided_at = now
    seq = len(trace.steps)
    steps: list[Step] = [
        Step(
            seq + 1,
            "human",
            "approve" if approve else "reject",
            proposal.status,
            {"proposal_id": str(proposal.id), "kind": proposal.kind, "summary": proposal.summary},
        )
    ]
    if approve:
        result = execute(proposal)
        proposal.payload["execution"] = result
        steps.append(
            Step(
                seq + 2,
                "code",
                "execute",
                "done",
                {"proposal_id": str(proposal.id), "kind": proposal.kind} | result,
            )
        )
    store.decide_proposal(proposal)
    store.append_steps(trace.id, steps)

    return ProposalOut.model_validate(proposal, from_attributes=True)
