from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.repositories.flow_repo import FlowRepository
from app.schemas.flow import FlowOut

router = APIRouter(prefix="/flows", tags=["flows"])


@router.get("", response_model=list[FlowOut])
async def list_flows(
    source: str | None = Query(None, description="Filter by source country ISO"),
    target: str | None = Query(None, description="Filter by target country ISO"),
    commodity: str | None = Query(None, description="Filter by commodity (oil/gas)"),
    session: AsyncSession = Depends(get_session),
):
    repo = FlowRepository(session)
    if source:
        items = await repo.list_by_source(source)
    elif target:
        items = await repo.list_by_target(target)
    elif commodity:
        return await repo.list_by_commodity(commodity)
    else:
        items = await repo.list_all()
    if commodity:
        items = [f for f in items if f.commodity == commodity]
    return items
