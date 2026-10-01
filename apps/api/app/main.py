"""coach.ai API -- MVP FastAPI wiring (T-30 / T-33).

The design targets PostgreSQL-18 (T-01); this MVP serves content from the authoritative seed and
keeps accounts/sessions/feedback/runs in the in-memory store (T-33). Booting gates on a DB-free
seed check (I1/I2/I4) so the app never serves inconsistent content.
"""

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import content, accounts, music
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
    # The web app (apps/web, e.g. http://localhost:3000) is a different origin from this API (8000),
    # so the browser blocks its fetches (GET /content, POST /runs) unless CORS answers. The MVP surface
    # is auth-free public content + an in-memory store, so we allow the dev web origins. (allow_*_origin
    # is "*" because the API carries no credentials; the future light-account path narrows this.)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://100.85.211.98:3000",
        ],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["content-type", "authorization"],
    )
    app.include_router(router)
    app.include_router(content.router)
    app.include_router(accounts.router)
    app.include_router(music.router)
    return app


app = create_app()
