from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.country import Country
from app.repositories.base import BaseRepository


class CountryRepository(BaseRepository):
    async def list_all(self) -> list[Country]:
        result = await self.session.execute(select(Country).order_by(Country.importance_score.desc()))
        return result.scalars().all()

    async def get_by_iso(self, iso: str) -> Country | None:
        result = await self.session.execute(select(Country).where(Country.iso == iso.upper()))
        return result.scalar_one_or_none()
