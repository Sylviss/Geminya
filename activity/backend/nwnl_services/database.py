"""Standalone database service for NWNL Activity backend.

Manages the asyncpg connection pool and provides query methods needed
by the Activity API routes. Built incrementally as cogs are migrated.
"""

import asyncpg
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

# Constants matching bot's WaifuService
MAX_STAR_LEVEL = 6
UPGRADE_COSTS = {2: 50, 3: 100, 4: 150, 5: 250, 6: 350}
POWER_BY_STAR = {1: 100, 2: 250, 3: 500, 4: 1000}

# JSON fields that need parsing from string → dict/list
_WAIFU_JSON_FIELDS = [
    "stats", "elemental_type", "potency",
    "elemental_resistances", "favorite_gifts", "special_dialogue",
]


def _parse_waifu_json_fields(waifu: dict) -> dict:
    """Parse JSON-encoded string fields in a waifu row."""
    for field in _WAIFU_JSON_FIELDS:
        val = waifu.get(field)
        if val is not None and isinstance(val, str):
            try:
                waifu[field] = json.loads(val)
            except Exception:
                pass
    return waifu


class NwnlDatabaseService:
    """Database service for NWNL routes — connects directly to PostgreSQL."""

    def __init__(self, pg_config: Dict[str, Any]):
        self.pg_config = pg_config
        self.pool: Optional[asyncpg.Pool] = None

    async def initialize(self):
        """Create the connection pool."""
        self.pool = await asyncpg.create_pool(
            host=self.pg_config["host"],
            port=self.pg_config["port"],
            user=self.pg_config["user"],
            password=self.pg_config["password"],
            database=self.pg_config["database"],
            min_size=2,
            max_size=10,
        )
        logger.info("NwnlDatabaseService: PostgreSQL pool created")

    async def close(self):
        """Close the connection pool."""
        if self.pool:
            await self.pool.close()
            logger.info("NwnlDatabaseService: PostgreSQL pool closed")

    # ═══════════════════════════════════════════════════════════════════
    #  User Management
    # ═══════════════════════════════════════════════════════════════════

    async def get_or_create_user(self, discord_id: str) -> Dict[str, Any]:
        """Get user from database or create if doesn't exist."""
        async with self.pool.acquire() as conn:
            user = await conn.fetchrow(
                "SELECT * FROM users WHERE discord_id = $1", discord_id
            )
            if user:
                return dict(user)

            old_date = datetime(2022, 1, 1, tzinfo=timezone.utc)
            old_timestamp = int(old_date.timestamp())
            await conn.execute(
                """INSERT INTO users (discord_id, academy_name, last_daily_reset)
                   VALUES ($1, $2, $3)""",
                discord_id,
                f"Academy {discord_id[:6]}",
                old_timestamp,
            )
            user = await conn.fetchrow(
                "SELECT * FROM users WHERE discord_id = $1", discord_id
            )
            return dict(user) if user else {}

    async def update_academy_name(self, discord_id: str, name: str) -> bool:
        """Rename the user's academy."""
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                "UPDATE users SET academy_name = $1 WHERE discord_id = $2",
                name, discord_id,
            )
            return result[-1] != "0"

    async def update_user_crystals(self, discord_id: str, amount: int) -> bool:
        """Add/subtract sakura crystals."""
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                "UPDATE users SET sakura_crystals = sakura_crystals + $1 WHERE discord_id = $2",
                amount, discord_id,
            )
            return result[-1] != "0"

    async def update_user_rank(self, discord_id: str, new_rank: int) -> bool:
        """Set collector rank."""
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                "UPDATE users SET collector_rank = $1 WHERE discord_id = $2",
                new_rank, discord_id,
            )
            return result[-1] != "0"

    async def update_daily_reset(self, discord_id: str, timestamp: int) -> bool:
        """Update last daily claim timestamp."""
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                "UPDATE users SET last_daily_reset = $1 WHERE discord_id = $2",
                timestamp, discord_id,
            )
            return result[-1] != "0"

    async def reset_user_account(self, discord_id: str) -> bool:
        """Reset all progress to defaults (keeps the user row)."""
        async with self.pool.acquire() as conn:
            try:
                await conn.execute(
                    """UPDATE users SET
                       sakura_crystals = 2000,
                       quartzs = 0,
                       pity_counter = 0,
                       last_daily_reset = 0,
                       collector_rank = 1
                       WHERE discord_id = $1""",
                    discord_id,
                )
                user_row = await conn.fetchrow(
                    "SELECT id FROM users WHERE discord_id = $1", discord_id
                )
                if user_row:
                    uid = user_row["id"]
                    await conn.execute("DELETE FROM user_waifus WHERE user_id = $1", uid)
                    await conn.execute("DELETE FROM conversations WHERE user_id = $1", uid)
                    await conn.execute("DELETE FROM user_mission_progress WHERE user_id = $1", uid)
                    await conn.execute("DELETE FROM user_inventory WHERE user_id = $1", discord_id)
                    await conn.execute("DELETE FROM user_purchases WHERE user_id = $1", discord_id)
                    await conn.execute("DELETE FROM gift_code_redemptions WHERE user_id = $1", discord_id)
                return True
            except Exception as e:
                logger.error(f"Error resetting user account {discord_id}: {e}")
                return False

    async def delete_user_account(self, discord_id: str) -> bool:
        """Permanently delete user account and all related data."""
        async with self.pool.acquire() as conn:
            try:
                user_row = await conn.fetchrow(
                    "SELECT id FROM users WHERE discord_id = $1", discord_id
                )
                if user_row:
                    uid = user_row["id"]
                    await conn.execute("DELETE FROM user_inventory WHERE user_id = $1", discord_id)
                    await conn.execute("DELETE FROM user_purchases WHERE user_id = $1", discord_id)
                    await conn.execute("DELETE FROM gift_code_redemptions WHERE user_id = $1", discord_id)
                    await conn.execute("DELETE FROM users WHERE id = $1", uid)
                return True
            except Exception as e:
                logger.error(f"Error deleting user account {discord_id}: {e}")
                return False

    # ═══════════════════════════════════════════════════════════════════
    #  Collection
    # ═══════════════════════════════════════════════════════════════════

    async def get_user_collection(self, discord_id: str) -> List[Dict[str, Any]]:
        """Get all waifus in a user's collection with waifu metadata."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT uw.*, w.name, w.series, w.series_id, w.rarity, w.image_url,
                       w.waifu_id, w.stats, w.elemental_type, w.potency,
                       w.elemental_resistances, w.favorite_gifts, w.special_dialogue,
                       w.archetype
                FROM user_waifus uw
                JOIN waifus w ON uw.waifu_id = w.waifu_id
                JOIN users u ON uw.user_id = u.id
                WHERE u.discord_id = $1
                ORDER BY uw.obtained_at DESC
                """,
                discord_id,
            )
            return [_parse_waifu_json_fields(dict(row)) for row in rows]

    async def get_user_collection_shard_data(
        self, discord_id: str, waifu_ids: List[int]
    ) -> Dict[int, int]:
        """Batch-fetch shard counts for specific waifus in a user's collection."""
        if not waifu_ids:
            return {}
        async with self.pool.acquire() as conn:
            user = await conn.fetchrow(
                "SELECT id FROM users WHERE discord_id = $1", discord_id
            )
            if not user:
                return {}
            rows = await conn.fetch(
                "SELECT waifu_id, star_shards FROM user_waifus WHERE user_id = $1 AND waifu_id = ANY($2::int[])",
                user["id"], waifu_ids,
            )
            return {row["waifu_id"]: row["star_shards"] for row in rows}

    async def get_series_genres(self, series_id: int) -> List[str]:
        """Get pipe-separated genres for a series, returned as a list."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT genres FROM series WHERE series_id = $1", series_id
            )
            if not row or not row["genres"]:
                return []
            return [g.strip() for g in row["genres"].split("|") if g.strip()]

    # ═══════════════════════════════════════════════════════════════════
    #  Stats & Rank (ported from WaifuService logic)
    # ═══════════════════════════════════════════════════════════════════

    async def get_user_stats(self, discord_id: str) -> Dict[str, Any]:
        """Compute comprehensive user statistics for academy status display."""
        user = await self.get_or_create_user(discord_id)
        collection = await self.get_user_collection(discord_id)

        total_waifus = len(collection)
        unique_waifus = len({w["waifu_id"] for w in collection})

        collection_power = 0
        star_distribution: Dict[int, int] = {}

        for waifu in collection:
            star = waifu.get("current_star_level") or waifu.get("rarity", 1) or 1

            # Power formula matching bot
            if star <= 4:
                power = POWER_BY_STAR.get(star, 100)
            else:
                power = 2000 * (2 ** (star - 5))
            collection_power += power

            star_distribution[star] = star_distribution.get(star, 0) + 1

        return {
            "user": user,
            "total_waifus": total_waifus,
            "unique_waifus": unique_waifus,
            "collection_power": collection_power,
            "rarity_distribution": star_distribution,
        }

    async def check_and_update_rank(self, discord_id: str) -> int:
        """Check if user qualifies for rank up and update. Returns new rank."""
        stats = await self.get_user_stats(discord_id)
        user = stats["user"]
        current_rank = user["collector_rank"]
        power = stats["collection_power"]
        waifus = stats["total_waifus"]

        # Rank by power: exponential (1000 * 2^rank)
        rank_by_power = 1
        while power >= 1000 * (2 ** rank_by_power):
            rank_by_power += 1

        # Rank by waifus: 5 per rank
        rank_by_waifus = (waifus // 5) + 1

        suggested = min(rank_by_power, rank_by_waifus)
        if suggested > current_rank:
            await self.update_user_rank(discord_id, suggested)
            return suggested
        return current_rank

    async def get_user_collection_with_stars(
        self, discord_id: str
    ) -> List[Dict[str, Any]]:
        """Get collection enhanced with star/shard/upgrade info."""
        collection = await self.get_user_collection(discord_id)
        if not collection:
            return []

        waifu_ids = [w["waifu_id"] for w in collection]
        shard_map = await self.get_user_collection_shard_data(discord_id, waifu_ids)

        enhanced = []
        for waifu in collection:
            wid = waifu["waifu_id"]
            star = waifu.get("current_star_level") or waifu["rarity"]
            shards = shard_map.get(wid, 0)
            next_star = star + 1 if star < MAX_STAR_LEVEL else None
            shards_needed = UPGRADE_COSTS.get(next_star, 0) if next_star else 0
            enhanced.append({
                **waifu,
                "current_star_level": star,
                "character_shards": shards,
                "next_star_level": next_star,
                "shards_needed_for_upgrade": shards_needed,
                "can_upgrade": shards >= shards_needed if shards_needed > 0 else False,
                "is_max_star": star >= MAX_STAR_LEVEL,
            })
        return enhanced

    # ═══════════════════════════════════════════════════════════════════
    #  Daily Missions
    # ═══════════════════════════════════════════════════════════════════

    async def get_all_active_daily_missions(self) -> List[Dict[str, Any]]:
        """Fetch all active daily missions."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM daily_missions WHERE is_active = TRUE"
            )
            return [dict(row) for row in rows]

    async def get_all_user_mission_progress_for_date(
        self, discord_id: str, date
    ) -> List[Dict[str, Any]]:
        """Fetch all user mission progress for a given date."""
        async with self.pool.acquire() as conn:
            user_row = await conn.fetchrow(
                "SELECT id FROM users WHERE discord_id = $1", discord_id
            )
            if not user_row:
                return []
            rows = await conn.fetch(
                "SELECT * FROM user_mission_progress WHERE user_id = $1 AND date = $2",
                user_row["id"], date,
            )
            return [dict(row) for row in rows]

    async def claim_user_mission_reward(
        self, discord_id: str, mission_id: int, date
    ) -> bool:
        """Mark mission as claimed and grant the reward. Returns False if not claimable."""
        async with self.pool.acquire() as conn:
            user_row = await conn.fetchrow(
                "SELECT id FROM users WHERE discord_id = $1", discord_id
            )
            if not user_row:
                return False
            progress = await conn.fetchrow(
                "SELECT * FROM user_mission_progress WHERE user_id = $1 AND mission_id = $2 AND date = $3",
                user_row["id"], mission_id, date,
            )
            if not progress or not progress["completed"] or progress["claimed"]:
                return False

            await conn.execute(
                "UPDATE user_mission_progress SET claimed = TRUE WHERE id = $1",
                progress["id"],
            )
            mission = await conn.fetchrow(
                "SELECT * FROM daily_missions WHERE id = $1", mission_id
            )
            if mission and mission["reward_type"] == "gems":
                await conn.execute(
                    "UPDATE users SET sakura_crystals = sakura_crystals + $1 WHERE discord_id = $2",
                    mission["reward_amount"], discord_id,
                )
            return True
