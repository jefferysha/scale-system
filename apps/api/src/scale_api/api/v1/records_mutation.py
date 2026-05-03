"""Records 修改路由（占位，Task 2.11 实装）."""
from fastapi import APIRouter

router = APIRouter()


@router.post("/")
async def create_record() -> dict:
    raise NotImplementedError("see Task 2.11")


@router.put("/{record_id}")
async def update_record(record_id: int) -> dict:
    raise NotImplementedError("see Task 2.11")


@router.delete("/{record_id}")
async def delete_record(record_id: int) -> dict:
    raise NotImplementedError("see Task 2.11")
