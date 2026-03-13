from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.repositories.country_repo import CountryRepository
from app.repositories.flow_repo import FlowRepository
from app.repositories.infra_repo import InfraRepository
from app.schemas.country import CountryBrief, CountryDetail
from app.schemas.flow import FlowOut
from app.schemas.infrastructure import InfrastructureOut
from scoring.formulas import route_concentration

router = APIRouter(prefix="/countries", tags=["countries"])

CHOKEPOINT_SLUGS = [
    "hormuz", "malacca", "suez", "sumed",
    "bab_el_mandeb", "turkish_straits", "panama",
]


@router.get("", response_model=list[CountryBrief])
async def list_countries(session: AsyncSession = Depends(get_session)):
    repo = CountryRepository(session)
    return await repo.list_all()


@router.get("/{iso}", response_model=CountryDetail)
async def get_country(iso: str, session: AsyncSession = Depends(get_session)):
    repo = CountryRepository(session)
    country = await repo.get_by_iso(iso)
    if not country:
        raise HTTPException(status_code=404, detail=f"Country {iso} not found")
    return country


@router.get("/{iso}/flows", response_model=list[FlowOut])
async def get_country_flows(iso: str, session: AsyncSession = Depends(get_session)):
    repo = FlowRepository(session)
    flows = await repo.list_by_country(iso)
    return flows


@router.get("/{iso}/infrastructures", response_model=list[InfrastructureOut])
async def get_country_infrastructures(iso: str, session: AsyncSession = Depends(get_session)):
    repo = InfraRepository(session)
    return await repo.list_by_country(iso)


@router.get("/{iso}/chokepoint-exposure")
async def get_chokepoint_exposure(iso: str, session: AsyncSession = Depends(get_session)):
    """Returns exposure (0-1) per chokepoint for the given importer country."""
    flow_repo = FlowRepository(session)
    flows = await flow_repo.list_by_target(iso.upper())
    flows_list = [
        {"source_iso": f.source_iso, "target_iso": f.target_iso,
         "volume_mt": f.volume_mt, "via_chokepoints": f.via_chokepoints or []}
        for f in flows
    ]
    return {
        slug: round(route_concentration(flows_list, iso.upper(), slug), 4)
        for slug in CHOKEPOINT_SLUGS
    }
