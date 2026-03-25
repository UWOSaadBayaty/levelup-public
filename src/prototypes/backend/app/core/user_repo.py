from typing import Optional

from app.core.db import db_cursor
from app.models.user_profile import UserProfile, UserRole


class UserRepo:
    DUMMY_PASSWORD_HASH = "firebase-auth-only"

    _SELECT_COLS = (
        "id, username, password_hash, firebase_id, email, role, "
        "resume_id, cover_letter_id, tier"
    )

    def _row_to_profile(self, row) -> UserProfile:
        (
            id_,
            username,
            password_hash,
            firebase_id,
            email,
            role_str,
            resume_id,
            cover_letter_id,
            tier,
        ) = row

        return UserProfile(
            id=id_,
            firebase_uid=firebase_id,
            email=email,
            name=username,
            role=UserRole(role_str),
            tier=tier or "free",
        )

    def get_by_uid(self, firebase_uid: str) -> Optional[UserProfile]:
        with db_cursor() as cur:
            cur.execute(
                f"SELECT {self._SELECT_COLS} FROM users WHERE firebase_id = %s",
                (firebase_uid,),
            )
            row = cur.fetchone()
            return None if not row else self._row_to_profile(row)

    def create_user(
        self,
        firebase_uid: str,
        email: str,
        name: Optional[str],
        role: UserRole,
    ) -> UserProfile:
        username = name or email or firebase_uid

        with db_cursor() as cur:
            cur.execute(
                f"""
                INSERT INTO users (username, password_hash, firebase_id, email, role)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (email)
                DO UPDATE SET firebase_id = EXCLUDED.firebase_id
                RETURNING {self._SELECT_COLS}
                """,
                (username, self.DUMMY_PASSWORD_HASH, firebase_uid, email, role.value),
            )
            return self._row_to_profile(cur.fetchone())

    def update_name(self, firebase_uid: str, new_name: str) -> UserProfile:
        with db_cursor() as cur:
            cur.execute(
                f"""
                UPDATE users
                SET username = %s
                WHERE firebase_id = %s
                RETURNING {self._SELECT_COLS}
                """,
                (new_name, firebase_uid),
            )
            row = cur.fetchone()
            if not row:
                raise ValueError("User not found")
            return self._row_to_profile(row)

    def update_tier(self, firebase_uid: str, tier: str,
                    stripe_customer_id: Optional[str] = None,
                    stripe_subscription_id: Optional[str] = None,
                    subscription_status: str = "active") -> Optional[UserProfile]:
        with db_cursor() as cur:
            cur.execute(
                f"""
                UPDATE users
                SET tier = %s,
                    stripe_customer_id = COALESCE(%s, stripe_customer_id),
                    stripe_subscription_id = COALESCE(%s, stripe_subscription_id),
                    subscription_status = %s,
                    paid_at = CASE WHEN %s != 'free' THEN NOW() ELSE paid_at END
                WHERE firebase_id = %s
                RETURNING {self._SELECT_COLS}
                """,
                (tier, stripe_customer_id, stripe_subscription_id,
                 subscription_status, tier, firebase_uid),
            )
            row = cur.fetchone()
            return None if not row else self._row_to_profile(row)

    def get_by_stripe_customer_id(self, stripe_customer_id: str) -> Optional[UserProfile]:
        with db_cursor() as cur:
            cur.execute(
                f"SELECT {self._SELECT_COLS} FROM users WHERE stripe_customer_id = %s",
                (stripe_customer_id,),
            )
            row = cur.fetchone()
            return None if not row else self._row_to_profile(row)

    def delete_by_uid(self, firebase_uid: str) -> bool:
        with db_cursor() as cur:
            cur.execute(
                "DELETE FROM users WHERE firebase_id = %s RETURNING id",
                (firebase_uid,),
            )
            return cur.fetchone() is not None
