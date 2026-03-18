"""Gacha / waifu service for the NWNL Activity backend.

Ports the summon logic from cogs/commands/waifu_summon.py and
services/waifu_service.py into a standalone async service that
works with NwnlDatabaseService.
"""

import random
import logging
from typing import Dict, List, Any, Optional

from nwnl_services.database import NwnlDatabaseService

logger = logging.getLogger(__name__)

# Gacha constants (mirror WaifuService)
GACHA_RATES = {3: 5.0, 2: 20.0, 1: 75.0}
PITY_3_STAR = 50
SHARD_REWARDS = {3: 50, 2: 20, 1: 5}
UPGRADE_COSTS = {2: 50, 3: 100, 4: 150, 5: 250, 6: 350}
MAX_STAR_LEVEL = 6
DEFAULT_SUMMON_COST = 10
DEFAULT_CURRENCY = "sakura_crystals"


# Rate-up weight multipliers (relative to normal pool)
# Rate-up characters get weight = (n_normal / RATE_UP_DIVISOR)
# Normal characters get weight = (n_rate_up * RATE_UP_MULTIPLIER)
RATE_UP_DIVISOR = 2.0
RATE_UP_MULTIPLIER = 1.5


class NwnlWaifuService:
    """Standalone gacha service for Activity backend."""

    def __init__(self, db: NwnlDatabaseService):
        self.db = db
        self._waifu_list: List[Dict[str, Any]] = []

    async def initialize(self):
        """Load full waifu list from DB into memory."""
        self._waifu_list = await self.db.get_all_waifus()
        logger.info("NwnlWaifuService: loaded %d waifus", len(self._waifu_list))

    # ─── Public API ───────────────────────────────────────────────────

    async def get_active_banners(self) -> List[Dict[str, Any]]:
        return await self.db.list_active_banners()

    async def get_banner(self, banner_id: int) -> Optional[Dict[str, Any]]:
        return await self.db.get_banner(banner_id)

    async def get_banner_pool(self, banner_id: int) -> List[Dict[str, Any]]:
        """Return waifu records that belong to a banner (2★ and 3★ only for display)."""
        banner = await self.db.get_banner(banner_id)
        if not banner:
            return []
        items = await self.db.get_banner_items(banner_id)
        item_ids = [i["item_id"] for i in items]
        rate_up_ids = {i["item_id"] for i in items if i.get("rate_up")}

        banner_type = banner.get("type", "standard")
        import json as _json

        series_ids_raw = banner.get("series_ids") or "[]"
        if isinstance(series_ids_raw, str):
            try:
                series_ids = _json.loads(series_ids_raw)
            except Exception:
                series_ids = []
        else:
            series_ids = list(series_ids_raw)
        series_id_set = {int(s) for s in series_ids if s}

        # Combine rate_up_ids with all characters from rate-up series
        featured_ids = set(rate_up_ids)
        if banner_type == "rate-up" and series_id_set:
            for w in self._waifu_list:
                if w.get("series_id") in series_id_set:
                    featured_ids.add(w["waifu_id"])

        result = []
        for w in self._waifu_list:
            rarity = w.get("rarity", 0)
            wid = w["waifu_id"]
            in_pool = False

            if banner_type == "rate-up":
                # Pool = all waifus of rarity 2 or 3
                in_pool = rarity in (2, 3)
                if series_id_set:
                    in_pool = in_pool and (w.get("series_id") in series_id_set)
            elif banner_type == "premium":
                in_pool = rarity in (2, 3) and wid in item_ids
            else:
                in_pool = rarity in (2, 3) and wid in item_ids

            if in_pool:
                result.append({
                    **w,
                    "is_rate_up": wid in featured_ids,
                })
        return result

    async def get_banner_rates(self, banner_id: int) -> Dict[str, Any]:
        """Return computed rate breakdown for a banner."""
        banner = await self.db.get_banner(banner_id)
        if not banner:
            return {}

        banner_type = banner.get("type", "standard")
        items = await self.db.get_banner_items(banner_id)
        rate_up_ids = {i["item_id"] for i in items if i.get("rate_up")}

        # Base rates per rarity tier
        if banner_type == "premium":
            base_rates = {3: 5.0, 2: 95.0, 1: 0.0}
        else:
            base_rates = dict(GACHA_RATES)  # {3: 5.0, 2: 20.0, 1: 75.0}

        rate_up_characters: List[Dict[str, Any]] = []
        featured_rate_per_char: Optional[float] = None
        standard_rate_per_char: Optional[float] = None

        if banner_type == "rate-up":
            # Also resolve series_ids from the banner to get all featured characters
            import json as _json
            series_ids_raw = banner.get("series_ids") or "[]"
            if isinstance(series_ids_raw, str):
                try:
                    series_ids = _json.loads(series_ids_raw)
                except Exception:
                    series_ids = []
            else:
                series_ids = list(series_ids_raw)
            series_id_set = {int(s) for s in series_ids if s}

            # Combine rate_up_ids from banner_items with all characters from series_ids
            featured_ids = set(rate_up_ids)
            for w in self._waifu_list:
                if w.get("series_id") in series_id_set:
                    featured_ids.add(w["waifu_id"])

            # Compute per-character rates within the 3★ tier
            pool_3 = [w for w in self._waifu_list if w.get("rarity") == 3]
            n_rate_up = sum(1 for w in pool_3 if w["waifu_id"] in featured_ids)
            n_normal = len(pool_3) - n_rate_up

            if n_rate_up > 0 and n_normal > 0:
                w_rate_up = n_normal / RATE_UP_DIVISOR
                w_normal = n_rate_up * RATE_UP_MULTIPLIER
                total_weight = n_rate_up * w_rate_up + n_normal * w_normal
                frac_rate_up = (w_rate_up / total_weight) if total_weight > 0 else 0.0
                frac_normal = (w_normal / total_weight) if total_weight > 0 else 0.0
                featured_rate_per_char = round(base_rates[3] * frac_rate_up, 3)
                standard_rate_per_char = round(base_rates[3] * frac_normal, 4)
            elif n_rate_up > 0:
                featured_rate_per_char = round(base_rates[3] / n_rate_up, 3)
                standard_rate_per_char = None
            else:
                standard_rate_per_char = round(base_rates[3] / max(len(pool_3), 1), 4)

            rate_up_characters = [
                {**w, "is_rate_up": True}
                for w in self._waifu_list
                if w["waifu_id"] in featured_ids
            ]

        elif banner_type == "limited":
            # For limited banners, show all limited characters (from banner_items)
            item_ids_set = set(item_ids)
            rate_up_characters = [
                {**w, "is_rate_up": False}
                for w in self._waifu_list
                if w["waifu_id"] in item_ids_set and w.get("rarity") in (2, 3)
            ]

        return {
            "banner_id": banner_id,
            "banner_name": banner.get("name", ""),
            "banner_type": banner_type,
            "base_rates": base_rates,
            "pity_at": PITY_3_STAR,
            "rate_up_characters": rate_up_characters,
            "featured_rate_per_char": featured_rate_per_char,
            "standard_rate_per_3star": standard_rate_per_char,
        }

    async def perform_summon(
        self, discord_id: str, banner_id: Optional[int] = None
    ) -> Dict[str, Any]:
        cost, currency_type = await self._get_cost_and_currency(banner_id)

        # Validate banner active
        if banner_id is not None:
            banner = await self.db.get_banner(banner_id)
            if not banner:
                return {"success": False, "message": "Banner not found."}
            if not banner.get("is_active"):
                return {"success": False, "message": f"Banner '{banner.get('name')}' is not active."}

        # Check currency
        user = await self.db.get_or_create_user(discord_id)
        has_enough, current_amount = self._check_currency(user, currency_type, cost)
        if not has_enough:
            cname = _currency_name(currency_type)
            return {
                "success": False,
                "message": f"Not enough {cname}! Need {cost}, have {current_amount}.",
            }

        banner_type = "standard"
        if banner_id is not None:
            brow = await self.db.get_banner(banner_id)
            if brow:
                banner_type = brow.get("type", "standard")

        # Determine rarity
        rarity = self._determine_rarity(user, currency_type, banner_type)

        # Build pool
        available, weights = await self._build_pool(banner_id, banner_type, rarity)
        if not available:
            return {
                "success": False,
                "message": f"No waifus available for rarity {rarity}. Please contact an admin.",
            }

        selected = random.choices(available, weights=weights, k=1)[0]

        # Handle collection logic
        summon_result = await self._handle_summon_result(discord_id, selected, rarity)

        # Deduct currency
        await self._deduct_currency(discord_id, currency_type, cost)

        # 1% Daphine bonus for non-sakura currencies
        daphine_gained = 0
        if currency_type != "sakura_crystals" and random.random() < 0.01:
            daphine_gained = 1
            await self.db.update_user_daphine(discord_id, 1)

        # Update pity (only sakura_crystals)
        if currency_type == "sakura_crystals":
            reset_pity = rarity >= 3
            await self.db.update_pity_counter(discord_id, reset=reset_pity)
            await self.db.clamp_user_pity_counter(discord_id, PITY_3_STAR)

        # +1 quartz per pull
        await self.db.update_user_quartzs(discord_id, 1)

        updated = await self.db.get_or_create_user(discord_id)
        currency_remaining = updated.get(_currency_field(currency_type), 0)

        return {
            "success": True,
            "waifu": _slim_waifu(selected),
            "rarity": rarity,
            "currency_type": currency_type,
            "cost": cost,
            "currency_remaining": currency_remaining,
            "crystals_remaining": updated.get("sakura_crystals", 0),
            "quartzs_remaining": updated.get("quartzs", 0),
            "daphine_gained": daphine_gained,
            "pity_counter": updated.get("pity_counter", 0),
            **summon_result,
        }

    async def perform_multi_summon(
        self, discord_id: str, banner_id: Optional[int] = None
    ) -> Dict[str, Any]:
        cost, currency_type = await self._get_cost_and_currency(banner_id)
        total_cost = cost * 10

        if banner_id is not None:
            banner = await self.db.get_banner(banner_id)
            if not banner:
                return {"success": False, "message": "Banner not found."}
            if not banner.get("is_active"):
                return {"success": False, "message": f"Banner '{banner.get('name')}' is not active."}

        user = await self.db.get_or_create_user(discord_id)
        has_enough, current_amount = self._check_currency(user, currency_type, total_cost)
        if not has_enough:
            cname = _currency_name(currency_type)
            return {
                "success": False,
                "message": f"Not enough {cname}! Need {total_cost} for 10 pulls, have {current_amount}.",
            }

        banner_type = "standard"
        if banner_id is not None:
            brow = await self.db.get_banner(banner_id)
            if brow:
                banner_type = brow.get("type", "standard")

        results = []
        total_daphine = 0

        for _ in range(10):
            # Re-fetch user for up-to-date pity
            user = await self.db.get_or_create_user(discord_id)
            rarity = self._determine_rarity(user, currency_type, banner_type)

            available, weights = await self._build_pool(banner_id, banner_type, rarity)
            if not available:
                available = [w for w in self._waifu_list if w.get("rarity") == rarity]
                weights = [1] * len(available)
            if not available:
                # Last-resort fallback: pick any waifu of any rarity
                available = list(self._waifu_list)
                weights = [1] * len(available)
            # Skip only if absolutely no waifus exist in the database at all
            if not available:
                continue

            selected = random.choices(available, weights=weights, k=1)[0]
            summon_result = await self._handle_summon_result(discord_id, selected, rarity)

            if currency_type != "sakura_crystals" and random.random() < 0.01:
                total_daphine += 1
                await self.db.update_user_daphine(discord_id, 1)

            if currency_type == "sakura_crystals":
                reset_pity = rarity >= 3
                await self.db.update_pity_counter(discord_id, reset=reset_pity)
                await self.db.clamp_user_pity_counter(discord_id, PITY_3_STAR)

            await self.db.update_user_quartzs(discord_id, 1)

            results.append({
                "waifu": _slim_waifu(selected),
                "rarity": rarity,
                **summon_result,
            })

        # 2★ guarantee: if no 2★+ pulled in 10 pulls, upgrade a random 1★ result to 2★
        has_two_star_plus = any(r["rarity"] >= 2 for r in results)
        if not has_two_star_plus and results:
            one_star_indices = [i for i, r in enumerate(results) if r["rarity"] == 1]
            if one_star_indices:
                upgrade_idx = random.choice(one_star_indices)
                upgraded = dict(results[upgrade_idx])
                upgraded["rarity"] = 2
                upgraded["current_star_level"] = 2
                wid = upgraded["waifu"]["waifu_id"]
                await self.db.update_character_star_and_shards(
                    discord_id, wid, 2, upgraded.get("total_shards", 0)
                )
                results[upgrade_idx] = upgraded

        await self._deduct_currency(discord_id, currency_type, total_cost)

        updated = await self.db.get_or_create_user(discord_id)
        currency_remaining = updated.get(_currency_field(currency_type), 0)

        return {
            "success": True,
            "pulls": results,
            "count": len(results),
            "currency_type": currency_type,
            "total_cost": total_cost,
            "currency_remaining": currency_remaining,
            "crystals_remaining": updated.get("sakura_crystals", 0),
            "quartzs_remaining": updated.get("quartzs", 0),
            "daphine_gained": total_daphine,
            "pity_counter": updated.get("pity_counter", 0),
        }

    # ─── Private Helpers ──────────────────────────────────────────────

    async def _get_cost_and_currency(
        self, banner_id: Optional[int]
    ) -> tuple[int, str]:
        if banner_id is None:
            return DEFAULT_SUMMON_COST, DEFAULT_CURRENCY
        banner = await self.db.get_banner(banner_id)
        if not banner:
            return DEFAULT_SUMMON_COST, DEFAULT_CURRENCY
        return banner.get("cost", DEFAULT_SUMMON_COST), banner.get("currency_type", DEFAULT_CURRENCY)

    @staticmethod
    def _check_currency(user: Dict, currency_type: str, required: int) -> tuple[bool, int]:
        field = _currency_field(currency_type)
        current = user.get(field, 0)
        return current >= required, current

    async def _deduct_currency(self, discord_id: str, currency_type: str, amount: int) -> bool:
        if currency_type == "sakura_crystals":
            return await self.db.update_user_crystals(discord_id, -amount)
        elif currency_type == "quartzs":
            return await self.db.update_user_quartzs(discord_id, -amount)
        elif currency_type == "daphine":
            return await self.db.remove_user_daphine(discord_id, amount)
        return False

    def _determine_rarity(
        self, user: Dict, currency_type: str, banner_type: str
    ) -> int:
        if banner_type == "premium":
            if currency_type == "sakura_crystals" and user.get("pity_counter", 0) >= PITY_3_STAR:
                return 3
            roll = random.random() * 100
            return 3 if roll <= 5.0 else 2

        if currency_type != "sakura_crystals":
            roll = random.random() * 100
            cumulative = 0.0
            for r in sorted(GACHA_RATES):
                cumulative += GACHA_RATES[r]
                if roll <= cumulative:
                    return r
            return 1

        # Sakura crystals with pity
        if user.get("pity_counter", 0) >= PITY_3_STAR:
            return 3

        roll = random.random() * 100
        cumulative = 0.0
        for r in sorted(GACHA_RATES):
            cumulative += GACHA_RATES[r]
            if roll <= cumulative:
                return r
        return 1

    async def _build_pool(
        self, banner_id: Optional[int], banner_type: str, rarity: int
    ) -> tuple[List[Dict], List[float]]:
        if banner_id is None:
            waifus = [w for w in self._waifu_list if w.get("rarity") == rarity]
            return waifus, [1.0] * len(waifus)

        items = await self.db.get_banner_items(banner_id)
        item_ids = {i["item_id"] for i in items}
        rate_up_ids = {i["item_id"] for i in items if i.get("rate_up")}

        if banner_type == "rate-up":
            # Combine rate_up_ids with all characters from banner's series_ids
            import json as _json
            banner = await self.db.get_banner(banner_id)
            series_ids_raw = (banner.get("series_ids") or "[]") if banner else "[]"
            if isinstance(series_ids_raw, str):
                try:
                    series_ids = _json.loads(series_ids_raw)
                except Exception:
                    series_ids = []
            else:
                series_ids = list(series_ids_raw)
            series_id_set = {int(s) for s in series_ids if s}

            featured_ids = set(rate_up_ids)
            for w in self._waifu_list:
                if w.get("series_id") in series_id_set:
                    featured_ids.add(w["waifu_id"])

            pool = [w for w in self._waifu_list if w.get("rarity") == rarity]
            n_rate_up = sum(1 for w in pool if w["waifu_id"] in featured_ids)
            n_normal = len(pool) - n_rate_up
            if n_rate_up > 0 and n_normal > 0:
                weights = [
                    (n_normal / RATE_UP_DIVISOR) if w["waifu_id"] in featured_ids else (n_rate_up * RATE_UP_MULTIPLIER)
                    for w in pool
                ]
            else:
                weights = [1.0] * len(pool)
            return pool, weights

        if banner_type == "premium":
            pool = [
                w for w in self._waifu_list
                if w["waifu_id"] in item_ids and w.get("rarity") == rarity and rarity >= 2
            ]
            return pool, [1.0] * len(pool)

        # limited / standard
        if banner_type == "limited" and rarity == 1:
            in_banner = [w for w in self._waifu_list if w["waifu_id"] in item_ids and w.get("rarity") == 1]
            ids_in = {w["waifu_id"] for w in in_banner}
            all_1star = [w for w in self._waifu_list if w.get("rarity") == 1 and w["waifu_id"] not in ids_in]
            pool = in_banner + all_1star
        else:
            pool = [w for w in self._waifu_list if w["waifu_id"] in item_ids and w.get("rarity") == rarity]
        return pool, [1.0] * len(pool)

    async def _handle_summon_result(
        self, discord_id: str, waifu: Dict, pulled_rarity: int
    ) -> Dict[str, Any]:
        wid = waifu["waifu_id"]
        existing = await self.db.get_user_waifu(discord_id, wid)

        if existing:
            current_star = existing.get("current_star_level") or pulled_rarity
            shard_reward = SHARD_REWARDS.get(pulled_rarity, 5)

            if current_star >= MAX_STAR_LEVEL:
                await self.db.update_user_quartzs(discord_id, shard_reward)
                return {
                    "is_new": False,
                    "is_duplicate": True,
                    "current_star_level": current_star,
                    "shards_gained": 0,
                    "total_shards": 0,
                    "quartz_gained": shard_reward,
                    "upgrades_performed": [],
                }

            current_shards = await self.db.get_character_shards(discord_id, wid)
            new_total = current_shards + shard_reward
            await self.db.add_character_shards(discord_id, wid, shard_reward)
            upgrade = await self._auto_upgrade(discord_id, wid, new_total, current_star)
            return {
                "is_new": False,
                "is_duplicate": True,
                "current_star_level": upgrade["final_star"],
                "shards_gained": shard_reward,
                "total_shards": upgrade["remaining_shards"],
                "quartz_gained": upgrade["quartz_gained"],
                "upgrades_performed": upgrade["upgrades"],
            }

        # New character
        await self.db.add_waifu_to_collection(discord_id, wid)
        await self.db.set_character_initial_star(discord_id, wid, pulled_rarity)
        return {
            "is_new": True,
            "is_duplicate": False,
            "current_star_level": pulled_rarity,
            "shards_gained": 0,
            "total_shards": 0,
            "quartz_gained": 0,
            "upgrades_performed": [],
        }

    async def _auto_upgrade(
        self, discord_id: str, waifu_id: int, shards: int, current_star: int
    ) -> Dict[str, Any]:
        upgrades = []
        quartz_gained = 0
        remaining = shards
        star = current_star

        while star < MAX_STAR_LEVEL:
            needed = UPGRADE_COSTS.get(star + 1)
            if needed is None or remaining < needed:
                break
            remaining -= needed
            star += 1
            upgrades.append({"from_star": star - 1, "to_star": star, "shards_used": needed})

        if star >= MAX_STAR_LEVEL and remaining > 0:
            quartz_gained = remaining
            await self.db.update_user_quartzs(discord_id, remaining)
            remaining = 0

        await self.db.update_character_star_and_shards(discord_id, waifu_id, star, remaining)
        return {"final_star": star, "remaining_shards": remaining, "quartz_gained": quartz_gained, "upgrades": upgrades}


# ─── Utilities ────────────────────────────────────────────────────────

def _slim_waifu(w: Dict[str, Any]) -> Dict[str, Any]:
    """Return only the fields the frontend needs for summon results."""
    return {
        "waifu_id": w.get("waifu_id"),
        "name": w.get("name"),
        "series": w.get("series"),
        "rarity": w.get("rarity"),
        "image_url": w.get("image_url"),
    }


def _currency_field(currency_type: str) -> str:
    return {"sakura_crystals": "sakura_crystals", "quartzs": "quartzs", "daphine": "daphine"}.get(
        currency_type, "sakura_crystals"
    )


def _currency_name(currency_type: str) -> str:
    return {"sakura_crystals": "Sakura Crystals", "quartzs": "Quartzs", "daphine": "Daphine"}.get(
        currency_type, currency_type.title()
    )
