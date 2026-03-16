"""Academy API routes for the NWNL Activity.

Migrated from cogs/commands/waifu_academy.py — provides endpoints for
academy status, daily rewards, missions, collection search, rename,
reset, and account deletion.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

import pytz
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from nwnl_deps import get_current_user, get_user_lock

logger = logging.getLogger(__name__)
router = APIRouter()

TZ = pytz.timezone("Asia/Bangkok")

# ─── Request / Response Models ────────────────────────────────────────

class RenameRequest(BaseModel):
    name: str = Field(min_length=3, max_length=50)

class ResetRequest(BaseModel):
    confirmation: str

class DeleteRequest(BaseModel):
    confirmation: str


# ─── Helper ───────────────────────────────────────────────────────────

def _get_db(request: Request):
    """Get NwnlDatabaseService from app state."""
    db = request.app.state.nwnl_db
    if not db or not db.pool:
        raise HTTPException(status_code=503, detail="NWNL services are not available")
    return db


# ─── Endpoints ────────────────────────────────────────────────────────

@router.get("/status")
async def academy_status(
    request: Request,
    user_id: str = Depends(get_current_user),
):
    """Get comprehensive academy status: rank, currencies, star distribution, rank progress."""
    db = _get_db(request)

    await db.check_and_update_rank(user_id)
    stats = await db.get_user_stats(user_id)
    user = stats["user"]

    current_rank = user["collector_rank"]
    power = stats["collection_power"]
    waifus = stats["total_waifus"]

    next_rank_power_req = 1000 * (2 ** current_rank)
    next_rank_waifu_req = 5 * current_rank

    power_pct = min(power / next_rank_power_req, 1.0) if next_rank_power_req else 1.0
    waifu_pct = min(waifus / next_rank_waifu_req, 1.0) if next_rank_waifu_req else 1.0

    return {
        "academy_name": user.get("academy_name", f"Academy {user_id[:6]}"),
        "collector_rank": current_rank,
        "sakura_crystals": user.get("sakura_crystals", 0),
        "quartzs": user.get("quartzs", 0),
        "daphine": user.get("daphine", 0),
        "pity_counter": user.get("pity_counter", 0),
        "guaranteed_3star_in": max(0, 50 - user.get("pity_counter", 0)),
        "total_waifus": stats["total_waifus"],
        "unique_waifus": stats["unique_waifus"],
        "collection_power": power,
        "rarity_distribution": {
            str(k): v for k, v in stats["rarity_distribution"].items()
        },
        "rank_progress": {
            "power": power,
            "power_required": next_rank_power_req,
            "power_pct": round(power_pct, 3),
            "waifus": waifus,
            "waifus_required": next_rank_waifu_req,
            "waifu_pct": round(waifu_pct, 3),
            "overall_pct": round(min(power_pct, waifu_pct), 3),
        },
    }


@router.post("/daily")
async def claim_daily(
    request: Request,
    user_id: str = Depends(get_current_user),
    lock: asyncio.Lock = Depends(get_user_lock),
):
    """Claim daily 500 sakura crystals. Resets at 00:00 UTC+7."""
    db = _get_db(request)

    async with lock:
        user = await db.get_or_create_user(user_id)

        now_utc = datetime.now(timezone.utc)
        current_ts = int(now_utc.timestamp())

        last_reset = user.get("last_daily_reset", 0)

        if last_reset > 0:
            last_dt = datetime.fromtimestamp(last_reset, tz=timezone.utc).astimezone(TZ)
            last_zero = last_dt.replace(hour=0, minute=0, second=0, microsecond=0)
            next_reset = last_zero + timedelta(days=1)
            next_reset_ts = int(next_reset.astimezone(timezone.utc).timestamp())
        else:
            next_reset_ts = 0

        if last_reset > 0 and current_ts < next_reset_ts:
            seconds_left = next_reset_ts - current_ts
            return {
                "claimed": False,
                "reason": "already_claimed",
                "seconds_left": seconds_left,
                "current_crystals": user["sakura_crystals"],
            }

        daily_crystals = 500
        await db.update_user_crystals(user_id, daily_crystals)
        await db.update_daily_reset(user_id, current_ts)

        return {
            "claimed": True,
            "crystals_earned": daily_crystals,
            "current_crystals": user["sakura_crystals"] + daily_crystals,
        }


@router.get("/missions")
async def get_missions(
    request: Request,
    user_id: str = Depends(get_current_user),
):
    """Get daily missions with user's progress."""
    db = _get_db(request)

    now_local = datetime.now(timezone.utc).astimezone(TZ)
    today = now_local.date()

    missions = await db.get_all_active_daily_missions()
    progress_rows = await db.get_all_user_mission_progress_for_date(user_id, today)
    progress_map = {row["mission_id"]: row for row in progress_rows}

    result = []
    for m in missions:
        mid = m["id"]
        prog = progress_map.get(mid)
        current = prog["current_progress"] if prog else 0
        completed = prog["completed"] if prog else False
        claimed = prog["claimed"] if prog else False

        result.append({
            "id": mid,
            "name": m["name"],
            "description": m["description"],
            "target_count": m["target_count"],
            "current_progress": current,
            "completed": completed,
            "claimed": claimed,
            "reward_type": m["reward_type"],
            "reward_amount": m["reward_amount"],
        })

    return {"missions": result, "date": str(today)}


@router.post("/missions/{mission_id}/claim")
async def claim_mission(
    mission_id: int,
    request: Request,
    user_id: str = Depends(get_current_user),
    lock: asyncio.Lock = Depends(get_user_lock),
):
    """Claim a completed mission's reward."""
    db = _get_db(request)

    async with lock:
        now_local = datetime.now(timezone.utc).astimezone(TZ)
        today = now_local.date()

        success = await db.claim_user_mission_reward(user_id, mission_id, today)
        if not success:
            raise HTTPException(
                status_code=400,
                detail="Mission not claimable — either not completed or already claimed.",
            )
        return {"claimed": True, "mission_id": mission_id}


@router.post("/rename")
async def rename_academy(
    body: RenameRequest,
    request: Request,
    user_id: str = Depends(get_current_user),
    lock: asyncio.Lock = Depends(get_user_lock),
):
    """Rename the user's academy (3–50 characters)."""
    db = _get_db(request)

    async with lock:
        await db.update_academy_name(user_id, body.name)
        return {"renamed": True, "new_name": body.name}


@router.post("/reset")
async def reset_account(
    body: ResetRequest,
    request: Request,
    user_id: str = Depends(get_current_user),
    lock: asyncio.Lock = Depends(get_user_lock),
):
    """Reset academy progress. Requires confirmation: "confirm"."""
    if body.confirmation.lower() != "confirm":
        raise HTTPException(
            status_code=400,
            detail='Send confirmation: "confirm" to reset your academy.',
        )

    db = _get_db(request)

    async with lock:
        stats = await db.get_user_stats(user_id)
        success = await db.reset_user_account(user_id)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to reset account.")

        return {
            "reset": True,
            "previous_stats": {
                "total_waifus": stats["total_waifus"],
                "unique_waifus": stats["unique_waifus"],
                "collection_power": stats["collection_power"],
                "collector_rank": stats["user"]["collector_rank"],
                "sakura_crystals": stats["user"]["sakura_crystals"],
            },
        }


@router.delete("/delete")
async def delete_account(
    body: DeleteRequest,
    request: Request,
    user_id: str = Depends(get_current_user),
    lock: asyncio.Lock = Depends(get_user_lock),
):
    """Permanently delete account. Requires confirmation: "delete forever"."""
    if body.confirmation.lower() != "delete forever":
        raise HTTPException(
            status_code=400,
            detail='Send confirmation: "delete forever" to permanently delete your account.',
        )

    db = _get_db(request)

    async with lock:
        stats = await db.get_user_stats(user_id)
        success = await db.delete_user_account(user_id)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete account.")

        return {
            "deleted": True,
            "final_stats": {
                "total_waifus": stats["total_waifus"],
                "unique_waifus": stats["unique_waifus"],
                "collection_power": stats["collection_power"],
                "collector_rank": stats["user"]["collector_rank"],
                "sakura_crystals": stats["user"]["sakura_crystals"],
            },
        }


@router.get("/search")
async def collection_search(
    request: Request,
    user_id: str = Depends(get_current_user),
    anime_id: Optional[int] = None,
    genre: Optional[str] = None,
    archetype: Optional[str] = None,
    element: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    """Search/filter user's waifu collection. Paginated."""
    db = _get_db(request)

    collection = await db.get_user_collection_with_stars(user_id)
    if not collection:
        return {"results": [], "total": 0, "page": 1, "page_count": 1}

    filtered = collection

    if anime_id is not None:
        filtered = [w for w in filtered if w.get("series_id") == anime_id]

    if genre is not None:
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

    if archetype is not None:
        filtered = [
            w for w in filtered
            if isinstance(w.get("archetype"), str)
            and archetype.lower() in w["archetype"].lower()
        ]

    if element is not None:
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
