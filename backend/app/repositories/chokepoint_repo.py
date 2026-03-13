from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chokepoint import Chokepoint
from app.repositories.base import BaseRepository


class ChokepointRepository(BaseRepository):
    async def list_all(self) -> list[Chokepoint]:
        result = await self.session.execute(
            select(Chokepoint).order_by(Chokepoint.oil_transit_mbd.desc())
        )
        return result.scalars().all()

    async def get_by_slug(self, slug: str) -> Chokepoint | None:
        result = await self.session.execute(
            select(Chokepoint).where(Chokepoint.slug == slug.lower())
        )
        return result.scalar_one_or_none()
