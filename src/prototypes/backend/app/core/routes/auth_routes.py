from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.core.deps import get_user_repo
from app.core.firebase import verify_id_token
from app.core.user_repo import UserRepo
from app.core.auth import get_current_user
from app.models.user_profile import UserProfile, UserRole

router = APIRouter(prefix="/auth", tags=["auth"])


class BootstrapRequest(BaseModel):
    name: Optional[str] = None


@router.post("/bootstrap", response_model=UserProfile)
async def bootstrap_user(
    data: BootstrapRequest,
    authorization: str | None = Header(default=None),
    repo: UserRepo = Depends(get_user_repo),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    id_token = authorization.split(" ", 1)[1]

    try:
        decoded = verify_id_token(id_token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid ID token: {e}")

    firebase_uid: str = decoded.get("uid")
    email: Optional[str] = decoded.get("email")
    name: Optional[str] = data.name

    if not firebase_uid:
        raise HTTPException(status_code=400, detail="Token missing uid")

    existing = repo.get_by_uid(firebase_uid)
    if existing:
        if name and name != existing.name:
            return repo.update_name(firebase_uid, name)
        return existing

    return repo.create_user(
        firebase_uid=firebase_uid,
        email=email or "",
        name=name,
        role=UserRole.applicant,
    )


@router.get("/me", response_model=UserProfile)
async def who_am_i(user: UserProfile = Depends(get_current_user)):
    return user


@router.delete("/account")
async def delete_my_account(
    user: UserProfile = Depends(get_current_user),
    repo: UserRepo = Depends(get_user_repo),
):
    """
    Correct model:
    - Frontend deletes Firebase Auth user (reauth needed)
    - Backend deletes DB user row (cascade deletes everything else)
    """
    deleted = repo.delete_by_uid(user.firebase_uid)
    if not deleted:
        # this usually means bootstrap never happened or firebase_id wasn't stored
        raise HTTPException(status_code=404, detail="User row not found in DB")

    return {"status": "deleted", "db_deleted": True}
