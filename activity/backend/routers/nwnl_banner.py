"""Banner API routes for NWNL Activity.

GET /nwnl/banners        → list all active banners
GET /nwnl/banners/{id}   → banner details
GET /nwnl/banners/{id}/pool → character pool for banner (2★ / 3★)
"""

import json
import logging
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends, Request

from nwnl_deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_waifu_service(request: Request):
    svc = getattr(request.app.state, "nwnl_waifu", None)
    if svc is None:
        raise HTTPException(status_code=503, detail="Waifu service unavailable")
    return svc


def _parse_series_ids(raw) -> List[int]:
    if not raw:
        return []
    if isinstance(raw, list):
        return [int(s) for s in raw if s]
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [int(s) for s in parsed if s]
        return []
    except Exception:
        return []


def _format_banner(b: dict) -> dict:
    """Add computed display fields to a banner dict."""
    currency_emojis = {
        "sakura_crystals": "💎",
        "quartzs": "💠",
        "daphine": "🦋",
    }
    currency_names = {
        "sakura_crystals": "Sakura Crystals",
        "quartzs": "Quartzs",
        "daphine": "Daphine",
    }
    ct = b.get("currency_type", "sakura_crystals")
    cost = b.get("cost", 10)
    b["currency_emoji"] = currency_emojis.get(ct, "💰")
    b["currency_name"] = currency_names.get(ct, ct.title())
    b["cost_display"] = f"{b['currency_emoji']} {cost} {b['currency_name']}"
    b["series_ids"] = _parse_series_ids(b.get("series_ids"))
    # Ensure JSON-serialisable timestamps
    for ts_field in ("start_time", "end_time"):
        val = b.get(ts_field)
        if val is not None and hasattr(val, "isoformat"):
            b[ts_field] = val.isoformat()
    return b


@router.get("")
async def list_banners(
    _user_id: str = Depends(get_current_user),
    request: Request = None,
):
    """List all active banners."""
    svc = _get_waifu_service(request)
    banners = await svc.get_active_banners()
    return [_format_banner(b) for b in banners]


@router.get("/{banner_id}")
async def get_banner(
    banner_id: int,
    _user_id: str = Depends(get_current_user),
    request: Request = None,
):
    """Get details for a specific banner."""
    svc = _get_waifu_service(request)
    banner = await svc.get_banner(banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")
    return _format_banner(banner)


@router.get("/{banner_id}/pool")
async def get_banner_pool(
    banner_id: int,
    _user_id: str = Depends(get_current_user),
    request: Request = None,
):
    """Get the 2★/3★ character pool for a banner."""
    svc = _get_waifu_service(request)
    banner = await svc.get_banner(banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")
    pool = await svc.get_banner_pool(banner_id)
    return {
        "banner_id": banner_id,
        "banner_name": banner.get("name", ""),
        "count": len(pool),
        "characters": pool,
    }
