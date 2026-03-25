
from typing import Generator

from app.core.user_repo import UserRepo


def get_user_repo() -> Generator[UserRepo, None, None]:
    """
    FastAPI dependency that yields a UserRepo.

    UserRepo itself opens/closes DB connections via db_cursor(),
    so there's nothing special to clean up here.
    """
    repo = UserRepo()
    try:
        yield repo
    finally:
        pass
