"""AuthService 测试（含 refresh 轮换 + reuse 检测）。"""
import pytest
import pytest_asyncio

from scale_api.core.exceptions import AuthenticationError, TokenReuseError
from scale_api.core.security import hash_password
from scale_api.models.user import User
from scale_api.services.auth_service import AuthService


@pytest_asyncio.fixture
async def alice(session) -> User:
    u = User(username="alice_auth", password_hash=hash_password("s3cret!"), role="operator")
    session.add(u)
    await session.commit()
    await session.refresh(u)
    return u


@pytest.mark.asyncio
async def test_login_returns_tokens(session, alice) -> None:
    svc = AuthService(session)
    out = await svc.login(
        username="alice_auth", password="s3cret!", client_kind="web", ua=None, ip=None,
    )
    assert out.access_token
    assert out.refresh_token
    assert out.user.username == "alice_auth"


@pytest.mark.asyncio
async def test_login_wrong_password_raises(session, alice) -> None:
    svc = AuthService(session)
    with pytest.raises(AuthenticationError):
        await svc.login(
            username="alice_auth", password="wrong", client_kind="web", ua=None, ip=None,
        )


@pytest.mark.asyncio
async def test_refresh_rotates_token(session, alice) -> None:
    svc = AuthService(session)
    out1 = await svc.login(
        username="alice_auth", password="s3cret!", client_kind="web", ua=None, ip=None,
    )
    out2 = await svc.refresh(out1.refresh_token or "", client_kind="web", ua=None, ip=None)
    assert out2.refresh_token != out1.refresh_token


@pytest.mark.asyncio
async def test_refresh_reuse_revokes_all(session, alice) -> None:
    svc = AuthService(session)
    out1 = await svc.login(
        username="alice_auth", password="s3cret!", client_kind="web", ua=None, ip=None,
    )
    await svc.refresh(out1.refresh_token or "", client_kind="web", ua=None, ip=None)
    # 用旧 refresh token 再换 → 触发 reuse
    with pytest.raises(TokenReuseError):
        await svc.refresh(out1.refresh_token or "", client_kind="web", ua=None, ip=None)
