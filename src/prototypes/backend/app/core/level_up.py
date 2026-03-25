from typing import List, Optional
from app.services.llm_strategy_interface import LLMStrategy
from app.services.llm_strategies import LLMStrategyFactory
from app.services.llm_config import LLMConfig
from app.services.prompt_context import (
    extract_jd_signals,
    extract_resume_signals,
    format_prompt_list,
    format_prompt_value,
    select_relevant_lines,
)

class LevelUp:
    def __init__(self, provider: str = "mock"):
        self.provider = provider
        self._strategy: LLMStrategy = LLMStrategyFactory.create_strategy(provider)
        self._config = LLMConfig(
            system_prompt=(
                "You are a precise career assistant. "
                "Prioritize truthful, specific, ATS-aware output and follow formatting instructions exactly."
            )
        )

    def extract_jd_keywords(self, jd_text: str) -> str:
        """
        Extracts technical keywords using a Waterfall Strategy via the Factory.
        """
        jd_signals = extract_jd_signals(jd_text)
        extraction_config = LLMConfig(
            system_prompt=(
                "You are a senior technical recruiter and ATS taxonomist. "
                "Extract only hard skills, technical platforms, tools, languages, frameworks, and domain concepts "
                "that materially affect screening for this role. "
                "Exclude soft skills, generic verbs, seniority adjectives, and filler. "
                "Merge duplicates and return ONLY a valid JSON array of 8 to 15 strings ordered by hiring importance."
            ),
            temperature=0.0,
            max_tokens=220,
        )

        context = (
            "JOB DESCRIPTION:\n"
            f"{jd_text}\n\n"
            "HEURISTIC SIGNALS:\n"
            f"- Job title: {format_prompt_value(jd_signals.get('job_title'))}\n"
            f"- Company: {format_prompt_value(jd_signals.get('company_name'))}\n"
            "  Priority technical terms inferred from the JD:\n"
            f"{format_prompt_list(jd_signals.get('keywords', []), fallback='- None inferred locally.')}"
        )

        prompt = (
            "Task:\n"
            "1. Read the full job description, not just the heuristic signals.\n"
            "2. Extract the most screening-relevant hard skills.\n"
            "3. Prefer canonical terms taken directly from the JD when possible.\n"
            "4. Keep the list concise, deduplicated, and useful for resume targeting.\n"
            "5. Return JSON only."
        )

        if self.provider.lower() != "groq":
            return self._strategy.generate_response(
                prompt=prompt,
                context=context,
                config=extraction_config
            )

        waterfall_models = [
            "groq/compound",
            "groq/compound-mini",
            "llama-3.1-8b-instant"
        ]

        for model_id in waterfall_models:
            print(f"[LevelUp] Attempting keyword extraction with: {model_id}")
            temp_strategy = LLMStrategyFactory.create_strategy(
                provider="groq",
                model=model_id
            )

            result = temp_strategy.generate_response(
                prompt=prompt,
                context=context,
                config=extraction_config
            )

            if result.startswith("Error from Groq Client"):
                print(f"[LevelUp] Strategy failed ({model_id}). Switching to next...")
                continue
            return result

        return '["Error: Unable to extract keywords due to high traffic."]'

    def improve_text_content(self, text_to_improve: str, target_keywords: Optional[List[str]] = None) -> str:
        """
        Rewrites text to be impact-focused.
        Accepts optional 'target_keywords' to tailor the output.
        """
        is_multiline = "\n" in text_to_improve.strip()
        keyword_targets = target_keywords or []
        matched_keywords = [
            keyword for keyword in keyword_targets
            if keyword and keyword.lower() in text_to_improve.lower()
        ]

        instructions = (
            "Rewrite the resume content so it reads like a high-quality, ATS-friendly accomplishment statement.\n\n"
            "CORE RULES:\n"
            "1. Preserve the original truth, scope, and seniority. Never invent metrics, technologies, ownership, or outcomes.\n"
            "2. Prefer the structure 'strong action + technical/context detail + outcome or business effect'.\n"
            "3. Remove filler such as 'responsible for', 'helped with', and personal pronouns.\n"
            "4. Make wording specific and concrete, but do not keyword-stuff.\n"
            "5. If target keywords are provided, weave them in only when they are already supported by the source or are an obvious semantic rename.\n"
            "6. If the original line is already strong, improve it lightly instead of over-rewriting it.\n"
        )

        if is_multiline:
            instructions += (
                "\nFORMATTING RULES:\n"
                "- The input contains multiple bullet points.\n"
                "- Rewrite each line individually.\n"
                "- Preserve the exact same number of lines and the original order.\n"
                "- Return only the rewritten lines separated by newlines."
            )
        else:
            instructions += "\nFORMATTING RULES:\n- Return only the rewritten text for the single input."

        context = (
            "SOURCE TEXT:\n"
            f"{text_to_improve}\n\n"
            "ATS TARGET KEYWORDS:\n"
            f"{format_prompt_list(keyword_targets, fallback='- None provided.')}\n\n"
            "KEYWORDS ALREADY PRESENT IN THE SOURCE:\n"
            f"{format_prompt_list(matched_keywords, fallback='- None detected directly.')}"
        )

        prompt = f"{instructions}\n\nReturn only the rewritten version."

        return self._strategy.generate_response(prompt, context, self._config)

    def generate_cover_letter(self, resume_text: str, jd_text: str) -> str:
        """
        Generates a tailored cover letter using the resume and job description.
        """
        resume_signals = extract_resume_signals(resume_text)
        jd_signals = extract_jd_signals(jd_text)
        aligned_keywords = [
            keyword for keyword in jd_signals.get("keywords", [])
            if keyword and keyword.lower() in resume_text.lower()
        ]
        evidence_lines = select_relevant_lines(
            list(resume_signals.get("experience_bullets", [])) + list(resume_signals.get("project_bullets", [])),
            jd_signals.get("keywords", []),
            limit=5,
        )

        cover_letter_config = LLMConfig(
            system_prompt=(
                "You are an expert career coach and hiring manager. "
                "Write cover letters that sound credible, specific, and tailored rather than generic. "
                "Use only evidence grounded in the provided resume context."
            ),
            temperature=0.55,
            max_tokens=600
        )

        context = (
            "JOB TARGET:\n"
            f"- Job title: {format_prompt_value(jd_signals.get('job_title'))}\n"
            f"- Company: {format_prompt_value(jd_signals.get('company_name'))}\n"
            "- Priority JD keywords:\n"
            f"{format_prompt_list(jd_signals.get('keywords', []), fallback='- None inferred.')}\n"
            "- Key responsibilities:\n"
            f"{format_prompt_list(jd_signals.get('responsibilities', []), fallback='- Not clearly segmented.')}\n"
            "- Key requirements:\n"
            f"{format_prompt_list(jd_signals.get('requirements', []), fallback='- Not clearly segmented.')}\n\n"
            "CANDIDATE SNAPSHOT:\n"
            f"- Name: {format_prompt_value(resume_signals.get('name'))}\n"
            f"- Summary: {format_prompt_value(resume_signals.get('summary'))}\n"
            "- Skills:\n"
            f"{format_prompt_list(resume_signals.get('skills', []), fallback='- Not explicitly listed.')}\n"
            "- Strongest evidence lines:\n"
            f"{format_prompt_list(evidence_lines, fallback='- Use the raw resume below.')}\n"
            "- Overlapping keywords between resume and JD:\n"
            f"{format_prompt_list(aligned_keywords, fallback='- No direct overlap detected.')}\n\n"
            "RAW JOB DESCRIPTION:\n"
            f"{jd_text}\n\n"
            "RAW RESUME:\n"
            f"{resume_text}"
        )

        prompt = (
            "Write a tailored cover letter.\n"
            "Requirements:\n"
            "- 230 to 320 words.\n"
            "- Use 4 short paragraphs.\n"
            "- Open by connecting the candidate to the role and company if identifiable; if the company is unclear, omit it instead of using placeholders.\n"
            "- Highlight the 2 to 3 strongest resume examples that match the job.\n"
            "- Mirror important JD keywords naturally, especially those already supported by the resume.\n"
            "- Sound confident and human, not templated or overly flattering.\n"
            "- Do not restate the entire resume, do not use bullet points, and do not invent facts.\n"
            "- Return only the finished cover letter text."
        )

        return self._strategy.generate_response(
            prompt=prompt,
            context=context,
            config=cover_letter_config
        )

    def generate_general_feedback(self, resume_context: str) -> str:
        resume_signals = extract_resume_signals(resume_context)
        context = (
            "RESUME SUMMARY:\n"
            f"- Candidate: {format_prompt_value(resume_signals.get('name'))}\n"
            f"- Summary present: {'Yes' if resume_signals.get('summary') else 'No'}\n"
            f"- Experience bullets: {len(resume_signals.get('experience_bullets', []))}\n"
            f"- Project bullets: {len(resume_signals.get('project_bullets', []))}\n"
            "- Skills detected:\n"
            f"{format_prompt_list(resume_signals.get('skills', []), fallback='- None explicitly listed.')}\n"
            "- Resume keywords inferred:\n"
            f"{format_prompt_list(resume_signals.get('keywords', []), fallback='- None inferred.')}\n\n"
            "RAW RESUME:\n"
            f"{resume_context}"
        )
        prompt = (
            "Review the resume and provide exactly 3 high-leverage improvements.\n"
            "Requirements:\n"
            "- Prioritize the changes that would most improve clarity, impact, and ATS performance.\n"
            "- Each improvement must include: issue, why it matters, and a concrete fix.\n"
            "- Keep each improvement to 2 short sentences maximum.\n"
            "- Format the response as exactly 3 bullet points and return only those bullets."
        )
        return self._strategy.generate_response(prompt, context, self._config)
