from fastapi import APIRouter, Request

from .schemas import MerchantOut

router = APIRouter()


@router.get("/merchants", response_model=list[MerchantOut])
def merchants(request: Request) -> list[MerchantOut]:
    found = request.app.state.store.merchants()

    return [MerchantOut.model_validate(m, from_attributes=True) for m in found]


@router.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}
