"""Records 批量同步路由（占位，Task 2.11 实装）."""
from fastapi import APIRouter

router = APIRouter()


@router.post("/batch")
async def batch_records() -> dict:
    raise NotImplementedError("see Task 2.11")
