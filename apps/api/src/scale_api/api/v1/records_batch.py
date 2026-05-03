"""Records 批量同步路由（POST /batch）."""
from fastapi import APIRouter

from scale_api.api.deps import CurrentUser, DBSession
from scale_api.schemas.record import BatchRequest, BatchResponse
from scale_api.services.record_batch_processor import process_batch

router = APIRouter()


@router.post("/batch", response_model=BatchResponse)
async def batch_records(
    body: BatchRequest,
    user: CurrentUser,
    session: DBSession,
) -> BatchResponse:
    """批量同步：双端共用入口。每条独立处理。"""
    results = await process_batch(
        session, body.records, operator_id=user.id, source="batch",
    )
    return BatchResponse(results=results)
