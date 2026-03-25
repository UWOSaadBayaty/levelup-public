from typing import List, Optional
from pydantic import BaseModel


class Project(BaseModel):
    """
    A project listed on the resume.
    """

    name: Optional[str] = None           
    description: Optional[str] = None       
    tech_stack: Optional[List[str]] = None        
    links: Optional[List[str]] = None