# app/main.py
import os
import shutil
import uuid
import re
import json
from typing import List, Dict, Any, Optional

from fastapi import Depends, FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.core.routes.interview_routes import router as interview_router
from app.core.routes.auth_routes import router as auth_router

from app.core.routes.stripe_routes import router as stripe_router
from .services.token_guard import guarded_ai_call
from .services.quota_service import get_usage_summary

from app.core.routes.job_description_routes import router as job_descriptions_router

from app.core.db import (
    store_parsed_resume,
    list_resumes_for_user,
    load_resume_version,
    delete_resume_for_user,
    save_manual_resume_update,
    db_fingerprint,          # ✅ new
    save_cover_letter,
    list_cover_letters,
)
from app.core.firebase import init_firebase
from app.core.auth import get_current_user
from app.core.level_up import LevelUp

from app.models.resume import Resume
from app.models.user_profile import UserProfile
from app.services.pdf_parser import PdfResumeParser

app = FastAPI(title="LevelUp Backend")

app.include_router(auth_router)
app.include_router(interview_router)
app.include_router(stripe_router)
app.include_router(job_descriptions_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = "temp_uploads"
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.dirname(CURRENT_DIR)
TEMP_UPLOAD_PATH = os.path.join(BACKEND_ROOT, TEMP_DIR)
os.makedirs(TEMP_UPLOAD_PATH, exist_ok=True)


class EduItem(BaseModel):
    institution: str = ""
    degree: str = ""
    year: str = ""

class SaveCoverLetterRequest(BaseModel):
    content: str
    job_title: str
    company_name: str
    resume_text: str      # <--- NEW
    job_description: str  # <--- NEW
class ExpItem(BaseModel):
    company: str = ""
    title: str = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    bullets: List[str] = []


class ProjItem(BaseModel):
    name: str = ""
    description: str = ""
    tech_stack: List[str] = []
    links: List[str] = []


class CertItem(BaseModel):
    name: str = ""
    issuer: str = ""
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None

class CoverLetterRequest(BaseModel):
    resume_text: str
    jd_text: str
    provider: str = "groq"  # defaults to mock if not sent


class ResumeUpdateRequest(BaseModel):
    header: List[str] = []
    summary: str = ""
    education: List[EduItem] = []
    experience: List[ExpItem] = []
    projects: List[ProjItem] = []
    skills: List[str] = []
    certifications: List[CertItem] = []
    # --- NEW FIELDS ---
    job_description_text: Optional[str] = ""
    job_description_keywords: Optional[List[str]] = []


class ImproveRequest(BaseModel):
    resume_text: str
    provider: str = "mock"
    api_key: str = ""


class OptimizeTextRequest(BaseModel):
    selected_text: str
    target_keywords: List[str] = [] 
    provider: str = "mock"
    api_key: str = ""

class AnalyzeJDRequest(BaseModel):
    jd_text: str
    provider: str = "mock"
    api_key: str = ""


class ResumeSummary(BaseModel):
    resume_id: int
    version_id: int
    title: str
    created_date: str

def serialize_resume(resume: Resume) -> Dict[str, Any]:
    return {
        "file_name": resume.file_name,
        "header": list(resume.header or []),
        "summary": resume.summary or "",
        # ... (keep education, experience, projects, skills, certifications as they are) ...
        "education": [
            {"institution": ed.institution or "", "degree": ed.degree or "", "year": ed.year or ""}
            for ed in (resume.education or [])
        ],
        "experience": [
            {
                "company": exp.company or "",
                "title": exp.title or "",
                "bullets": list(exp.bullets or []),
                "start_date": exp.start_date.isoformat() if getattr(exp, "start_date", None) else None,
                "end_date": exp.end_date.isoformat() if getattr(exp, "end_date", None) else None,
            }
            for exp in (resume.experience or [])
        ],
        "projects": [
            {
                "name": proj.name or "",
                "description": proj.description or "",
                "tech_stack": [str(x) for x in (proj.tech_stack or [])],
                "links": [str(x) for x in (proj.links or [])],
            }
            for proj in (resume.projects or [])
        ],
        "skills": [str(s) for s in (resume.skills or [])],
        "certifications": [
            {
                "name": cert.name or "",
                "issuer": cert.issuer or "",
                "issue_date": cert.issue_date.isoformat() if getattr(cert, "issue_date", None) else None,
                "expiry_date": cert.expiry_date.isoformat() if getattr(cert, "expiry_date", None) else None,
            }
            for cert in (resume.certifications or [])
        ],
        # --- NEW FIELDS ---
        "job_description_text": getattr(resume, "job_description_text", ""),
        "job_description_keywords": getattr(resume, "job_description_keywords", []),
    }

@app.on_event("startup")
async def startup_event():
    init_firebase()

    # ✅ proves Supabase vs local on every boot
    try:
        print("[DB]", db_fingerprint())
    except Exception as e:
        print("[DB] fingerprint failed:", e)

    print("[LevelUp] Backend startup complete")


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/token-usage")
async def token_usage_endpoint(user: UserProfile = Depends(get_current_user)):
    return get_usage_summary(user_id=user.id, tier=user.tier)


@app.get("/resumes", response_model=Dict[str, List[ResumeSummary]])
async def list_my_resumes(user: UserProfile = Depends(get_current_user)):
    rows = list_resumes_for_user(user.id)
    return {"items": rows}


@app.post("/parse_resume")
async def parse_resume_endpoint(
    file: UploadFile = File(...),
    user: UserProfile = Depends(get_current_user),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path_for_parser = os.path.join(TEMP_UPLOAD_PATH, unique_filename)

    try:
        with open(file_path_for_parser, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        parser = PdfResumeParser()
        resume_data: Resume = parser.parse(file_path_for_parser)
        resume_data.file_name = file.filename


        if os.path.exists(file_path_for_parser):
            os.remove(file_path_for_parser)

        resume_id, version_id = store_parsed_resume(
            owner_id=user.id,
            title=file.filename,
            resume=resume_data,
        )

        response_data = serialize_resume(resume_data)
        response_data["resume_id"] = resume_id
        response_data["version_id"] = version_id
        return response_data

    except Exception as e:
        if os.path.exists(file_path_for_parser):
            os.remove(file_path_for_parser)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to parse and store resume: {file.filename}. Error: {str(e)}")


@app.delete("/resumes/{resume_id}")
async def delete_my_resume(resume_id: int, user: UserProfile = Depends(get_current_user)):
    try:
        delete_resume_for_user(resume_id=resume_id, owner_id=user.id)
    except PermissionError:
        raise HTTPException(status_code=403, detail="Not your resume")
    except ValueError:
        raise HTTPException(status_code=404, detail="Resume not found")
    except Exception as e:
        print(f"Error deleting resume {resume_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete resume")

    return {"status": "deleted"}


@app.get("/resume_versions/{version_id}")
async def get_resume_version(version_id: int, user: UserProfile = Depends(get_current_user)):
    try:
        resume_obj = load_resume_version(version_id=version_id, owner_id=user.id)
    except PermissionError:
        raise HTTPException(status_code=403, detail="Not your resume")
    except ValueError:
        raise HTTPException(status_code=404, detail="Resume version not found")
    except Exception as e:
        print(f"Error loading resume version {version_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to load resume version")

    return serialize_resume(resume_obj)


@app.post("/improve_resume")
async def improve_resume_endpoint(request: ImproveRequest, user: UserProfile = Depends(get_current_user)):
    try:
        # TODO(DB TEAMMATE): replace "free" with real tier from DB (set by Stripe webhooks)
        tier = user.tier

        def run():
            level_up_app = LevelUp(provider=request.provider)
            return level_up_app.generate_general_feedback(request.resume_text)

        feedback = guarded_ai_call(
            user_id=user.id,
            tier=tier,
            input_text=request.resume_text,
            output_buffer=250,  # bigger output expected
            fn=run,
        )

        return {"feedback": feedback}
    except Exception as e:
        print(f"AI Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/optimize_text")
async def optimize_text_endpoint(request: OptimizeTextRequest, user: UserProfile = Depends(get_current_user)):
    try:
        tier = user.tier

        def run():
            level_up_app = LevelUp(provider=request.provider)
            return level_up_app.improve_text_content(
                request.selected_text,
                target_keywords=request.target_keywords
            )

        optimized_text = guarded_ai_call(
            user_id=user.id,
            tier=tier,
            input_text=request.selected_text,
            output_buffer=150,
            fn=run,
        )

        return {"optimized_text": optimized_text}
    except Exception as e:
        print(f"AI Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



if __name__ == "__main__":
    print(
        "FastAPI app is configured. To run successfully, navigate to the 'backend' "
        "directory and use:\n"
        "  uvicorn app.main:app --reload"
    )

@app.post("/analyze_jd")
async def analyze_jd_endpoint(request: AnalyzeJDRequest, user: UserProfile = Depends(get_current_user)):
    """
    Extracts keywords from a pasted Job Description.
    Robustly handles "chatty" LLM responses containing reasoning text.
    """
    try:
        tier = user.tier

        def run():
            level_up_app = LevelUp(provider=request.provider)
            return level_up_app.extract_jd_keywords(request.jd_text)

        keywords_json_str = guarded_ai_call(
            user_id=user.id,
            tier=tier,
            input_text=request.jd_text,
            output_buffer=120,
            fn=run,
        )

        try:
            cleaned = keywords_json_str.strip()
            fenced_match = re.search(r"```json\s*(.*?)```", cleaned, re.DOTALL | re.IGNORECASE)
            if fenced_match:
                cleaned = fenced_match.group(1).strip()
            elif "[" in cleaned and "]" in cleaned:
                cleaned = cleaned[cleaned.find("["): cleaned.rfind("]") + 1]

            keywords_list = json.loads(cleaned)
            if isinstance(keywords_list, dict) and "keywords" in keywords_list:
                keywords_list = keywords_list["keywords"]
        except json.JSONDecodeError:
            keywords_list = []

        # Ensure all items are strings (sometimes LLMs return objects)
        keywords_list = [str(k) for k in keywords_list if isinstance(k, (str, int, float))]

        return {"keywords": keywords_list}

    except Exception as e:
        print(f"AI Error (Analyze JD): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/resumes/{resume_id}/save")
async def save_resume_version_endpoint(
    resume_id: int,
    data: ResumeUpdateRequest,
    user: UserProfile = Depends(get_current_user),
):
    try:
        new_version_id = save_manual_resume_update(owner_id=user.id, resume_id=resume_id, data=data)
        return {"status": "saved", "version_id": new_version_id}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Not your resume")
    except ValueError:
        raise HTTPException(status_code=404, detail="Resume not found")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to save version: {str(e)}")
    
@app.post("/save_cover_letter")
async def save_cover_letter_endpoint(
    request: SaveCoverLetterRequest,
    user: UserProfile = Depends(get_current_user)
):
    try:
        letter_id = save_cover_letter(
            owner_id=user.id,
            job_title=request.job_title,
            company_name=request.company_name,
            content=request.content,
            resume_text=request.resume_text,       # <--- Pass it
            job_description=request.job_description # <--- Pass it
        )
        return {"status": "success", "id": letter_id}

    except Exception as e:
        print(f"Database Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save cover letter")

@app.get("/cover_letters")
async def get_cover_letters_endpoint(user: UserProfile = Depends(get_current_user)):
    try:
        # Use the SQL function from db.py
        items = list_cover_letters(owner_id=user.id)
        return {"items": items}
    except Exception as e:
        print(f"Database Error (Get Cover Letters): {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch cover letters")


@app.post("/generate_cover_letter")
async def generate_cover_letter_endpoint(
    request: CoverLetterRequest,
    user: UserProfile = Depends(get_current_user),
):
    try:
        tier = user.tier

        # Use a combined string so your estimator counts BOTH resume + JD
        combined_input = f"RESUME:\n{request.resume_text}\n\nJOB:\n{request.jd_text}"

        def run():
            level_up_app = LevelUp(provider=request.provider)
            return level_up_app.generate_cover_letter(
                resume_text=request.resume_text,
                jd_text=request.jd_text
            )

        cover_letter = guarded_ai_call(
            user_id=user.id,
            tier=tier,
            input_text=combined_input,
            output_buffer=600,   # adjust as you like
            fn=run,
        )

        return {"cover_letter": cover_letter}

    except Exception as e:
        print(f"AI Error (Cover Letter): {e}")
        raise HTTPException(status_code=500, detail=str(e))
