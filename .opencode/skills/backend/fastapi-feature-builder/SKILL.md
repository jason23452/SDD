---
name: fastapi-feature-builder
description: >-
  Build, modify, refactor, debug, or validate FastAPI/Python backend projects（FastAPI 後端專案建立、修改、重構、除錯與驗證）。Use when work involves FastAPI、Python backend、API routes、APIRouter、feature modules、app/features、app/core、app/shared、Pydantic schemas/settings、SQLAlchemy models/sessions、Alembic migrations、service/repository classes、dependency injection、async I/O、高併發、Redis、auth、Docker Compose、uv、FastAPI CLI、Uvicorn、pytest、httpx AsyncClient、後端架構規劃或 feature-based implementation。This skill is a mandatory execution contract: inspect the existing project first, preserve API/DB/deployment compatibility unless explicitly changed, keep routers thin, place business logic in service/use-case classes, use repositories for persistence, add Alembic migrations for schema changes, keep Docker Compose and runtime config aligned, and verify with the strongest available lint/type/test/migration/startup commands.
---

# FastAPI Feature Builder

使用這個 skill 處理 FastAPI 後端的建立、修改、重構、除錯與驗證。這是一份強制執行契約，不是參考建議，也不是 best practice 清單。任何與本 skill 衝突的臨時做法、捷徑、個人偏好、模板習慣或為了先能跑而繞過契約的做法，都必須讓位給本規範。核心目標只有三件事：維持清楚的 feature 邊界、用可驗證的方式交付變更、避免在架構與基礎設施上留下不可追蹤的例外。

適用總則：

- 新專案、專案初始化、骨架建立、或使用者明確要求套用本 skill 架構時，必須完整遵守本 skill 的檔案架構、baseline 套件、Compose contract 與驗證規則。
- 既有專案若未明確要求遷移架構，必須優先沿用既有 layout、entrypoint、settings wiring 與部署契約；但 business logic 分層、migration、Compose 對齊、驗證門檻、資源安全與套件決策規則仍然必須遵守。
- 既有專案與本 skill 的新專案骨架不同時，不得直接套模板覆蓋；必須在不破壞既有契約的前提下，套用本 skill 的等價約束。

## 操作原則

- 必須先檢查現有專案，再新增或修改檔案。未確認 package manager、entrypoint、app layout、database setup、Compose/infrastructure setup、test strategy 前，禁止套模板。
- 必須沿用 repository 既有慣例；只有在使用者明確要求或現有設計阻礙目標時才可引入新結構。
- 必須保留 public API、database behavior、migration history 與 deployment contract，除非使用者明確要求 breaking change。
- 啟動、開發、測試與驗證都必須依照本 skill 的專案架構契約與 infrastructure contract 執行；禁止用臨時 `main.py`、單檔 demo、未註冊 router、繞過 `app/main.py`，或繞過正式 Compose/依賴服務配置的方式啟動。
- Router 只能處理 HTTP 邊界；business behavior 必須放在 service/use-case class；persistence 必須放在 repository。
- Async request path 必須 async-safe。禁止新增 blocking I/O、global request state、singleton session 或 unmanaged client。
- DB schema change 必須使用 Alembic migration；禁止用 app startup 的 `create_all()` 取代 migration。
- 必須執行可用的最強驗證命令。不能執行時，必須明確說明未驗證項目、原因與風險。
- 只要任務牽涉 DB、Redis、queue、worker、object storage、mail service 或其他本機/容器化基礎設施，就必須同步檢查並維護 `docker-compose.yml` 或專案既有等價 Compose 檔，不得把基礎設施視為 out of scope；新增環境需求時，必須優先以 Compose 建置，不得要求使用者手動安裝服務。
- 任一強制規則未符合時，不得宣稱任務完成。

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

依任務範圍檢查需要的項目，但不得跳過架構基本面：

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

遇到較大的變更、使用者要求規劃/設計/架構、或會影響 DB/API/startup/deployment 時，改檔前必須先用中文給一份精簡規劃。若使用者直接要求小型實作，可直接修改，但改檔前至少必須完成 package manager、entrypoint、app layout、database setup、Compose/infrastructure setup、test strategy 六項檢查；不得以「小改動」為由跳過。

規劃至少必須包含：

- 目標：API 行為、後端能力或 bug fix。
- 不變契約：public API、DB schema、migrations、startup command、deployment behavior。
- Feature 邊界：受影響或新增的 business feature；不要用 router/service/model 這種技術層命名 feature。
- 檔案落點：會新增或修改哪些檔案，以及各檔職責。
- 物件設計：service、repository、adapter、policy、unit-of-work class，以及 dependency injection 方式。
- Data impact：models、schemas、queries、migrations、indexes、seeds、rollback concerns。
- Runtime impact：settings、`.env.example`、Docker Compose、Redis、auth、lifespan、external clients。
- Concurrency risk：blocking I/O、session scope、connection pooling、timeouts、retries、background work、shared state。
- Test strategy：router、service、repository、migration、Redis、auth、concurrency coverage。
- Verification commands：lint、typecheck、tests、migrations、Compose validation、infrastructure startup checks、startup checks。

## 專案架構契約

新專案必須使用以下 feature-based 架構。既有專案只有在使用者明確要求遷移架構時，才可朝此架構遷移；未取得明確要求前，必須維持既有 layout，同時不得新增更多 layered spaghetti。此檔案架構是穩定契約與驗收標準；物件導向設計、高併發設計、基礎設施 wiring 與驗證流程都必須在此架構內完成，不得因為改用 class-based service/repository/adapters 而新增未規劃的目錄層級。

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
docker-compose.yml
.env.example
pyproject.toml
```

硬性規則：

- 小 feature 不得硬建空檔案。只有有明確職責與測試落點時才可新增 `repository.py`、`dependencies.py`、`exceptions.py`。
- `app/main.py` 必須保持薄。它負責建立 app、lifespan、middleware、exception handlers、include routers。
- `app/core/` 只放 infrastructure：settings、database、Redis、logging、security、global exception mapping。
- `app/shared/` 只放沒有 feature ownership 的通用 application code。禁止讓 `shared/` 變成第二套業務層。
- `app/features/<feature>/` 必須擁有該 feature 的 router、schemas、models、service、repository、dependencies、exceptions。
- `app/models.py` 必須集中匯入 feature-owned ORM models，確保 Alembic metadata 可發現。
- 禁止因為導入 OOP 而新增 `services/`、`repositories/`、`adapters/`、`interfaces/`、`use_cases/` 等額外資料夾，除非使用者明確要求改變檔案架構。
- 未符合此架構契約的新增專案，不得宣稱可交付。

職責分工是強制責任邊界：

- `router.py`：HTTP boundary、route declaration、request parsing、response model、status code、dependency injection、HTTP exception mapping。
- `schemas.py`：Pydantic request/response/filter/command DTO。避免把 ORM model 直接暴露成 API contract。
- `models.py`：feature-owned ORM models。確認 Alembic metadata discovery 能看見新 model。
- `service.py`：class-based use cases、business rules、transaction orchestration、cache invalidation、跨 repository/adapter 協調。
- `repository.py`：class-based persistence 與 SQLAlchemy queries。不要 import router、`Request` 或 `HTTPException`。
- `dependencies.py`：request-scoped factories，例如 session、repository、service、permission checks、clients、current-user requirements。
- `exceptions.py`：domain exceptions。HTTP mapping 放在 router 或 app boundary。
- Adapters/clients：外部 HTTP、Redis、queue 或第三方服務必須包在 feature/shared interface 後面；不得把第三方 client 直接散落在 router、service 或 dependency wiring 中。

允許的依賴方向：

```text
router -> service -> repository -> database
router -> schemas
router -> dependencies
service -> repository
service -> adapters/clients
```

下列做法一律視為違規：

- Router 直接放 business logic 或 database queries。
- Repository import FastAPI/HTTP layer。
- `shared/` import feature-private modules。
- Feature 直接 import 其他 feature 的 private repository、model 或 schema，除非既有架構已有明確 public boundary。
- Repository 自行建立 session，繞過 dependency 或 unit-of-work boundary。
- 任何用「先能跑」為理由繞過上述依賴方向的設計。

## 檔案架構鎖定契約

檔案架構是穩定契約。除非使用者明確要求重構目錄，否則規劃與實作必須遵守下列規則；違反任一項即視為架構破壞：

- 不得把單數檔案 `service.py` 改成 `services/` 目錄。
- 不得把單數檔案 `repository.py` 改成 `repositories/` 目錄。
- 不得新增 `domain/`、`application/`、`infrastructure/`、`interfaces/`、`use_cases/`、`adapters/` 等額外 DDD 或 Clean Architecture 目錄。
- 不得為了 OOP 把 class 拆到新資料夾；class 必須放在既有規劃檔案中。
- 不得移動既有檔案來追求理想架構，除非本次任務明確是遷移架構。
- 若確實需要新增同層檔案，例如 `policies.py`、`adapters.py`、`unit_of_work.py`，必須先證明該 feature 內已有足夠複雜度，且新增檔案不破壞既有架構規劃。
- 新增檔案必須有明確職責與測試落點；禁止建立空檔案或未使用 scaffolding。

若任務需要修改架構規劃，必須先提出原因、替代方案、影響檔案、遷移步驟、風險與回滾方式，並等待使用者明確同意。未取得同意前，禁止改變檔案架構。

## 啟動與開發契約

啟動專案、開發功能、跑 smoke test、驗證 `/docs` 或 health endpoint 時，都必須按照「專案架構契約」執行。任何不依正式架構啟動的結果，一律不得當成驗證通過：

- 標準 entrypoint 是 `app/main.py` 中的 `app`。預設使用 `app.main:app`，除非既有專案已明確定義其他 entrypoint。
- `app/main.py` 必須透過正式 router registry 或 include router 流程載入 `app/features/<feature>/router.py`。
- 啟動前要確認 settings 來自 `app/core/config.py` 或專案既有等價位置，DB/Redis/security client 由 `app/core/` 或 lifespan/dependency 管理。
- 開發新 feature 時，不得為了快速啟動建立平行的 demo app、臨時 `main.py`、臨時 router registry 或跳過 feature layout。
- `uvicorn` 啟動命令必須指向正式 app entrypoint，例如 `uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`。
- FastAPI CLI 若被使用，也必須指向正式架構，例如 `uv run fastapi dev app/main.py`，不得指向臨時檔案。
- 啟動失敗時，優先修正架構契約內的 import、router registration、settings、lifespan、dependency wiring；不要用改啟動路徑繞過問題。
- 若既有專案 entrypoint 不是 `app.main:app`，必須先在規劃或回報中明確列出既有 entrypoint、原因與等價啟動命令。
- 若無法用正式 entrypoint 啟動，不得宣稱專案可啟動、可開發或已完成。

## Async 與資源安全

對 async endpoints，下列規則全部適用：

- 專案若是 async stack，必須使用 async DB driver 與 `AsyncSession`。
- 透過 dependencies 傳遞 request-scoped sessions；不要把 request session 放在 module global。
- HTTP/Redis 等長生命週期 clients 必須由 lifespan 或可明確關閉的 scope 管理。
- 外部 calls 必須有 timeout 與 bounded retry。
- CPU-bound 或 long-running work 禁止放在 request path；必要時使用 worker、queue 或明確 background strategy。
- 禁止 unbounded `asyncio.gather`、unbounded queue、沒有 lifecycle handling 的 fire-and-forget task，以及 mutable global request data。
- 若既有專案是 synchronous stack，除非任務明確要求 async migration，否則必須保持一致。

## Database 與 Migrations

只要資料形狀改變，下列規則全部適用：

- Model、repository 與 schema/query 變更要一起思考。
- DB schema change 必須新增或更新 Alembic migration。
- 必須檢查 `target_metadata` 是否包含新 models。
- 必須保留 migration history；heads 分叉時建立 merge revision。
- Index、constraint、nullable/default behavior 要明確設計。
- Transaction boundary 必須放在 service 或 unit-of-work，不得放在 router。
- 只要任務涉及 schema change、migration、metadata discovery 或 DB contract 驗證，且環境允許執行，就必須執行：

```bash
uv run alembic heads
uv run alembic upgrade head
```

## Settings、Docker、Redis、Auth

- Settings 必須放在 `app/core/config.py` 或專案既有等價位置。新專案必須使用 `pydantic-settings`；既有專案若已採用單一且一致的 settings 機制，必須沿用，不得混入第二套設定系統。
- 新增非 secret configuration 時同步更新 `.env.example`。
- 不要把 real secrets 寫進 settings、Compose、tests 或 examples。
- Compose 變更用 `docker compose config` 驗證。
- Compose 中 container 間連線使用 service name，例如 `db`、`redis`，不要用 `localhost`。
- Redis keys 要有清楚 prefix、TTL 與 invalidation rules。Async request path 使用 async Redis client。
- Auth dependency 必須放在 router 或 route level。Shared security helpers 必須放在 `app/core/security.py` 或 `app/shared/security.py`，不得散落在 feature 內外的任意位置。

## Infrastructure 與 Docker Compose Contract

只要任務依賴或影響資料庫、Redis、queue、worker、mail catcher、object storage、search engine、mock external service，或任何本機開發需要的 supporting services，本節規則全部視為強制契約：

- 必須檢查既有 `docker-compose.yml`、`compose.yml`、`compose.yaml` 或專案既有等價 Compose 檔；不得假設基礎設施由使用者手動安裝。
- 額外環境一律優先使用 Compose 建置。只要本次需求新增 DB、Redis、queue、worker、mail service、storage 或其他 supporting service，必須先以 Compose 定義服務，再處理 app wiring。
- 若本次任務新增或改變 DB、Redis、queue、worker、mail service、storage 或其他 supporting service 依賴，必須同步更新 Compose 設定，除非使用者明確要求不處理本機基礎設施。
- 若專案既有開發流程依賴 Compose，禁止以「請自行在本機安裝 PostgreSQL/Redis」作為繞過方案。
- App settings、`.env.example`、Compose environment、container command、exposed ports、healthcheck、volume、depends_on、service name 必須彼此一致；任何一處改動影響連線契約時，必須一起更新。
- Container 之間連線必須使用 Compose service name，不得使用 `localhost`、宿主機 IP 或只在作者本機成立的位址。
- 若應用程式在容器內執行，DB/Redis 連線字串、callback URL、CORS origin、worker broker/backend 位址都必須符合 container networking，而不是只讓 host machine 啟動方式可用。
- 若 migration、seed、worker、scheduler、mail UI、admin UI 或 mock service 是本機開發/驗證路徑的一部分，必須在 Compose 或專案既有等價機制中有明確且可執行的定義。
- 只要任務涉及持久化資料、ORM model、repository query、schema change、migration、DB settings、DSN、connection pool、read replica、transaction isolation 或任何實際 DB 讀寫，就必須提供對應的 Compose service、連線設定、初始化方式與最小驗證流程；不得只建立 ORM model、migration 或連線設定而缺少可啟動的 DB 環境。
- 新增基礎設施時，必須檢查資料持久化需求，明確決定是否需要 volume、初始化腳本、healthcheck 與啟動順序。
- Compose 變更後，至少必須執行 `docker compose config`。若環境可用且任務依賴該服務，還必須執行最小必要的 `docker compose up -d ...` 或專案既有等價啟動驗證。
- 若因執行環境限制無法完成 Compose 啟動驗證，必須明確列出未驗證的服務、原因、受影響功能與風險；不得省略。
- 不得新增未被 app settings、tests、docs 或啟動流程使用的死 Compose services。
- 不得只修改 Python 程式碼而忽略已被本次需求改變的 infrastructure contract。

## 套件決策契約

套件選用是強制決策流程，不是自由發揮區：

- 能用成熟、主流、維護中的套件完成需求時，必須優先使用套件；禁止先手動造輪子，再把套件當備案。
- 本 skill 定義的 baseline 套件是新專案的預設必裝組合。建立專案時必須先安裝，不需要逐項詢問使用者；只有使用者明確要求其他工具鏈或排除特定套件時才可偏離。
- baseline 之外的能力套件必須根據 user story 判斷；不得為未被需求證明的能力預裝依賴。
- 若 user story 已明確要求某能力，必須安裝對應套件並完成 wiring；不得只留下 interface、TODO 或空檔案。
- 若同一能力存在多個合理套件方案，或 user story 不足以唯一決定是否需要該能力，必須先詢問使用者，再進行安裝或實作。
- 若決定不採用成熟套件，必須有明確理由，例如既有依賴衝突、授權限制、部署限制、效能限制或使用者明確要求；不得只因個人偏好而手作通用基礎能力。
- 一旦選擇安裝某能力所需套件，必須同步完成 settings、`.env.example`、Compose、dependency wiring、啟動流程與最小必要測試；不得只安裝套件或只改一半。
- 套件決策必須與專案既有 package manager、lockfile、runtime stack 與 deployment contract 一致；不得為了單一功能引入第二套等價基礎框架。

## 依賴套件

新增套件前必須先檢查既有套件管理工具、版本約束與 lockfile。禁止混用 `uv`、Poetry、pip-tools、pip；若專案不是 `uv`，必須使用專案既有等價命令並同步更新 lockfile。

新 FastAPI 專案建立時，必須先安裝下列 baseline `uv` 套件組合：

```bash
uv add "fastapi[standard]" "uvicorn[standard]" pydantic-settings
uv add --dev pytest anyio ruff pyright
```

Baseline contract：

- `fastapi[standard]` 會帶入 FastAPI 常用標準依賴，例如 `uvicorn`、`fastapi-cli`、`httpx`、`jinja2`、`python-multipart`、`email-validator`。
- server runtime 必須明確以 `uvicorn` 為準；新專案必須顯式加入 `"uvicorn[standard]"`，讓啟動命令與 dependency contract 清楚。
- `pydantic-settings`、`pytest`、`anyio`、`ruff`、`pyright` 屬於 baseline，不因 user story 缺少明示而省略。
- 若不需要 FastAPI Cloud CLI，必須改用以下 baseline 變體，而不是任意縮減 baseline：

```bash
uv add "fastapi[standard-no-fastapi-cloud-cli]" "uvicorn[standard]" pydantic-settings
uv add --dev pytest anyio ruff pyright
```

baseline 安裝完成後，再依 user story 判斷是否啟用下列能力模組；若 user story 未明確且存在多個合理方案，必須先詢問使用者。已決定啟用時，必須安裝對應套件，不得改用手刻基礎能力替代：

- Async PostgreSQL 與 migration：`uv add "sqlalchemy[asyncio]" alembic asyncpg`
- SQLite async 測試或本機輕量 DB：`uv add aiosqlite`
- Redis cache、rate limit、lock 或 token deny list：`uv add redis`
- JWT 驗證與簽發：`uv add pyjwt`
- 密碼雜湊：`uv add "pwdlib[argon2]"`
- ORJSON response：`uv add orjson`
- 額外 Pydantic 型別：`uv add pydantic-extra-types`
- 背景任務或分散式 worker：若 user story 明確需要，必須依既有架構或使用者明確選擇安裝 `celery`、`rq`、`dramatiq` 或專案既有 queue 套件；若需求未指定且存在多個合理方案，必須先詢問使用者。
- 測試 coverage：`uv add --dev pytest-cov`

套件選型規則：

- 不要為未使用的 capability 預先安裝 DB、Redis、auth、queue、worker 或 observability 套件；baseline 與 capability 的界線必須以本節定義為準，不得自行重寫。
- baseline 套件必須先安裝；只有 capability 套件才由 user story 決定是否安裝。
- 不得為了避免安裝套件而自行實作成熟套件已涵蓋的通用能力，例如 password hashing、JWT handling、HTTP client、migration tooling、Redis client 或 queue integration。
- 套件是否安裝必須由 user story 驅動；user story 不足時必須詢問使用者，不得替使用者腦補需求。
- DB driver 必須符合實際資料庫與 sync/async stack；PostgreSQL async 預設用 `asyncpg`，既有 sync stack 則沿用現有 driver。
- `uvicorn` 是 FastAPI app 的標準 ASGI server；production-like 啟動必須使用 `uv run uvicorn app.main:app --host 0.0.0.0 --port 8000` 或專案既有等價正式命令。
- `httpx` 的安裝判斷以本條為唯一依據：若 baseline 或既有依賴已提供 `httpx`，不得重複新增；只有在 runtime 外部 HTTP 呼叫或測試需求存在，且目前依賴尚未提供 `httpx` 時，才可安裝 `httpx`。
- Auth 套件必須配合既有身份系統；已有 OAuth/OIDC/SAML 時不要自行新增帳密或 JWT 系統。若 user story 需要 auth 但未指定方案，必須先詢問使用者。
- 若新增套件需要 settings、`.env.example`、Docker Compose 或 CI 調整，必須一起修改。
- 安裝或改 lockfile 後，必須至少執行可用的 import/startup/test 檢查；不能執行時必須說明原因與風險。

## Testing

下列項目是最低驗證門檻。可在此基礎上增加更多測試，但不得低於下列要求。只要牽涉使用者可見 API 行為、business rules、migration 或啟動路徑，就不得沒有對應測試或驗證：

- Router tests：HTTP contracts、status codes、validation、auth、dependency overrides。
- Service tests：business rules、permissions、cache invalidation、transaction behavior。
- Repository tests：queries、persistence、constraints、migration-sensitive behavior。
- Async app 使用 `httpx.AsyncClient` 與專案的 async test framework。
- Bug fix、race condition、locking、rate limit、cache invalidation、concurrency-sensitive behavior 要有 regression tests。
- Fixture overrides 必須涵蓋 database sessions、current user/auth、Redis、external clients。
- API contract 變更至少要有 router-level 驗證。
- Business rule 變更至少要有 service-level 驗證。
- Schema 或 migration 變更至少要有 migration 驗證，並搭配 repository 或 startup 驗證確認 metadata 與查詢行為一致。
- Compose 或 supporting service 契約變更至少要有 `docker compose config` 驗證；若環境可用且該服務為需求路徑的一部分，還必須有對應服務啟動驗證。
- Entrypoint、import path、router registration、settings wiring、lifespan 或 dependency wiring 變更至少要有 startup/import 驗證。

## Command Patterns

必須優先使用 repository 既有 scripts。若專案不是 `uv`，必須改用既有工具鏈的等價命令並同步維護 lockfile。若沒有既有 scripts，以下是 `uv` 專案的標準命令樣式：

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

FastAPI CLI 只有在既有專案已使用它或本次任務明確需要時才可使用；使用時也必須指向正式 entrypoint，且不得取代正式 startup/import 驗證：

```bash
uv run python -c "from app.main import app; print(app.title)"
uv run fastapi dev app/main.py
uv run fastapi run app/main.py
```

Docker / Compose checks：

```bash
docker compose config
docker compose up -d <required-services>
```

其中 `<required-services>` 指本次 user story 實際依賴的服務，例如 `db`、`redis`、`worker`、`scheduler`、`mailhog`、`minio`。不得把固定的服務範例誤用成所有任務的完整驗證。

依檢查到的專案路徑與命令調整。沒有實際成功執行的命令，不得宣稱已通過。若任一必要驗證失敗，必須修復或明確回報 blocker；不得淡化為「應該可用」。若任務依賴基礎設施，Compose 驗證也屬於必要驗證，不得省略。

## 未完成條件

出現任一情況時，任務一律視為未完成，不得宣稱完成：

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
- 需要的 DB、Redis、queue、worker 或其他 supporting service 沒有在既有 Compose 契約中被正確定義、更新或驗證。
- 未使用正式 `app.main:app` 或既有正式 entrypoint 啟動。
- 缺少必要 dependency、lockfile 未同步，或套件管理工具混用。
- 未執行可用的 lint、typecheck、tests、migration、Compose 或 startup 驗證，且沒有明確說明原因與風險。

## Final Response

完成 FastAPI 任務時，Final Response 必須簡短且具體說明：

- 若存在任何 blocker、未完成條件、必要驗證失敗，或必要驗證未執行，Final Response 第一段必須先列出 blocker；未先列 blocker 前，不得先寫完成摘要。
- 改了什麼、在哪裡。
- 哪些 contract 被保留，哪些是刻意改變。
- 執行了哪些 verification commands，以及結果。
- 哪些命令沒跑，原因是什麼。
- 仍存在的風險或後續工作。
- 若有任何未完成條件，必須直接標示為 blocker，不得用模糊語氣帶過。
