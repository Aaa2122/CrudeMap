from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.repositories.infra_repo import InfraRepository
from app.schemas.infrastructure import InfrastructureOut

router = APIRouter(prefix="/infrastructures", tags=["infrastructures"])


@router.get("", response_model=list[InfrastructureOut])
async def list_infrastructures(
    country: str | None = Query(None, description="Filter by country ISO"),
    type: str | None = Query(None, description="Filter by type (port/terminal/pipeline)"),
    session: AsyncSession = Depends(get_session),
):
    repo = InfraRepository(session)
    if country:
        return await repo.list_by_country(country)
    items = await repo.list_all()
    if type:
        items = [i for i in items if i.type == type]
    return items


@router.get("/{infra_id}", response_model=InfrastructureOut)
async def get_infrastructure(infra_id: int, session: AsyncSession = Depends(get_session)):
    repo = InfraRepository(session)
    item = await repo.get_by_id(infra_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Infrastructure {infra_id} not found")
    return item
