# app/core/db.py
import os
import hashlib
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Optional, List, Dict, Any, Tuple
from urllib.parse import urlparse

from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import execute_values, Json

from app.models.resume import Resume, Experience, Education, Project
from app.models.certification import Certification

# Load backend/.env explicitly
BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env")
print("[DB] dotenv path:", BACKEND_DIR / ".env")
print("[DB] dotenv exists:", (BACKEND_DIR / ".env").exists())

def _require_env(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"{name} is not set. Refusing to start (no local DB fallback).")
    return v


def get_connection():
    database_url = _require_env("DATABASE_URL").strip()

    parsed = urlparse(database_url)
    print("[DB] using DATABASE_URL user:", parsed.username)
    print("[DB] using DATABASE_URL host:", parsed.hostname)

    connect_kwargs = {}
    if "sslmode=" not in database_url:
        connect_kwargs["sslmode"] = os.getenv("DB_SSLMODE", "require")

    return psycopg2.connect(database_url, **connect_kwargs)


@contextmanager
def db_cursor() -> Iterator:
    """
    Transactional cursor with auto commit/rollback.
    """
    conn = get_connection()
    try:
        with conn:
            with conn.cursor() as cur:
                yield cur
    finally:
        conn.close()


def db_fingerprint() -> str:
    """
    Prints where we're connected (proves Supabase vs local).
    """
    with db_cursor() as cur:
        cur.execute(
            """
            select
              current_database() as db,
              inet_server_addr() as host,
              inet_server_port() as port,
              current_user as user
            """
        )
        row = cur.fetchone()
        return f"{row[0]} @ {row[1]}:{row[2]} as {row[3]}"


def _resume_to_payload(resume: Resume) -> Dict[str, Any]:
    exp_list: List[Dict[str, Any]] = []
    for exp in (resume.experience or []):
        base = exp
        inner = getattr(exp, "company", None)
        if inner is not None and hasattr(inner, "company") and hasattr(inner, "title"):
            base = inner

        company = getattr(base, "company", None)
        title = getattr(base, "title", None)
        start_date = getattr(base, "start_date", None) or getattr(exp, "start_date", None)
        end_date = getattr(base, "end_date", None) or getattr(exp, "end_date", None)

        raw_bullets = list(getattr(base, "bullets", []) or []) or list(getattr(exp, "bullets", []) or [])

        exp_list.append(
            {
                "company": None if company is None else str(company),
                "title": None if title is None else str(title),
                "start_date": start_date,
                "end_date": end_date,
                "bullets": [str(b) for b in raw_bullets],
            }
        )

    edu_list: List[Dict[str, Any]] = []
    for ed in (resume.education or []):
        raw_inst = getattr(ed, "institution", None)
        raw_deg = getattr(ed, "degree", None)
        edu_list.append(
            {
                "institution": None if raw_inst is None else str(raw_inst),
                "degree": None if raw_deg is None else str(raw_deg),
            }
        )

    proj_list: List[Dict[str, Any]] = []
    for proj in (resume.projects or []):
        raw_name = getattr(proj, "name", None)
        raw_desc = getattr(proj, "description", None)
        raw_stack = list(getattr(proj, "tech_stack", []) or [])
        raw_links = list(getattr(proj, "links", []) or [])

        proj_list.append(
            {
                "name": None if raw_name is None else str(raw_name),
                "description": None if raw_desc is None else str(raw_desc),
                "tech_stack": [str(x) for x in raw_stack],
                "links": [str(x) for x in raw_links],
            }
        )

    skills_list = [str(s) for s in (resume.skills or [])]

    cert_list: List[Dict[str, Any]] = []
    for cert in (resume.certifications or []):
        raw_name = getattr(cert, "name", None)
        raw_issuer = getattr(cert, "issuer", None)
        issue_date = getattr(cert, "issue_date", None)
        expiry_date = getattr(cert, "expiry_date", None)
        cert_list.append(
            {
                "name": None if raw_name is None else str(raw_name),
                "issuer": None if raw_issuer is None else str(raw_issuer),
                "issue_date": issue_date,
                "expiry_date": expiry_date,
            }
        )

    return {
        "experience": exp_list,
        "education": edu_list,
        "projects": proj_list,
        "skills": skills_list,
        "certifications": cert_list,
    }


def store_parsed_resume(owner_id: int, title: str, resume: Resume) -> Tuple[int, int]:
    payload = _resume_to_payload(resume)

    exp_list = payload.get("experience", []) or []
    edu_list = payload.get("education", []) or []
    proj_list = payload.get("projects", []) or []
    skills_list = payload.get("skills", []) or []
    cert_list = payload.get("certifications", []) or []

    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO resume (owner_id, title)
            VALUES (%s, %s)
            RETURNING id
            """,
            (owner_id, title),
        )
        resume_id = cur.fetchone()[0]

        cur.execute(
            """
            INSERT INTO resume_version (resume_id, version_no, title)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (resume_id, 1, title),
        )
        version_id = cur.fetchone()[0]

        exp_rows: List[tuple] = []
        for exp in exp_list:
            bullets = [str(b) for b in (exp.get("bullets") or [])]
            bullet_text = "\n".join(bullets) if bullets else None
            exp_rows.append(
                (
                    version_id,
                    exp.get("company"),
                    exp.get("title"),
                    None,
                    exp.get("start_date"),
                    exp.get("end_date"),
                    False if exp.get("end_date") else True,
                    bullet_text,
                )
            )

        if exp_rows:
            execute_values(
                cur,
                """
                INSERT INTO resume_experience (
                    resume_version, company, title, location,
                    start_date, end_date, is_current, bullet_point
                )
                VALUES %s
                """,
                exp_rows,
            )

        edu_rows: List[tuple] = []
        for ed in edu_list:
            edu_rows.append((version_id, ed.get("institution"), ed.get("degree"), None, None, None, None))
        if edu_rows:
            execute_values(
                cur,
                """
                INSERT INTO resume_education (
                    resume_version, school, degree, study_field,
                    start_date, end_date, gpa
                )
                VALUES %s
                """,
                edu_rows,
            )

        proj_rows: List[tuple] = []
        for proj in proj_list:
            tech_stack = [str(x) for x in (proj.get("tech_stack") or [])] or None
            links = [str(x) for x in (proj.get("links") or [])] or None
            proj_rows.append((version_id, proj.get("name"), proj.get("description"), tech_stack, links))
        if proj_rows:
            execute_values(
                cur,
                """
                INSERT INTO resume_projects (
                    resume_version, name, description, tech_stack, links
                )
                VALUES %s
                """,
                proj_rows,
            )

        skill_rows: List[tuple] = [(version_id, str(name), None) for name in skills_list]
        if skill_rows:
            execute_values(
                cur,
                """
                INSERT INTO resume_skills (resume_version, name, level)
                VALUES %s
                """,
                skill_rows,
            )

        cert_rows: List[tuple] = []
        for cert in cert_list:
            cert_rows.append(
                (version_id, cert.get("name"), cert.get("issuer"), cert.get("issue_date"), cert.get("expiry_date"))
            )
        if cert_rows:
            execute_values(
                cur,
                """
                INSERT INTO resume_certifications (
                    resume_version, name, issuer, issue_date, expiry_date
                )
                VALUES %s
                """,
                cert_rows,
            )

        return resume_id, version_id


def list_resumes_for_user(owner_id: int) -> List[Dict[str, object]]:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT
                r.id AS resume_id,
                rv.id AS version_id,
                COALESCE(rv.title, r.title) AS title,
                rv.created_date
            FROM resume r
            JOIN resume_version rv ON rv.resume_id = r.id
            WHERE r.owner_id = %s
            ORDER BY rv.created_date DESC, rv.id DESC
            """,
            (owner_id,),
        )
        rows = cur.fetchall()

    return [
        {"resume_id": row[0], "version_id": row[1], "title": row[2], "created_date": row[3].isoformat()}
        for row in rows
    ]


def load_resume_version(version_id: int, owner_id: int) -> Resume:
    with db_cursor() as cur:
        # --- MODIFIED SELECT: Retrieve jd_text and keywords ---
        cur.execute(
            """
            SELECT r.owner_id, COALESCE(rv.title, r.title), rv.job_description_text, rv.job_description_keywords
            FROM resume_version rv
            JOIN resume r ON rv.resume_id = r.id
            WHERE rv.id = %s
            """,
            (version_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("Resume version not found")
        
        db_owner_id, title, jd_text, jd_keywords = row
        
        if db_owner_id != owner_id:
            raise PermissionError("Not your resume")

        # ... (Rest of the function fetching sub-tables remains exactly the same) ...
        # Fetch Experience
        cur.execute("""SELECT company, title, start_date, end_date, bullet_point FROM resume_experience WHERE resume_version = %s ORDER BY id""", (version_id,))
        exp_rows = cur.fetchall()
        experiences = [Experience(company=r[0], title=r[1], start_date=r[2], end_date=r[3], bullets=r[4].split("\n") if r[4] else []) for r in exp_rows]

        # Fetch Education
        cur.execute("""SELECT school, degree, study_field, start_date, end_date, gpa FROM resume_education WHERE resume_version = %s ORDER BY id""", (version_id,))
        edu_rows = cur.fetchall()
        educations = [Education(institution=r[0], degree=r[1], year=str(r[4].year) if r[4] else None) for r in edu_rows]

        # Fetch Projects
        cur.execute("""SELECT name, description, tech_stack, links FROM resume_projects WHERE resume_version = %s ORDER BY id""", (version_id,))
        proj_rows = cur.fetchall()
        projects = [Project(name=r[0], description=r[1] or "", tech_stack=[str(x) for x in r[2]] if r[2] else [], links=[str(x) for x in r[3]] if r[3] else []) for r in proj_rows]

        # Fetch Skills
        cur.execute("""SELECT name FROM resume_skills WHERE resume_version = %s ORDER BY id""", (version_id,))
        skills = [r[0] for r in cur.fetchall() if r[0]]

        # Fetch Certs
        cur.execute("""SELECT name, issuer, issue_date, expiry_date FROM resume_certifications WHERE resume_version = %s ORDER BY id""", (version_id,))
        certs = [Certification(name=r[0], issuer=r[1], issue_date=r[2], expiry_date=r[3]) for r in cur.fetchall()]

    # --- MODIFIED RETURN: Populate new fields on the Resume object ---
    resume = Resume(
        header=[title] if title else [],
        summary="",
        experience=experiences,
        education=educations,
        projects=projects,
        skills=skills,
        certifications=certs,
        file_name=title,
    )
    # Dynamically attach attributes (or you can add these fields to your Resume model definition)
    resume.job_description_text = jd_text or ""
    resume.job_description_keywords = jd_keywords or []
    
    return resume

def delete_resume_for_user(resume_id: int, owner_id: int) -> None:
    with db_cursor() as cur:
        cur.execute("SELECT owner_id FROM resume WHERE id = %s", (resume_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError("Resume not found")
        if row[0] != owner_id:
            raise PermissionError("Not your resume")

        cur.execute("SELECT id FROM resume_version WHERE resume_id = %s", (resume_id,))
        version_ids = [r[0] for r in cur.fetchall()]

        if version_ids:
            cur.execute("DELETE FROM resume_experience WHERE resume_version = ANY(%s)", (version_ids,))
            cur.execute("DELETE FROM resume_education WHERE resume_version = ANY(%s)", (version_ids,))
            cur.execute("DELETE FROM resume_projects WHERE resume_version = ANY(%s)", (version_ids,))
            cur.execute("DELETE FROM resume_skills WHERE resume_version = ANY(%s)", (version_ids,))
            cur.execute("DELETE FROM resume_certifications WHERE resume_version = ANY(%s)", (version_ids,))
            cur.execute("DELETE FROM resume_version WHERE id = ANY(%s)", (version_ids,))

        cur.execute("DELETE FROM resume WHERE id = %s", (resume_id,))


def job_hash(job_description: str) -> str:
    normalized = " ".join((job_description or "").split()).strip().lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def find_unanswered_interview_question(
    owner_id: int,
    job_hash_value: str,
    question_type: str,
    difficulty: Optional[str] = None,
    topic: Optional[str] = None,
):
    """
    Returns the most recent unanswered question matching:
      owner_id + job_hash + question_type
    And if difficulty/topic are provided, it matches those too.

    If difficulty/topic are None, they are treated as "any".
    """
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT q.id, q.topic, q.difficulty, q.question_text, q.tags, q.leetcode_links, q.created_at
            FROM interview_questions q
            LEFT JOIN interview_answers a
              ON a.question_id = q.id AND a.owner_id = q.owner_id
            WHERE q.owner_id = %s
              AND q.job_hash = %s
              AND q.question_type = %s
              AND a.id IS NULL
              AND (%s IS NULL OR q.difficulty = %s)
              AND (%s IS NULL OR q.topic = %s)
            ORDER BY q.created_at DESC, q.id DESC
            LIMIT 1
            """,
            (owner_id, job_hash_value, question_type, difficulty, difficulty, topic, topic),
        )
        return cur.fetchone()


def insert_interview_question(
    owner_id: int,
    job_hash_value: str,
    question_type: str,
    topic: Optional[str],
    difficulty: Optional[str],
    question_text: str,
    tags: List[str],
    leetcode_links: List[Dict[str, Any]],
) -> int:
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO interview_questions (owner_id, job_hash, question_type, topic, difficulty, question_text, tags, leetcode_links)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (owner_id, job_hash_value, question_type, topic, difficulty, question_text, tags, Json(leetcode_links)),
        )
        return cur.fetchone()[0]


def get_interview_question(owner_id: int, question_id: int):
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, owner_id, job_hash, question_type, topic, difficulty, question_text, tags, leetcode_links
            FROM interview_questions
            WHERE id = %s AND owner_id = %s
            """,
            (question_id, owner_id),
        )
        return cur.fetchone()


def insert_interview_answer(
    owner_id: int,
    question_id: int,
    answer_text: str,
    score: int,
    feedback: List[str],
    improve_next: List[str],
) -> int:
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO interview_answers (owner_id, question_id, answer_text, score, feedback, improve_next)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (owner_id, question_id, answer_text, score, "\n".join(feedback) if feedback else "", Json(improve_next)),
        )
        return cur.fetchone()[0]

def list_saved_job_descriptions(owner_id: int):
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, name, job_description, created_at, updated_at
            FROM saved_job_descriptions
            WHERE owner_id = %s
            ORDER BY updated_at DESC, id DESC
            """,
            (owner_id,),
        )
        return cur.fetchall()

def create_saved_job_description(owner_id: int, name: str, job_description: str) -> int:
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO saved_job_descriptions (owner_id, name, job_description)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (owner_id, name.strip(), job_description),
        )
        return cur.fetchone()[0]

def update_saved_job_description(owner_id: int, saved_id: int, name: str, job_description: str) -> None:
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE saved_job_descriptions
            SET name = %s, job_description = %s
            WHERE id = %s AND owner_id = %s
            """,
            (name.strip(), job_description, saved_id, owner_id),
        )

def delete_saved_job_description(owner_id: int, saved_id: int) -> None:
    with db_cursor() as cur:
        cur.execute(
            """
            DELETE FROM saved_job_descriptions
            WHERE id = %s AND owner_id = %s
            """,
            (saved_id, owner_id),
        )

def save_manual_resume_update(owner_id: int, resume_id: int, data):
    """
    Overwrites the latest version with new data (including JD context).
    Handles UPDATE if version exists, INSERT if it's new.
    """
    with db_cursor() as cur:
        # 1. Verify Ownership
        cur.execute("SELECT id FROM resume WHERE id = %s AND owner_id = %s", (resume_id, owner_id))
        if not cur.fetchone():
            raise PermissionError("User does not own this resume")

        # 2. Check for existing version
        cur.execute(
            """
            SELECT id
            FROM resume_version
            WHERE resume_id = %s
            ORDER BY created_date DESC
            LIMIT 1
            """,
            (resume_id,),
        )
        row = cur.fetchone()

        if row:
            # --- SCENARIO A: Version Exists -> UPDATE IT ---
            version_id = row[0]
            
            # Update the JD Context fields on the existing row
            cur.execute(
                """
                UPDATE resume_version
                SET job_description_text = %s,
                    job_description_keywords = %s,
                    created_date = NOW()  -- Update timestamp to show activity
                WHERE id = %s
                """,
                (data.job_description_text, data.job_description_keywords, version_id),
            )

            # Clear out old child data so we can replace it
            cur.execute("DELETE FROM resume_experience WHERE resume_version = %s", (version_id,))
            cur.execute("DELETE FROM resume_education WHERE resume_version = %s", (version_id,))
            cur.execute("DELETE FROM resume_projects WHERE resume_version = %s", (version_id,))
            cur.execute("DELETE FROM resume_skills WHERE resume_version = %s", (version_id,))
            cur.execute("DELETE FROM resume_certifications WHERE resume_version = %s", (version_id,))

        else:
            # --- SCENARIO B: No Version -> INSERT NEW (Version 1) ---
            cur.execute(
                """
                INSERT INTO resume_version 
                (resume_id, version_no, title, created_date, job_description_text, job_description_keywords)
                VALUES (%s, 1, 'Current Version', NOW(), %s, %s)
                RETURNING id
                """,
                (
                    resume_id, 
                    data.job_description_text, 
                    data.job_description_keywords
                ),
            )
            version_id = cur.fetchone()[0]

        # 3. Insert Child Data (Same for both scenarios)
        
        # Experience
        for exp in data.experience:
            bullet_text = "\n".join(exp.bullets) if exp.bullets else ""
            cur.execute(
                """
                INSERT INTO resume_experience
                (resume_version, company, title, start_date, end_date, bullet_point)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (version_id, exp.company, exp.title, exp.start_date or None, exp.end_date or None, bullet_text),
            )

        # Education
        for edu in data.education:
            # Handle empty strings for year to avoid date parsing errors
            start_date_val = f"{edu.year}-01-01" if edu.year and len(edu.year) == 4 and edu.year.isdigit() else None
            cur.execute(
                """
                INSERT INTO resume_education (resume_version, school, degree, start_date)
                VALUES (%s, %s, %s, %s)
                """,
                (version_id, edu.institution, edu.degree, start_date_val),
            )

        # Projects
        for proj in data.projects:
            cur.execute(
                """
                INSERT INTO resume_projects (resume_version, name, description, tech_stack, links)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (version_id, proj.name, proj.description, proj.tech_stack, proj.links),
            )

        # Skills
        for skill in data.skills:
            cur.execute(
                """
                INSERT INTO resume_skills (resume_version, name)
                VALUES (%s, %s)
                """,
                (version_id, skill),
            )

        # Certifications
        for cert in data.certifications:
            cur.execute(
                """
                INSERT INTO resume_certifications (resume_version, name, issuer, issue_date, expiry_date)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (version_id, cert.name, cert.issuer, cert.issue_date, cert.expiry_date),
            )

        # 4. Touch the parent resume table
        cur.execute("UPDATE resume SET last_updated_date = NOW() WHERE id = %s", (resume_id,))
        
        return version_id

def save_cover_letter(
    owner_id: int, 
    job_title: str, 
    company_name: str, 
    content: str, 
    resume_text: str,      # <--- NEW ARG
    job_description: str   # <--- NEW ARG
) -> int:
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO cover_letters 
            (owner_id, job_title, company_name, content, resume_text, job_description)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (owner_id, job_title, company_name, content, resume_text, job_description),
        )
        return cur.fetchone()[0]

def list_cover_letters(owner_id: int) -> List[Dict[str, Any]]:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, job_title, company_name, content, created_at, resume_text, job_description
            FROM cover_letters
            WHERE owner_id = %s
            ORDER BY created_at DESC
            """,
            (owner_id,),
        )
        rows = cur.fetchall()

    return [
        {
            "id": row[0],
            "job_title": row[1] or "Unknown Role",
            "company_name": row[2] or "Unknown Company",
            "content": row[3],
            "created_at": row[4],
            "resume_text": row[5] or "",        # <--- Return this
            "job_description": row[6] or ""     # <--- Return this
        }
        for row in rows
    ]
