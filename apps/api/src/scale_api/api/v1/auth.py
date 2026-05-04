"""认证端点。"""
from fastapi import APIRouter, Request, Response

from scale_api.api.deps import CurrentUser, DBSession
from scale_api.repositories.refresh_token_repo import RefreshTokenRepository
from scale_api.schemas.auth import LoginRequest, RefreshRequest, TokenResponse
from scale_api.schemas.user import UserOut
from scale_api.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _cookie_settings(is_https: bool) -> tuple[str, str, str, str]:
    """根据请求协议选择 cookie 名/path/samesite。

    HTTPS 下用 ``__Host-`` 前缀（要求 Secure + Path=/）；HTTP 下用普通名 + Lax。

    **Path 必须是请求 URL 的前缀，否则浏览器会拒收**（即 set-cookie 的 path
    比 set-cookie 响应所在 path 还窄会被丢弃）。因此一律用 ``/``。

    Returns:
        (cookie_name, path, samesite, ``"true"|""`` 占位用于日志)
    """
    if is_https:
        return "__Host-refresh", "/", "strict", "secure"
    return "scale_refresh", "/", "lax", "insecure"


def _set_refresh_cookie(response: Response, request: Request, refresh_token: str) -> None:
    is_https = request.url.scheme == "https"
    name, path, samesite, _ = _cookie_settings(is_https)
    response.set_cookie(
        key=name,
        value=refresh_token,
        httponly=True,
        secure=is_https,
        samesite=samesite,  # type: ignore[arg-type]
        path=path,
        max_age=60 * 60 * 24 * 7,
    )


def _read_refresh_cookie(request: Request) -> str:
    """优先读 ``__Host-refresh``（HTTPS）；HTTP 兜底读 ``scale_refresh``。"""
    return request.cookies.get("__Host-refresh") or request.cookies.get("scale_refresh") or ""


def _clear_refresh_cookie(response: Response, request: Request) -> None:
    is_https = request.url.scheme == "https"
    name, path, _, _ = _cookie_settings(is_https)
    response.delete_cookie(name, path=path)
    # 兼容历史 path 也清掉
    response.delete_cookie("__Host-refresh", path="/")
    response.delete_cookie("scale_refresh", path="/")
    response.delete_cookie("scale_refresh", path="/api/v1/auth/refresh")


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    session: DBSession,
) -> TokenResponse:
    svc = AuthService(session)
    out = await svc.login(
        username=body.username,
        password=body.password,
        client_kind=body.client_kind,
        ua=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )
    if body.client_kind == "web":
        # 双写：cookie（HTTPS 部署用，HttpOnly 防 XSS）+ body（HTTP 部署兼容，
        # 避免 chrome fetch+CORS+SameSite=Lax 在 localhost 下不发 cookie 的边缘情况）。
        _set_refresh_cookie(response, request, out.refresh_token or "")
    return out


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest,
    request: Request,
    response: Response,
    session: DBSession,
) -> TokenResponse:
    rt = body.refresh_token or _read_refresh_cookie(request)
    # 显式从 body 读 client_kind；为空时按"有 cookie=web，否则 desktop"兜底。
    client_kind = body.client_kind or ("web" if _read_refresh_cookie(request) else "desktop")
    svc = AuthService(session)
    out = await svc.refresh(
        rt,
        client_kind=client_kind,
        ua=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )
    if client_kind == "web":
        _set_refresh_cookie(response, request, out.refresh_token or "")
        # body 也保留新的 refresh_token，前端用以替换内存中的旧值
    return out


@router.post("/logout")
async def logout(
    response: Response,
    request: Request,
    user: CurrentUser,
    session: DBSession,
) -> dict[str, str]:
    await RefreshTokenRepository(session).revoke_all_for_user(user.id)
    await session.commit()
    _clear_refresh_cookie(response, request)
    return {"status": "logged_out"}


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
