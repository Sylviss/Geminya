"""Ban checking middleware for NWNL routes.

Intercepts all /api/nwnl/* requests and blocks banned users
based on the banned.json file at the repo root.
"""

import json
import logging
import time
from pathlib import Path
from typing import List

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# How often to re-read banned.json (seconds)
BAN_LIST_REFRESH_INTERVAL = 300  # 5 minutes


class NwnlBanMiddleware(BaseHTTPMiddleware):
    """Middleware that blocks banned users from accessing /api/nwnl/* endpoints."""

    def __init__(self, app, banned_file: Path | None = None):
        super().__init__(app)
        self.banned_file = banned_file or Path(__file__).parent.parent.parent / "banned.json"
        self._banned_ids: List[str] = []
        self._last_loaded: float = 0
        self._load_ban_list()

    def _load_ban_list(self):
        """Load or refresh the ban list from banned.json."""
        try:
            if self.banned_file.exists():
                with open(self.banned_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self._banned_ids = [str(uid) for uid in data] if isinstance(data, list) else []
                logger.debug(f"Loaded {len(self._banned_ids)} banned users from {self.banned_file}")
            else:
                self._banned_ids = []
        except Exception as e:
            logger.error(f"Failed to load banned.json: {e}")
        self._last_loaded = time.time()

    async def dispatch(self, request: Request, call_next):
        # Only intercept /api/nwnl/* routes
        if not request.url.path.startswith("/api/nwnl"):
            return await call_next(request)

        # Refresh ban list periodically
        if time.time() - self._last_loaded > BAN_LIST_REFRESH_INTERVAL:
            self._load_ban_list()

        # Check if user is banned
        user_id = request.headers.get("X-User-ID")
        if user_id and user_id in self._banned_ids:
            logger.warning(f"Blocked banned user {user_id} from {request.url.path}")
            return JSONResponse(
                status_code=403,
                content={"detail": "Your account has been suspended."},
            )

        return await call_next(request)
