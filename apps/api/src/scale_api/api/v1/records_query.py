"""Records 查询路由（占位，Task 2.11 实装）."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_records() -> dict:
    raise NotImplementedError("see Task 2.11")


@router.get("/export")
async def export_records() -> dict:
    raise NotImplementedError("see Task 2.11")


@router.get("/{record_id}")
async def get_record(record_id: int) -> dict:
    raise NotImplementedError("see Task 2.11")
