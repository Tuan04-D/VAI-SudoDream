"""Authenticated chat history API."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from core import security
from infrastructure import mongo


router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/history/{resident_id}")
async def history(
    resident_id: str,
    user: Annotated[dict, Depends(security.get_current_user)],
):
    if user["role"] != "admin" and user["_id"] != resident_id:
        raise HTTPException(status_code=403, detail="Không được xem lịch sử chat của người khác")
    if not await mongo.get_resident(resident_id):
        raise HTTPException(status_code=404, detail="Resident not found")
    return await mongo.get_chat_history(resident_id)
