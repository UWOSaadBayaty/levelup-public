from abc import ABC, abstractmethod
from typing import Any
from app.services.llm_config import LLMConfig

class LLMStrategy(ABC):
    """
    Interface for LLM interaction strategies.
    Matches the <<interface>> LLMStrategy in the UML.
    """
    @abstractmethod
    def generate_response(self, prompt: str, context: str, config: LLMConfig) -> str:
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        pass