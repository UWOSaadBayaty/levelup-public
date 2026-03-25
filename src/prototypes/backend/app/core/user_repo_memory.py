
from typing import Optional
from .user_repo import UserRepo, UserProfile, UserRole


class InMemoryUserRepo(UserRepo):
    """
    Temporary in-memory 'database' until the real DB is implemented.
    Stores users in a Python dictionary.

    This allows:
    - user creation
    - updating names
    - updating roles
    - retrieving users by Firebase UID

    Without needing any real database engine.
    """

    def __init__(self):
        self.users: dict[str, UserProfile] = {}
        self.next_id = 1

    def get_by_uid(self, firebase_uid: str) -> Optional[UserProfile]:
        return self.users.get(firebase_uid)

    def create_user(self, firebase_uid: str, email: str, name: str | None, role: UserRole) -> UserProfile:
        user = UserProfile(
            id=self.next_id,
            firebase_uid=firebase_uid,
            email=email,
            name=name,
            role=role,
        )
        self.users[firebase_uid] = user
        self.next_id += 1
        return user

    def update_name(self, firebase_uid: str, name: str) -> UserProfile:
        user = self.users[firebase_uid]
        user.name = name
        return user

    def update_role(self, firebase_uid: str, new_role: UserRole) -> UserProfile:
        user = self.users[firebase_uid]
        user.role = new_role
        return user
