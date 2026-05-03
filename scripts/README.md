# scripts

## seed-from-excel.py

把 `称重数据库.xlsx` 的 4 个 sheet（项目库 / 杯库 / S徐六泾断面200712 / S浙江201611）一次性导入 PG，作为 mock 初始数据。**幂等可重跑**。

### 用法

```bash
# 1. 起 PG（端口 5433）
docker compose -f docker/docker-compose.yml up -d pg

# 2. 升级业务表 schema
cd apps/api && uv run alembic upgrade head

# 3. dry-run 看数量
APP_ENV=test uv run python ../../scripts/seed-from-excel.py \
  --excel /Users/jiayin/Downloads/称重数据库.xlsx \
  --dry-run

# 4. 真跑
APP_ENV=test uv run python ../../scripts/seed-from-excel.py \
  --excel /Users/jiayin/Downloads/称重数据库.xlsx
```

> 设 `APP_ENV=test` 是为了关掉 SQLAlchemy 的 SQL echo 噪音；不设也能跑。

### 幂等机制

| 表 | 幂等 key |
|---|---|
| `projects` | `name` UNIQUE |
| `cups` | `cup_number` UNIQUE |
| `weighing_records` | `client_uid` UNIQUE，由 `uuid5(NAMESPACE_URL, "scale://import/{project_id}/{vertical_id}/{date}/{start_time}")` 稳定生成 |

重复跑同一份 Excel：成功数字完全一致，DB 行数不变。

### Excel 字段实测

- **项目库**：表头第 1 列实为 `None`（无"序号"标题），数据列为 `(序号, 项目, 建立日期, 备注)`。
- **杯库**：列名 `(杯号, 当前杯重, 最新率定日期杯重, 上次杯重, 上次率定日期)`，但"最新率定日期杯重" 列实际只存日期。"上次率定日期"在实测数据中全部为空 → 无 previous calibration 入库。
- **S徐六泾断面200712**（24 列）：第 16 列 `bh1`、第 22 列 `bs1`，**实为 bh10/bs10 typo**；脚本同时认 `bh1/bh10` 与 `bs1/bs10`。
- **S浙江201611**（25 列）：用正确的 `bh10/bs10`，多一列"容积"。实测全部为空，按缺省 1000 mL 处理（plan 默认值）。
- 两个 sheet 都有 (垂线号, 日期+时间) 完全相同的物理重复行（徐六泾 4 条、浙江 6 条），脚本通过 `client_uid` 去重为 1 条。

### 模块结构

```
scripts/
├── seed-from-excel.py             # 入口（CLI）
└── seed_from_excel/
    ├── excel_reader.py            # openpyxl 包装
    ├── _helpers.py                # 类型转换 (Decimal/date/datetime)
    ├── projects_loader.py
    ├── cups_loader.py             # 含 batch flush + cup_calibrations
    └── records_loader.py          # 宽表 → JSONB points + 自动建 vertical
```
