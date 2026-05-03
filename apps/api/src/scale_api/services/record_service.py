"""Record 门面服务（CRUD + 计算 + 幂等）."""
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.core.exceptions import NotFoundError, ValidationError
from scale_api.models.record import WeighingRecord
from scale_api.repositories.record_repo import RecordRepository
from scale_api.schemas.record import RecordCreate, RecordUpdate
from scale_api.services.audit import write_audit
from scale_api.services.record_calculator import compute_avg, compute_concentration_mg_l
from scale_api.services.record_validator import validate_points


def _build_enriched_points(
    raw_points: list[dict[str, Any]], volume_ml: Any,
) -> tuple[list[dict[str, Any]], Any]:
    """校验 points + 给每点算 concentration + 算平均值。返回 (enriched, avg)."""
    validated = validate_points(raw_points)
    enriched: list[dict[str, Any]] = []
    concs = []
    for p in validated:
        conc = compute_concentration_mg_l(p.wet_weight_g, p.cup_tare_g, volume_ml)
        enriched.append({**p.model_dump(mode="json"), "concentration_mg_l": str(conc)})
        concs.append(conc)
    return enriched, compute_avg(concs)


class RecordService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = RecordRepository(session)

    async def create(
        self,
        body: RecordCreate,
        *,
        operator_id: int | None,
        source: str,
        commit: bool = True,
    ) -> WeighingRecord:
        if body.volume_ml is None or body.volume_ml <= 0:
            raise ValidationError("volume_ml 必须 > 0")

        # client_uid 幂等：单条 POST 重复返回原记录
        existing = await self.repo.get_by_client_uid(body.client_uid)
        if existing:
            return existing

        enriched, avg = _build_enriched_points(
            [p.model_dump(mode="json") for p in body.points], body.volume_ml,
        )

        r = WeighingRecord(
            client_uid=body.client_uid,
            project_id=body.project_id,
            vertical_id=body.vertical_id,
            tide_type=body.tide_type,
            sample_date=body.sample_date,
            water_depth_m=body.water_depth_m,
            start_time=body.start_time,
            end_time=body.end_time,
            volume_ml=body.volume_ml,
            points=enriched,
            computed_avg_concentration=avg,
            notes=body.notes,
            operator_id=operator_id,
            source=source,
        )
        await self.repo.create(r)
        if commit:
            await self.session.commit()
            await self.session.refresh(r)
        return r

    async def update(
        self,
        record_id: int,
        body: RecordUpdate,
        *,
        actor_id: int | None,
    ) -> WeighingRecord:
        r = await self.repo.get(record_id)
        if r is None:
            raise NotFoundError(f"记录 {record_id} 不存在")
        before = {"notes": r.notes, "tide_type": r.tide_type}
        if body.notes is not None:
            r.notes = body.notes
        if body.tide_type is not None:
            r.tide_type = body.tide_type
        await write_audit(
            self.session,
            actor_id=actor_id,
            action="update",
            entity="record",
            entity_id=r.id,
            before=before,
            after={"notes": r.notes, "tide_type": r.tide_type},
        )
        await self.session.commit()
        await self.session.refresh(r)
        return r

    async def delete(self, record_id: int, *, actor_id: int | None) -> None:
        r = await self.repo.get(record_id)
        if r is None:
            raise NotFoundError(f"记录 {record_id} 不存在")
        await write_audit(
            self.session,
            actor_id=actor_id,
            action="delete",
            entity="record",
            entity_id=r.id,
        )
        await self.session.delete(r)
        await self.session.commit()
