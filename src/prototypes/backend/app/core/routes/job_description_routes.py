from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.models.user_profile import UserProfile
from app.core.db import (
    list_saved_job_descriptions,
    create_saved_job_description,
    update_saved_job_description,
    delete_saved_job_description,
)

router = APIRouter(prefix="/job-descriptions", tags=["job-descriptions"])

class SavedJobDescriptionOut(BaseModel):
    id: int
    name: str
    job_description: str

class CreateSavedJobDescriptionIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    job_description: str = Field(min_length=10)

class UpdateSavedJobDescriptionIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    job_description: str = Field(min_length=10)

@router.get("", response_model=List[SavedJobDescriptionOut])
def list_saved(user: UserProfile = Depends(get_current_user)):
    rows = list_saved_job_descriptions(user.id)
    return [{"id": r[0], "name": r[1], "job_description": r[2]} for r in rows]

@router.post("", response_model=SavedJobDescriptionOut)
def create_saved(req: CreateSavedJobDescriptionIn, user: UserProfile = Depends(get_current_user)):
    try:
        new_id = create_saved_job_description(user.id, req.name, req.job_description)
        return {"id": new_id, "name": req.name.strip(), "job_description": req.job_description}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not save. Name may already exist. ({e})")

@router.put("/{saved_id}", response_model=SavedJobDescriptionOut)
def update_saved(saved_id: int, req: UpdateSavedJobDescriptionIn, user: UserProfile = Depends(get_current_user)):
    try:
        update_saved_job_description(user.id, saved_id, req.name, req.job_description)
        return {"id": saved_id, "name": req.name.strip(), "job_description": req.job_description}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not update. ({e})")

@router.delete("/{saved_id}")
def delete_saved(saved_id: int, user: UserProfile = Depends(get_current_user)):
    delete_saved_job_description(user.id, saved_id)
    return {"ok": True}
