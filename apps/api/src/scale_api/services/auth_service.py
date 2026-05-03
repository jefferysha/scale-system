"""认证服务（登录 + refresh 轮换 + reuse 检测）。"""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.core.config import get_settings
from scale_api.core.exceptions import AuthenticationError, InvalidTokenError, TokenReuseError
from scale_api.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_refresh_token,
    verify_password,
)
from scale_api.models.refresh_token import RefreshToken
from scale_api.repositories.refresh_token_repo import RefreshTokenRepository
from scale_api.repositories.user_repo import UserRepository
from scale_api.schemas.auth import TokenResponse
from scale_api.schemas.user import UserOut


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.users = UserRepository(session)
        self.tokens = RefreshTokenRepository(session)

    async def login(
        self,
        *,
        username: str,
        password: str,
        client_kind: str,
        ua: str | None,
        ip: str | None,
    ) -> TokenResponse:
        u = await self.users.get_by_username(username)
        if u is None or not u.is_active or not verify_password(password, u.password_hash):
            raise AuthenticationError("用户名或密码错误")

        return await self._issue(
            user_id=u.id, role=u.role, user=u, client_kind=client_kind, ua=ua, ip=ip,
        )

    async def refresh(
        self,
        refresh_token: str,
        *,
        client_kind: str,
        ua: str | None,
        ip: str | None,
    ) -> TokenResponse:
        try:
            payload = decode_token(refresh_token)
        except InvalidTokenError as e:
            raise AuthenticationError("refresh token 无效") from e
        if payload.get("type") != "refresh":
            raise AuthenticationError("token 类型错误")

        jti = uuid.UUID(payload["jti"])
        db_token = await self.tokens.get_by_jti(jti)
        if db_token is None:
            raise AuthenticationError("refresh token 不存在")

        # reuse 检测：已 revoke 的又被用了
        if db_token.revoked_at is not None:
            await self.tokens.revoke_all_for_user(db_token.user_id)
            await self.session.commit()
            raise TokenReuseError("检测到 refresh token 重放，已吊销该用户所有会话")

        if hash_refresh_token(refresh_token) != db_token.token_hash:
            raise AuthenticationError("token 哈希不匹配")

        u = await self.users.get(db_token.user_id)
        if u is None or not u.is_active:
            raise AuthenticationError("用户不可用")

        # 轮换
        new = await self._issue(
            user_id=u.id, role=u.role, user=u, client_kind=client_kind, ua=ua, ip=ip,
        )
        await self.tokens.revoke(
            db_token,
            rotated_to=uuid.UUID(decode_token(new.refresh_token or "")["jti"]),
        )
        await self.session.commit()
        return new

    async def _issue(
        self,
        *,
        user_id: int,
        role: str,
        user: object,
        client_kind: str,
        ua: str | None,
        ip: str | None,
    ) -> TokenResponse:
        s = get_settings()
        access = create_access_token(user_id=user_id, role=role)
        refresh, jti = create_refresh_token(user_id=user_id)
        rt = RefreshToken(
            jti=jti,
            user_id=user_id,
            token_hash=hash_refresh_token(refresh),
            client_kind=client_kind,
            user_agent=ua,
            ip_address=ip,
            issued_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(days=s.refresh_token_ttl_days),
        )
        await self.tokens.create(rt)
        await self.session.commit()
        return TokenResponse(
            access_token=access,
            expires_in=s.access_token_ttl_minutes * 60,
            user=UserOut.model_validate(user),
            refresh_token=refresh,
        )
