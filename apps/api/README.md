# scale-api

FastAPI 后端服务。

## 启动

```bash
uv sync
cp .env.example .env
docker compose -f ../../docker/docker-compose.yml up -d pg
uv run alembic upgrade head
uv run uvicorn scale_api.main:app --reload --port 8000
```

打开 http://localhost:8000/docs 看 OpenAPI。

## 测试

```bash
uv run pytest
```
