import json
import os
from typing import Any, Dict

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

_firebase_app = None


def init_firebase() -> None:
    global _firebase_app
    if _firebase_app is not None:
        return

    # First try GOOGLE_APPLICATION_CREDENTIALS (path to JSON file)
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if cred_path and os.path.isfile(cred_path):
        cred = credentials.Certificate(cred_path)
    else:
        # Fall back to FIREBASE_SERVICE_ACCOUNT_JSON env var (inline JSON string)
        cred_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        if not cred_json:
            raise RuntimeError(
                "Firebase credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS "
                "(path to JSON file) or FIREBASE_SERVICE_ACCOUNT_JSON (JSON string)."
            )
        cred = credentials.Certificate(json.loads(cred_json))

    _firebase_app = firebase_admin.initialize_app(cred)


def verify_id_token(id_token: str) -> Dict[str, Any]:
    if _firebase_app is None:
        init_firebase()
    return firebase_auth.verify_id_token(id_token)
