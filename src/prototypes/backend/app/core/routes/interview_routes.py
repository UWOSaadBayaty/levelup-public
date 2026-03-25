from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.models.user_profile import UserProfile
from app.services.token_guard import guarded_ai_call

from app.core.db import (
    job_hash,
    find_unanswered_interview_question,
    insert_interview_question,
    get_interview_question,
    insert_interview_answer,
)

router = APIRouter(prefix="/interview", tags=["interview"])


def _norm_difficulty(d: Optional[str]) -> str:
    d = (d or "").strip().lower()
    if d in {"easy", "medium", "hard"}:
        return d
    # choose your default; I’m using "easy" because UI defaults to easy
    return "easy"


def _norm_topic(t: Optional[str]) -> Optional[str]:
    t = (t or "").strip()
    return t if t else None


class GenerateQuestionRequest(BaseModel):
    job_description: str = Field(min_length=10)
    question_type: str = "technical"
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    provider: str = "mock"
    model: str = ""


class GenerateQuestionResponse(BaseModel):
    id: int
    question_type: str
    topic: Optional[str]
    difficulty: Optional[str]
    question_text: str
    tags: List[str]
    leetcode_links: List[Dict[str, str]]


class ScoreAnswerRequest(BaseModel):
    question_id: int
    job_description: str = Field(min_length=10)
    answer_text: str = Field(min_length=1)
    provider: str = "mock"
    model: str = ""


class ScoreAnswerResponse(BaseModel):
    score: int
    feedback: List[str]
    improve_next: List[str]


@router.post("/question", response_model=GenerateQuestionResponse)
async def get_or_generate_question(req: GenerateQuestionRequest, user: UserProfile = Depends(get_current_user)):
    from app.services.interview_service import generate_interview_question

    jh = job_hash(req.job_description)

    existing = find_unanswered_interview_question(
        owner_id=user.id,
        job_hash_value=jh,
        question_type=req.question_type,
        difficulty=req.difficulty,
        topic=req.topic,             
    )

    if existing:
        q_id, topic, difficulty, question_text, tags, leetcode_links, _created_at = existing
        return {
            "id": q_id,
            "question_type": req.question_type,
            "topic": topic,
            "difficulty": difficulty,
            "question_text": question_text,
            "tags": tags or [],
            "leetcode_links": leetcode_links or [],
        }

    tier = user.tier

    def run():
        return generate_interview_question(
            job_description=req.job_description,
            question_type=req.question_type,
            topic=req.topic,
            difficulty=req.difficulty,
            provider=req.provider,
            model=req.model,
        )

    # Choose an output_buffer that matches how long your question responses usually are.
    generated = guarded_ai_call(
        user_id=user.id,
        tier=tier,
        input_text=req.job_description,
        output_buffer=220,  # question + tags + links can be chunky
        fn=run,
    )


    q_id = insert_interview_question(
        owner_id=user.id,
        job_hash_value=jh,
        question_type=req.question_type,
        topic=generated["topic"],
        difficulty=generated["difficulty"],  
        question_text=generated["question_text"],
        tags=generated["tags"],
        leetcode_links=generated["leetcode_links"],
    )

    return {
        "id": q_id,
        "question_type": req.question_type,
        "topic": generated["topic"],
        "difficulty": generated["difficulty"],
        "question_text": generated["question_text"],
        "tags": generated["tags"],
        "leetcode_links": generated["leetcode_links"],
    }


@router.post("/score", response_model=ScoreAnswerResponse)
async def score_answer(req: ScoreAnswerRequest, user: UserProfile = Depends(get_current_user)):
    from app.services.interview_service import score_interview_answer

    row = get_interview_question(owner_id=user.id, question_id=req.question_id)
    if not row:
        raise HTTPException(status_code=404, detail="Question not found")

    _id, _owner_id, _job_hash, _qtype, _topic, _difficulty, question_text, _tags, _links = row

    tier = user.tier

    combined_input = (
        f"JOB DESCRIPTION:\n{req.job_description}\n\n"
        f"QUESTION:\n{question_text}\n\n"
        f"ANSWER:\n{req.answer_text}"
    )

    def run():
        return score_interview_answer(
            job_description=req.job_description,
            question_text=question_text,
            answer_text=req.answer_text,
            provider=req.provider,
            model=req.model,
            question_type=_qtype or "technical",
        )

    scored = guarded_ai_call(
        user_id=user.id,
        tier=tier,
        input_text=combined_input,
        output_buffer=220,
        fn=run,
    )

    insert_interview_answer(
        owner_id=user.id,
        question_id=req.question_id,
        answer_text=req.answer_text,
        score=scored["score"],
        feedback=scored["feedback"],
        improve_next=scored["improve_next"],
    )

    return {
        "score": scored["score"],
        "feedback": scored["feedback"],
        "improve_next": scored["improve_next"],
    }
