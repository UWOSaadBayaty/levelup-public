# app/core/services/quota_service.py
from datetime import datetime, timedelta, timezone

from app.core.db import db_cursor

# ============================================================
# TIER LIMITS (per 5-minute window)
# ============================================================
TIER_LIMITS = {
    "free":  2_000,
    "pro":   5_000,
    "elite": 15_000,
}

WINDOW_MINUTES = 5

# Upgrade path: what tier comes next
NEXT_TIER = {
    "free": "pro",
    "pro": "elite",
}


def current_period_key() -> str:
    now = datetime.now(timezone.utc)
    bucket_minute = (now.minute // WINDOW_MINUTES) * WINDOW_MINUTES
    bucket_start = now.replace(minute=bucket_minute, second=0, microsecond=0)
    return bucket_start.strftime("%Y-%m-%dT%H:%MZ")


def current_window_reset_at() -> datetime:
    now = datetime.now(timezone.utc)
    bucket_minute = (now.minute // WINDOW_MINUTES) * WINDOW_MINUTES
    bucket_start = now.replace(minute=bucket_minute, second=0, microsecond=0)
    return bucket_start + timedelta(minutes=WINDOW_MINUTES)


def normalize_tier(tier: str) -> str:
    t = (tier or "free").lower()
    return t if t in TIER_LIMITS else "free"


def get_limit_for_tier(tier: str) -> int:
    return TIER_LIMITS[normalize_tier(tier)]


def get_used_tokens(user_id: int) -> int:
    with db_cursor() as cur:
        cur.execute(
            "SELECT tokens_used FROM token_usage WHERE user_id = %s AND period_key = %s",
            (user_id, current_period_key()),
        )
        row = cur.fetchone()
        return row[0] if row else 0


def get_total_tokens(user_id: int) -> int:
    with db_cursor() as cur:
        cur.execute(
            "SELECT total_tokens_used FROM users WHERE id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        return row[0] if row else 0


def can_consume(user_id: int, tier: str, tokens_needed: int) -> bool:
    used = get_used_tokens(user_id)
    limit = get_limit_for_tier(tier)
    return used + max(0, int(tokens_needed)) <= limit


def consume(user_id: int, tokens_used: int) -> int:
    """Records usage in the current 5-minute window and increments lifetime total."""
    period = current_period_key()
    tokens = max(0, int(tokens_used))
    with db_cursor() as cur:
        # Upsert current window usage
        cur.execute(
            """INSERT INTO token_usage (user_id, period_key, tokens_used, updated_at)
               VALUES (%s, %s, %s, now())
               ON CONFLICT (user_id, period_key)
               DO UPDATE SET tokens_used = token_usage.tokens_used + %s,
                             updated_at = now()
               RETURNING tokens_used""",
            (user_id, period, tokens, tokens),
        )
        window_total = cur.fetchone()[0]

        # Increment lifetime total on users table
        cur.execute(
            """UPDATE users
               SET total_tokens_used = total_tokens_used + %s
             WHERE id = %s""",
            (tokens, user_id),
        )

        return window_total


def get_usage_summary(user_id: int, tier: str) -> dict:
    """Returns usage info for the frontend."""
    t = normalize_tier(tier)
    window_used = get_used_tokens(user_id)
    window_limit = get_limit_for_tier(t)
    total_used = get_total_tokens(user_id)
    next_tier = NEXT_TIER.get(t)
    reset_at = current_window_reset_at()
    reset_in_seconds = max(0, int((reset_at - datetime.now(timezone.utc)).total_seconds()))

    result = {
        "tier": t,
        "window_minutes": WINDOW_MINUTES,
        "window_used": window_used,
        "window_limit": window_limit,
        "window_remaining": max(0, window_limit - window_used),
        "reset_at": reset_at.isoformat(),
        "reset_in_seconds": reset_in_seconds,
        # Backward-compatible aliases for existing frontend consumers.
        "monthly_used": window_used,
        "monthly_limit": window_limit,
        "monthly_remaining": max(0, window_limit - window_used),
        "total_used": total_used,
        "period": current_period_key(),
    }

    if next_tier:
        result["next_tier"] = next_tier
        result["next_tier_limit"] = TIER_LIMITS[next_tier]

    return result
