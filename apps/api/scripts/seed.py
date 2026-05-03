"""开发用 seed 脚本：建一个 admin 用户。

用法：
    cd apps/api
    docker compose -f ../../docker/docker-compose.yml up -d pg
    uv run alembic upgrade head
    uv run python scripts/seed.py

可通过环境变量覆盖默认值：
    SEED_ADMIN_USERNAME=admin
    SEED_ADMIN_PASSWORD=admin123!
    SEED_ADMIN_EMAIL=admin@example.com
"""
from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy.ext.asyncio import async_sessionmaker

from scale_api.core.security import hash_password
from scale_api.db.session import make_engine
from scale_api.models.user import User
from scale_api.repositories.user_repo import UserRepository


async def seed_admin(
    *, username: str, password: str, email: str | None,
) -> tuple[bool, str]:
    """返回 (是否新建, 提示信息)。已存在则跳过且返回 False。"""
    engine = make_engine()
    sm = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with sm() as session:
            repo = UserRepository(session)
            existing = await repo.get_by_username(username)
            if existing is not None:
                return False, f"用户 {username!r} 已存在（id={existing.id}, role={existing.role}），跳过"

            user = User(
                username=username,
                email=email,
                password_hash=hash_password(password),
                role="admin",
                is_active=True,
            )
            await repo.create(user)
            await session.commit()
            await session.refresh(user)
            return True, f"已创建 admin 用户 username={user.username!r} id={user.id}"
    finally:
        await engine.dispose()


def main() -> int:
    username = os.getenv("SEED_ADMIN_USERNAME", "admin")
    password = os.getenv("SEED_ADMIN_PASSWORD", "admin123!")
    email = os.getenv("SEED_ADMIN_EMAIL", "admin@example.com") or None

    if len(password) < 8:
        print("ERROR: SEED_ADMIN_PASSWORD 必须至少 8 字符", file=sys.stderr)
        return 1

    created, msg = asyncio.run(seed_admin(username=username, password=password, email=email))
    print(msg)
    if created:
        print()
        print("登录信息：")
        print(f"  用户名: {username}")
        print(f"  密码:   {password}")
        print(f"  角色:   admin")
        print()
        print("请记得在生产环境改成强密码！")
    return 0


if __name__ == "__main__":
    sys.exit(main())
