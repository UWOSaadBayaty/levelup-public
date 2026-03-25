from __future__ import annotations

import re
from typing import Dict, Iterable, List, Optional


TECH_TERMS = {
    "aws", "azure", "gcp", "cloud", "docker", "kubernetes", "terraform", "ansible",
    "linux", "unix", "bash", "git", "github", "gitlab", "ci/cd", "jenkins", "github actions",
    "python", "java", "javascript", "typescript", "node.js", "node", "react", "next.js",
    "vue", "angular", "express", "fastapi", "flask", "django", "spring", "spring boot",
    "rest", "rest api", "restful", "graphql", "grpc", "microservices", "system design",
    "distributed systems", "sql", "postgresql", "mysql", "sqlite", "oracle", "sql server",
    "nosql", "mongodb", "redis", "dynamodb", "cassandra", "elasticsearch", "kafka", "rabbitmq",
    "spark", "hadoop", "airflow", "dbt", "snowflake", "tableau", "power bi", "excel",
    "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch", "machine learning",
    "data science", "data analysis", "computer vision", "nlp", "llm", "openai", "prompt engineering",
    "html", "css", "sass", "tailwind", "bootstrap", "c", "c++", "c#", ".net", "go", "golang",
    "rust", "php", "ruby", "swift", "kotlin", "scala", "android", "ios", "react native",
    "unit testing", "integration testing", "pytest", "jest", "selenium", "playwright",
    "oauth", "jwt", "firebase", "supabase", "agile", "scrum",
}

GENERIC_TERMS = {
    "team", "teams", "work", "working", "role", "position", "company", "candidate",
    "experience", "preferred", "plus", "bonus", "requirement", "requirements",
    "qualification", "qualifications", "responsibilities", "responsibility",
    "communication", "leadership", "collaboration", "problem solving", "detail oriented",
    "self starter", "fast paced", "stakeholders", "customer", "customers", "business",
    "job description", "resume", "cover letter", "interview", "professional", "skills",
}

HEADING_HINTS = {
    "summary", "experience", "projects", "project", "education", "skills",
    "requirements", "qualifications", "responsibilities", "about", "preferred",
    "must have", "nice to have", "what you will do", "what you'll do",
}


def compact_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def dedupe_preserve_order(items: Iterable[str]) -> List[str]:
    seen = set()
    output: List[str] = []
    for raw_item in items:
        item = compact_whitespace(raw_item)
        if not item:
            continue
        key = item.casefold()
        if key in seen:
            continue
        seen.add(key)
        output.append(item)
    return output


def clean_lines(text: str) -> List[str]:
    return [line.strip() for line in (text or "").replace("\r", "\n").split("\n") if line.strip()]


def normalize_heading(text: str) -> str:
    value = re.sub(r"[^a-z0-9+#./]+", " ", (text or "").strip().lower()).strip()
    return re.sub(r"\s+", " ", value)


def is_heading_line(line: str) -> bool:
    stripped = (line or "").strip()
    if not stripped:
        return False
    if stripped.endswith(":"):
        return True
    normalized = normalize_heading(stripped)
    if normalized in HEADING_HINTS:
        return True
    return len(normalized.split()) <= 4 and normalized in HEADING_HINTS


def extract_labeled_value(text: str, labels: Iterable[str]) -> str:
    lines = clean_lines(text)
    normalized_targets = {normalize_heading(label) for label in labels}

    for line in lines:
        if ":" not in line:
            continue
        label, value = line.split(":", 1)
        if normalize_heading(label) in normalized_targets and value.strip():
            return value.strip()
    return ""


def extract_section_lines(text: str, section_names: Iterable[str]) -> List[str]:
    lines = clean_lines(text)
    normalized_targets = {normalize_heading(name) for name in section_names}

    in_section = False
    collected: List[str] = []

    for line in lines:
        if ":" in line:
            maybe_heading, rest = line.split(":", 1)
            normalized_heading = normalize_heading(maybe_heading)
            if normalized_heading in normalized_targets:
                in_section = True
                if rest.strip():
                    collected.append(rest.strip())
                continue
            if in_section and is_heading_line(maybe_heading + ":"):
                break
        elif is_heading_line(line):
            normalized_heading = normalize_heading(line.rstrip(":"))
            if normalized_heading in normalized_targets:
                in_section = True
                continue
            if in_section:
                break

        if in_section:
            collected.append(line)

    return collected


def extract_bullets(lines: Iterable[str]) -> List[str]:
    bullets: List[str] = []
    for line in lines:
        stripped = compact_whitespace(re.sub(r"^[\-\*\u2022]+\s*", "", line))
        if stripped:
            bullets.append(stripped)
    return bullets


def extract_skill_list(text: str) -> List[str]:
    inline = extract_labeled_value(text, ["skills"])
    skill_text = inline
    if not skill_text:
        skill_text = " | ".join(extract_section_lines(text, ["skills"]))

    parts = re.split(r"[,;|/]\s*", skill_text)
    return dedupe_preserve_order(parts)


def _looks_technical(phrase: str) -> bool:
    normalized = compact_whitespace(phrase).strip(".,:;()[]{}")
    if not normalized:
        return False

    lower = normalized.casefold()
    if lower in GENERIC_TERMS:
        return False
    if lower in TECH_TERMS:
        return True

    tokens = normalized.split()
    if any(token.casefold() in TECH_TERMS for token in tokens):
        return True
    if any(any(ch.isdigit() for ch in token) for token in tokens):
        return True
    if any(any(ch in "+#./" for ch in token) for token in tokens):
        return True
    if any(token.isupper() and 2 <= len(token) <= 10 for token in tokens):
        return True
    if any(re.search(r"[A-Z].*[A-Z]", token) for token in tokens):
        return True
    return False


def extract_keyword_candidates(text: str, limit: int = 15) -> List[str]:
    scores: Dict[str, int] = {}
    display: Dict[str, str] = {}
    order: List[str] = []

    for line in clean_lines(text):
        base_score = 1
        lowered = line.casefold()
        if any(word in lowered for word in ("require", "qualification", "responsibil", "preferred", "must have", "stack", "skills")):
            base_score += 2

        for tech_term in sorted(TECH_TERMS, key=len, reverse=True):
            pattern = rf"(?<![A-Za-z0-9+#./-]){re.escape(tech_term)}(?![A-Za-z0-9+#./-])"
            match = re.search(pattern, line, flags=re.IGNORECASE)
            if not match:
                continue

            key = tech_term.casefold()
            if key not in scores:
                order.append(key)
                display[key] = match.group(0)
            scores[key] = scores.get(key, 0) + base_score + min(2, len(tech_term.split()) - 1)

        token_candidates = re.findall(r"[A-Za-z][A-Za-z0-9+#./-]*", line)
        for token in token_candidates:
            phrase = compact_whitespace(token).strip(".,:;()[]{}")
            if len(phrase) < 2 or not _looks_technical(phrase):
                continue

            key = phrase.casefold()
            if key not in scores:
                order.append(key)
                display[key] = phrase
            scores[key] = scores.get(key, 0) + base_score

    ranked = sorted(order, key=lambda key: (-scores[key], order.index(key)))
    return [display[key] for key in ranked[:limit]]


def extract_resume_signals(resume_text: str) -> Dict[str, object]:
    experience_lines = extract_section_lines(resume_text, ["experience"])
    project_lines = extract_section_lines(resume_text, ["projects", "project"])
    education_lines = extract_section_lines(resume_text, ["education"])

    experience_bullets = extract_bullets(experience_lines)
    project_bullets = extract_bullets(project_lines)

    skills = extract_skill_list(resume_text)
    keywords = dedupe_preserve_order(skills + extract_keyword_candidates(resume_text, limit=20))

    return {
        "name": extract_labeled_value(resume_text, ["name", "candidate", "applicant"]),
        "summary": extract_labeled_value(resume_text, ["summary", "profile"]),
        "skills": skills,
        "keywords": keywords[:15],
        "experience_bullets": experience_bullets,
        "project_bullets": project_bullets,
        "education": extract_bullets(education_lines) or education_lines,
    }


def extract_jd_signals(jd_text: str) -> Dict[str, object]:
    requirement_lines = extract_section_lines(
        jd_text,
        ["requirements", "qualifications", "preferred", "must have", "nice to have"],
    )
    responsibility_lines = extract_section_lines(
        jd_text,
        ["responsibilities", "what you will do", "what you'll do", "about the role"],
    )

    title = extract_labeled_value(jd_text, ["title", "job title", "role"])
    company = extract_labeled_value(jd_text, ["company", "organization"])

    if not title:
        for line in clean_lines(jd_text)[:5]:
            stripped = line.strip(":- ")
            if 2 <= len(stripped.split()) <= 8 and not stripped.endswith("."):
                title = stripped
                break

    keywords = extract_keyword_candidates(jd_text, limit=15)

    return {
        "job_title": title,
        "company_name": company,
        "requirements": extract_bullets(requirement_lines) or requirement_lines[:8],
        "responsibilities": extract_bullets(responsibility_lines) or responsibility_lines[:8],
        "keywords": keywords,
    }


def select_relevant_lines(lines: Iterable[str], keywords: Iterable[str], limit: int = 4) -> List[str]:
    keyword_list = [compact_whitespace(keyword).casefold() for keyword in keywords if compact_whitespace(keyword)]
    scored = []

    for index, raw_line in enumerate(lines):
        line = compact_whitespace(raw_line)
        if not line:
            continue

        score = 0
        lower = line.casefold()
        for keyword in keyword_list:
            if keyword and keyword in lower:
                score += 3
        if re.search(r"\d", line):
            score += 1
        scored.append((score, index, line))

    scored.sort(key=lambda item: (-item[0], item[1]))
    selected = [line for _, _, line in scored[:limit]]
    return dedupe_preserve_order(selected)


def format_prompt_list(items: Iterable[str], fallback: str = "Not provided.") -> str:
    values = [compact_whitespace(item) for item in items if compact_whitespace(item)]
    if not values:
        return fallback
    return "\n".join(f"- {value}" for value in values)


def format_prompt_value(value: Optional[str], fallback: str = "Not provided.") -> str:
    cleaned = compact_whitespace(value or "")
    return cleaned or fallback
