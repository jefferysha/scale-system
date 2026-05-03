"""Scales API."""
from fastapi import APIRouter, status

from scale_api.api.deps import AdminUser, CurrentUser, DBSession
from scale_api.schemas.scale import (
    ScaleCreate,
    ScaleOut,
    ScaleProbeAck,
    ScaleProbeReport,
    ScaleUpdate,
    ScaleValidateResult,
)
from scale_api.services.scale_service import ScaleService

router = APIRouter(prefix="/scales", tags=["scales"])


@router.get("", response_model=list[ScaleOut])
async def list_scales(_: CurrentUser, session: DBSession) -> list[ScaleOut]:
    items = await ScaleService(session).list_all()
    return [ScaleOut.model_validate(s) for s in items]


@router.get("/{scale_id}", response_model=ScaleOut)
async def get_scale(
    scale_id: int, _: CurrentUser, session: DBSession,
) -> ScaleOut:
    s = await ScaleService(session).get(scale_id)
    return ScaleOut.model_validate(s)


@router.post("", response_model=ScaleOut, status_code=status.HTTP_201_CREATED)
async def create_scale(
    body: ScaleCreate, user: AdminUser, session: DBSession,
) -> ScaleOut:
    s = await ScaleService(session).create(body, actor_id=user.id)
    return ScaleOut.model_validate(s)


@router.put("/{scale_id}", response_model=ScaleOut)
async def update_scale(
    scale_id: int,
    body: ScaleUpdate,
    user: AdminUser,
    session: DBSession,
) -> ScaleOut:
    s = await ScaleService(session).update(scale_id, body, actor_id=user.id)
    return ScaleOut.model_validate(s)


@router.delete("/{scale_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scale(
    scale_id: int, user: AdminUser, session: DBSession,
) -> None:
    await ScaleService(session).soft_delete(scale_id, actor_id=user.id)


@router.post("/{scale_id}/validate", response_model=ScaleValidateResult)
async def validate_scale_config(
    scale_id: int, _: AdminUser, session: DBSession,
) -> ScaleValidateResult:
    return await ScaleService(session).validate_config(scale_id)


@router.post("/{scale_id}/probe-result", response_model=ScaleProbeAck)
async def post_probe_result(
    scale_id: int,
    body: ScaleProbeReport,
    user: CurrentUser,
    session: DBSession,
) -> ScaleProbeAck:
    await ScaleService(session).record_probe(scale_id, body, actor_id=user.id)
    return ScaleProbeAck(recorded=True)
