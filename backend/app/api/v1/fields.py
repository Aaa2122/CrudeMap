from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.repositories.field_repo import FieldRepository
from app.schemas.field import FieldOut

router = APIRouter(prefix="/fields", tags=["fields"])


@router.get("", response_model=list[FieldOut])
async def list_fields(
    commodity: str | None = Query(None, description="Filter by commodity (oil/gas)"),
    country: str | None = Query(None, description="Filter by country ISO"),
    session: AsyncSession = Depends(get_session),
):
    repo = FieldRepository(session)
    if country:
        return await repo.list_by_country(country)
    return await repo.list_all(commodity=commodity)


@router.get("/{field_id}", response_model=FieldOut)
async def get_field(field_id: int, session: AsyncSession = Depends(get_session)):
    repo = FieldRepository(session)
    item = await repo.get_by_id(field_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Field {field_id} not found")
    return item
