"""应用配置（pydantic-settings）."""
from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = Field(..., description="postgresql+asyncpg://...")
    jwt_secret: str = Field(...)
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 30
    refresh_token_ttl_days: int = 7
    # NoDecode：禁用 pydantic-settings 自动 JSON 解析，由 validator 自行拆分逗号
    allowed_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173"],
    )
    app_env: str = "development"
    log_level: str = "INFO"
    # ── 串口接入 ─────────────────────────────────────────────────────────
    # 默认传输 URL，pyserial.serial_for_url 接受：
    #   serial:///dev/ttyUSB0  本地 USB 直读（Linux Docker --device 也用这种）
    #   socket://host:port     Mac/Win Docker 时通过 host socat 桥
    #   tcp://host:port        生产 ser2net 远程网关
    #   loop://                单元测试
    # 不配置时 connect 端点返回 UNCONFIGURED。
    scale_default_transport: str | None = Field(default=None)

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _split_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    @field_validator("jwt_secret")
    @classmethod
    def _check_jwt_secret(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("JWT_SECRET 必须至少 32 字符")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
