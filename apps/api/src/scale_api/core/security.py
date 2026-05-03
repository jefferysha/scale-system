"""密码哈希 + JWT。"""
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from scale_api.core.config import get_settings
from scale_api.core.exceptions import InvalidTokenError

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(plain: str) -> str:
    return _pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_ctx.verify(plain, hashed)


def hash_refresh_token(token: str) -> str:
    """SHA-256 哈希（用于入库，避免存原 token）。"""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(user_id: int, role: str) -> str:
    s = get_settings()
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "iat": int(_now().timestamp()),
        "exp": int((_now() + timedelta(minutes=s.access_token_ttl_minutes)).timestamp()),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def create_refresh_token(user_id: int) -> tuple[str, uuid.UUID]:
    s = get_settings()
    jti = uuid.uuid4()
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "jti": str(jti),
        "iat": int(_now().timestamp()),
        "exp": int((_now() + timedelta(days=s.refresh_token_ttl_days)).timestamp()),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm), jti


def decode_token(token: str) -> dict[str, Any]:
    s = get_settings()
    try:
        return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except JWTError as e:
        raise InvalidTokenError(f"token 无效: {e}") from e
