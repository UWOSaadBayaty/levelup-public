from typing import List

from fastapi import Depends, HTTPException, Header
from starlette.status import HTTP_401_UNAUTHORIZED, HTTP_403_FORBIDDEN

from app.core.deps import get_user_repo
from app.core.firebase import verify_id_token
from app.core.user_repo import UserRepo
from app.models.user_profile import UserProfile, UserRole


async def get_current_user(
    authorization: str | None = Header(default=None),
    repo: UserRepo = Depends(get_user_repo),
) -> UserProfile:
    """
    Dependency that:
      1) Reads the Firebase ID token from the Authorization header.
      2) Verifies the token using Firebase Admin.
      3) Looks up the corresponding user in the DB via firebase_uid.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )

    id_token = authorization.split(" ", 1)[1]

    try:
        decoded = verify_id_token(id_token)
    except Exception:
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired ID token",
        )

    firebase_uid = decoded.get("uid")
    if not firebase_uid:
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="Token missing UID",
        )

    user = repo.get_by_uid(firebase_uid)
    if user is None:
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="User not found in local database. Call /auth/bootstrap first.",
        )

    return user


def require_roles(allowed_roles: List[UserRole]):
    """
    Returns a dependency that ensures the current user has one of the allowed roles.
    Usage:
        @app.get("/admin", dependencies=[Depends(require_roles([UserRole.admin]))])
    """

    async def _inner(user: UserProfile = Depends(get_current_user)) -> UserProfile:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return _inner