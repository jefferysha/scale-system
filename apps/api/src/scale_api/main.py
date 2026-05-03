"""FastAPI 应用入口."""
from fastapi import FastAPI

app = FastAPI(
    title="Scale API",
    version="0.1.0",
    description="天平称重系统后端",
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "scale-api"}
