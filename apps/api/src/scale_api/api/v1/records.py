"""Records 路由聚合（按 §6.4 拆 4 文件）."""
from fastapi import APIRouter

from scale_api.api.v1 import records_batch, records_mutation, records_query

router = APIRouter(prefix="/records", tags=["records"])
router.include_router(records_query.router)
router.include_router(records_mutation.router)
router.include_router(records_batch.router)
