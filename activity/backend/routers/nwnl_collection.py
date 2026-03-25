"""Collection, database browser, and awaken routes for NWNL Activity."""

import asyncio
import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, Request, HTTPException

from nwnl_deps import get_current_user, get_user_lock

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_db(request: Request):
    db = request.app.state.nwnl_db
    if not db or not db.pool:
        raise HTTPException(status_code=503, detail="NWNL services are not available")
    return db


def _raw_stats_power(waifu: Dict[str, Any]) -> float:
    stats = waifu.get("stats")
    star = waifu.get("current_star_level", waifu.get("rarity", 1))
    mult = (1 + (star - 1) * 0.10) * 0.95
    if stats and isinstance(stats, dict):
        vals = [v for v in stats.values() if isinstance(v, (int, float))]
        if vals:
            return (sum(vals) / len(vals)) * mult
    return 0.0


def _to_collection_item(waifu: Dict[str, Any]) -> Dict[str, Any]:
    etype = waifu.get("elemental_type")
    if isinstance(etype, list):
        elements = ", ".join(str(e) for e in etype)
    else:
        elements = etype or "?"

    return {
        "waifu_id": waifu["waifu_id"],
        "name": waifu["name"],
        "series": waifu.get("series", "Unknown"),
        "series_id": waifu.get("series_id"),
        "image_url": waifu.get("image_url"),
        "rarity": waifu["rarity"],
        "current_star_level": waifu["current_star_level"],
        "character_shards": waifu["character_shards"],
        "can_upgrade": waifu["can_upgrade"],
        "shards_needed_for_upgrade": waifu["shards_needed_for_upgrade"],
        "is_max_star": waifu["is_max_star"],
        "is_awakened": waifu.get("is_awakened", False),
        "elements": elements,
        "archetype": waifu.get("archetype", "?"),
        "stats": waifu.get("stats") or {},
        "stats_power": round(_raw_stats_power(waifu), 1),
        "potency": waifu.get("potency"),
        "elemental_resistances": waifu.get("elemental_resistances"),
    }


@router.get("/collection")
async def get_collection(
    request: Request,
    user_id: str = Depends(get_current_user),
    name: Optional[str] = None,
    series: Optional[str] = None,
    element: Optional[str] = None,
    archetype: Optional[str] = None,
    rarity: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
    sort_by: str = "power",
    sort_order: str = "desc",
):
    """Get user collection with filtering, sorting, and pagination."""
    db = _get_db(request)
    collection = await db.get_user_collection_with_stars(user_id)

    if name:
        q = name.lower()
        collection = [w for w in collection if q in (w.get("name") or "").lower()]
    if series:
        q = series.lower()
        collection = [w for w in collection if q in (w.get("series") or "").lower()]
    if archetype:
        q = archetype.lower()
        collection = [
            w for w in collection
            if isinstance(w.get("archetype"), str) and q in w["archetype"].lower()
        ]
    if element:
        q = element.lower()

        def _match_element(w: Dict[str, Any]) -> bool:
            et = w.get("elemental_type")
            if isinstance(et, str):
                return q in et.lower()
            if isinstance(et, list):
                return any(q in str(e).lower() for e in et)
            return False

        collection = [w for w in collection if _match_element(w)]
    if rarity is not None:
        collection = [w for w in collection if int(w.get("rarity", 0)) == rarity]

    reverse = sort_order.lower() != "asc"
    if sort_by == "name":
        collection.sort(key=lambda w: (w.get("name") or "").lower(), reverse=reverse)
    elif sort_by == "star":
        collection.sort(
            key=lambda w: w.get("current_star_level", w.get("rarity", 1)),
            reverse=reverse,
        )
    else:
        collection.sort(key=_raw_stats_power, reverse=reverse)

    total = len(collection)
    safe_page_size = max(1, min(page_size, 100))
    page_count = max(1, (total + safe_page_size - 1) // safe_page_size)
    safe_page = max(1, min(page, page_count))
    start = (safe_page - 1) * safe_page_size

    items = [_to_collection_item(w) for w in collection[start:start + safe_page_size]]

    return {
        "results": items,
        "total": total,
        "page": safe_page,
        "page_count": page_count,
        "page_size": safe_page_size,
    }


@router.get("/collection/search")
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
    """Search/filter user's waifu collection by name, series, genre, archetype, element."""
    db = _get_db(request)

    collection = await db.get_user_collection_with_stars(user_id)
    if not collection:
        return {"results": [], "total": 0, "page": 1, "page_count": 1}

    filtered = collection

    if name:
        name_lower = name.lower()
        filtered = [w for w in filtered if name_lower in (w.get("name") or "").lower()]

    if series:
        series_lower = series.lower()
        filtered = [w for w in filtered if series_lower in (w.get("series") or "").lower()]

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

    if archetype:
        filtered = [
            w for w in filtered
            if isinstance(w.get("archetype"), str)
            and archetype.lower() in w["archetype"].lower()
        ]

    if element:
        def _match(w):
            et = w.get("elemental_type")
            if isinstance(et, str):
                return element.lower() in et.lower()
            if isinstance(et, list):
                return any(element.lower() in str(e).lower() for e in et)
            return False
        filtered = [w for w in filtered if _match(w)]

    filtered.sort(key=lambda w: (
        -_raw_stats_power(w),
        -w.get("current_star_level", w.get("rarity", 1)),
        -w.get("character_shards", 0),
        w.get("name", ""),
    ))

    total = len(filtered)
    safe_page_size = max(1, min(page_size, 100))
    page_count = max(1, (total + safe_page_size - 1) // safe_page_size)
    safe_page = max(1, min(page, page_count))
    start = (safe_page - 1) * safe_page_size

    results = [_to_collection_item(w) for w in filtered[start:start + safe_page_size]]

    return {
        "results": results,
        "total": total,
        "page": safe_page,
        "page_count": page_count,
        "page_size": safe_page_size,
    }


@router.get("/collection/{waifu_id}")
async def get_collection_waifu_profile(
    waifu_id: int,
    request: Request,
    user_id: str = Depends(get_current_user),
):
    """Get detailed profile for one owned waifu."""
    db = _get_db(request)
    waifu = await db.get_user_waifu(user_id, waifu_id)
    if not waifu:
        raise HTTPException(status_code=404, detail="Waifu not found in your collection")

    star = waifu.get("current_star_level") or waifu.get("rarity", 1)
    next_star = star + 1 if star < 6 else None
    shards_needed = {2: 50, 3: 100, 4: 150, 5: 250, 6: 350}.get(next_star, 0) if next_star else 0

    shards = waifu.get("star_shards", 0) or 0
    payload = {
        **_to_collection_item({
            **waifu,
            "current_star_level": star,
            "character_shards": shards,
            "can_upgrade": shards >= shards_needed if shards_needed else False,
            "shards_needed_for_upgrade": shards_needed,
            "is_max_star": star >= 6,
        }),
        "next_star_level": next_star,
        "about": waifu.get("about"),
        "favorite_gifts": waifu.get("favorite_gifts"),
        "special_dialogue": waifu.get("special_dialogue"),
    }
    return payload


@router.get("/database")
async def get_database_series(
    request: Request,
    _user_id: str = Depends(get_current_user),
    page: int = 1,
    page_size: int = 20,
    query: Optional[str] = None,
):
    """Browse all series in the NWNL database."""
    db = _get_db(request)
    return await db.get_series_page(page=page, page_size=page_size, name_query=query)


@router.get("/database/series/{series_id}")
async def get_database_series_detail(
    series_id: int,
    request: Request,
    _user_id: str = Depends(get_current_user),
):
    """Get one series and all characters belonging to it."""
    db = _get_db(request)
    series = await db.get_series_by_id(series_id)
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    characters = await db.get_waifus_by_series_id(series_id)

    return {
        "series": series,
        "characters": [
            {
                "waifu_id": w.get("waifu_id"),
                "name": w.get("name"),
                "series": w.get("series"),
                "series_id": w.get("series_id"),
                "rarity": w.get("rarity"),
                "image_url": w.get("image_url"),
                "archetype": w.get("archetype"),
                "elemental_type": w.get("elemental_type"),
                "stats": w.get("stats") or {},
            }
            for w in characters
        ],
    }


@router.get("/database/search")
async def search_database(
    request: Request,
    _user_id: str = Depends(get_current_user),
    query: str = "",
    limit: int = 20,
):
    """Search series and characters by name."""
    db = _get_db(request)
    return await db.search_series_and_waifus(query=query, limit=limit)


@router.post("/awaken/{waifu_id}")
async def awaken_waifu(
    waifu_id: int,
    request: Request,
    user_id: str = Depends(get_current_user),
    lock: asyncio.Lock = Depends(get_user_lock),
):
    """Awaken a waifu (costs 1 Daphine)."""
    db = _get_db(request)
    async with lock:
        result = await db.awaken_user_waifu(user_id, waifu_id)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Awaken failed"))

    return result
