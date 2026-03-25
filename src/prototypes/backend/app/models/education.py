from typing import Optional
from pydantic import BaseModel


class Education(BaseModel):
    """
    Single education entry for the resume.
    """

    institution: Optional[str] = None
    degree: Optional[str] = None
    year: Optional[str] = None