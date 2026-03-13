from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scenario import Scenario
from app.repositories.base import BaseRepository


class ScenarioRepository(BaseRepository):
    async def list_all(self) -> list[Scenario]:
        result = await self.session.execute(select(Scenario))
        return result.scalars().all()

    async def get_by_slug(self, slug: str) -> Scenario | None:
        result = await self.session.execute(
            select(Scenario).where(Scenario.slug == slug.lower())
        )
        return result.scalar_one_or_none()
