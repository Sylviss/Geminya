"""Academy API routes for the NWNL Activity.

Migrated from cogs/commands/waifu_academy.py — provides endpoints for
academy status, daily rewards, missions, rename, reset, and account deletion.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from nwnl_deps import get_current_user, get_user_lock

logger = logging.getLogger(__name__)
router = APIRouter()

TZ = ZoneInfo("Asia/Bangkok")

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
        "last_daily_reset": user.get("last_daily_reset", 0),
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


