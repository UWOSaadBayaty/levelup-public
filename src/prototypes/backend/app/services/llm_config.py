from pydantic import BaseModel

class LLMConfig(BaseModel):
    """
    Configuration for LLM generation parameters.
    Matches the LLMConfig class in the UML.
    """
    temperature: float = 0.7
    max_tokens: int = 500
    top_p: float = 1.0
    system_prompt: str = "You are a helpful career assistant expert in resume optimization."