"""Summon API routes for NWNL Activity.

POST /nwnl/summon               → single pull (count=1) or 10x pull (count=10)
POST /nwnl/summon/multi         → 10x pull (kept for backwards compat)

Note: Awaken endpoint moved to /nwnl/collection/{waifu_id}/awaken in Phase 2C
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
    count: int = 1  # 1 = single pull, 10 = multi pull


def _get_waifu_service(request: Request):
    svc = getattr(request.app.state, "nwnl_waifu", None)
    if svc is None:
        raise HTTPException(status_code=503, detail="Waifu service unavailable")
    return svc


@router.post("")
async def summon(
    body: SummonRequest,
    user_id: str = Depends(get_current_user),
    lock: asyncio.Lock = Depends(get_user_lock),
    request: Request = None,
):
    """Perform a waifu summon. Use count=1 for single, count=10 for multi."""
    svc = _get_waifu_service(request)
    try:
        if body.count >= 10:
            async with lock:
                result = await svc.perform_multi_summon(user_id, body.banner_id)
            if not result.get("success"):
                raise HTTPException(status_code=400, detail=result.get("message", "Multi summon failed"))
        else:
            async with lock:
                result = await svc.perform_summon(user_id, body.banner_id)
            if not result.get("success"):
                raise HTTPException(status_code=400, detail=result.get("message", "Summon failed"))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Summon error for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal summon error: {str(e)}")
    return result


@router.post("/multi")
async def multi_summon(
    body: SummonRequest,
    user_id: str = Depends(get_current_user),
    lock: asyncio.Lock = Depends(get_user_lock),
    request: Request = None,
):
    """Perform a 10x waifu summon (backwards compat endpoint)."""
    svc = _get_waifu_service(request)
    try:
        async with lock:
            result = await svc.perform_multi_summon(user_id, body.banner_id)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("message", "Multi summon failed"))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Multi summon error for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal summon error: {str(e)}")
    return result
