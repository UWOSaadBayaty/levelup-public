# app/services/llm_strategies.py
import os
from pathlib import Path

from dotenv import load_dotenv
from huggingface_hub import InferenceClient
from openai import OpenAI

from app.services.llm_strategy_interface import LLMStrategy
from app.services.llm_config import LLMConfig

# ------------------------------------------------------------
# Load backend/.env reliably (independent of current working dir)
# ------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parents[2]  # .../backend
load_dotenv(BACKEND_DIR / ".env")


def _get_env(name: str, default: str = "") -> str:
    """Small helper to read env vars safely."""
    return (os.getenv(name) or default).strip()


# Env vars (match your .env)
GROQ_API_KEY = _get_env("GROQ_API_KEY")
GROQ_BASE_URL = _get_env("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
GROQ_MODEL_DEFAULT = _get_env("GROQ_MODEL", "llama-3.1-8b-instant")

HUGGINGFACE_API_KEY = _get_env("HUGGINGFACE_API_KEY")  # optional
HUGGINGFACE_MODEL_DEFAULT = _get_env("HUGGINGFACE_MODEL", "meta-llama/Meta-Llama-3-8B-Instruct")


class HuggingFaceStrategy(LLMStrategy):
    def __init__(self, api_key: str, model: str = HUGGINGFACE_MODEL_DEFAULT):
        if not api_key:
            raise ValueError("Hugging Face API Key is required (HUGGINGFACE_API_KEY).")
        self.api_key = api_key
        self.model = model
        self.client = InferenceClient(model=self.model, token=self.api_key)

    def get_model_name(self) -> str:
        return self.model

    def generate_response(self, prompt: str, context: str, config: LLMConfig) -> str:
        messages = [
            {"role": "system", "content": config.system_prompt},
            {"role": "user", "content": f"Context: {context}\n\nTask: {prompt}"},
        ]
        try:
            response = self.client.chat_completion(
                messages=messages,
                max_tokens=config.max_tokens,
                temperature=config.temperature,
                top_p=config.top_p,
                stream=False,
            )

            choice = response.choices[0]
            content = getattr(choice.message, "content", None) or choice.message["content"]
            return (content or "").strip()

        except Exception as e:
            return f"Error from Hugging Face Client: {str(e)}"


class GroqStrategy(LLMStrategy):
    """
    Uses Groq's OpenAI-compatible API via the OpenAI Python SDK.
    Env vars:
      - GROQ_API_KEY (required)
      - GROQ_BASE_URL (optional)
      - GROQ_MODEL (optional)
    """
    def __init__(self, api_key: str, model: str = GROQ_MODEL_DEFAULT, base_url: str = GROQ_BASE_URL):
        if not api_key:
            raise ValueError("Groq API Key is required (GROQ_API_KEY).")

        self.api_key = api_key
        self.model = model
        self.base_url = base_url

        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
        )

    def get_model_name(self) -> str:
        return self.model

    def generate_response(self, prompt: str, context: str, config: LLMConfig) -> str:
        messages = [
            {"role": "system", "content": config.system_prompt},
            {"role": "user", "content": f"Context: {context}\n\nTask: {prompt}"},
        ]

        try:
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=config.max_tokens,
                temperature=config.temperature,
                top_p=config.top_p,
            )

            return (resp.choices[0].message.content or "").strip()

        except Exception as e:
            return f"Error from Groq Client: {str(e)}"


class MockLLMStrategy(LLMStrategy):
    def get_model_name(self) -> str:
        return "Mock-v1"

    def generate_response(self, prompt: str, context: str, config: LLMConfig) -> str:
        return (
            "{"
            "\"questionText\": \"Implement a function that checks if a string is a palindrome.\","
            "\"topic\": \"strings\","
            "\"difficulty\": \"easy\","
            "\"tags\": [\"strings\", \"two-pointers\"]"
            "}"
        )


class LLMStrategyFactory:
    @staticmethod
    def create_strategy(provider: str, model: str = "") -> LLMStrategy:
        provider_key = (provider or "").lower().strip()

        if provider_key == "huggingface":
            target_model = model.strip() if model else HUGGINGFACE_MODEL_DEFAULT
            return HuggingFaceStrategy(api_key=HUGGINGFACE_API_KEY, model=target_model)

        if provider_key == "groq":
            target_model = model.strip() if model else GROQ_MODEL_DEFAULT
            return GroqStrategy(api_key=GROQ_API_KEY, model=target_model, base_url=GROQ_BASE_URL)

        if provider_key == "mock":
            return MockLLMStrategy()

        # Default fallback
        return MockLLMStrategy()
