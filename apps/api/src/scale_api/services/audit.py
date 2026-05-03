"""审计日志写入 helper（service 层使用）."""
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.models.audit_log import AuditLog


async def write_audit(
    session: AsyncSession,
    *,
    actor_id: int | None,
    action: str,
    entity: str,
    entity_id: int | None = None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
) -> None:
    """落 audit_logs 一行（不 commit，由调用方控制事务）."""
    log = AuditLog(
        actor_id=actor_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        before=before,
        after=after,
    )
    session.add(log)
    await session.flush()
