from sqlalchemy import select

from app.models.field import OilGasField
from app.repositories.base import BaseRepository


class FieldRepository(BaseRepository):
    async def list_all(self, commodity: str | None = None) -> list[OilGasField]:
        query = select(OilGasField).order_by(OilGasField.production_mt.desc().nulls_last())
        if commodity:
            query = query.where(OilGasField.commodity.in_([commodity, "mixed"]))
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_by_id(self, field_id: int) -> OilGasField | None:
        result = await self.session.execute(
            select(OilGasField).where(OilGasField.id == field_id)
        )
        return result.scalar_one_or_none()

    async def list_by_country(self, iso: str) -> list[OilGasField]:
        result = await self.session.execute(
            select(OilGasField).where(OilGasField.country_iso == iso.upper())
        )
        return result.scalars().all()
