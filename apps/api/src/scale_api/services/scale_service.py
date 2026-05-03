"""Scale 服务（CRUD + 协议兼容校验 + probe 审计）."""
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.core.exceptions import NotFoundError, ValidationError
from scale_api.models.scale import Scale
from scale_api.repositories.scale_repo import ScaleRepository
from scale_api.schemas.scale import (
    ScaleCreate,
    ScaleProbeReport,
    ScaleUpdate,
    ScaleValidateResult,
)
from scale_api.services.audit import write_audit


def _validate_protocol_compat(scale: Scale) -> list[str]:
    """根据 protocol_type 校验串口参数兼容性，返回 warnings（错误直接 raise）."""
    warnings: list[str] = []
    if scale.protocol_type == "mettler":
        if scale.stop_bits != 1:
            raise ValidationError("Mettler 协议要求 stop_bits=1")
        if scale.parity not in {"none", "even"}:
            raise ValidationError("Mettler 协议 parity 必须 none 或 even")
    elif scale.protocol_type == "sartorius":
        if scale.data_bits != 7 or scale.parity != "odd":
            raise ValidationError("Sartorius SBI 要求 data_bits=7 且 parity=odd")
    elif scale.protocol_type == "generic":
        warnings.append("使用 generic 协议，未做强制兼容性校验")
    return warnings


class ScaleService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ScaleRepository(session)

    async def list_all(self) -> list[Scale]:
        return await self.repo.list_all()

    async def get(self, scale_id: int) -> Scale:
        s = await self.repo.get(scale_id)
        if s is None:
            raise NotFoundError(f"天平 {scale_id} 不存在")
        return s

    async def create(self, body: ScaleCreate, *, actor_id: int | None) -> Scale:
        s = Scale(**body.model_dump(), created_by=actor_id)
        _validate_protocol_compat(s)
        await self.repo.create(s)
        await write_audit(
            self.session,
            actor_id=actor_id,
            action="create",
            entity="scale",
            entity_id=s.id,
            after={"name": s.name, "protocol_type": s.protocol_type},
        )
        await self.session.commit()
        await self.session.refresh(s)
        return s

    async def update(
        self, scale_id: int, body: ScaleUpdate, *, actor_id: int | None,
    ) -> Scale:
        s = await self.get(scale_id)
        before = {
            "name": s.name,
            "protocol_type": s.protocol_type,
            "baud_rate": s.baud_rate,
        }
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(s, field, value)
        _validate_protocol_compat(s)
        await write_audit(
            self.session,
            actor_id=actor_id,
            action="update",
            entity="scale",
            entity_id=s.id,
            before=before,
            after={
                "name": s.name,
                "protocol_type": s.protocol_type,
                "baud_rate": s.baud_rate,
            },
        )
        await self.session.commit()
        await self.session.refresh(s)
        return s

    async def soft_delete(self, scale_id: int, *, actor_id: int | None) -> None:
        s = await self.get(scale_id)
        s.is_active = False
        await write_audit(
            self.session,
            actor_id=actor_id,
            action="delete",
            entity="scale",
            entity_id=s.id,
        )
        await self.session.commit()

    async def validate_config(self, scale_id: int) -> ScaleValidateResult:
        s = await self.get(scale_id)
        warnings = _validate_protocol_compat(s)
        return ScaleValidateResult(ok=True, warnings=warnings)

    async def record_probe(
        self,
        scale_id: int,
        report: ScaleProbeReport,
        *,
        actor_id: int | None,
    ) -> None:
        s = await self.get(scale_id)
        await write_audit(
            self.session,
            actor_id=actor_id,
            action="scale_probe",
            entity="scale",
            entity_id=s.id,
            after={
                "ok": report.ok,
                "samples_count": report.samples_count,
                "error": report.error,
            },
        )
        await self.session.commit()
