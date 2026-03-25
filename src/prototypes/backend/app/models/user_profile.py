from enum import Enum
from pydantic import BaseModel


class UserRole(str, Enum):
    """
    Application roles. These must match the strings stored in the DB
    (users.role column).

    For now we support:
      - applicant : normal user
      - admin     : elevated privileges (for future use)
    """
    applicant = "applicant"
    admin = "admin"


class UserProfile(BaseModel):
    """
    Domain model returned by auth/bootstrap and auth/me, and used by
    backend dependencies like get_current_user.
    """
    id: int
    firebase_uid: str
    email: str
    name: str
    role: UserRole
    tier: str = "free"