"""Cup 服务（CRUD + 率定历史 + 软删）."""
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.core.exceptions import ConflictError, NotFoundError
from scale_api.models.cup import Cup
from scale_api.models.cup_calibration import CupCalibration
from scale_api.repositories.cup_repo import CupRepository
from scale_api.schemas.common import OffsetPage
from scale_api.schemas.cup import CupCalibrationCreate, CupCreate, CupUpdate
from scale_api.services.audit import write_audit
from scale_api.services.pagination import offset_paginate


class CupService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = CupRepository(session)

    async def list_paged(
        self,
        *,
        q: str | None,
        is_active: bool | None,
        page: int,
        size: int,
    ) -> OffsetPage[Any]:
        stmt = self.repo.list_query(q=q, is_active=is_active)
        return await offset_paginate(self.session, stmt, page=page, size=size)

    async def get(self, cup_id: int) -> Cup:
        c = await self.repo.get(cup_id)
        if c is None:
            raise NotFoundError(f"杯 {cup_id} 不存在")
        return c

    async def create(self, body: CupCreate, *, actor_id: int | None) -> Cup:
        if await self.repo.get_by_number(body.cup_number):
            raise ConflictError(f"杯号 {body.cup_number} 已存在")
        c = Cup(
            cup_number=body.cup_number,
            current_tare_g=body.current_tare_g,
            is_active=body.is_active,
            notes=body.notes,
        )
        await self.repo.create(c)
        await write_audit(
            self.session,
            actor_id=actor_id,
            action="create",
            entity="cup",
            entity_id=c.id,
            after={"cup_number": c.cup_number, "current_tare_g": str(c.current_tare_g)},
        )
        await self.session.commit()
        await self.session.refresh(c)
        return c

    async def update(
        self, cup_id: int, body: CupUpdate, *, actor_id: int | None,
    ) -> Cup:
        c = await self.get(cup_id)
        before = {"cup_number": c.cup_number, "is_active": c.is_active, "notes": c.notes}
        if body.cup_number is not None and body.cup_number != c.cup_number:
            existing = await self.repo.get_by_number(body.cup_number)
            if existing and existing.id != c.id:
                raise ConflictError(f"杯号 {body.cup_number} 已存在")
            c.cup_number = body.cup_number
        if body.notes is not None:
            c.notes = body.notes
        if body.is_active is not None:
            c.is_active = body.is_active
        await write_audit(
            self.session,
            actor_id=actor_id,
            action="update",
            entity="cup",
            entity_id=c.id,
            before=before,
            after={
                "cup_number": c.cup_number,
                "is_active": c.is_active,
                "notes": c.notes,
            },
        )
        await self.session.commit()
        await self.session.refresh(c)
        return c

    async def soft_delete(self, cup_id: int, *, actor_id: int | None) -> None:
        c = await self.get(cup_id)
        c.is_active = False
        await write_audit(
            self.session,
            actor_id=actor_id,
            action="delete",
            entity="cup",
            entity_id=c.id,
        )
        await self.session.commit()

    async def calibrate(
        self,
        cup_id: int,
        body: CupCalibrationCreate,
        *,
        actor_id: int | None,
    ) -> CupCalibration:
        c = await self.get(cup_id)
        cal = CupCalibration(
            cup_id=c.id,
            tare_g=body.tare_g,
            method=body.method,
            notes=body.notes,
            calibrated_by=actor_id,
        )
        self.session.add(cal)
        await self.session.flush()
        c.current_tare_g = body.tare_g
        c.latest_calibration_date = datetime.now(UTC).date()
        await write_audit(
            self.session,
            actor_id=actor_id,
            action="calibrate",
            entity="cup",
            entity_id=c.id,
            after={"tare_g": str(body.tare_g), "method": body.method},
        )
        await self.session.commit()
        await self.session.refresh(cal)
        return cal

    async def list_calibrations(self, cup_id: int) -> list[CupCalibration]:
        await self.get(cup_id)
        return await self.repo.list_calibrations(cup_id)
