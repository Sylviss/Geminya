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

    async def get_series_page(
        self, page: int = 1, page_size: int = 20, name_query: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get paginated series list with optional name filtering."""
        safe_page = max(1, page)
        safe_page_size = max(1, min(page_size, 100))
        offset = (safe_page - 1) * safe_page_size

        where_sql = ""
        params: List[Any] = []
        if name_query:
            where_sql = "WHERE LOWER(name) LIKE LOWER($1)"
            params.append(f"%{name_query.strip()}%")

        async with self.pool.acquire() as conn:
            total_row = await conn.fetchrow(
                f"SELECT COUNT(*) AS total FROM series {where_sql}", *params
            )
            total = int(total_row["total"]) if total_row else 0

            if name_query:
                rows = await conn.fetch(
                    f"""
                    SELECT series_id, name, english_name, image_link, creator,
                           genres, synopsis, favorites, members, score, media_type
                    FROM series
                    {where_sql}
                    ORDER BY COALESCE(members, 0) DESC, series_id ASC
                    OFFSET $2 LIMIT $3
                    """,
                    *params,
                    offset,
                    safe_page_size,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT series_id, name, english_name, image_link, creator,
                           genres, synopsis, favorites, members, score, media_type
                    FROM series
                    ORDER BY COALESCE(members, 0) DESC, series_id ASC
                    OFFSET $1 LIMIT $2
                    """,
                    offset,
                    safe_page_size,
                )

        items: List[Dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            genres_raw = item.get("genres") or ""
            item["genres_list"] = [g.strip() for g in genres_raw.split("|") if g.strip()]
            items.append(item)

        page_count = max(1, (total + safe_page_size - 1) // safe_page_size)
        return {
            "items": items,
            "total": total,
            "page": min(safe_page, page_count),
            "page_count": page_count,
            "page_size": safe_page_size,
        }

    async def get_series_by_id(self, series_id: int) -> Optional[Dict[str, Any]]:
        """Get a single series row by series_id."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT series_id, name, english_name, image_link, creator,
                       genres, synopsis, favorites, members, score, media_type
                FROM series
                WHERE series_id = $1
                """,
                series_id,
            )
            if not row:
                return None
            item = dict(row)
            genres_raw = item.get("genres") or ""
            item["genres_list"] = [g.strip() for g in genres_raw.split("|") if g.strip()]
            return item

    async def get_waifus_by_series_id(self, series_id: int) -> List[Dict[str, Any]]:
        """Get all waifus belonging to a specific series."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT waifu_id, name, series, series_id, rarity, image_url,
                       archetype, stats, elemental_type, potency,
                       elemental_resistances, favorite_gifts, special_dialogue
                FROM waifus
                WHERE series_id = $1
                ORDER BY rarity DESC, name ASC
                """,
                series_id,
            )
            return [_parse_waifu_json_fields(dict(row)) for row in rows]

    async def search_series_and_waifus(
        self, query: str, limit: int = 20
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Search both series and waifus by name (case-insensitive)."""
        q = (query or "").strip()
        if not q:
            return {"series": [], "characters": []}

        safe_limit = max(1, min(limit, 100))
        like = f"%{q}%"

        async with self.pool.acquire() as conn:
            series_rows = await conn.fetch(
                """
                SELECT series_id, name, english_name, image_link, creator,
                       genres, synopsis, favorites, members, score, media_type
                FROM series
                WHERE LOWER(name) LIKE LOWER($1)
                   OR LOWER(COALESCE(english_name, '')) LIKE LOWER($1)
                ORDER BY COALESCE(members, 0) DESC, series_id ASC
                LIMIT $2
                """,
                like,
                safe_limit,
            )

            waifu_rows = await conn.fetch(
                """
                SELECT waifu_id, name, series, series_id, rarity, image_url,
                       archetype, stats, elemental_type, potency,
                       elemental_resistances, favorite_gifts, special_dialogue
                FROM waifus
                WHERE LOWER(name) LIKE LOWER($1)
                   OR LOWER(series) LIKE LOWER($1)
                ORDER BY rarity DESC, name ASC
                LIMIT $2
                """,
                like,
                safe_limit,
            )

        series_result: List[Dict[str, Any]] = []
        for row in series_rows:
            item = dict(row)
            genres_raw = item.get("genres") or ""
            item["genres_list"] = [g.strip() for g in genres_raw.split("|") if g.strip()]
            series_result.append(item)

        return {
            "series": series_result,
            "characters": [_parse_waifu_json_fields(dict(row)) for row in waifu_rows],
        }

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
    #  Banners
    # ═══════════════════════════════════════════════════════════════════

    async def list_active_banners(self) -> List[Dict[str, Any]]:
        """Return all banners where is_active = TRUE."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM banners WHERE is_active = TRUE ORDER BY id")
            return [dict(row) for row in rows]

    async def get_banner(self, banner_id: int) -> Optional[Dict[str, Any]]:
        """Return a single banner by primary key."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM banners WHERE id = $1", banner_id)
            return dict(row) if row else None

    async def get_banner_items(self, banner_id: int) -> List[Dict[str, Any]]:
        """Return all banner_items rows for a banner."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM banner_items WHERE banner_id = $1", banner_id)
            return [dict(row) for row in rows]

    # ═══════════════════════════════════════════════════════════════════
    #  Waifu Data (for gacha pool building)
    # ═══════════════════════════════════════════════════════════════════

    async def get_all_waifus(self) -> List[Dict[str, Any]]:
        """Return all waifu records (name, rarity, series, image, stats, etc.)."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT waifu_id, name, series, series_id, rarity, image_url, archetype, "
                "stats, elemental_type, potency, elemental_resistances, favorite_gifts, special_dialogue "
                "FROM waifus ORDER BY waifu_id"
            )
            return [_parse_waifu_json_fields(dict(row)) for row in rows]

    async def get_waifus_by_ids(self, waifu_ids: List[int]) -> List[Dict[str, Any]]:
        """Return waifu records for a given list of waifu_ids."""
        if not waifu_ids:
            return []
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT waifu_id, name, series, series_id, rarity, image_url, archetype, "
                "stats, elemental_type, potency, elemental_resistances, favorite_gifts, special_dialogue "
                "FROM waifus WHERE waifu_id = ANY($1::int[])",
                waifu_ids,
            )
            return [_parse_waifu_json_fields(dict(row)) for row in rows]

    async def get_waifu_by_id(self, waifu_id: int) -> Optional[Dict[str, Any]]:
        """Return a single waifu by waifu_id."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT waifu_id, name, series, series_id, rarity, image_url, archetype, "
                "stats, elemental_type, potency, elemental_resistances, favorite_gifts, special_dialogue "
                "FROM waifus WHERE waifu_id = $1",
                waifu_id,
            )
            return _parse_waifu_json_fields(dict(row)) if row else None

    # ═══════════════════════════════════════════════════════════════════
    #  Currency & Pity (for summon)
    # ═══════════════════════════════════════════════════════════════════

    async def update_user_quartzs(self, discord_id: str, amount: int) -> bool:
        """Add/subtract quartzs."""
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                "UPDATE users SET quartzs = quartzs + $1 WHERE discord_id = $2",
                amount, discord_id,
            )
            return result[-1] != "0"

    async def update_user_daphine(self, discord_id: str, amount: int) -> bool:
        """Add daphine."""
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                "UPDATE users SET daphine = daphine + $1 WHERE discord_id = $2",
                amount, discord_id,
            )
            return result[-1] != "0"

    async def remove_user_daphine(self, discord_id: str, amount: int) -> bool:
        """Remove daphine if sufficient balance; returns False if insufficient."""
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                "UPDATE users SET daphine = daphine - $1 WHERE discord_id = $2 AND daphine >= $1",
                amount, discord_id,
            )
            return result[-1] != "0"

    async def update_pity_counter(self, discord_id: str, reset: bool = False) -> bool:
        """Increment or reset the pity counter."""
        async with self.pool.acquire() as conn:
            if reset:
                result = await conn.execute(
                    "UPDATE users SET pity_counter = 0 WHERE discord_id = $1", discord_id
                )
            else:
                result = await conn.execute(
                    "UPDATE users SET pity_counter = pity_counter + 1 WHERE discord_id = $1", discord_id
                )
            return result[-1] != "0"

    async def clamp_user_pity_counter(self, discord_id: str, max_pity: int) -> bool:
        """Ensure pity counter never exceeds max_pity."""
        async with self.pool.acquire() as conn:
            await conn.execute(
                "UPDATE users SET pity_counter = $1 WHERE discord_id = $2 AND pity_counter > $1",
                max_pity, discord_id,
            )
            return True

    # ═══════════════════════════════════════════════════════════════════
    #  Character Shards & Star Level (for summon results)
    # ═══════════════════════════════════════════════════════════════════

    async def add_waifu_to_collection(self, discord_id: str, waifu_id: int) -> bool:
        """Add a new waifu to user collection (no-op if already owned). Returns True if inserted."""
        async with self.pool.acquire() as conn:
            user_row = await conn.fetchrow(
                "SELECT id FROM users WHERE discord_id = $1", discord_id
            )
            if not user_row:
                return False
            uid = user_row["id"]
            result = await conn.execute(
                "INSERT INTO user_waifus (user_id, waifu_id, obtained_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING",
                uid, waifu_id,
            )
            return result.split()[-1] != "0"

    async def set_character_initial_star(self, discord_id: str, waifu_id: int, star_level: int) -> bool:
        """Set the initial star level for a freshly-added character."""
        async with self.pool.acquire() as conn:
            user_row = await conn.fetchrow(
                "SELECT id FROM users WHERE discord_id = $1", discord_id
            )
            if not user_row:
                return False
            result = await conn.execute(
                "UPDATE user_waifus SET current_star_level = $1 WHERE user_id = $2 AND waifu_id = $3",
                star_level, user_row["id"], waifu_id,
            )
            return result[-1] != "0"

    async def get_character_shards(self, discord_id: str, waifu_id: int) -> int:
        """Get current star_shards for a character in a user's collection."""
        async with self.pool.acquire() as conn:
            user_row = await conn.fetchrow(
                "SELECT id FROM users WHERE discord_id = $1", discord_id
            )
            if not user_row:
                return 0
            row = await conn.fetchrow(
                "SELECT star_shards FROM user_waifus WHERE user_id = $1 AND waifu_id = $2",
                user_row["id"], waifu_id,
            )
            return (row["star_shards"] or 0) if row else 0

    async def add_character_shards(self, discord_id: str, waifu_id: int, amount: int) -> None:
        """Add star_shards to a character."""
        async with self.pool.acquire() as conn:
            user_row = await conn.fetchrow(
                "SELECT id FROM users WHERE discord_id = $1", discord_id
            )
            if not user_row:
                return
            await conn.execute(
                "UPDATE user_waifus SET star_shards = star_shards + $1 WHERE user_id = $2 AND waifu_id = $3",
                amount, user_row["id"], waifu_id,
            )

    async def update_character_star_and_shards(
        self, discord_id: str, waifu_id: int, star_level: int, shards: int
    ) -> bool:
        """Atomically set current_star_level and star_shards for a character."""
        async with self.pool.acquire() as conn:
            user_row = await conn.fetchrow(
                "SELECT id FROM users WHERE discord_id = $1", discord_id
            )
            if not user_row:
                return False
            result = await conn.execute(
                "UPDATE user_waifus SET current_star_level = $1, star_shards = $2 WHERE user_id = $3 AND waifu_id = $4",
                star_level, shards, user_row["id"], waifu_id,
            )
            return result[-1] != "0"

    async def get_character_star_level(self, discord_id: str, waifu_id: int) -> int:
        """Get current star level of a character (falls back to base rarity)."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT uw.current_star_level, w.rarity
                FROM user_waifus uw
                JOIN waifus w ON uw.waifu_id = w.waifu_id
                JOIN users u ON uw.user_id = u.id
                WHERE u.discord_id = $1 AND uw.waifu_id = $2
                LIMIT 1
                """,
                discord_id, waifu_id,
            )
            if row:
                return row["current_star_level"] if row["current_star_level"] is not None else row["rarity"]
            fallback = await conn.fetchrow("SELECT rarity FROM waifus WHERE waifu_id = $1", waifu_id)
            return fallback["rarity"] if fallback else 1

    async def get_user_waifu(self, discord_id: str, waifu_id: int) -> Optional[Dict[str, Any]]:
        """Return a user_waifu row + waifu metadata for a specific waifu. None if not owned."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT uw.id as user_waifu_id, uw.waifu_id, uw.current_star_level,
                       uw.star_shards, uw.is_awakened, w.name, w.series, w.rarity,
                       w.image_url, w.archetype, w.stats, w.elemental_type
                FROM user_waifus uw
                JOIN waifus w ON uw.waifu_id = w.waifu_id
                JOIN users u ON uw.user_id = u.id
                WHERE u.discord_id = $1 AND uw.waifu_id = $2
                """,
                discord_id, waifu_id,
            )
            return _parse_waifu_json_fields(dict(row)) if row else None

    async def awaken_user_waifu(self, discord_id: str, waifu_id: int) -> Dict[str, Any]:
        """Awaken a waifu consuming 1 Daphine. Returns result dict with success/message."""
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                user = await conn.fetchrow(
                    "SELECT id, daphine FROM users WHERE discord_id = $1", discord_id
                )
                if not user:
                    return {"success": False, "message": "User not found."}
                if user["daphine"] < 1:
                    return {"success": False, "message": "You do not have any Daphine. 🦋"}
                user_waifu = await conn.fetchrow(
                    "SELECT id, is_awakened FROM user_waifus WHERE user_id = $1 AND waifu_id = $2",
                    user["id"], waifu_id,
                )
                if not user_waifu:
                    return {"success": False, "message": "You do not own this waifu."}
                if user_waifu["is_awakened"]:
                    return {"success": False, "message": "This waifu is already awakened."}
                await conn.execute(
                    "UPDATE users SET daphine = daphine - 1 WHERE id = $1", user["id"]
                )
                await conn.execute(
                    "UPDATE user_waifus SET is_awakened = TRUE WHERE id = $1", user_waifu["id"]
                )
                return {"success": True, "message": "Waifu awakened successfully! 🦋"}

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
