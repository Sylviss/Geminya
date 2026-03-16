"""Lightweight config shim for NWNL services in the Activity backend.

Provides only the interface that NwnlDatabaseService needs (get_postgres_config()),
without pulling in the full bot Config class and its heavy dependency tree.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any


class NwnlConfig:
    """Minimal config that exposes get_postgres_config() for NwnlDatabaseService."""

    def __init__(self, secrets: Dict[str, Any]):
        self.postgres_host = secrets.get("POSTGRES_HOST", os.environ.get("POSTGRES_HOST", ""))
        self.postgres_port = int(secrets.get("POSTGRES_PORT", os.environ.get("POSTGRES_PORT", "5432")))
        self.postgres_user = secrets.get("POSTGRES_USER", os.environ.get("POSTGRES_USER", ""))
        self.postgres_password = secrets.get("POSTGRES_PASSWORD", os.environ.get("POSTGRES_PASSWORD", ""))
        self.postgres_database = secrets.get("POSTGRES_DB", os.environ.get("POSTGRES_DB", ""))

    def get_postgres_config(self) -> Dict[str, Any]:
        """Return postgres config dict matching the shape NwnlDatabaseService expects."""
        return {
            "host": self.postgres_host,
            "port": self.postgres_port,
            "user": self.postgres_user,
            "password": self.postgres_password,
            "database": self.postgres_database,
        }

    @classmethod
    def from_secrets_file(cls, secrets_path: Path | None = None) -> "NwnlConfig":
        """Load config from secrets.json at repo root."""
        if secrets_path is None:
            secrets_path = Path(__file__).parent.parent.parent / "secrets.json"
        secrets = {}
        if secrets_path.exists():
            with open(secrets_path, "r", encoding="utf-8") as f:
                secrets = json.load(f)
        return cls(secrets)
