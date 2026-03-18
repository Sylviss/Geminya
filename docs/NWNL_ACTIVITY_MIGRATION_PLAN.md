# NWNL & World Threat → Discord Activity Migration Plan

## Overview

This document describes the plan to migrate the entire NWNL and World Threat command system from the Discord bot (discord.py slash commands + Views) into the Discord Activity (React frontend + FastAPI backend).

**Approach: Move & Delete.** For each cog, build API routes and React UI in the Activity, verify feature parity, then delete the original cog.

**Service Strategy: Standalone services.** The activity backend has its own service layer in `activity/backend/nwnl_services/` that connects directly to PostgreSQL via `asyncpg`. The bot and activity share the **same database** but have **separate service code**. This avoids importing the bot's dependency tree (`discord.py`, LLMs, etc.) into the activity backend. After migration, unused bot services will be removed.

```
from nwnl_services.database import NwnlDatabaseService
# Future: from nwnl_services.waifu import NwnlWaifuService
# Future: from nwnl_services.expedition import NwnlExpeditionService
```

---

## Architecture

```
Discord Client (iframe)
    │
    ├── Frontend (Vercel)
    │       └── React + Vite SPA
    │               /nwnl/*  ← NEW routes
    │
    └── Backend (Koyeb) ← entire repo root
            └── activity/backend/main.py (FastAPI)
                    ├── Existing quiz game routers
                    ├── NEW /api/nwnl/* routers
                    └── nwnl_services/  ← standalone service layer
                            ├── database.py (asyncpg pool + queries)
                            ├── waifu.py    (gacha, stats, rank logic)
                            └── ...         (built incrementally per cog)
```

The bot (discord.py) and activity backend share the **same PostgreSQL database** but have **separate service code**.

---

## Phase 1 — Foundation ✅ COMPLETE

Standalone service layer wired into FastAPI.

| Task | Status |
|------|--------|
| **Add `asyncpg`** | ✅ Added to `requirements.txt` |
| **`NwnlDatabaseService`** | ✅ `nwnl_services/database.py` — asyncpg pool + `get_or_create_user` |
| **`NwnlConfig`** | ✅ `nwnl_config.py` — reads Postgres creds from `secrets.json` |
| **Wire in lifespan** | ✅ `main.py` — initializes `NwnlDatabaseService`, attaches to `app.state.nwnl_db` |
| **Auth dependency** | ✅ `nwnl_deps.py` — `get_current_user` reads `X-User-ID`, ensures user exists |
| **Request locking** | ✅ `nwnl_deps.py` — `get_user_lock` per-user `asyncio.Lock` dict |
| **Guild context** | ✅ `nwnl_deps.py` — `get_guild_id` reads `X-Guild-ID` header |
| **Frontend headers** | ✅ `client.ts` sends `X-Guild-ID`, `discord.ts` exports `getGuildId()` |
| **Ban checking** | ✅ `nwnl_middleware.py` — checks `banned.json` for `/api/nwnl/*` |

---

## Phase 2 — Cog Migration (one by one)

Each cog follows the same loop:

```
1. Build API routes in activity/backend/routers/nwnl_<name>.py
2. Test endpoints with curl / Postman
3. Build React page(s) + components in activity/frontend/src/
4. Test end-to-end in Discord Activity iframe
5. Delete the bot cog file
```

---

### 2A — Academy (3 days)

**Simplest UI. Proves the full pipeline end-to-end.**

#### Backend — `activity/backend/routers/nwnl_academy.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/nwnl/academy/status` | GET | Rank, currencies, star distribution, rank progress |
| `/nwnl/academy/daily` | POST | Claim 500 crystals (UTC+7 daily reset) |
| `/nwnl/academy/missions` | GET | Daily missions + progress |
| `/nwnl/academy/missions/{id}/claim` | POST | Claim mission reward |
| `/nwnl/academy/rename` | POST | Rename academy |
| `/nwnl/academy/reset` | POST | Reset account |
| `/nwnl/academy/delete` | DELETE | Delete account permanently |
| `/nwnl/academy/search` | GET | Filtered collection search with stats *(Note: will move to Phase 2C collection router later)* |

#### Frontend

| Component | Description |
|-----------|-------------|
| `pages/Academy.tsx` | Rank badge, crystal/quartzs/daphine display, star distribution chart |
| Daily claim button | With countdown timer to next UTC+7 reset |
| Missions panel | Progress bars + claim buttons per mission |
| Collection search | Filter by name/series/element/archetype, paginated results *(Note: will move to Phase 2C collection page later)* |

**Delete:** `cogs/commands/waifu_academy.py`

---

### 2B — Banners + Summon (5 days)

**Core gacha loop. High user impact. Summon animation is the big UX upgrade.**

#### Backend — `activity/backend/routers/nwnl_summon.py` + `nwnl_banner.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/nwnl/banners` | GET | List active banners |
| `/nwnl/banners/{id}` | GET | Banner details |
| `/nwnl/banners/{id}/pool` | GET | Banner character pool |
| `/nwnl/summon` | POST | Single pull (banner_id optional) |
| `/nwnl/summon/multi` | POST | 10x pull |

#### Frontend

| Component | Description |
|-----------|-------------|
| `pages/Banners.tsx` | Banner cards with featured characters, cost, currency type |
| `pages/Summon.tsx` | Pull button, CSS/Canvas gacha animation, rarity reveal effect |
| `components/nwnl/SummonResults.tsx` | Multi-pull result grid with rarity highlights |
| `components/nwnl/CharacterCard.tsx` | **Reusable** — rarity border, star level, stats preview |

**Delete:** `cogs/commands/waifu_summon.py`, `cogs/commands/banner.py` (Wait until Phase 2C to delete `waifu_awaken.py`)

---

### 2C — Collection + Database Browser + Awaken (3 days)

**Read-only views, relatively simple, used constantly.**

#### Backend — `activity/backend/routers/nwnl_collection.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/nwnl/collection` | GET | User's collection (paginated, filterable) |
| `/nwnl/collection/search` | GET | Search/filter user's waifu collection by name, series, genre, archetype, element *(from Phase 2A)* |
| `/nwnl/collection/{waifu_id}` | GET | Character profile detail |
| `/nwnl/database` | GET | Browse all series (paginated) |
| `/nwnl/database/series/{id}` | GET | Series detail + characters |
| `/nwnl/database/search` | GET | Search characters/series by name |
| `/nwnl/awaken/{waifu_id}` | POST | Awaken character (costs 1 Daphine) - *Moved from 2B* |

#### Frontend

| Component | Description |
|-----------|-------------|
| `pages/Collection.tsx` | Grid/list toggle, rarity/element/series filters, sort by power/star/name |
| `pages/CharacterProfile.tsx` | Full card: stats radar chart, star progress, shard count, awakening status |
| `pages/Database.tsx` | All series browser with search, click into series → character list |
| `components/nwnl/StatsRadar.tsx` | **Reusable** 7-axis radar chart (atk/mag/vit/spr/int/spd/lck) |
| `components/nwnl/AwakenDialog.tsx` | Confirm/cancel modal showing Daphine cost - *Moved from 2B* |

**Delete:** Collection/database commands already gone with 2B (same cog file) + `cogs/commands/waifu_awaken.py`

---

### 2D — Shop + Inventory (3 days)

**Self-contained commerce system.**

#### Backend — `activity/backend/routers/nwnl_shop.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/nwnl/shop` | GET | Shop catalog (paginated, categorized) |
| `/nwnl/shop/buy` | POST | Purchase item (currency_type + quantity) |
| `/nwnl/inventory` | GET | User's inventory |
| `/nwnl/inventory/use/{item_id}` | POST | Use/consume item |
| `/nwnl/shop/history` | GET | Purchase history |

#### Frontend

| Component | Description |
|-----------|-------------|
| `pages/Shop.tsx` | Category tabs, item cards with price/effects, buy button with currency selector |
| `pages/Inventory.tsx` | Owned items grid, use button, quantity display |
| Purchase history tab | Transaction log table within Shop page |

**Delete:** `cogs/commands/shop.py`

---

### 2E — World Threat (5 days)

**Server-wide cooperative boss battle. Needs guild context + real-time updates.**

#### Backend — `activity/backend/routers/nwnl_world_threat.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/nwnl/world-threat/status` | GET | Boss state + player status |
| `/nwnl/world-threat/characters` | GET | User's available characters (curse-filtered) |
| `/nwnl/world-threat/fight` | POST | Submit 6-char team, calculate points, grant rewards, evolve boss |
| `/nwnl/world-threat/research` | POST | Perform research action |
| `/nwnl/world-threat/rewards` | GET | All reward tier tables |
| `/nwnl/world-threat/checkpoints` | GET | Player's personal + server checkpoint progress |
| `WS /ws/world-threat/{guild_id}` | WebSocket | Real-time boss state broadcast on fight/research |

#### Frontend

| Component | Description |
|-----------|-------------|
| `pages/WorldThreat.tsx` | Boss dashboard: name, dominant stats, cursed stat, buffs/curses grid, adaptation level, server progress bar, action buttons |
| `pages/WorldThreatFight.tsx` | 6-slot team builder, character picker with search/pagination, real-time power calculator, buff match indicators, dual sort (raw power vs. buff count) |
| `components/nwnl/PowerCalculator.tsx` | Live point formula breakdown (base × affinity × series × research × adaptation) |
| `components/nwnl/BuffMatchIndicator.tsx` | Per-character badge showing buff/curse matches |
| `components/nwnl/BossEvolutionFeed.tsx` | WebSocket-driven activity feed |
| `pages/WorldThreatRewards.tsx` | 3 tabs: immediate tiers (24 rows), personal checkpoints (6), server checkpoints (6) |

**Delete:** `cogs/commands/world_threat.py`

---

### 2F — Expeditions + Equipment (7 days)

**Most complex UI in the system. Saved for last since it reuses components from prior phases.**

#### Backend — `activity/backend/routers/nwnl_expedition.py` + `nwnl_equipment.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/nwnl/expeditions/catalog` | GET | All expedition templates |
| `/nwnl/expeditions/catalog/{id}` | GET | Expedition detail |
| `/nwnl/expeditions/available` | GET | Expeditions user can start |
| `/nwnl/expeditions/active` | GET | User's in-progress expeditions with time remaining |
| `/nwnl/expeditions/start` | POST | Start expedition (expedition_id, participant_ids[], equipment_id?) |
| `/nwnl/expeditions/{id}/complete` | POST | Complete + claim rewards |
| `/nwnl/expeditions/{id}/results` | GET | Full results with encounter logs |
| `/nwnl/equipment` | GET | User's equipment list |
| `/nwnl/equipment/{id}` | GET | Equipment detail with subslots |
| `/nwnl/equipment/{id}/subslot` | POST | Unlock subslot by consuming another equipment |
| `/nwnl/equipment/{id}/subslot/last` | DELETE | Remove last subslot |
| `/nwnl/equipment/{id}/subslot/all` | DELETE | Remove all subslots |

#### Frontend

| Component | Description |
|-----------|-------------|
| `pages/Expeditions.tsx` | Hub: active expeditions (countdown timers) + Start New button |
| `pages/ExpeditionCatalog.tsx` | Browse all expeditions: difficulty, duration, affinity pools, rewards preview |
| `pages/ExpeditionStart.tsx` | Flow: select expedition → pick 3 characters → pick equipment → confirm |
| `components/nwnl/CharacterSelect.tsx` | **Reusable** multi-select picker with search, pagination (25/page), equipment attachment. Props: `maxSelections` (3 for expeditions, 6 for World Threat) |
| `pages/ExpeditionResults.tsx` | Multi-tab: encounter log timeline, team performance stats, rewards summary |
| `pages/Equipment.tsx` | Equipment list → detail → subslot management (unlock/remove/consume) |
| `components/nwnl/EquipmentSlotView.tsx` | Visual subslot bar (0–5 slots, filled/empty/locked states) |

**Delete:** `cogs/commands/expeditions.py`

---

## Phase 3 — Cleanup (2 days)

| Task | Details |
|------|---------|
| **Remove bot services** | If no remaining bot features use `WaifuService`/`ExpeditionService`/`WorldThreatService`, remove them from `container.py` and `services/` (or keep for any remaining bot usage) |
| **Update Sidebar** | Add NWNL section to `activity/frontend/src/components/common/Sidebar.tsx` with nav links |
| **Update Home page** | Add NWNL game cards to `activity/frontend/src/pages/Home.tsx` alongside quiz games |
| **Add `/nwnl` bot command** | Single slash command that sends an Activity launch button — the only remaining NWNL bot presence |
| **Add shared components** | `CurrencyDisplay.tsx`, `RarityBadge.tsx`, `PaginationControls.tsx` — shared across all NWNL pages |

---

## Key Reusable Components

These components are built once and shared across multiple pages:

| Component | Used By | `maxSelections` / notes |
|-----------|---------|------------------------|
| `CharacterCard.tsx` | Summon, Collection, Expeditions, WorldThreat | — |
| `CharacterSelect.tsx` | ExpeditionStart, WorldThreatFight | prop: `maxSelections` (3 or 6) |
| `StatsRadar.tsx` | CharacterProfile, WorldThreatFight | — |
| `CurrencyDisplay.tsx` | Academy, Shop, Summon | crystals / quartzs / daphine |
| `PaginationControls.tsx` | Every paginated view | — |
| `RarityBadge.tsx` | CharacterCard | ★/★★/★★★ |
| `ConfirmDialog.tsx` | Research, Reset, Account delete (Awaken uses AwakenDialog) | generic confirm/cancel modal |

---

## Feature Parity Notes

| Bot Behavior | Activity Solution |
|-------------|------------------|
| Per-user command locking (`CommandQueueService`) | In-memory `asyncio.Lock` dict per `discord_id` per endpoint |
| Daily reset (midnight UTC+7) | Same service logic; frontend shows countdown timer |
| Ban checking (`banned.json`) | FastAPI middleware before all `/api/nwnl/*` routes |
| Multi-page discord embeds | React pagination — simpler and more natural |
| Confirmation flows (buttons + timeout) | React modal dialogs |
| Guild-scoped World Threat | Frontend sends `X-Guild-ID` from `discordSdk.guildId` |
| Boss evolution after fight/research | WebSocket broadcasts updated boss state to all guild members |
| Character images | Routed through existing `media_proxy.py` |
| Gacha animation (sequential embed edits) | CSS/Canvas pull animation with rarity reveal — **major UX upgrade** |

---

## Effort Summary

| Phase | Days |
|-------|------|
| Phase 1 — Foundation | 1–2 |
| 2A — Academy | 3 |
| 2B — Summon + Banners + Awaken | 5 |
| 2C — Collection + Database | 3 |
| 2D — Shop + Inventory | 3 |
| 2E — World Threat | 5 |
| 2F — Expeditions + Equipment | 7 |
| Phase 3 — Cleanup | 2 |
| **Total** | **~29 days** |
