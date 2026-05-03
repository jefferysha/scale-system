"""Cups API."""
from fastapi import APIRouter, Query, status

from scale_api.api.deps import AdminUser, CurrentUser, DBSession
from scale_api.schemas.common import OffsetPage
from scale_api.schemas.cup import (
    CupCalibrationCreate,
    CupCalibrationOut,
    CupCreate,
    CupOut,
    CupUpdate,
)
from scale_api.services.cup_service import CupService

router = APIRouter(prefix="/cups", tags=["cups"])


@router.get("", response_model=OffsetPage[CupOut])
async def list_cups(
    _: CurrentUser,
    session: DBSession,
    q: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> OffsetPage[CupOut]:
    p = await CupService(session).list_paged(q=q, is_active=is_active, page=page, size=size)
    return OffsetPage(
        items=[CupOut.model_validate(c) for c in p.items],
        total=p.total,
        page=p.page,
        size=p.size,
    )


@router.get("/{cup_id}", response_model=CupOut)
async def get_cup(cup_id: int, _: CurrentUser, session: DBSession) -> CupOut:
    c = await CupService(session).get(cup_id)
    return CupOut.model_validate(c)


@router.post("", response_model=CupOut, status_code=status.HTTP_201_CREATED)
async def create_cup(
    body: CupCreate, user: AdminUser, session: DBSession,
) -> CupOut:
    c = await CupService(session).create(body, actor_id=user.id)
    return CupOut.model_validate(c)


@router.put("/{cup_id}", response_model=CupOut)
async def update_cup(
    cup_id: int, body: CupUpdate, user: AdminUser, session: DBSession,
) -> CupOut:
    c = await CupService(session).update(cup_id, body, actor_id=user.id)
    return CupOut.model_validate(c)


@router.delete("/{cup_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cup(cup_id: int, user: AdminUser, session: DBSession) -> None:
    await CupService(session).soft_delete(cup_id, actor_id=user.id)


@router.post(
    "/{cup_id}/calibrate",
    response_model=CupCalibrationOut,
    status_code=status.HTTP_201_CREATED,
)
async def calibrate_cup(
    cup_id: int,
    body: CupCalibrationCreate,
    user: AdminUser,
    session: DBSession,
) -> CupCalibrationOut:
    cal = await CupService(session).calibrate(cup_id, body, actor_id=user.id)
    return CupCalibrationOut.model_validate(cal)


@router.get("/{cup_id}/calibrations", response_model=list[CupCalibrationOut])
async def list_calibrations(
    cup_id: int, _: CurrentUser, session: DBSession,
) -> list[CupCalibrationOut]:
    items = await CupService(session).list_calibrations(cup_id)
    return [CupCalibrationOut.model_validate(c) for c in items]
