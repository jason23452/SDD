---
name: fastapi-feature-builder
description: >-
  FastAPI 後端專案建立、啟動、修改、重構與驗證的最高優先級強制規範。只要任務涉及 FastAPI、Python backend、API route、APIRouter、feature module、app/features、app/core、app/shared、schemas、models、service、repository、dependencies、database session、SQLAlchemy、Alembic migration、Pydantic settings、auth、Redis、Docker Compose、tests、httpx AsyncClient、FastAPI CLI、fastapi dev、fastapi run、Uvicorn、uv、uv sync、uv run、物件導向後端設計、class-based service/repository/adapters、dependency injection、async I/O、高併發、connection pooling、blocking code 排除、後端實作規劃、架構規劃、變更計畫，或需要建立可啟動的後端專案，就必須使用此 skill。此 skill 要求使用中文規劃 feature-based 與物件導向並重的專案架構，先產出嚴謹可驗證的變更規劃，優先查閱 FastAPI 與 uv 官方文件，交付可用 uv 安裝、啟動、測試、遷移、支援高併發、可用 Docker Compose 驗證的 FastAPI 專案或變更。
---

# FastAPI Feature Builder

此 skill 是 FastAPI 後端開發的強制規範，不是參考建議。凡是任務涉及 FastAPI 後端專案建立、啟動、API 開發、feature module、database、migration、Redis、Docker Compose、auth、tests 或重構，必須依本 skill 執行。

未符合啟動、架構、測試與驗證要求，不得宣稱完成。

## 官方文件優先

涉及 FastAPI 安裝、啟動、CLI、APIRouter、dependency、testing、lifespan、deployment 或版本行為時，必須優先查閱 FastAPI 官方文件。

官方文件優先順序：

- Tutorial: `https://fastapi.tiangolo.com/tutorial/`
- First Steps: `https://fastapi.tiangolo.com/tutorial/first-steps/`
- Bigger Applications: `https://fastapi.tiangolo.com/tutorial/bigger-applications/`
- FastAPI CLI: `https://fastapi.tiangolo.com/fastapi-cli/`
- Run a Server Manually: `https://fastapi.tiangolo.com/deployment/manually/`
- SQL Databases: `https://fastapi.tiangolo.com/tutorial/sql-databases/`
- Testing: `https://fastapi.tiangolo.com/tutorial/testing/`
- Async Tests: `https://fastapi.tiangolo.com/advanced/async-tests/`
- Concurrency and async/await: `https://fastapi.tiangolo.com/async/`
- Settings: `https://fastapi.tiangolo.com/advanced/settings/`
- uv FastAPI guide: `https://docs.astral.sh/uv/guides/integration/fastapi/`
- uv run: `https://docs.astral.sh/uv/concepts/projects/run/`
- uv CLI reference: `https://docs.astral.sh/uv/reference/cli/`

禁止事項：

- 禁止只依賴記憶決定 FastAPI CLI、entrypoint、dependency 或 Pydantic 行為。
- 禁止用非官方教學作為主要依據。
- 禁止在未確認既有版本與架構前套用模板。
- 禁止把單檔教學範例直接當成正式專案架構。

## 不可跳過條款

1. 必須先檢查現況，再新增或修改檔案。
2. 必須確認專案是否可安裝、可啟動、可測試。
3. 必須以 feature-based 架構組織業務功能，不得只依 router、schemas、models、services 這類技術層切分新功能。
4. 必須以物件導向方式封裝 business use case、repository、external adapters 與 infrastructure clients；router 不得承載 business logic。
5. 必須以 async I/O 與 request-scoped resources 支援高併發；不得在 async route、service 或 repository 中執行 blocking I/O。
6. 必須保留既有公開 API、資料庫行為、migration 歷史與相容性，除非使用者明確要求 breaking change。
7. 物件導向與高併發要求不得改變既有檔案架構規劃。除非使用者明確要求重構目錄，否則只能在既有 `service.py`、`repository.py`、`dependencies.py`、`models.py`、`schemas.py` 等檔案內調整實作。
8. 涉及 DB schema 的變更必須使用 Alembic migration；禁止在正式應用啟動時自動 `create_all()` 取代 migration。
9. 修改 repository、model 或 migration 時，必須檢查 ORM registry 與 Alembic metadata discovery。
10. 實作前必須完成規劃契約；若任務很小，仍須在內部完成同等檢查，不得跳過 feature 邊界、檔案位置、併發風險與驗證命令判斷。
11. 完成後必須執行可用的 lint、typecheck、tests、migration、Docker Compose 與啟動驗證；未驗證不得宣稱完成。

## 現況審核

任何 FastAPI 修改前，必須檢查下列項目：

1. Python 版本、虛擬環境與 package manager：`uv`、Poetry、pip-tools、pip。
2. `pyproject.toml`、`requirements.txt`、lockfile、Dockerfile、Compose。
3. FastAPI、Pydantic、SQLAlchemy、Alembic、Redis、test framework 版本。
4. app entrypoint：`app.main:app`、`main:app`、`[tool.fastapi] entrypoint` 或既有啟動命令。
5. 目錄結構：`app/core/`、`app/shared/`、`app/features/` 或既有替代慣例。
6. router registry、dependency injection、settings、database session、lifespan、middleware、exception handling。
7. migration 狀態：`alembic.ini`、`alembic/env.py`、`target_metadata`、目前 heads。
8. 測試結構與 fixture：DB override、auth override、Redis/external client override。
9. 併發風險：blocking I/O、global mutable state、singleton session、未關閉的 external clients、同步 DB driver、未受控 background task。

未完成現況審核，不得新增 feature、改 DB、改啟動方式或重構架構。

## 規劃契約

任何非純文字說明的 FastAPI 任務，在修改檔案前必須先完成規劃。規劃可以很短，但必須可驗證、可追蹤、可回滾。不得只寫「新增 feature」或「調整 service」這類籠統描述。

規劃必須包含：

1. **任務目標**：明確列出使用者要完成的 API 行為、後端能力或修復目標。
2. **既有架構鎖定**：列出不得改變的檔案架構、啟動方式、public API、DB schema、migration 歷史與部署契約。
3. **Feature 邊界**：說明此變更屬於哪個 feature，或是否需要建立新 feature；不得以技術層命名 feature。
4. **檔案落點**：列出每個預計修改或新增的檔案，以及該檔案的職責。OOP class 必須放在既有規劃檔案內。
5. **OOP 類別規劃**：列出 service、repository、adapter、policy、unit of work 的 class 名稱、依賴來源與注入方式。
6. **高併發風險**：檢查 blocking I/O、DB session scope、connection pool、external client lifecycle、timeout、background job、shared mutable state。
7. **資料與 migration 影響**：說明是否修改 model、schema、repository query、Alembic migration、seed 或 indexes。
8. **設定與啟動影響**：說明是否修改 `.env.example`、settings、Docker Compose、FastAPI entrypoint、dev/run 指令。
9. **測試策略**：列出 router、service、repository、migration、Redis、auth、concurrency 需要覆蓋的測試。
10. **驗證命令**：列出完成後必須執行的 lint、typecheck、tests、Alembic、Compose、啟動命令。
11. **風險與回滾**：列出可能破壞相容性的點，以及如果失敗如何回退。

若規劃中出現下列任一情況，必須在實作前重新收斂範圍：

- 需要改變既有檔案架構，但使用者沒有明確同意。
- 需要 breaking API change，但使用者沒有明確要求。
- 需要 DB destructive migration，但沒有備援或回滾策略。
- 需要導入新基礎設施、queue、cache、auth provider、worker，但需求沒有明確支持。
- 需要在 async request path 執行 blocking I/O。
- 需要新增 global mutable state 保存 request-specific data。

## 規劃輸出格式

當使用者要求「規劃」、「設計」、「架構」、「先不要改」或任務範圍較大時，必須用中文輸出下列格式。若使用者直接要求實作，可在內部完成同等規劃後再改檔。

```text
目標：
- ...

不改變的契約：
- 檔案架構：不改變 / 需要使用者同意
- Public API：不改變 / 影響如下
- DB schema：不改變 / 影響如下
- 啟動方式：不改變 / 影響如下

Feature 邊界：
- feature：...
- 理由：...

檔案落點：
- app/features/<feature>/router.py：...
- app/features/<feature>/service.py：class ...
- app/features/<feature>/repository.py：class ...
- app/features/<feature>/dependencies.py：factory ...

OOP 設計：
- Service：...
- Repository：...
- Adapter/Client：...
- Policy/Permission：...
- Unit of Work：需要 / 不需要

高併發檢查：
- Async I/O：...
- DB session scope：...
- External client lifecycle：...
- Timeout / retry：...
- Blocking code：無 / 風險如下
- Shared mutable state：無 / 風險如下

資料與 migration：
- Model：...
- Alembic：需要 / 不需要，理由：...
- Index / constraint：...

測試：
- Router：...
- Service：...
- Repository：...
- Concurrency / Redis / auth：...

驗證命令：
- ...

風險與回滾：
- ...
```

禁止輸出只有檔案樹、沒有啟動與驗證策略的規劃。

## 新專案契約

建立新 FastAPI 專案時，預設使用 `uv`、`fastapi[standard]`、Pydantic v2、SQLAlchemy 2.x async、Alembic、PostgreSQL、Redis、pytest、Ruff、Pyright。若使用者或既有環境明確指定其他工具，必須沿用指定工具並說明差異。

建議初始化：

```bash
uv init
uv add "fastapi[standard]" pydantic-settings "sqlalchemy[asyncio]" alembic asyncpg redis httpx pyjwt "pwdlib[argon2]"
uv add --dev pytest anyio ruff pyright
```

最低啟動要求：

- 必須有 `app/main.py`，且匯出 `app = FastAPI()`。
- 必須有可執行的 development 啟動命令。
- 必須有可執行的 production-like 啟動命令。
- 必須有 `/health` 或等價 health endpoint。
- 必須能開啟 `/docs` 或明確說明 docs 被關閉的原因。

## 啟動契約

FastAPI 專案必須具備明確啟動方式。不得只建立架構而不提供啟動命令。新專案與可控專案必須優先使用 `uv`；既有專案若不是 `uv`，除非使用者要求遷移，否則保留既有工具並提供等價命令。

## uv 啟動專案說明

使用 `uv` 的專案不得要求使用者手動 activate `.venv` 才能啟動。所有指令必須以 `uv run` 或 `uv sync` 為主，確保命令在專案環境與 lockfile 對齊的狀態下執行。

### 第一次啟動

在專案根目錄執行：

```bash
uv sync
uv run fastapi dev app/main.py
```

啟動後必須驗證：

```bash
uv run python -c "from app.main import app; print(app.title)"
```

並用瀏覽器或 HTTP client 檢查：

```text
http://127.0.0.1:8000/docs
http://127.0.0.1:8000/health
```

若 `/health` 尚未存在，新專案必須新增。既有專案若使用不同 health path，必須在回報中寫明。

### Development 啟動

預設命令：

```bash
uv run fastapi dev app/main.py
```

若已在 `pyproject.toml` 設定 `[tool.fastapi] entrypoint`，可使用：

```bash
uv run fastapi dev
```

若需要指定 host 或 port，必須使用 FastAPI CLI 支援的參數，並回報實際 URL：

```bash
uv run fastapi dev app/main.py --host 127.0.0.1 --port 8000
```

### Production-like 啟動

預設命令：

```bash
uv run fastapi run app/main.py
```

若已設定 `[tool.fastapi] entrypoint`：

```bash
uv run fastapi run
```

容器或部署環境也可使用 Uvicorn fallback，但必須明確指定 import path：

```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Uvicorn development fallback

只有在 FastAPI CLI 不可用、既有專案已採用 Uvicorn，或需要明確控制 reload 參數時才使用：

```bash
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

不得同時提供多個互相矛盾的啟動入口。若存在 `main:app`、`app.main:app`、`src.app.main:app` 等差異，必須先以實際 import 驗證後再寫入文件或回報。

### Docker Compose 啟動

有 Compose 時，啟動順序必須可重現：

```bash
docker compose config
docker compose up db redis
uv run alembic upgrade head
uv run fastapi dev app/main.py
```

若 API 也在 Compose 中啟動：

```bash
docker compose config
docker compose up --build
```

Compose 內的 API service 仍必須使用明確啟動命令，例如：

```bash
uv run fastapi run app/main.py
```

### 啟動失敗處理

啟動失敗時不得只回報「啟動失敗」。必須檢查並回報：

- `uv sync` 是否成功。
- `fastapi[standard]` 是否已安裝。
- `app/main.py` 是否存在。
- `app.main:app` 是否可 import。
- `[tool.fastapi] entrypoint` 是否正確。
- `.env` 或 `.env.example` 是否缺少必要設定。
- DB/Redis 是否啟動。
- Alembic migration 是否已套用。
- Port 是否被占用。

### Entrypoint 設定

新專案應在 `pyproject.toml` 設定 FastAPI entrypoint：

```toml
[tool.fastapi]
entrypoint = "app.main:app"
```

設定後，`fastapi dev` 與 `fastapi run` 應能找到 app。若既有專案已使用其他入口，必須保留可運作入口並避免破壞部署。

## 專案架構契約

新專案必須使用以下 feature-based 架構。既有專案可逐步遷移，但不得新增更多 layered spaghetti。此檔案架構是穩定契約；物件導向設計與高併發設計必須在此架構內完成，不得因為改用 class-based service/repository/adapters 而新增未規劃的目錄層級。

```text
app/
  __init__.py
  main.py
  models.py
  core/
    config.py
    database.py
    redis.py
    cache.py
    logging.py
    exceptions.py
    security.py
  shared/
    pagination.py
    types.py
    utils.py
  features/
    users/
      __init__.py
      router.py
      schemas.py
      models.py
      service.py
      repository.py
      dependencies.py
      exceptions.py
    items/
      __init__.py
      router.py
      schemas.py
      models.py
      service.py
      repository.py
      dependencies.py
      exceptions.py
alembic/
  versions/
tests/
  features/
    users/
      test_router.py
      test_service.py
      test_repository.py
compose.yml
.env.example
pyproject.toml
```

規則：

- 小 feature 不得硬建空檔案。只有有明確職責時才新增 `repository.py`、`dependencies.py`、`exceptions.py`。
- `app/main.py` 必須保持薄。它負責建立 app、lifespan、middleware、exception handlers、include routers。
- `app/core/` 只放 infrastructure：settings、database、Redis、logging、security、global exception mapping。
- `app/shared/` 只放沒有 feature ownership 的通用 application code。禁止讓 `shared/` 變成第二套業務層。
- `app/features/<feature>/` 必須擁有該 feature 的 router、schemas、models、service、repository、dependencies、exceptions。
- `app/models.py` 必須集中匯入 feature-owned ORM models，確保 Alembic metadata 可發現。
- 禁止因為導入 OOP 而新增 `services/`、`repositories/`、`adapters/`、`interfaces/`、`use_cases/` 等額外資料夾，除非使用者明確要求改變檔案架構。

## 檔案架構鎖定契約

檔案架構是穩定契約。除非使用者明確要求重構目錄，否則規劃與實作必須遵守下列規則：

- 不得把單數檔案 `service.py` 改成 `services/` 目錄。
- 不得把單數檔案 `repository.py` 改成 `repositories/` 目錄。
- 不得新增 `domain/`、`application/`、`infrastructure/`、`interfaces/`、`use_cases/`、`adapters/` 等額外 DDD 或 Clean Architecture 目錄。
- 不得為了 OOP 把 class 拆到新資料夾；class 必須放在既有規劃檔案中。
- 不得移動既有檔案來追求理想架構，除非本次任務明確是遷移架構。
- 若確實需要新增同層檔案，例如 `policies.py`、`adapters.py`、`unit_of_work.py`，必須先證明該 feature 內已有足夠複雜度，且新增檔案不破壞既有架構規劃。
- 新增檔案必須有明確職責與測試落點；禁止建立空檔案或未使用 scaffolding。

若任務需要修改架構規劃，必須先提出原因、替代方案、影響檔案、遷移步驟、風險與回滾方式，並等待使用者明確同意。

## 物件導向設計契約

FastAPI route function 可以維持 function-based，但 feature 內部設計必須以物件導向為主。目標是讓 business logic、persistence、external integration 與 infrastructure lifecycle 有清楚邊界，並且可測試、可替換、可並行安全。

必須使用 class 封裝：

- Service：封裝 use case、business rules、transaction orchestration、cache invalidation。
- Repository：封裝 persistence 與 SQLAlchemy query。
- Adapter/Client：封裝外部 API、message broker、object storage、email、payment、LLM 或其他 integration。
- Policy/Permission：封裝複雜授權規則。
- Unit of Work：當一個 use case 需要跨多 repository transaction 時使用。

OOP 實作必須維持既有檔案架構；class 應放在原規劃檔案內：

```text
app/features/orders/
  router.py
  schemas.py
  models.py
  service.py          # class OrderService
  repository.py       # class OrderRepository
  dependencies.py     # get_order_service()
  policies.py         # optional, only when policy logic is large enough
  exceptions.py
```

Service 範例：

```python
class OrderService:
    def __init__(
        self,
        *,
        repository: "OrderRepository",
        policy: "OrderPolicy",
        cache: "CacheClient | None" = None,
    ) -> None:
        self.repository = repository
        self.policy = policy
        self.cache = cache

    async def create_order(self, command: "OrderCreate") -> "OrderRead":
        self.policy.ensure_can_create(command)
        order = await self.repository.create(command)
        if self.cache is not None:
            await self.cache.invalidate("orders:list")
        return OrderRead.model_validate(order)
```

Dependency factory 範例：

```python
async def get_order_service(
    session: AsyncSession = Depends(get_session),
    cache: CacheClient = Depends(get_cache_client),
) -> OrderService:
    return OrderService(
        repository=OrderRepository(session=session),
        policy=OrderPolicy(),
        cache=cache,
    )
```

規則：

- Router 只能呼叫 service method，不得直接編排 business workflow。
- Service 不得 import FastAPI `Request`、`HTTPException` 或 router。
- Repository 必須是可注入物件，不得在 method 內自行建立 global session。
- External adapter 必須透過 dependency injection 注入，不得在 service method 內臨時建立未關閉 client。
- External adapter 若只服務單一 feature，必須放在該 feature 既有檔案或明確命名的同層檔案中；不得為了 adapter 任意新增全域 `adapters/` 目錄。
- 跨 feature 互動必須透過 narrow public service interface、Protocol、domain event 或 background job；不得 import 另一個 feature 的 private repository。
- 若使用 Protocol 或 abstract base class，必須是為了測試、替換 external adapter 或穩定 domain boundary；不得為沒有變化點的程式碼建立空泛抽象。
- Protocol 或 abstract base class 必須放在現有 feature 檔案或既有 shared/core 檔案內；不得新增未規劃的 architecture folder。
- 禁止使用 global mutable singleton 保存 request-specific state、user context、DB session、transaction 或 tenant context。

## 高併發契約

FastAPI 後端必須預設支援高併發 I/O 工作負載。任何新功能都必須避免阻塞 event loop，並確保 request-scoped resource 不會在並發請求間互相污染。

硬性規則：

1. 使用 async DB driver 時，route、service、repository 必須使用 `async def` 與 `await`。
2. 使用不支援 async 的 blocking library 時，不得直接放入 async path；必須改用 sync route、threadpool、queue worker，或更換 async library。
3. 每個 request 必須取得獨立 `AsyncSession` scope；禁止共用 global session。
4. Database engine 必須設定合理 connection pool；不得在每個 request 建立 engine。
5. HTTP external calls 必須優先使用 `httpx.AsyncClient` 或既有 async client，並由 lifespan/dependency 管理 lifecycle。
6. Redis 必須使用 async client 或既有 async-safe adapter，且不得在 request path 內建立未關閉連線。
7. CPU-bound、長時間工作、批次處理、寄信、檔案轉換、第三方慢操作，必須移到 background job、queue 或 worker；不得阻塞 API response path。
8. 必須為外部 I/O 設定 timeout、retry boundary 與錯誤轉譯；不得讓 request 無限等待。
9. 必須避免未受控 `asyncio.create_task()`；需要 fire-and-forget 時必須有 lifecycle、錯誤記錄與 shutdown 策略。
10. 必須避免在 concurrent request 中修改共享 mutable state；需要共享狀態時使用 Redis、DB transaction、lock 或明確同步策略。

高併發設計檢查：

- DB session 是否 request-scoped。
- External clients 是否在 lifespan 建立並在 shutdown 關閉。
- 所有 I/O 是否可 await 或被隔離到 thread/worker。
- Transaction 是否短且邊界清楚。
- Redis key、lock、rate limit 是否有 TTL。
- 是否有 backpressure、pagination、limit、timeout。
- 是否有避免 N+1 query 或過大 response。

禁止事項：

- 禁止在 async route 中呼叫 `time.sleep()`、同步 `requests`、同步 DB query、同步檔案大 I/O 或長 CPU loop。
- 禁止把 `AsyncSession`、current user、tenant context 存在 module-level variable。
- 禁止在 hot path 反覆建立 DB engine、Redis client、HTTP client。
- 禁止沒有 timeout 的外部 HTTP call。
- 禁止沒有容量控制的 unbounded queue、unbounded gather 或無限制並行任務。

## 檔案職責

- `router.py`：HTTP 邊界。只處理 route、status code、request parsing、response model、dependency injection。禁止寫 DB query。
- `schemas.py`：Pydantic request/response/filter/command DTO。禁止與 ORM model 混用。
- `models.py`：feature-owned ORM models。新增或修改時必須同步 central registry 與 migration。
- `service.py`：class-based use case、business rules、transaction orchestration、cache invalidation、跨 repository 流程。
- `repository.py`：class-based SQLAlchemy query 與 persistence details。禁止 import router、Request、HTTPException。
- `dependencies.py`：feature-scoped dependencies、permission checks、service factories。
- `exceptions.py`：domain exceptions。HTTP mapping 必須在 router 或 app boundary。

## 依賴方向

允許方向：

```text
router -> service -> repository -> database
router -> schemas
router -> dependencies
service -> repository
service -> cache/redis/external clients
```

禁止方向：

- repository import router、FastAPI `Request` 或 `HTTPException`。
- `shared/` import `features/`。
- feature 隨意 import 另一個 feature 的 private repository、model 或 schemas。
- router 直接操作 SQLAlchemy session 寫 query。
- repository 自行建立 session，除非既有專案已採 repository-owned session 且本次不重構該模式。

跨 feature 行為必須使用：

- 擁有資料的 feature 暴露狹窄 public service function。
- 真正 domain-neutral 的 shared primitive。
- domain event、background job 或 queue。
- reporting/search feature 處理跨多 domain read-only query。

## 新增 Feature 流程

新增 feature 必須依序執行：

1. 以使用者流程或 API resource 命名 feature，不得以技術層命名。
2. 建立 `app/features/<feature>/`，只建立必要檔案。
3. 先定義 schemas，再定義 route contract。
4. service 以 use case 命名；有 business rules 時不得只做 generic CRUD。
5. service 與 repository 必須優先以 class 實作，並透過 dependency factory 注入。
6. repository 只處理 persistence，不處理 HTTP 邏輯。
7. router 使用穩定 prefix、tags、response_model、status_code。
8. router 掛到 `app/main.py` 或既有 router registry。
9. 若有 DB schema 變更，建立或更新 Alembic migration。
10. 新增 router/service/repository tests，並至少覆蓋 service class 的主要 use case。
11. 啟動專案並驗證 `/docs`、health endpoint 與新增 route。

## Database 與 Migration 契約

推薦 stack：

- SQLAlchemy 2.x async ORM。
- `AsyncSession` 與 `async_sessionmaker`。
- PostgreSQL + `asyncpg`。
- Alembic migration。

硬性規則：

- 生產資料庫 schema change 必須使用 Alembic migration。
- 禁止用 app startup `create_all()` 取代 migration。
- 多 repository transaction 預設由 service 管理 commit/rollback。
- FastAPI dependency 提供 session 時，repository 不得自行開 session。
- feature-owned models 必須能被 Alembic `target_metadata` 發現。
- repository class 必須接收 session 注入；禁止在 repository 內建立 engine 或 session。

只要新增或修改 `models.py`、`repository.py`、migration，必須執行：

```bash
uv run alembic heads
uv run alembic upgrade head
```

若 DB 不可用，必須回報未執行原因與風險。若出現多個 Alembic head 且不是刻意設計，必須建立 merge revision。

## Docker Compose 與 Redis 契約

新後端專案必須提供 `compose.yml`，除非使用者明確要求不要 Docker。

Compose 至少包含：

- `api`：FastAPI service，使用明確啟動命令。
- `db`：PostgreSQL，使用 named volume 與 healthcheck。
- `redis`：Redis，使用 healthcheck。

規則：

- `.env.example` 必須與 `app/core/config.py`、Compose environment 一致。
- 禁止把 production secret 寫死在 Compose。
- 容器內連線必須使用 service name，例如 `db`、`redis`，不得使用 `localhost`。
- 修改 Compose 後必須執行：

```bash
docker compose config
```

Redis 規則：

- Redis client 集中在 `app/core/redis.py` 或明確 feature adapter。
- Redis client lifecycle 必須由 lifespan 或 dependency 管理；禁止在每個 request 重複建立新連線。
- cache key 必須有 TTL。
- key prefix 必須包含 app/environment/feature/use case。
- 寫入資料後，service layer 必須處理 cache invalidation 或 key versioning。
- Redis lock 必須有 expiration。

## Pydantic 與 Settings 契約

- 必須先確認專案使用 Pydantic v1 或 v2。
- 新專案使用 Pydantic v2。
- Pydantic v2 ORM serialization 使用 `model_config = ConfigDict(from_attributes=True)` 與 `model_validate`。
- Pydantic v1 既有專案可保留 `orm_mode = True` 與 `from_orm`，但不得混用 v1/v2 寫法。
- Settings 必須集中在 `app/core/config.py`，使用 `pydantic-settings`。
- `.env.example` 必須列出所有必要設定，且不得包含真實 secret。

## Auth 與 Security 契約

- Auth dependency 必須放在 router 或 route level，權限判斷靠近受保護 feature。
- 自建帳密登入使用 `pwdlib[argon2]` hash 密碼。
- JWT 使用 `pyjwt` 或既有專案標準工具。
- 若產品已有 OAuth/OIDC/SAML，必須優先沿用外部 identity provider，不得自行重造 identity system。
- Security helper 可放 `app/core/security.py` 或 `app/shared/security.py`，但不得讓 shared 依賴特定 feature。

## 測試契約

必須優先測使用者可見 API 行為與 business rules。

- Router tests 使用 `httpx.AsyncClient` 測 async app。
- 既有同步測試可保留 `TestClient`。
- Service 有 business rules 時必須直接測。
- Repository 涉及複雜 query 或 DB 行為時必須測。
- Redis cache/rate limit/token deny list 有變更時，必須測 key、TTL、invalidation。
- 必須使用 dependency override 隔離 DB session、current user、permission、Redis、external clients。
- Fixture 優先靠近 feature；跨多 feature 才放 shared `conftest.py`。
- 高併發相關功能必須測試 timeout、並發請求、resource cleanup，或至少測試 async service/repository 不共享 request-scoped state。
- 若修復 race condition、locking、rate limit、cache invalidation 或 queue 行為，必須加入對應 regression test。

## 驗證門檻

完成前必須執行可用驗證：

```bash
uv sync
uv run ruff check .
uv run pyright
uv run pytest
uv run fastapi dev
uv run fastapi run
```

視情況執行：

```bash
uv run alembic heads
uv run alembic upgrade head
docker compose config
docker compose up
```

高併發或 async I/O 相關變更應視情況執行並發 smoke test、repository/service async test，或用 `httpx.AsyncClient` 發送多個並發請求驗證行為。

若專案不是 `uv`，必須使用等價命令。禁止假裝執行不存在的 script。若命令失敗，必須修復或明確回報原因、影響範圍與風險。

## 實作前審查門檻

開始修改檔案前，必須逐項通過：

- 已確認 feature 邊界。
- 已確認檔案架構不改變，或已取得使用者同意。
- 已確認 OOP class 放置位置。
- 已確認 DB schema 是否變更。
- 已確認是否需要 Alembic migration。
- 已確認 async path 無 blocking I/O 設計。
- 已確認 request-scoped session 與 external client lifecycle。
- 已確認測試與驗證命令。

若任一項無法確認，必須先補充調查；不得直接改檔。

## 實作後審查門檻

完成修改後，必須逐項檢查：

- 檔案架構未被非必要改變。
- Router 只負責 HTTP boundary。
- Service class 承載 use case 與 business rules。
- Repository class 只承載 persistence。
- Dependencies 負責組裝 class 與 request-scoped resource。
- DB schema change 已有 migration；無 schema change 時已明確確認。
- async path 沒有 blocking I/O。
- external clients 沒有在 hot path 反覆建立。
- tests、lint、typecheck、啟動與 Compose/Migration 驗證已執行或已說明原因。

## 未完成條件

出現任一情況時，不得宣稱完成：

- 專案沒有明確啟動命令。
- 無法匯入 `app` 或 FastAPI CLI 找不到 entrypoint。
- 修改 DB schema 但沒有 Alembic migration。
- 修改 repository/model 但沒有檢查 Alembic metadata discovery。
- router 直接寫 DB query。
- repository import HTTP layer。
- service/repository 未透過物件與 dependency injection 封裝，導致 business logic 散落在 router。
- async route 中存在 blocking I/O 或未受控長任務。
- request-specific DB session、user、tenant 或 transaction state 被放入 global mutable state。
- external HTTP/Redis/DB client 在 hot path 反覆建立且未關閉。
- 測試、typecheck、lint 或 build 失敗且未修復。
- Docker Compose 修改後未執行 `docker compose config` 且未說明原因。
- `.env.example`、settings、Compose environment 不一致。

## 完成定義

只有同時符合下列條件，才可視為完成：

- FastAPI 專案可安裝 dependencies。
- 專案可用 `uv sync` 安裝 dependencies。
- 專案可用 `uv run fastapi dev app/main.py` 或等價 development 命令啟動。
- 專案具備 `uv run fastapi run app/main.py` 或等價 production-like 啟動命令。
- `/docs` 或 health endpoint 已驗證；若關閉 docs，已說明原因。
- Feature-based 邊界清楚，router/service/repository/schema 職責正確。
- Business use case、repository、external adapter 已以物件導向方式封裝，並透過 dependency injection 建立。
- 高併發風險已檢查：無 blocking async path、無 global request state、I/O client lifecycle 明確、DB session request-scoped。
- DB schema change 具備 Alembic migration。
- Docker Compose 與 `.env.example` 與 settings 一致。
- tests、lint、typecheck、migration、Compose 或啟動驗證已執行；若未執行，已列出原因與風險。

## 回報要求

完成 FastAPI 任務時，回報必須包含：

- 套用的 feature 邊界與理由。
- 新增或修改的主要檔案。
- uv 安裝與啟動方式，例如 `uv sync`、`uv run fastapi dev app/main.py`、`uv run fastapi run app/main.py`，以及實際驗證結果。
- 是否影響 public API、DB schema、migration、Docker Compose、Redis、auth。
- 執行過的 lint、typecheck、tests、Alembic、Docker Compose、啟動命令。
