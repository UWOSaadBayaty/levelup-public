from pathlib import Path
from typing import Union

from app.models.resume import Resume


class ResumeParser:
    def parse(self, file_path: Union[str, Path]) -> Resume:
        raise NotImplementedError