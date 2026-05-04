"""Shared dependencies and service instances."""

from functools import lru_cache
from supabase import create_client
from app.config import get_settings

_supabase_client = None


def get_db():
    """Get Supabase client singleton."""
    global _supabase_client
    if _supabase_client is None:
        settings = get_settings()
        _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    return _supabase_client
