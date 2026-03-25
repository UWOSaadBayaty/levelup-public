# app/core/services/token_guard.py
import math
import re
from typing import Callable, Any, Optional
from fastapi import HTTPException

from app.services.quota_service import (
    can_consume, consume,
    normalize_tier, NEXT_TIER,
)

WORD_RE = re.compile(r"[A-Za-z]+(?:['-][A-Za-z]+)*")
NUMBER_RE = re.compile(r"\d+(?:[.,:/-]\d+)*")
PUNCT_RE = re.compile(r"[^\w\s]")
NON_ASCII_RE = re.compile(r"[^\x00-\x7F]")
URL_RE = re.compile(r"https?://\S+|www\.\S+")
CODEISH_RE = re.compile(r"[A-Za-z0-9_./#+:-]{12,}")


def estimate_tokens(text: Optional[str]) -> int:
    """
    Hybrid heuristic for quota enforcement.

    It combines character length with word/number/punctuation density so prose,
    URLs, code-like strings, and resume bullet lists are estimated less crudely
    than a fixed chars-per-token rule.
    """
    if not text:
        return 1

    normalized = str(text).strip()
    char_count = len(normalized)

    word_count = len(WORD_RE.findall(normalized))
    number_count = len(NUMBER_RE.findall(normalized))
    punct_count = len(PUNCT_RE.findall(normalized))
    newline_count = normalized.count("\n")
    non_ascii_count = len(NON_ASCII_RE.findall(normalized))
    url_count = len(URL_RE.findall(normalized))
    codeish_count = len(CODEISH_RE.findall(normalized))

    char_estimate = math.ceil(char_count / 4.0)
    structure_estimate = (
        word_count
        + math.ceil(number_count * 0.6)
        + math.ceil(punct_count * 0.35)
        + math.ceil(newline_count * 0.2)
        + math.ceil(non_ascii_count * 0.5)
    )

    # Dense technical strings and URLs usually tokenize worse than plain prose.
    surcharge = (url_count * 6) + (codeish_count * 2)

    estimate = max(char_estimate, structure_estimate) + surcharge
    return max(1, estimate)


def guarded_ai_call(
    *,
    user_id: int,
    tier: str,
    input_text: str,
    output_buffer: int = 120,
    extra_tokens: int = 0,
    fn: Callable[[], Any],
) -> Any:
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    t = normalize_tier(tier)
    tokens_needed = estimate_tokens(input_text) + max(0, int(output_buffer)) + max(0, int(extra_tokens))

    if not can_consume(user_id, t, tokens_needed):
        next_tier = NEXT_TIER.get(t)

        msg = "You do not have enough tokens to proceed with this task in the current 5-minute window."
        if next_tier:
            msg += f" Upgrade to {next_tier} to increase your 5-minute limit."

        raise HTTPException(status_code=429, detail=msg)

    result = fn()
    consume(user_id, tokens_needed)
    return result
