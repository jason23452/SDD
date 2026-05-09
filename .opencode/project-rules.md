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
- 本專案流程採單一工作區全自動落地：bootstrap 後在主工作區產生/更新 planner，於主工作區 `spec-flow/` 內自動產生 OpenSpec proposal/specs/design/tasks，通過 strict validate 後直接在同一工作區 apply、驗證與整理結果。
- 禁止以 `.worktree/` 拆分、平行 worktree apply 或 worktree merge 作為預設流程；除非使用者日後明確要求回復 worktree 策略，否則 worktree 相關 agent 一律不得執行。
- 進入 bootstrap、OpenSpec propose/apply 或整合測試前，必須確認 `.opencode/skills/**/SKILL.md` 沒有未提交修改；若有修改，一律停止並回報 `ERROR: skill rules are immutable and cannot be changed`，不得把 skill 變更混入需求實作或流程修正。
- project-start-rules-definer 更新 `.opencode/project-rules.md` 後，主流程必須重新讀取該檔並確認最新使用者決策已落地；若 planner、question 回答與 project rules 不一致，不得進入 bootstrap 或 OpenSpec apply。

## 單一工作區自動化
- 主工作區 OpenSpec path 固定為 `spec-flow/`；不得為同一 run 建立 `.worktree/<run_id>/...` 或以 worktree branch 作為 apply 單位。
- classification 仍可用於拆任務與排序，但 OpenSpec change 預設為單一整合 change：`<run_id>-implementation`。所有分類需在同一 change 的 specs/design/tasks 中完整呈現，並依依賴順序 apply。
- 自動化順序固定為：`init-project -> technical-practice-classifier -> requirement-consistency-checker -> project-start-rules-definer -> project-bootstrapper（需要時） -> development-detail-planner -> single-workspace OpenSpec propose/spec -> strict validate -> single-workspace apply/fallback -> integration verification -> final report`。
- 使用者選擇初始化、建立、啟動或落地 frontend/backend 時，視為授權完整 downstream；完整 downstream 同時授權 apply/fallback 成功後依小功能自動建立中文細分 commit。只有使用者主動明確要求不要 commit 時，才改為回報未提交變更與建議 commit 切分。
- OpenSpec artifacts 必須自動生成：`proposal.md`、`design.md`、`tasks.md`、`specs/**/spec.md`、`alignment-check.md`；不得只產空目錄或口頭計畫。
- apply 完成後必須更新 tasks checkbox、執行可用驗證、確認 `git status --porcelain` 只剩使用者既有無關變更或流程允許的未追蹤資料；若新增需求/流程檔未提交或未說明，不得宣稱完成。
- Server smoke 必須 bounded：啟動前檢查 port、啟動後記錄 PID/job、驗證完成或失敗都必須停止，最後檢查 port 釋放；不得留下長駐 dev server。

## Frontend 規則
- Frontend 沿用 React SPA、Vite、TypeScript 與現有 lockfile 對應的 package manager；目前 `frontend/pnpm-lock.yaml` 存在時使用 pnpm，不混用 npm/yarn。
- 前端採 feature-based 結構：使用者可見流程放在 `src/features/<feature>/`，route/page 組裝放在 `src/pages/` 或 `src/app/`，跨功能且不含業務語意的程式才放 `src/shared/`。
- `shared/` 不得 import `features/`；跨 feature 使用需透過 feature public entry 或抽成真正通用的 shared code。
- 前端完成標準至少包含可安裝、可啟動、可 build，並針對主要 route/流程做 smoke 驗證；無法驗證時需記錄原因與風險。
- 若導入或修改 Tailwind/CSS，必須依 Tailwind CSS v4 官方文件與目前 bundler 整合，不使用 v3 初始化方式，不新增未確認的 UI/styling 套件。

## Backend 規則
- Backend 已確認採 FastAPI + PostgreSQL（migration 管理 schema）；新增後端功能需沿用 `app/`、`app/core/`、`app/features/` 的 feature-based 結構。若未來要改用 SQLite 或其他資料庫，需先經使用者明確確認並記錄遷移影響。
- FastAPI `app/main.py` 保持薄，只負責建立 app、middleware/exception handlers、lifespan 與 router include。
- Router 只處理 HTTP boundary；business rules 放 service；persistence/query 放 repository；schema/DTO 與 ORM model 不混用。
- 資料結構變更必須使用 migration；不得以 startup `create_all()` 取代正式 migration。
- Auth、settings、database session、security helpers 屬於 backend core 或 feature dependency，不得把 request-specific 狀態放入 global。
- Backend 完成標準至少包含 app 可 import/啟動、相關測試可跑、migration/DB 設定一致；無法驗證時需記錄原因與風險。

## 驗證與交付
- 前後端整合變更需明確列出 API contract、錯誤格式、狀態碼與前端對應行為。
- 可用的 build、test、typecheck、lint、migration、startup、smoke 指令不得跳過；不存在或失敗時要明確回報。

## 規則更新紀錄
- 2026-05-10：依使用者要求移除 worktree 流程，改為主工作區單一 OpenSpec change 全自動 propose/apply/verify；同時保留 skill immutable gate、project rules read-back gate 與 bounded server smoke gate。
