"""安全工具测试."""
import pytest

from scale_api.core.security import (
    InvalidTokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)


def test_password_round_trip() -> None:
    h = hash_password("s3cret!")
    assert h != "s3cret!"
    assert verify_password("s3cret!", h)
    assert not verify_password("wrong", h)


def test_access_token_round_trip() -> None:
    token = create_access_token(user_id=1, role="operator")
    payload = decode_token(token)
    assert payload["sub"] == "1"
    assert payload["role"] == "operator"
    assert payload["type"] == "access"


def test_refresh_token_includes_jti() -> None:
    token, jti = create_refresh_token(user_id=1)
    payload = decode_token(token)
    assert payload["sub"] == "1"
    assert payload["type"] == "refresh"
    assert payload["jti"] == str(jti)


def test_decode_invalid_token_raises() -> None:
    with pytest.raises(InvalidTokenError):
        decode_token("not.a.token")


def test_hash_refresh_token_is_deterministic() -> None:
    assert hash_refresh_token("abc") == hash_refresh_token("abc")
    assert hash_refresh_token("abc") != hash_refresh_token("abd")
