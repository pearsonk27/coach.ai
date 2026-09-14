"""coach.ai API -- MVP FastAPI wiring (T-30 / T-33).

The design targets PostgreSQL-18 (T-01); this MVP serves content from the authoritative seed and
keeps accounts/sessions/feedback/runs in the in-memory store (T-33). Booting gates on a DB-free
seed check (I1/I2/I4) so the app never serves inconsistent content.
"""

from fastapi import APIRouter, FastAPI

from app.api import content, accounts
from app.seed import check_seed

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health() -> dict:
    rep = check_seed()
    return {
        "status": "ok" if rep.ok else "degraded",
        "seed_ok": rep.ok,
        "templates": rep.template_slugs,
        "errors": rep.errors,
    }


def create_app() -> FastAPI:
    app = FastAPI(
        title="coach.ai API", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json"
    )
    app.include_router(router)
    app.include_router(content.router)
    app.include_router(accounts.router)
    return app


app = create_app()
