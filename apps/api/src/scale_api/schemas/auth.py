"""Auth schemas。"""
from pydantic import BaseModel, Field

from scale_api.schemas.user import UserOut


class LoginRequest(BaseModel):
    username: str
    password: str
    client_kind: str = Field(default="web", pattern="^(web|desktop)$")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
    # refresh_token 仅 desktop 客户端拿到 body；web 通过 set-cookie
    refresh_token: str | None = None


class RefreshRequest(BaseModel):
    """desktop 用 body 发；web 优先 cookie，HTTP 部署兜底走 body。"""

    refresh_token: str | None = None
    csrf_token: str | None = None
    client_kind: str | None = Field(default=None, pattern="^(web|desktop)$")
