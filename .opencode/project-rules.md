# 專案規則

## 規則來源
- 使用者最新明確規則優先於既有 README 與舊流程說明。
- Frontend 變更需遵守 `react-spa-feature-based`；樣式/Tailwind 變更需遵守 `tailwind-css`。
- Backend 變更需遵守 `fastapi-feature-builder`。
- `.opencode/skills/**/SKILL.md` 是不可變規則來源，不得刪除、覆寫、截斷、清空或弱化。

## 通用流程
- 需求落地前必須先讀取需求來源與相關 `frontend/README.md`、`backend/README.md`，並沿用現有專案脈絡。
- 既有專案不得重新初始化；若基底不完整，優先在既有資料夾內補齊可啟動、可建置、可測試的必要檔案。
- 不得提交 secrets、真實憑證或個資；範例設定只能放非機密預設值。
- 重大需求變更需先完成分類、一致性檢查與規則檢查，再進入實作。

## Worktree Port Allocation
- Worktree 開發、apply-change、server smoke、browser smoke 階段一律不得使用預設 ports：frontend `5173`、backend `8000`、PostgreSQL `5432`。
- `worktree-splitter` 必須為每個 run 產生 `.worktree/<run_id>/port-map.json` 與 `.worktree/<run_id>/PORTS.md`，並在每個 worktree 交接列附上專屬 ports。
- 每個 worktree 至少需配置：`frontendDevPort`、`frontendPreviewPort`、`backendApiPort`、`postgresHostPort`；不需要的服務可不啟動，但不得改用預設 port。
- Worktree server 啟動必須使用分配到的 port 且 fail fast；Vite 必須使用 `--strictPort`。
- Vite smoke 必須優先使用 `pnpm exec vite --host 127.0.0.1 --port <frontendDevPort> --strictPort` 或 `pnpm exec vite preview --host 127.0.0.1 --port <frontendPreviewPort> --strictPort`。
- 禁止使用會讓 Vite 吃不到參數的形式，例如 `pnpm dev -- --host 127.0.0.1 --port <port>` 或在 script 已含 `vite --host` 時再追加 `--` 後參數。
- Backend smoke 必須使用分配到的 `backendApiPort`，例如 `uv run uvicorn app.main:app --host 127.0.0.1 --port <backendApiPort>`。
- PostgreSQL/Compose 在 worktree 階段若需要對 host 開 port，必須使用分配到的 `postgresHostPort` 對映 container `5432`。
- 所有背景 server smoke 必須記錄 PID/job，驗證完成後自動停止，並檢查該 port 已釋放；不得留下長駐 dev server。
- 若分配 port 已被佔用，該 worktree 應停止並回報佔用 PID/command line，不得自動跳到未記錄的新 port。

## Merge Port Policy
- Merge integration 最終驗證才使用專案預設 ports：frontend `5173`、backend `8000`、PostgreSQL `5432`。
- Merge integration 啟動預設 port 前必須先檢查 port 是否被佔用。
- 若預設 port 被非本 run 管理的行程佔用，必須 fail fast 並回報佔用 PID/command line；不得自動 fallback 到其他 port。
- 若預設 port 被本 run 殘留 worktree server 佔用，必須先停止該 server、確認 port 釋放，再進行 merge 驗證。

## Frontend 規則
- Frontend 沿用 React SPA、Vite、TypeScript 與現有 lockfile 對應的 package manager；目前 `frontend/pnpm-lock.yaml` 存在時使用 pnpm，不混用 npm/yarn。
- 前端採 feature-based 結構：使用者可見流程放在 `src/features/<feature>/`，route/page 組裝放在 `src/pages/` 或 `src/app/`，跨功能且不含業務語意的程式才放 `src/shared/`。
- `shared/` 不得 import `features/`；跨 feature 使用需透過 feature public entry 或抽成真正通用的 shared code。
- 前端完成標準至少包含可安裝、可啟動、可 build，並針對主要 route/流程做 smoke 驗證；無法驗證時需記錄原因與風險。
- 若導入或修改 Tailwind/CSS，必須依 Tailwind CSS v4 官方文件與目前 bundler 整合，不使用 v3 初始化方式，不新增未確認的 UI/styling 套件。

## Backend 規則
- Backend 已確認採 FastAPI + PostgreSQL；新增後端功能需沿用 `app/`、`app/core/`、`app/features/` 的 feature-based 結構。
- FastAPI `app/main.py` 保持薄，只負責建立 app、middleware/exception handlers、lifespan 與 router include。
- Router 只處理 HTTP boundary；business rules 放 service；persistence/query 放 repository；schema/DTO 與 ORM model 不混用。
- 資料結構變更必須使用 migration；不得以 startup `create_all()` 取代正式 migration。
- Auth、settings、database session、security helpers 屬於 backend core 或 feature dependency，不得把 request-specific 狀態放入 global。
- Backend 完成標準至少包含 app 可 import/啟動、相關測試可跑、migration/DB 設定一致；無法驗證時需記錄原因與風險。

## 驗證與交付
- 前後端整合變更需明確列出 API contract、錯誤格式、狀態碼與前端對應行為。
- 可用的 build、test、typecheck、lint、migration、startup、smoke 指令不得跳過；不存在或失敗時要明確回報。
