# apps/api · 后端规范

> 与 spec `docs/superpowers/specs/2026-05-03-scale-system-fullstack-design.md` §6 / §7 / §8 / §11 强绑定。

## 4 层架构（强制单向依赖）

```
api/v1/*.py  ──▶  services/*.py  ──▶  repositories/*.py  ──▶  models/*.py
                       │
                       └─▶ schemas/*.py（DTO）
```

- **api 层**：FastAPI 路由，仅做 HTTP 入参出参 + 调用 service
- **service 层**：业务逻辑。**禁止 import models**，只通过 repository
- **repository 层**:唯一可以写 SQLAlchemy query 的地方
- **models / schemas 严格分离**：models 是 DB 结构，schemas 是 API 契约

## 强制规则

1. 所有 API 入参出参用 Pydantic schema，**禁止**直接返回 ORM 对象
2. 数据库写操作必须在事务里 + 写 `audit_logs`
3. 异常用 `core/exceptions.py` 中定义的业务异常类，**禁止**裸 `raise HTTPException`
4. 文件 ≤ 500 行（超过拆按 §6.4 的预拆分计划）
5. 数据库变更必须先 `alembic revision --autogenerate`，**禁止**手改表结构
6. 测试覆盖率 ≥ 80%（pytest-cov 强制）
7. 所有公开 API 必须有 OpenAPI tag + summary + 响应示例

## 依赖管理

```bash
uv sync                    # 装依赖
uv add <pkg>               # 加运行时依赖
uv add --dev <pkg>         # 加开发依赖
```

## 常用命令

```bash
uv run uvicorn scale_api.main:app --reload    # 启动开发
uv run pytest                                 # 跑测试
uv run ruff check .                           # lint
uv run ruff format .                          # 格式化
uv run mypy src                               # 类型检查
uv run alembic revision --autogenerate -m "msg"  # 生成迁移
uv run alembic upgrade head                   # 应用迁移
```

## 复杂模块拆分（spec §6.4）

新增/修改下列模块时必须按此拆分，不允许合并：
- `api/v1/records.py` → records_query.py / records_mutation.py / records_batch.py
- `services/record_service.py` → record_validator.py / record_calculator.py / record_batch_processor.py
- `repositories/record_repo.py` → record_query_builder.py
- `api/v1/scales.py` → scales_admin.py（管理员独立）

## 安全

- 密码：bcrypt cost=12
- Access token：30 min，**仅** body 返回，不写 cookie
- Refresh token：7 d，仅哈希入库 + 强制轮换 + reuse 检测
- 见 §11 全章
