from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.infrastructure import Infrastructure
from app.repositories.base import BaseRepository


class InfraRepository(BaseRepository):
    async def list_all(self) -> list[Infrastructure]:
        result = await self.session.execute(
            select(Infrastructure).order_by(Infrastructure.criticality_score.desc())
        )
        return result.scalars().all()

    async def get_by_id(self, infra_id: int) -> Infrastructure | None:
        result = await self.session.execute(
            select(Infrastructure).where(Infrastructure.id == infra_id)
        )
        return result.scalar_one_or_none()

    async def list_by_country(self, iso: str) -> list[Infrastructure]:
        result = await self.session.execute(
            select(Infrastructure).where(Infrastructure.country_iso == iso.upper())
        )
        return result.scalars().all()
