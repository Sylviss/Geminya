"""NWNL Services — standalone service layer for the Activity backend.

These services connect directly to PostgreSQL via asyncpg and contain
only the business logic needed by the Activity API routes. They are
independent of the bot's service layer and will be built incrementally
as each cog is migrated.
"""
