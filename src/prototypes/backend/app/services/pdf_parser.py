from __future__ import annotations

from pathlib import Path
import re
from typing import Dict, List, Optional, Union

import pdfplumber

from app.models.resume import Resume
from app.models.experience import Experience
from app.models.education import Education
from app.models.project import Project
from app.models.certification import Certification 
from .base_parser import ResumeParser


DEBUG_SECTIONS = False

BULLET_PREFIXES = ("§", "•", "·", "-", "–", "*")

SECTION_KEYWORDS = {
    "education": [
        "education", "academic background", "academic history", "studies"
    ],
    "experience": [
        "experience", "work history", "employment", "professional experience",
        "work experience"
    ],
    "projects": [
        "projects", "personal projects", "selected projects"
    ],
    "skills": [
        "skills", "technical skills", "tech skills", "technologies", "toolbox"
    ],
}


class PdfResumeParser(ResumeParser):
    """
    Generic-ish PDF resume parser:
    - Detects section headers by matching keywords (not exact strings).
    - Sections: header, education, experience, projects, skills.
    """

    def parse(self, file_path: Union[str, Path]) -> Resume:
        file_path = Path(file_path)
        raw_text = self._extract_text(file_path)
        lines = self._clean_lines(raw_text)
        sections = self._split_into_sections(lines)
        return self._build_resume(sections)


    def _extract_text(self, file_path: Path) -> str:
        """Read all pages and join text."""
        chunks: List[str] = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                chunks.append(page.extract_text() or "")
        return "\n".join(chunks)

    def _clean_lines(self, text: str) -> List[str]:
        """Split into non-empty, stripped lines."""
        return [ln.strip() for ln in text.splitlines() if ln.strip()]

    def _is_bullet(self, line: str) -> bool:
        """Check if a line starts with any known bullet prefix."""
        return line.startswith(BULLET_PREFIXES)

    def _detect_section_header(self, line: str) -> Optional[str]:
        if len(line.split()) > 7:
            return None

        cleaned = re.sub(r"[^a-zA-Z\s]", " ", line).lower()
        words = set(cleaned.split())

        if "education" in words:
            return "education"
        if "skills" in words or "technical" in words:
            return "skills"
        if "project" in words or "projects" in words:
            return "projects"
        if "experience" in words or "employment" in words:
            return "experience"

        for section, phrases in SECTION_KEYWORDS.items():
            for phrase in phrases:
                phrase_words = set(phrase.split())
                if phrase_words.issubset(words):
                    return section

        return None

    def _split_into_sections(self, lines: List[str]) -> Dict[str, List[str]]:
        sections: Dict[str, List[str]] = {
            "header": [],
            "education": [],
            "experience": [],
            "projects": [],
            "skills": [],
        }

        current = "header"

        for line in lines:
            if not self._is_bullet(line):
                sec = self._detect_section_header(line)
                if sec:
                    current = sec
                    continue 

            sections[current].append(line)
        return sections


    def _build_resume(self, sections: Dict[str, List[str]]) -> Resume:
        resume = Resume()

        edu_lines = sections["education"]
        if edu_lines:
            edu_main = [ln for ln in edu_lines if not self._is_bullet(ln)]
            degree = edu_main[0] if edu_main else ""
            institution = edu_main[1] if len(edu_main) > 1 else ""
            year = ""
            joined = " ".join(edu_main)
            m_year = re.search(r"(20\d{2}|19\d{2})", joined)
            if m_year:
                year = m_year.group(1)

            education = Education(degree=degree, institution=institution, year=year)
            resume.add_education(education)

        self._parse_experience_block(sections["experience"], resume)

        self._parse_projects_block(sections["projects"], resume)

        self._parse_skills_block(sections["skills"], resume)

        if sections["header"]:
            resume.header = sections["header"]

        return resume


    def _parse_experience_block(self, lines: List[str], resume: Resume) -> None:
        if not lines:
            return

        detected_count_before = len(resume.experience)
        i = 0
        current_exp: Optional[Experience] = None

        last_bullet_idx: Optional[int] = None

        date_pattern = re.compile(
            r"(\d{2}/\d{4}|[A-Za-z]{3,9}\.?\s+\d{4}|\b20\d{2}\b|\b19\d{2}\b|\bcurrent\b|\bpresent\b)",
            re.IGNORECASE,
        )

        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue

            is_bullet_line = self._is_bullet(line)

            if not is_bullet_line:
                next_line = lines[i + 1].strip() if i + 1 < len(lines) else ""
                has_dates_here = bool(date_pattern.search(line))
                has_dates_next = bool(date_pattern.search(next_line))
                next_not_bullet = (i + 1 < len(lines) and not self._is_bullet(next_line))

                if (has_dates_here and next_not_bullet) or (has_dates_next and next_not_bullet):
                    title = line
                    company = next_line if next_not_bullet else ""
                    i += 2 if next_not_bullet else 1

                    exp = Experience(title=title.strip(), company=company.strip())
                    resume.add_experience(exp)
                    current_exp = exp
                    last_bullet_idx = None
                    continue

            if is_bullet_line and current_exp:
                desc_line = line.lstrip("".join(BULLET_PREFIXES)).strip()
                if desc_line:
                    current_exp.add_bullet(desc_line)
                    last_bullet_idx = len(current_exp.bullets) - 1
                i += 1
                continue

            if (
                current_exp
                and last_bullet_idx is not None
                and not is_bullet_line
                and not date_pattern.search(line)
            ):
                current_exp.bullets[last_bullet_idx] = (
                    current_exp.bullets[last_bullet_idx] + " " + line
                )
                i += 1
                continue

            i += 1

        if len(resume.experience) == detected_count_before and lines:
            fallback = Experience(title="Experience", company="")
            for ln in lines:
                clean = ln.lstrip("".join(BULLET_PREFIXES)).strip()
                if clean:
                    fallback.add_bullet(clean)
            resume.add_experience(fallback)

            if not lines:
                return
            
            detected_count_before = len(resume.experience)
            i = 0
            current_exp: Optional[Experience] = None

            date_pattern = re.compile(
                r"(\d{2}/\d{4}|[A-Za-z]{3,9}\.?\s+\d{4}|\b20\d{2}\b|\b19\d{2}\b|\bcurrent\b|\bpresent\b)",
                re.IGNORECASE,
            )

            while i < len(lines):
                line = lines[i]
                if not self._is_bullet(line):
                    next_line = lines[i + 1] if i + 1 < len(lines) else ""
                    has_dates_here = bool(date_pattern.search(line))
                    has_dates_next = bool(date_pattern.search(next_line))
                    next_not_bullet = (i + 1 < len(lines) and not self._is_bullet(next_line))

                    if (has_dates_here and next_not_bullet) or (has_dates_next and next_not_bullet):
                        title = line
                        company = next_line if next_not_bullet else ""
                        i += 2 if next_not_bullet else 1

                        exp = Experience(title=title.strip(), company=company.strip())
                        resume.add_experience(exp)
                        current_exp = exp
                        continue

                if self._is_bullet(line) and current_exp:
                    bullet = line.lstrip("".join(BULLET_PREFIXES)).strip()
                    current_exp.add_bullet(bullet)
                    i += 1
                    continue
                i += 1

            if len(resume.experience) == detected_count_before and lines:
                fallback = Experience(title="Experience", company="")
                for ln in lines:
                    clean = ln.lstrip("".join(BULLET_PREFIXES)).strip()
                    if clean:
                        fallback.add_bullet(clean)
                resume.add_experience(fallback)

    def _parse_projects_block(self, lines: List[str], resume: Resume) -> None:
        if not lines:
            return

        before_count = len(resume.projects)
        i = 0
        current_project: Optional[Project] = None
        bullets: List[str] = []

        date_pattern = re.compile(
            r"(19\d{2}|20\d{2}|current|present)",
            re.IGNORECASE,
        )

        def flush() -> None:
            nonlocal current_project, bullets
            if current_project is not None:
                current_project.description = "\n".join(bullets).strip()
                resume.add_project(current_project)
            current_project = None
            bullets = []

        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue

            is_bullet_line = self._is_bullet(line)
            has_pipe = "|" in line
            has_dates = bool(date_pattern.search(line))

            if not is_bullet_line and (current_project is None or has_pipe or has_dates):
                flush()
                name = line
                if has_pipe:
                    name = line.split("|", 1)[0].strip()
                current_project = Project(
                    name=name,
                    description="",
                    tech_stack=[],
                    links=[],
                )
                i += 1
                continue

            if current_project is None:
                current_project = Project(
                    name=line,
                    description="",
                    tech_stack=[],
                    links=[],
                )
                i += 1
                continue

            if is_bullet_line:
                desc_line = line.lstrip("".join(BULLET_PREFIXES)).strip()
                if desc_line:
                    bullets.append(desc_line)
            else:
                if bullets:
                    bullets[-1] = bullets[-1] + " " + line
                else:
                    bullets.append(line)

            i += 1

        flush()

        if len(resume.projects) == before_count and lines:
            desc = "\n".join(
                ln.lstrip("".join(BULLET_PREFIXES)).strip()
                for ln in lines
                if ln.strip()
            )
            proj = Project(name="Projects", description=desc, tech_stack=[], links=[])
            resume.add_project(proj)

            if not lines:
                return

            before_count = len(resume.projects)
            i = 0
            current_project: Optional[Project] = None
            bullets: List[str] = []

            date_pattern = re.compile(
                r"(19\d{2}|20\d{2}|current|present)",
                re.IGNORECASE,
            )

            def flush() -> None:
                nonlocal current_project, bullets
                if current_project is not None:
                    current_project.description = "\n".join(bullets).strip()
                    resume.add_project(current_project)
                current_project = None
                bullets = []

            while i < len(lines):
                line = lines[i].strip()
                if not line:
                    i += 1
                    continue

                is_bullet_line = self._is_bullet(line)
                has_pipe = "|" in line
                has_dates = bool(date_pattern.search(line))

                if not is_bullet_line and (current_project is None or has_pipe or has_dates):
                    flush()
                    name = line
                    if has_pipe:
                        name = line.split("|", 1)[0].strip()
                    current_project = Project(
                        name=name,
                        description="",
                        tech_stack=[],
                        links=[],
                    )
                    i += 1
                    continue

                if current_project is None:
                    current_project = Project(
                        name=line,
                        description="",
                        tech_stack=[],
                        links=[],
                    )
                else:
                    desc_line = line.lstrip("".join(BULLET_PREFIXES)).strip()
                    if desc_line:
                        bullets.append(desc_line)

                i += 1

            flush()

            if len(resume.projects) == before_count and lines:
                desc = "\n".join(
                    ln.lstrip("".join(BULLET_PREFIXES)).strip()
                    for ln in lines
                    if ln.strip()
                )
                proj = Project(name="Projects", description=desc, tech_stack=[], links=[])
                resume.add_project(proj)

    def _parse_skills_block(self, lines: List[str], resume: Resume) -> None:
        for line in lines:
            text = line.lstrip("".join(BULLET_PREFIXES)).strip()
            if ":" in text:
                _, skills_part = text.split(":", 1)
            else:
                skills_part = text
            for s in skills_part.split(","):
                skill = s.strip()
                if skill:
                    resume.add_skill(skill)