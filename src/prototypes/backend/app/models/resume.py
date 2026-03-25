from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import List, Optional

from .certification import Certification


@dataclass
class Experience:
    company: Optional[str] = None
    title: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    bullets: List[str] = field(default_factory=list)

    def add_bullet(self, text: str) -> None:
        """
        Called by PdfResumeParser to append a single bullet line
        to this experience entry.
        """
        if text:
            self.bullets.append(text)


@dataclass
class Education:
    institution: Optional[str] = None
    degree: Optional[str] = None
    year: Optional[str] = None


@dataclass
class Project:
    name: Optional[str] = None
    description: Optional[str] = None
    tech_stack: List[str] = field(default_factory=list)
    links: List[str] = field(default_factory=list)


@dataclass
class Resume:
    header: List[str] = field(default_factory=list)
    summary: str = ""

    experience: List[Experience] = field(default_factory=list)
    education: List[Education] = field(default_factory=list)
    projects: List[Project] = field(default_factory=list)
    skills: List[str] = field(default_factory=list)
    certifications: List[Certification] = field(default_factory=list)

    file_name: Optional[str] = None


    def add_education(self, *args, **kwargs) -> None:
        """
        Called by PdfResumeParser. Accepts a flexible set of parameters and
        stores one education entry.

        It supports call styles like:
            add_education("Western University")
            add_education("Western", "BESc Software Engineering")
            add_education("Western", "BESc", "2025")
            add_education(institution="Western", degree="BESc", year="2025")
        """
        institution = kwargs.get("institution")
        degree = kwargs.get("degree")
        year = kwargs.get("year")

        if len(args) > 0 and institution is None:
            institution = args[0]
        if len(args) > 1 and degree is None:
            degree = args[1]
        if len(args) > 2 and year is None:
            year = args[2]

        self.education.append(
            Education(
                institution=institution,
                degree=degree,
                year=year,
            )
        )

    def add_experience(
        self,
        company: Optional[str] = None,
        title: Optional[str] = None,
        bullets: Optional[List[str]] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> None:
        """
        Helper used by the parser to add an experience entry.
        """
        self.experience.append(
            Experience(
                company=company,
                title=title,
                start_date=start_date,
                end_date=end_date,
                bullets=bullets or [],
            )
        )

    def add_project(
        self,
        name: str,
        description: str = "",
        tech_stack: Optional[List[str]] = None,
        links: Optional[List[str]] = None,
    ) -> None:
        self.projects.append(
            Project(
                name=name,
                description=description,
                tech_stack=tech_stack or [],
                links=links or [],
            )
        )

    def add_skill(self, skill: str) -> None:
        self.skills.append(skill)

    def add_certification(self, cert: Certification) -> None:
        self.certifications.append(cert)