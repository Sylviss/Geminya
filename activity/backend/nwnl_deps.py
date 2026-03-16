"""FastAPI dependencies for NWNL routes.

Provides auth, guild context, and per-user locking dependencies
that all NWNL API routes will use.
"""

import asyncio
import logging
from collections import defaultdict
from typing import Dict

from fastapi import Request, HTTPException, Depends

logger = logging.getLogger(__name__)

# In-memory per-user locks (replaces bot's CommandQueueService)
_user_locks: Dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)


async def get_current_user(request: Request) -> str:
    """Extract and validate the Discord user ID from request headers.
    
    Reads X-User-ID header (set by the frontend axios interceptor),
    calls get_or_create_user to ensure the user exists in the DB,
    and returns the discord_id string.
    
    Raises:
        HTTPException 401 if X-User-ID header is missing.
    """
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-ID header")

    # Ensure user exists in database
    nwnl_db = request.app.state.nwnl_db
    if nwnl_db and nwnl_db.pool:
        try:
            await nwnl_db.get_or_create_user(user_id)
        except Exception as e:
            logger.warning(f"Failed to ensure user exists for {user_id}: {e}")

    return user_id


async def get_guild_id(request: Request) -> str:
    """Extract guild ID from request headers.
    
    Used by World Threat and other guild-scoped routes.
    Reads X-Guild-ID header (set by frontend from discordSdk.guildId).
    
    Raises:
        HTTPException 400 if X-Guild-ID header is missing.
    """
    guild_id = request.headers.get("X-Guild-ID")
    if not guild_id:
        raise HTTPException(status_code=400, detail="Missing X-Guild-ID header — this feature requires a guild context")
    return guild_id


async def get_user_lock(request: Request) -> asyncio.Lock:
    """Get a per-user asyncio.Lock to prevent race conditions.
    
    Each unique discord_id gets its own lock. When a route acquires
    this lock, concurrent requests from the same user will queue up.
    
    Usage in a route:
        @router.post("/some-action")
        async def some_action(
            user_id: str = Depends(get_current_user),
            lock: asyncio.Lock = Depends(get_user_lock),
        ):
            async with lock:
                # ... mutating operation ...
    """
    user_id = request.headers.get("X-User-ID", "unknown")
    return _user_locks[user_id]
