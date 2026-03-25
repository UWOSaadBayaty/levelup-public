from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import List, Optional


@dataclass
class Experience:
    """
    Stand-alone Experience model used by PdfResumeParser.

    The important part for us is that it has:
      - company, title, dates
      - bullets: list of strings
      - add_bullet(text) helper the parser calls
    """
    company: Optional[str] = None
    title: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    bullets: List[str] = field(default_factory=list)

    def add_bullet(self, text: str) -> None:
        """
        Called by PdfResumeParser to append a single bullet line.
        """
        if text:
            self.bullets.append(text)