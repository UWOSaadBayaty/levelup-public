from __future__ import annotations
from datetime import date
from typing import Optional
from pydantic import BaseModel


class Certification(BaseModel):
    """
    Optional certifications on the resume.
    """

    name: Optional[str] = None
    issuer: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None