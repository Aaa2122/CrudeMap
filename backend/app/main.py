from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.countries import router as countries_router
from app.api.v1.flows import router as flows_router
from app.api.v1.chokepoints import router as chokepoints_router
from app.api.v1.infrastructures import router as infrastructures_router
from app.api.v1.scenarios import router as scenarios_router

app = FastAPI(
    title="CrudeMap API",
    description="Petroleum dependency mapping and disruption simulation",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"

app.include_router(countries_router, prefix=API_PREFIX)
app.include_router(flows_router, prefix=API_PREFIX)
app.include_router(chokepoints_router, prefix=API_PREFIX)
app.include_router(infrastructures_router, prefix=API_PREFIX)
app.include_router(scenarios_router, prefix=API_PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
