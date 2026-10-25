from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request


def current_merchant(request: Request, x_merchant_id: Annotated[int, Header()]) -> int:
    if x_merchant_id <= 0 or not request.app.state.store.merchant_exists(x_merchant_id):
        raise HTTPException(status_code=404, detail="unknown merchant")

    return x_merchant_id


Merchant = Annotated[int, Depends(current_merchant)]
