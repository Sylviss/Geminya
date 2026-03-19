"""Collection and Database Browser API routes for NWNL Activity.

Migrated from Phase 2A (collection search) and 2B (awaken).
Implements Phase 2C:
  - User collection viewing and filtering
  - Database browser (all series + characters)
  - Character profile details
  - Awaken functionality (moved from summon router)
"""

import asyncio
import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel

from nwnl_deps import get_current_user, get_user_lock

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Helper ───────────────────────────────────────────────────────────

def _get_db(request: Request):
    """Get NwnlDatabaseService from app state."""
    db = request.app.state.nwnl_db
    if not db or not db.pool:
        raise HTTPException(status_code=503, detail="NWNL services are not available")
    return db


# ─── Endpoints ────────────────────────────────────────────────────────

@router.get("")
async def get_collection(
    request: Request,
    user_id: str = Depends(get_current_user),
    page: int = 1,
    page_size: int = 20,
):
    """Get user's collection (paginated)."""
    db = _get_db(request)

    collection = await db.get_user_collection_with_stars(user_id)
    if not collection:
        return {"results": [], "total": 0, "page": 1, "page_count": 1}

    # Sort by power desc → star level desc → name asc
    def _raw_stats(w):
        stats = w.get("stats")
        star = w.get("current_star_level", w.get("rarity", 1))
        mult = (1 + (star - 1) * 0.10) * 0.95
        if stats and isinstance(stats, dict):
            vals = [v for v in stats.values() if isinstance(v, (int, float))]
            if vals:
                return (sum(vals) / len(vals)) * mult
        return 0.0

    collection.sort(key=lambda w: (
        -_raw_stats(w),
        -w.get("current_star_level", w.get("rarity", 1)),
        w.get("name", ""),
    ))

    total = len(collection)
    page_count = max(1, (total + page_size - 1) // page_size)
    page = max(1, min(page, page_count))
    start = (page - 1) * page_size

    results = []
    for w in collection[start : start + page_size]:
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


@router.get("/search")
async def collection_search(
    request: Request,
    user_id: str = Depends(get_current_user),
    name: Optional[str] = None,
    series: Optional[str] = None,
    genre: Optional[str] = None,
    archetype: Optional[str] = None,
    element: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    """Search/filter user's waifu collection by name, series, genre, archetype, element. Paginated.

    Moved from Phase 2A (academy router).
    """
    db = _get_db(request)

    collection = await db.get_user_collection_with_stars(user_id)
    if not collection:
        return {"results": [], "total": 0, "page": 1, "page_count": 1}

    filtered = collection

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
        genre_map: Dict[int, List[str]] = {}
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

    # Sort: stats power desc → star level desc → name asc
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
    """Get character profile detail (user's owned waifu + base waifu data)."""
    db = _get_db(request)

    # Get user's waifu data
    user_waifu = await db.get_user_waifu(user_id, waifu_id)
    if not user_waifu:
        raise HTTPException(status_code=404, detail="Character not found in your collection")

    # Get base waifu data
    base_waifu = await db.get_waifu_by_id(waifu_id)
    if not base_waifu:
        raise HTTPException(status_code=404, detail="Character data not found")

    # Merge data
    etype = base_waifu.get("elemental_type")
    if isinstance(etype, list):
        elements = etype
    else:
        elements = [etype] if etype else []

    return {
        "waifu_id": waifu_id,
        "name": base_waifu["name"],
        "series": base_waifu.get("series", "Unknown"),
        "series_id": base_waifu.get("series_id"),
        "image_url": base_waifu.get("image_url"),
        "rarity": base_waifu["rarity"],
        "archetype": base_waifu.get("archetype", "Unknown"),
        "elements": elements,
        "stats": base_waifu.get("stats", {}),
        "current_star_level": user_waifu["current_star_level"],
        "character_shards": user_waifu["character_shards"],
        "is_awakened": user_waifu.get("is_awakened", False),
        "obtained_at": user_waifu.get("obtained_at"),
        "can_upgrade": user_waifu.get("can_upgrade", False),
        "shards_needed_for_upgrade": user_waifu.get("shards_needed_for_upgrade", 0),
        "is_max_star": user_waifu.get("is_max_star", False),
    }


@router.post("/awaken/{waifu_id}")
async def awaken_waifu(
    waifu_id: int,
    user_id: str = Depends(get_current_user),
    lock: asyncio.Lock = Depends(get_user_lock),
    request: Request = None,
):
    """Awaken a waifu (costs 1 Daphine). Returns updated waifu info.

    Moved from Phase 2B (summon router).
    """
    db = _get_db(request)

    async with lock:
        result = await db.awaken_user_waifu(user_id, waifu_id)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Awaken failed"))

    return result


# ─── Database Browser Endpoints ───────────────────────────────────────

@router.get("/database/series")
async def get_all_series(
    request: Request,
    page: int = 1,
    page_size: int = 50,
):
    """Browse all series (paginated)."""
    db = _get_db(request)

    total = await db.get_series_count()
    page_count = max(1, (total + page_size - 1) // page_size)
    page = max(1, min(page, page_count))
    offset = (page - 1) * page_size

    series_list = await db.get_all_series(limit=page_size, offset=offset)

    return {
        "results": series_list,
        "total": total,
        "page": page,
        "page_count": page_count,
    }


@router.get("/database/series/{series_id}")
async def get_series_detail(
    series_id: int,
    request: Request,
):
    """Get series detail + characters in that series."""
    db = _get_db(request)

    series = await db.get_series_by_id(series_id)
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")

    waifus = await db.get_waifus_by_series_id(series_id)

    return {
        "series": series,
        "characters": waifus,
    }


@router.get("/database/search")
async def search_database(
    request: Request,
    query: str,
    type: str = "all",  # "all", "series", "characters"
    limit: int = 50,
):
    """Search characters/series by name."""
    db = _get_db(request)

    results = {
        "series": [],
        "characters": [],
    }

    if type in ("all", "series"):
        series_results = await db.search_series(query, limit=limit)
        results["series"] = series_results

    if type in ("all", "characters"):
        waifu_results = await db.search_waifus(query, limit=limit)
        results["characters"] = waifu_results

    return results
