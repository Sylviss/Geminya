"""Collection & Database Browser API routes for the NWNL Activity.

Phase 2C — Provides endpoints for:
- Collection viewing/searching (moved from academy)
- Character profile details
- Database browsing (all series)
- Series detail pages
- Awakening characters (moved from summon router)
"""

import logging
from typing import Optional
import asyncio

from fastapi import APIRouter, Depends, Request, HTTPException, Query
from pydantic import BaseModel

from nwnl_deps import get_current_user, get_user_lock

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Request Models ───────────────────────────────────────────────────

class AwakenRequest(BaseModel):
    """Request to awaken a character (requires 1 Daphine)."""
    pass  # Body is empty, waifu_id is in path


# ─── Helper ───────────────────────────────────────────────────────────

def _get_db(request: Request):
    """Get NwnlDatabaseService from app state."""
    db = request.app.state.nwnl_db
    if not db or not db.pool:
        raise HTTPException(status_code=503, detail="NWNL services are not available")
    return db


# ─── Endpoints ────────────────────────────────────────────────────────

@router.get("/search")
async def collection_search(
    request: Request,
    user_id: str = Depends(get_current_user),
    name: Optional[str] = None,
    series: Optional[str] = None,
    genre: Optional[str] = None,
    archetype: Optional[str] = None,
    element: Optional[str] = None,
    rarity: Optional[int] = Query(None, ge=1, le=3),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Search/filter user's collection by multiple criteria.

    Moved from /academy/search in Phase 2C.
    Supports filtering by: name, series, genre, archetype, element, rarity.
    Returns paginated results sorted by power → star level → shards → name.
    """
    db = _get_db(request)

    collection = await db.get_user_collection_with_stars(user_id)
    if not collection:
        return {"results": [], "total": 0, "page": 1, "page_count": 1}

    filtered = collection

    # Filter by rarity
    if rarity is not None:
        filtered = [w for w in filtered if w.get("rarity") == rarity]

    # Text search — character name (case-insensitive substring)
    if name:
        name_lower = name.lower()
        filtered = [w for w in filtered if name_lower in (w.get("name") or "").lower()]

    # Text search — series name (case-insensitive substring)
    if series:
        series_lower = series.lower()
        filtered = [w for w in filtered if series_lower in (w.get("series") or "").lower()]

    # Filter by genre
    if genre:
        genre_lower = genre.lower()
        series_ids = {int(w["series_id"]) for w in filtered if isinstance(w.get("series_id"), int)}
        genre_map = {}
        for sid in series_ids:
            try:
                genres = await db.get_series_genres(sid)
                genre_map[sid] = [g.lower() for g in genres]
            except Exception:
                genre_map[sid] = []
        filtered = [
            w for w in filtered
            if isinstance(w.get("series_id"), int)
            and genre_lower in genre_map.get(w["series_id"], [])
        ]

    # Filter by archetype
    if archetype:
        filtered = [
            w for w in filtered
            if isinstance(w.get("archetype"), str)
            and archetype.lower() in w["archetype"].lower()
        ]

    # Filter by element
    if element:
        def _match(w):
            et = w.get("elemental_type")
            if isinstance(et, str):
                return element.lower() in et.lower()
            if isinstance(et, list):
                return any(element.lower() in str(e).lower() for e in et)
            return False
        filtered = [w for w in filtered if _match(w)]

    # Sort: stats power desc → star level desc → shards desc → name asc
    def _raw_stats(w):
        stats = w.get("stats")
        star = w.get("current_star_level", w.get("rarity", 1))
        mult = (1 + (star - 1) * 0.10) * 0.95
        if stats and isinstance(stats, dict):
            vals = [v for v in stats.values() if isinstance(v, (int, float))]
            if vals:
                return (sum(vals) / len(vals)) * mult
        return 0.0

    filtered.sort(key=lambda w: (
        -_raw_stats(w),
        -w.get("current_star_level", w.get("rarity", 1)),
        -w.get("character_shards", 0),
        w.get("name", ""),
    ))

    total = len(filtered)
    page_count = max(1, (total + page_size - 1) // page_size)
    page = max(1, min(page, page_count))
    start = (page - 1) * page_size

    results = []
    for w in filtered[start : start + page_size]:
        etype = w.get("elemental_type")
        if isinstance(etype, list):
            elements = ", ".join(str(e) for e in etype)
        else:
            elements = etype or "?"

        results.append({
            "waifu_id": w["waifu_id"],
            "name": w["name"],
            "series": w.get("series", "Unknown"),
            "series_id": w.get("series_id"),
            "image_url": w.get("image_url"),
            "rarity": w["rarity"],
            "current_star_level": w["current_star_level"],
            "character_shards": w["character_shards"],
            "can_upgrade": w["can_upgrade"],
            "shards_needed_for_upgrade": w["shards_needed_for_upgrade"],
            "is_max_star": w["is_max_star"],
            "is_awakened": w.get("is_awakened", False),
            "elements": elements,
            "archetype": w.get("archetype", "?"),
            "stats_power": round(_raw_stats(w), 1),
        })

    return {
        "results": results,
        "total": total,
        "page": page,
        "page_count": page_count,
    }


@router.get("/{waifu_id}")
async def get_character_profile(
    waifu_id: int,
    request: Request,
    user_id: str = Depends(get_current_user),
):
    """Get full character profile with stats, ownership, and series info."""
    db = _get_db(request)

    waifu = await db.get_waifu_detail(waifu_id, discord_id=user_id)
    if not waifu:
        raise HTTPException(status_code=404, detail="Character not found")

    return waifu


@router.post("/{waifu_id}/awaken")
async def awaken_character(
    waifu_id: int,
    request: Request,
    user_id: str = Depends(get_current_user),
    lock: asyncio.Lock = Depends(get_user_lock),
):
    """Awaken a character (costs 1 Daphine).

    Moved from /nwnl/summon/awaken in Phase 2C.
    """
    db = _get_db(request)

    async with lock:
        result = await db.awaken_user_waifu(user_id, waifu_id)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        # Get updated waifu state
        waifu = await db.get_waifu_detail(waifu_id, discord_id=user_id)

        return {
            "success": True,
            "message": result["message"],
            "waifu": waifu,
        }


@router.get("/database/browse")
async def browse_database(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Browse all series in the database (paginated)."""
    db = _get_db(request)

    result = await db.get_all_series_paginated(page=page, page_size=page_size)
    return result


@router.get("/database/series/{series_id}")
async def get_series_detail(
    series_id: int,
    request: Request,
):
    """Get series detail including metadata and all characters."""
    db = _get_db(request)

    series = await db.get_series_detail(series_id)
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")

    characters = await db.get_series_characters(series_id)

    return {
        "series": series,
        "characters": characters,
        "character_count": len(characters),
    }


@router.get("/database/search")
async def search_database(
    request: Request,
    query: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Search characters and series by name."""
    db = _get_db(request)

    result = await db.search_database(query=query, page=page, page_size=page_size)
    return result
