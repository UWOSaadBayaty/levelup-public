# app/services/interview_service.py
import json
import re
from typing import Dict, Any, List, Optional

from app.services.llm_strategies import LLMStrategyFactory
from app.services.llm_config import LLMConfig
from app.services.leetcode_bank import pick_leetcode_links


def _extract_json(text: str) -> Dict[str, Any]:
    """
    LLMs sometimes wrap JSON in extra text (markdown fences, commentary, etc).
    This attempts to safely pull the first JSON object.
    """
    text = (text or "").strip()

    # 1) direct parse
    try:
        return json.loads(text)
    except Exception:
        pass

    # 2) strip common markdown fences
    # e.g. ```json { ... } ```
    fenced = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE | re.MULTILINE).strip()
    try:
        return json.loads(fenced)
    except Exception:
        pass

    # 3) find the first {...} block
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        raise ValueError(f"Model did not return JSON. Raw output:\n{text[:800]}")

    try:
        return json.loads(match.group(0))
    except Exception as e:
        raise ValueError(f"Failed to parse JSON from model output: {e}. Raw:\n{text[:800]}") from e


def generate_interview_question(
    job_description: str,
    question_type: str,
    topic: Optional[str],
    difficulty: Optional[str],
    provider: str,
    model: str = "",
) -> Dict[str, Any]:
    """
    Generates a single interview question as structured JSON, then enriches with LeetCode links.
    Provider keys:
      - "groq" (uses env GROQ_API_KEY, GROQ_BASE_URL, GROQ_MODEL)
      - "huggingface" (optional, env HUGGINGFACE_API_KEY)
      - "mock"
    """
    strategy = LLMStrategyFactory.create_strategy(provider=provider, model=model)

    is_behavioral = question_type.lower() == "behavioral"

    if is_behavioral:
        system_prompt = (
            "You are an expert behavioral interviewer skilled at assessing soft skills, "
            "teamwork, leadership, and culture fit through situational questions. "
            "You MUST return valid JSON only."
        )
        tag_guidance = (
            "Tags must reflect soft-skill themes only "
            "(e.g., teamwork, leadership, conflict-resolution, communication, adaptability, ownership)."
        )
        topic_instruction = f"The question MUST explore the behavioral theme: {topic}." if topic else "Choose a relevant behavioral theme from the job description."
    else:
        system_prompt = (
            "You are an expert technical interviewer. "
            "You generate high-quality technical interview questions tailored to a job description. "
            "You MUST return valid JSON only."
        )
        tag_guidance = (
            "Tags must reflect specific technical concepts only "
            "(e.g., arrays, hashmap, dynamic-programming, graphs, system-design, sql, recursion)."
        )
        topic_instruction = f"The question MUST cover the topic: {topic}." if topic else "Choose a relevant technical topic from the job description."

    difficulty_label = (difficulty or "medium").lower()
    difficulty_instruction = f"The question MUST be at {difficulty_label} difficulty."

    config = LLMConfig(
        temperature=0.5,
        max_tokens=800,
        system_prompt=system_prompt,
    )

    prompt = f"""
Generate ONE {question_type} interview question tailored to the job description below.

Constraints (you MUST follow these):
- {topic_instruction}
- {difficulty_instruction}
- {tag_guidance}
- Keep the question realistic for a real interview.
- Difficulty must be one of: easy, medium, hard.

Return ONLY valid JSON with this exact shape — no extra text, no markdown fences:
{{
  "questionText": "string",
  "topic": "string",
  "difficulty": "easy|medium|hard",
  "tags": ["tag1", "tag2", "tag3"]
}}
""".strip()

    context = f"Job Description:\n{job_description}"

    raw = strategy.generate_response(prompt=prompt, context=context, config=config)
    data = _extract_json(raw)

    tags = data.get("tags") or []
    if not isinstance(tags, list):
        tags = []

    # LeetCode links are only meaningful for technical questions
    leetcode_links = (
        pick_leetcode_links([str(t).strip() for t in tags], k=5)
        if not is_behavioral
        else []
    )

    return {
        "question_text": str(data.get("questionText", "")).strip(),
        "topic": str(data.get("topic", topic or "")).strip() or None,
        "difficulty": str(data.get("difficulty", difficulty_label)).strip().lower(),
        "tags": [str(t).strip() for t in tags if str(t).strip()],
        "leetcode_links": leetcode_links,
    }


def score_interview_answer(
    job_description: str,
    question_text: str,
    answer_text: str,
    provider: str,
    model: str = "",
    question_type: str = "technical",
) -> Dict[str, Any]:
    """
    Scores an interview answer and returns JSON: score, feedback, improve_next.
    """
    strategy = LLMStrategyFactory.create_strategy(provider=provider, model=model)

    is_behavioral = question_type.lower() == "behavioral"

    if is_behavioral:
        rubric = (
            "- Does the answer follow the STAR method (Situation, Task, Action, Result)?\n"
            "- Is the example specific and relevant to the job?\n"
            "- Does it demonstrate the soft skill the question targets?\n"
            "- Is the outcome clearly stated and measurable where possible?"
        )
    else:
        rubric = (
            "- Is the answer technically correct?\n"
            "- Does the candidate demonstrate understanding of time/space complexity or design tradeoffs?\n"
            "- Are edge cases and failure scenarios considered?\n"
            "- Is the explanation clear and well-structured?"
        )

    config = LLMConfig(
        temperature=0.2,
        max_tokens=700,
        system_prompt=(
            "You are an expert interviewer evaluating a candidate's answer. "
            "Score strictly and fairly based on the rubric provided. "
            "You MUST return valid JSON only."
        ),
    )

    prompt = f"""
Score the candidate's answer to the interview question below. Be strict and calibrated — do not default to high scores.

Scoring bands (apply these precisely):
- 0–40: Answer is off-topic, incorrect, or missing most key points.
- 41–65: Partial — shows some understanding but has 2 or more significant gaps in depth, accuracy, or completeness.
- 66–79: Adequate — mostly correct and clear but missing at least one important element (e.g. edge cases, error handling, tradeoffs, measurable outcome).
- 80–89: Good — correct, well-structured, covers most expected elements with only minor gaps.
- 90–100: Excellent — correct, thorough, well-structured, explicitly covers edge cases or tradeoffs with no notable omissions.

Deduction rules (apply before assigning a final score):
- Each significant gap identified in improveNext reduces the score by 5–10 points.
- If the answer is missing error handling or edge cases for a technical question, it cannot score above 79.
- If the answer is missing a measurable outcome or specific example for a behavioral question, it cannot score above 79.
- If there are 2 or more significant gaps, the score must not exceed 75.

Rubric ({question_type}):
{rubric}

Return ONLY valid JSON with this exact shape — no extra text, no markdown fences:
{{
  "score": <integer 0-100>,
  "feedback": ["<2 to 3 specific strengths of the answer>"],
  "improveNext": ["<2 to 3 specific, actionable gaps that affected the score>"]
}}
""".strip()

    context = f"""
Job Description:
{job_description}

Question:
{question_text}

Candidate Answer:
{answer_text}
""".strip()

    raw = strategy.generate_response(prompt=prompt, context=context, config=config)
    data = _extract_json(raw)

    score = int(data.get("score", 0))
    score = max(0, min(100, score))

    feedback = data.get("feedback") or []
    if not isinstance(feedback, list):
        feedback = []

    improve_next = data.get("improveNext") or []
    if not isinstance(improve_next, list):
        improve_next = []

    return {
        "score": score,
        "feedback": [str(x).strip() for x in feedback if str(x).strip()],
        "improve_next": [str(x).strip() for x in improve_next if str(x).strip()],
    }
