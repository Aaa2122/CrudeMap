from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.flow import CountryFlow
from app.repositories.base import BaseRepository


class FlowRepository(BaseRepository):
    async def list_all(self) -> list[CountryFlow]:
        result = await self.session.execute(select(CountryFlow))
        return result.scalars().all()

    async def list_by_commodity(self, commodity: str) -> list[CountryFlow]:
        result = await self.session.execute(
            select(CountryFlow).where(CountryFlow.commodity == commodity)
        )
        return result.scalars().all()

    async def list_by_source(self, source_iso: str) -> list[CountryFlow]:
        result = await self.session.execute(
            select(CountryFlow).where(CountryFlow.source_iso == source_iso.upper())
        )
        return result.scalars().all()

    async def list_by_target(self, target_iso: str) -> list[CountryFlow]:
        result = await self.session.execute(
            select(CountryFlow).where(CountryFlow.target_iso == target_iso.upper())
        )
        return result.scalars().all()

    async def list_by_country(self, iso: str) -> list[CountryFlow]:
        iso = iso.upper()
        result = await self.session.execute(
            select(CountryFlow).where(
                (CountryFlow.source_iso == iso) | (CountryFlow.target_iso == iso)
            )
        )
        return result.scalars().all()
