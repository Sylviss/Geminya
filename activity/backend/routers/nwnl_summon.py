"""Summon and awaken API routes for NWNL Activity.

POST /nwnl/summon               → single pull
POST /nwnl/summon/multi         → 10x pull
POST /nwnl/awaken/{waifu_id}    → awaken a character (costs 1 Daphine)
"""

import logging
from typing import Optional

import asyncio
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from nwnl_deps import get_current_user, get_user_lock

logger = logging.getLogger(__name__)

router = APIRouter()


class SummonRequest(BaseModel):
    banner_id: Optional[int] = None


def _get_waifu_service(request: Request):
    svc = getattr(request.app.state, "nwnl_waifu", None)
    if svc is None:
        raise HTTPException(status_code=503, detail="Waifu service unavailable")
    return svc


@router.post("")
async def single_summon(
    body: SummonRequest,
    user_id: str = Depends(get_current_user),
    lock: asyncio.Lock = Depends(get_user_lock),
    request: Request = None,
):
    """Perform a single waifu summon."""
    svc = _get_waifu_service(request)
    async with lock:
        result = await svc.perform_summon(user_id, body.banner_id)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Summon failed"))
    return result


@router.post("/multi")
async def multi_summon(
    body: SummonRequest,
    user_id: str = Depends(get_current_user),
    lock: asyncio.Lock = Depends(get_user_lock),
    request: Request = None,
):
    """Perform a 10x waifu summon."""
    svc = _get_waifu_service(request)
    async with lock:
        result = await svc.perform_multi_summon(user_id, body.banner_id)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Multi summon failed"))
    return result


@router.post("/awaken/{waifu_id}")
async def awaken_waifu(
    waifu_id: int,
    user_id: str = Depends(get_current_user),
    lock: asyncio.Lock = Depends(get_user_lock),
    request: Request = None,
):
    """Awaken a waifu (costs 1 Daphine). Returns updated waifu info."""
    svc = _get_waifu_service(request)
    nwnl_db = getattr(request.app.state, "nwnl_db", None)
    if nwnl_db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with lock:
        result = await nwnl_db.awaken_user_waifu(user_id, waifu_id)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Awaken failed"))
    return result
