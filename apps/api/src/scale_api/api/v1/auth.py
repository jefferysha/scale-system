"""认证端点。"""
from fastapi import APIRouter, Request, Response

from scale_api.api.deps import CurrentUser, DBSession
from scale_api.repositories.refresh_token_repo import RefreshTokenRepository
from scale_api.schemas.auth import LoginRequest, RefreshRequest, TokenResponse
from scale_api.schemas.user import UserOut
from scale_api.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


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
        # web 端 refresh 走 cookie，不放 body
        response.set_cookie(
            key="__Host-refresh",
            value=out.refresh_token or "",
            httponly=True,
            secure=request.url.scheme == "https",
            samesite="strict",
            path="/api/v1/auth/refresh",
            max_age=60 * 60 * 24 * 7,
        )
        out = out.model_copy(update={"refresh_token": None})
    return out


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest,
    request: Request,
    response: Response,
    session: DBSession,
) -> TokenResponse:
    rt = body.refresh_token or request.cookies.get("__Host-refresh", "")
    client_kind = "desktop" if body.refresh_token else "web"
    svc = AuthService(session)
    out = await svc.refresh(
        rt,
        client_kind=client_kind,
        ua=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )
    if client_kind == "web":
        response.set_cookie(
            key="__Host-refresh",
            value=out.refresh_token or "",
            httponly=True,
            secure=request.url.scheme == "https",
            samesite="strict",
            path="/api/v1/auth/refresh",
            max_age=60 * 60 * 24 * 7,
        )
        out = out.model_copy(update={"refresh_token": None})
    return out


@router.post("/logout")
async def logout(
    response: Response,
    user: CurrentUser,
    session: DBSession,
) -> dict[str, str]:
    await RefreshTokenRepository(session).revoke_all_for_user(user.id)
    await session.commit()
    response.delete_cookie("__Host-refresh", path="/api/v1/auth/refresh")
    return {"status": "logged_out"}


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
