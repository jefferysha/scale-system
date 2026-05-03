"""Records 修改路由（create / update / delete）."""
from fastapi import APIRouter, status

from scale_api.api.deps import AdminUser, CurrentUser, DBSession
from scale_api.schemas.record import RecordCreate, RecordOut, RecordUpdate
from scale_api.services.record_service import RecordService

router = APIRouter()


@router.post("/", response_model=RecordOut, status_code=status.HTTP_201_CREATED)
async def create_record(
    body: RecordCreate, user: CurrentUser, session: DBSession,
) -> RecordOut:
    """单条录入。重复 client_uid 返回原记录（200/201 由现状决定）."""
    r = await RecordService(session).create(
        body, operator_id=user.id, source="web",
    )
    return RecordOut.model_validate(r)


@router.put("/{record_id}", response_model=RecordOut)
async def update_record(
    record_id: int,
    body: RecordUpdate,
    user: AdminUser,
    session: DBSession,
) -> RecordOut:
    r = await RecordService(session).update(record_id, body, actor_id=user.id)
    return RecordOut.model_validate(r)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_record(
    record_id: int, user: AdminUser, session: DBSession,
) -> None:
    await RecordService(session).delete(record_id, actor_id=user.id)
