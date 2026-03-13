from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.repositories.chokepoint_repo import ChokepointRepository
from app.repositories.country_repo import CountryRepository
from app.repositories.flow_repo import FlowRepository
from app.schemas.chokepoint import ChokepointBrief, ChokepointDetail, ExposedCountry
from scoring.formulas import route_concentration

router = APIRouter(prefix="/chokepoints", tags=["chokepoints"])


@router.get("", response_model=list[ChokepointBrief])
async def list_chokepoints(session: AsyncSession = Depends(get_session)):
    repo = ChokepointRepository(session)
    return await repo.list_all()


@router.get("/{slug}", response_model=ChokepointDetail)
async def get_chokepoint(slug: str, session: AsyncSession = Depends(get_session)):
    choke_repo = ChokepointRepository(session)
    chokepoint = await choke_repo.get_by_slug(slug)
    if not chokepoint:
        raise HTTPException(status_code=404, detail=f"Chokepoint '{slug}' not found")

    # Compute exposed countries
    flow_repo = FlowRepository(session)
    country_repo = CountryRepository(session)
    all_flows = await flow_repo.list_all()
    all_countries = await country_repo.list_all()

    flows_list = [
        {"source_iso": f.source_iso, "target_iso": f.target_iso,
         "volume_mt": f.volume_mt, "via_chokepoints": f.via_chokepoints or []}
        for f in all_flows
    ]
    countries_by_iso = {c.iso: c for c in all_countries}

    exposed = []
    for country in all_countries:
        if (country.import_oil_mt or 0) == 0:
            continue
        exposure = route_concentration(flows_list, country.iso, slug)
        if exposure > 0:
            total_import = sum(
                f["volume_mt"] for f in flows_list if f["target_iso"] == country.iso
            )
            exposed.append(ExposedCountry(
                iso=country.iso,
                name=country.name,
                exposure=round(exposure, 4),
                import_volume_mt=round(total_import * exposure, 1),
            ))

    exposed.sort(key=lambda x: x.exposure, reverse=True)

    return ChokepointDetail(
        slug=chokepoint.slug,
        name=chokepoint.name,
        lat=chokepoint.lat,
        lon=chokepoint.lon,
        oil_transit_mbd=chokepoint.oil_transit_mbd,
        pct_world_trade=chokepoint.pct_world_trade,
        risk_level=chokepoint.risk_level,
        source=chokepoint.source,
        source_year=chokepoint.source_year,
        exposed_countries=exposed,
    )
