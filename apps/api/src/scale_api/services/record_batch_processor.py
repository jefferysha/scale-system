"""批量记录同步：每条独立处理 + client_uid 去重."""
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.core.exceptions import ValidationError
from scale_api.repositories.record_repo import RecordRepository
from scale_api.schemas.record import BatchItemResult, RecordCreate
from scale_api.services.record_service import RecordService


async def process_batch(
    session: AsyncSession,
    batch: list[RecordCreate],
    *,
    operator_id: int | None,
    source: str,
) -> list[BatchItemResult]:
    """逐条处理，结果列表 1:1 对应。"""
    repo = RecordRepository(session)
    service = RecordService(session)
    results: list[BatchItemResult] = []
    for item in batch:
        try:
            existing = await repo.get_by_client_uid(item.client_uid)
            if existing:
                results.append(
                    BatchItemResult(
                        client_uid=item.client_uid,
                        status="duplicate",
                        id=existing.id,
                    ),
                )
                continue
            r = await service.create(
                item, operator_id=operator_id, source=source, commit=False,
            )
            await session.flush()
            results.append(
                BatchItemResult(
                    client_uid=item.client_uid, status="created", id=r.id,
                ),
            )
        except ValidationError as e:
            await session.rollback()
            results.append(
                BatchItemResult(
                    client_uid=item.client_uid, status="invalid", error=str(e),
                ),
            )
    await session.commit()
    return results
