"""FastAPI 应用入口."""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from scale_api.api.v1 import auth as auth_v1
from scale_api.api.v1 import projects as projects_v1
from scale_api.api.v1 import users as users_v1
from scale_api.api.v1 import verticals as verticals_v1
from scale_api.core.config import get_settings
from scale_api.core.exceptions import BusinessError

settings = get_settings()

app = FastAPI(
    title="Scale API",
    version="0.1.0",
    description="天平称重系统后端",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(BusinessError)
async def _biz_handler(_: Request, exc: BusinessError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.http_status,
        content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "scale-api"}


app.include_router(auth_v1.router, prefix="/api/v1")
app.include_router(users_v1.router, prefix="/api/v1")
app.include_router(projects_v1.router, prefix="/api/v1")
app.include_router(verticals_v1.router, prefix="/api/v1")
