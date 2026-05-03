"""配置层测试."""
import pytest

from scale_api.core.config import Settings


def test_settings_loads_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@host/db")
    monkeypatch.setenv("JWT_SECRET", "x" * 32)
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://a.com,http://b.com")
    s = Settings()
    assert s.database_url == "postgresql+asyncpg://u:p@host/db"
    assert s.allowed_origins == ["http://a.com", "http://b.com"]
    assert s.access_token_ttl_minutes == 30  # 默认值


def test_settings_rejects_short_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET", "tooshort")
    monkeypatch.setenv("DATABASE_URL", "x")
    with pytest.raises(ValueError, match="JWT_SECRET"):
        Settings()
