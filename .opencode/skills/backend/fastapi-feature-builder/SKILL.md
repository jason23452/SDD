---
name: fastapi-feature-builder
description: >-
  Build, modify, refactor, debug, or validate FastAPI/Python backend projects（FastAPI 後端專案建立、修改、重構、除錯與驗證）。Use when work involves FastAPI、Python backend、API routes、APIRouter、feature modules、app/features、app/core、app/shared、Pydantic schemas/settings、SQLAlchemy models/sessions、Alembic migrations、service/repository classes、dependency injection、async I/O、高併發、Redis、auth、Docker Compose、uv、FastAPI CLI、Uvicorn、pytest、httpx AsyncClient、後端架構規劃或 feature-based implementation。Guides Codex to inspect the existing project first, define feature boundaries, keep routers thin, use class-based service/repository/adapters where appropriate, preserve API/DB compatibility, implement migrations for schema changes, and verify with available lint/type/test/migration/startup commands.
---

# FastAPI Feature Builder

使用這個 skill 處理 FastAPI 後端的建立、修改、重構、除錯與驗證。核心目標是：以現有專案慣例為主，採用 feature-based 架構、清楚的物件責任、async-safe resource handling，並交付可驗證的變更。

## 操作原則

- 先檢查現有專案，再新增或修改檔案。不要在不知道 package manager、entrypoint、app layout、database setup、test strategy 前套模板。
- 優先沿用 repository 既有慣例；只有在使用者明確要求或現有設計阻礙目標時才引入新結構。
- 保留 public API、database behavior、migration history 與 deployment contract，除非使用者明確要求 breaking change。
- Router 只處理 HTTP 邊界；business behavior 放在 service/use-case class；persistence 放在 repository。
- Async request path 必須 async-safe。不要新增 blocking I/O、global request state、singleton session 或 unmanaged client。
- DB schema change 必須使用 Alembic migration；不要用 app startup 的 `create_all()` 取代 migration。
- 執行可用的最強驗證命令。不能執行時，要說明未驗證項目與原因。

## 官方來源

FastAPI、uv、dependency injection、startup、CLI、testing、SQLAlchemy 或 Pydantic 行為可能受版本影響時，先查 primary documentation，不要只靠記憶。

- FastAPI tutorial: `https://fastapi.tiangolo.com/tutorial/`
- Bigger applications: `https://fastapi.tiangolo.com/tutorial/bigger-applications/`
- FastAPI CLI: `https://fastapi.tiangolo.com/fastapi-cli/`
- Manual deployment: `https://fastapi.tiangolo.com/deployment/manually/`
- SQL databases: `https://fastapi.tiangolo.com/tutorial/sql-databases/`
- Testing: `https://fastapi.tiangolo.com/tutorial/testing/`
- Async tests: `https://fastapi.tiangolo.com/advanced/async-tests/`
- Concurrency and async/await: `https://fastapi.tiangolo.com/async/`
- Settings: `https://fastapi.tiangolo.com/advanced/settings/`
- uv FastAPI guide: `https://docs.astral.sh/uv/guides/integration/fastapi/`
- uv run: `https://docs.astral.sh/uv/concepts/projects/run/`

## 現況檢查

依任務範圍檢查需要的項目，但不要跳過架構基本面：

- Python 版本與 package manager：`uv`、Poetry、pip-tools 或 pip。
- Dependency files：`pyproject.toml`、lockfile、`requirements.txt`、`Dockerfile`、Compose files。
- FastAPI、Pydantic、SQLAlchemy、Alembic、Redis、auth、test framework 版本。
- App entrypoint：`app.main:app`、`main:app`、`src.app.main:app`、`[tool.fastapi]` 或 project scripts。
- 現有 layout：`app/core/`、`app/shared/`、`app/features/` 或專案自己的等價慣例。
- Router registration、dependency factories、settings、database session scope、lifespan hooks、middleware、exception handling。
- Migration setup：`alembic.ini`、`alembic/env.py`、`target_metadata`、current heads。
- Test fixtures 與 database、auth/current user、Redis、external clients overrides。
- 高併發風險：blocking calls、global mutable state、singleton sessions、unclosed clients、sync DB drivers、unmanaged background tasks。

## 規劃契約

遇到較大的變更、使用者要求規劃/設計/架構、或會影響 DB/API/startup/deployment 時，改檔前先用中文給一份精簡規劃。若使用者直接要求小型實作，可以在內部完成同等檢查後直接修改。

規劃應包含：

- 目標：API 行為、後端能力或 bug fix。
- 不變契約：public API、DB schema、migrations、startup command、deployment behavior。
- Feature 邊界：受影響或新增的 business feature；不要用 router/service/model 這種技術層命名 feature。
- 檔案落點：會新增或修改哪些檔案，以及各檔職責。
- 物件設計：service、repository、adapter、policy、unit-of-work class，以及 dependency injection 方式。
- Data impact：models、schemas、queries、migrations、indexes、seeds、rollback concerns。
- Runtime impact：settings、`.env.example`、Docker Compose、Redis、auth、lifespan、external clients。
- Concurrency risk：blocking I/O、session scope、connection pooling、timeouts、retries、background work、shared state。
- Test strategy：router、service、repository、migration、Redis、auth、concurrency coverage。
- Verification commands：lint、typecheck、tests、migrations、Compose validation、startup checks。

## Feature Layout

新增後端功能時，優先採用 feature-owned layout；若專案已有不同慣例，沿用現有慣例。

```text
app/
  main.py
  core/
    config.py
    database.py
    redis.py
    security.py
  shared/
    exceptions.py
    pagination.py
  features/
    <feature>/
      router.py
      schemas.py
      models.py
      service.py
      repository.py
      dependencies.py
      exceptions.py
```

職責分工：

- `router.py`：HTTP boundary、route declaration、request parsing、response model、status code、dependency injection、HTTP exception mapping。
- `schemas.py`：Pydantic request/response/filter/command DTO。避免把 ORM model 直接暴露成 API contract。
- `models.py`：feature-owned ORM models。確認 Alembic metadata discovery 能看見新 model。
- `service.py`：class-based use cases、business rules、transaction orchestration、cache invalidation、跨 repository/adapter 協調。
- `repository.py`：class-based persistence 與 SQLAlchemy queries。不要 import router、`Request` 或 `HTTPException`。
- `dependencies.py`：request-scoped factories，例如 session、repository、service、permission checks、clients、current-user requirements。
- `exceptions.py`：domain exceptions。HTTP mapping 放在 router 或 app boundary。
- Adapters/clients：外部 HTTP、Redis、queue 或第三方服務應包在 feature/shared interface 後面。

允許的依賴方向：

```text
router -> service -> repository -> database
router -> schemas
router -> dependencies
service -> repository
service -> adapters/clients
```

避免：

- Router 直接放 business logic 或 database queries。
- Repository import FastAPI/HTTP layer。
- `shared/` import feature-private modules。
- Feature 直接 import 其他 feature 的 private repository、model 或 schema，除非既有架構已有明確 public boundary。
- Repository 自行建立 session，繞過 dependency 或 unit-of-work boundary。

## Async 與資源安全

對 async endpoints：

- 專案若是 async stack，使用 async DB driver 與 `AsyncSession`。
- 透過 dependencies 傳遞 request-scoped sessions；不要把 request session 放在 module global。
- HTTP/Redis 等長生命週期 clients 必須由 lifespan 或可明確關閉的 scope 管理。
- 外部 calls 要有 timeout 與 bounded retry。
- CPU-bound 或 long-running work 不要放在 request path；必要時使用 worker、queue 或明確 background strategy。
- 避免 unbounded `asyncio.gather`、unbounded queue、沒有 lifecycle handling 的 fire-and-forget task，以及 mutable global request data。
- 若既有專案是 synchronous stack，除非任務明確要求 async migration，否則保持一致。

## Database 與 Migrations

資料形狀改變時：

- Model、repository 與 schema/query 變更要一起思考。
- DB schema change 必須新增或更新 Alembic migration。
- 檢查 `target_metadata` 是否包含新 models。
- 保留 migration history；heads 分叉時建立 merge revision。
- Index、constraint、nullable/default behavior 要明確設計。
- Transaction boundary 放在 service 或 unit-of-work，不放在 router。
- 可用時執行：

```bash
uv run alembic heads
uv run alembic upgrade head
```

## Settings、Docker、Redis、Auth

- Settings 放在 `app/core/config.py` 或專案等價位置，優先使用 `pydantic-settings`。
- 新增非 secret configuration 時同步更新 `.env.example`。
- 不要把 real secrets 寫進 settings、Compose、tests 或 examples。
- Compose 變更用 `docker compose config` 驗證。
- Compose 中 container 間連線使用 service name，例如 `db`、`redis`，不要用 `localhost`。
- Redis keys 要有清楚 prefix、TTL 與 invalidation rules。Async request path 使用 async Redis client。
- Auth dependency 放在 router 或 route level。Shared security helpers 可放在 `app/core/security.py` 或 `app/shared/security.py`。

## 依賴套件

新增套件前先檢查既有套件管理工具、版本約束與 lockfile。不要混用 `uv`、Poetry、pip-tools、pip；若專案不是 `uv`，使用專案既有等價命令並同步更新 lockfile。

新 FastAPI 專案優先使用下列 `uv` 套件組合：

```bash
uv add "fastapi[standard]" "uvicorn[standard]" pydantic-settings
uv add --dev pytest anyio ruff pyright
```

`fastapi[standard]` 會帶入 FastAPI 常用標準依賴，例如 `uvicorn`、`fastapi-cli`、`httpx`、`jinja2`、`python-multipart`、`email-validator`。但 server runtime 要明確以 `uvicorn` 為準；新專案仍建議顯式加入 `"uvicorn[standard]"`，讓啟動命令與 dependency contract 清楚。若不需要 FastAPI Cloud CLI，改用：

```bash
uv add "fastapi[standard-no-fastapi-cloud-cli]" "uvicorn[standard]" pydantic-settings
```

依功能需求加上相關套件：

- Async PostgreSQL 與 migration：`uv add "sqlalchemy[asyncio]" alembic asyncpg`
- SQLite async 測試或本機輕量 DB：`uv add aiosqlite`
- Redis cache、rate limit、lock 或 token deny list：`uv add redis`
- JWT 驗證與簽發：`uv add pyjwt`
- 密碼雜湊：`uv add "pwdlib[argon2]"`
- Runtime 外部 HTTP client：`uv add httpx`
- ORJSON response：`uv add orjson`
- 額外 Pydantic 型別：`uv add pydantic-extra-types`
- 背景任務或分散式 worker：依既有架構選擇 `celery`、`rq`、`dramatiq` 或專案既有 queue 套件，不要任意引入新 queue。
- 測試需要 HTTP client 且 runtime 不使用 `httpx`：`uv add --dev httpx`
- 測試 coverage：`uv add --dev pytest-cov`

套件選型規則：

- 不要為未使用的基礎設施預先安裝 DB、Redis、auth、queue、worker 或 observability 套件。
- DB driver 必須符合實際資料庫與 sync/async stack；PostgreSQL async 預設用 `asyncpg`，既有 sync stack 則沿用現有 driver。
- `uvicorn` 是 FastAPI app 的標準 ASGI server；production-like 啟動優先使用 `uv run uvicorn app.main:app --host 0.0.0.0 --port 8000` 或專案既有等價命令。
- `httpx` 若已由 `fastapi[standard]` 帶入，不要重複新增；只有在 minimal `fastapi` 安裝或 dev-only 測試需求時才單獨加入。
- Auth 套件必須配合既有身份系統；已有 OAuth/OIDC/SAML 時不要自行新增帳密或 JWT 系統。
- 若新增套件需要 settings、`.env.example`、Docker Compose 或 CI 調整，必須一起修改。
- 安裝或改 lockfile 後，至少執行可用的 import/startup/test 檢查；不能執行時說明原因。

## Testing

測試深度依風險調整：

- Router tests：HTTP contracts、status codes、validation、auth、dependency overrides。
- Service tests：business rules、permissions、cache invalidation、transaction behavior。
- Repository tests：queries、persistence、constraints、migration-sensitive behavior。
- Async app 使用 `httpx.AsyncClient` 與專案的 async test framework。
- Bug fix、race condition、locking、rate limit、cache invalidation、concurrency-sensitive behavior 要有 regression tests。
- Fixture overrides 應涵蓋 database sessions、current user/auth、Redis、external clients。

## Command Patterns

優先使用 repository 既有 scripts。常見 uv commands：

```bash
uv sync
uv run ruff check .
uv run pyright
uv run pytest
uv run alembic heads
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

FastAPI CLI 可作為開發輔助或既有專案命令：

```bash
uv run python -c "from app.main import app; print(app.title)"
uv run fastapi dev app/main.py
uv run fastapi run app/main.py
```

Docker checks：

```bash
docker compose config
docker compose up db redis
```

依檢查到的專案路徑與命令調整。沒有實際成功執行的命令，不得宣稱已通過。

## 常見失敗模式

完成前檢查：

- FastAPI app 無法 import，或 startup command 使用錯誤 module path。
- Router 重複註冊或沒有註冊。
- 新 model 沒有被 Alembic metadata discovery 看見。
- Schema change 沒有 migration。
- Router 直接執行 database 或 business logic。
- Repository import FastAPI 或 HTTP exceptions。
- Async route 呼叫 blocking code，例如 `requests`、`time.sleep`、sync DB access 或 CPU-heavy loops。
- Request-specific user/session/tenant state 被放進 global。
- External HTTP、Redis 或 DB clients 每個 request 建立且沒有 cleanup。
- Tests 因 dependency overrides 不真實而失去保護力。
- `.env.example`、settings 與 Compose environment 不一致。

## Final Response

完成 FastAPI 任務時，簡短說明：

- 改了什麼、在哪裡。
- 哪些 contract 被保留，哪些是刻意改變。
- 執行了哪些 verification commands，以及結果。
- 哪些命令沒跑，原因是什麼。
- 仍存在的風險或後續工作。