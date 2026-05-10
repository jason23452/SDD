# 專案規則

## 規則來源
- 使用者最新明確規則優先於既有 README、舊流程說明與舊 agent 文字。
- 本專案固定採 multi-worktree 流程：每個技術實踐分類一個 worktree，各自擁有自己的 `spec-flow/` 與 OpenSpec change。
- Frontend 變更需遵守 `react-spa-feature-based`；樣式/Tailwind 變更需遵守 `tailwind-css`。
- Backend 變更需遵守 `fastapi-feature-builder`。
- `.opencode/skills/**/SKILL.md` 是不可變規則來源，不得刪除、覆寫、截斷、清空或弱化。

## 通用流程
- 需求落地前必須先讀取需求來源與相關 `frontend/README.md`、`backend/README.md`，並沿用現有專案脈絡。
- 既有專案不得重新初始化；若基底不完整，優先在既有資料夾內補齊可啟動、可建置、可測試的必要檔案。
- 不得提交 secrets、真實憑證或個資；範例設定只能放非機密預設值。
- 重大需求變更需先完成分類、一致性檢查與規則檢查，再進入實作。
- 使用者選擇初始化、建立、啟動或落地 frontend/backend 時，除非主動明確限制 downstream，預設授權完整鏈路：`project-bootstrapper -> development-detail-planner -> worktree-splitter -> parallel OpenSpec propose/spec -> parallel apply-change/fallback -> worktree-merge-integrator`。
- 進入 bootstrap、worktree split、OpenSpec propose/apply 或整合測試前，必須確認 `.opencode/skills/**/SKILL.md` 沒有實際內容 diff。只以 `git diff --name-only -- .opencode/skills` 與 `git diff --cached --name-only -- .opencode/skills` 判斷；若有實際內容修改，一律停止並回報 `ERROR: skill rules are immutable and cannot be changed`。純 line-ending/stat 假異動或其他非 skill 檔的 `needs update` 不得當成 blocker，也不得 stage/commit skill 檔。
- project-start-rules-definer 更新 `.opencode/project-rules.md` 後，主流程必須重新讀取該檔並確認最新使用者決策已落地；若 planner、question 回答與 project rules 不一致，不得進入 bootstrap 或 OpenSpec apply。

## Multi-Worktree OpenSpec 自動化
- 主工作區只負責 init/project rules/bootstrap/planner 與協調；OpenSpec artifacts 由各 worktree 在各自 `<worktree>/spec-flow/` 內建立，不在主工作區共用單一 change。
- `worktree-splitter` 依分類 ID 建立 `.worktree/<run_id>/<name>` 與對應 branch，並同步目前主工作區完整檔案快照；同步時排除 `.git`、`.worktree`、主工作區 `spec-flow` 與 `.opencode/skills`，讓各 worktree 保留 HEAD 中乾淨的 skill 檔；不得在 splitter 階段實作、測試、commit、merge 或 push。
- OpenSpec propose/spec 必須同批平行啟動：每個 worktree 先用 `openspec new change "<change>" --schema spec-driven` 建立 change，再產生 `proposal.md`、`design.md`、`tasks.md`、`specs/**/spec.md`、`alignment-check.md`，並通過 strict validate。
- 所有 worktree 的 alignment 與 strict validate 全部通過後，才能同批平行執行 apply-change/fallback；每個 worktree 必須獨立 apply、驗證，並依小功能建立中文細分 commit。
- 所有 worktree apply/fallback 完成、驗證完成且沒有未 commit 變更後，才可由 `worktree-merge-integrator` 一般 merge 到 `.worktree/<run_id>/merge` 與 `integration/<run_id>`；禁止 squash/rebase，遇到衝突需先讀 planner 與相關 `spec-flow` artifacts 並用 question 確認解法。
- Server smoke 必須 bounded：啟動前檢查 port、啟動後記錄 PID/job、驗證完成或失敗都必須停止，最後檢查 port 釋放；不得留下長駐 dev server。

## Frontend 規則
- Frontend 沿用 React SPA、Vite、TypeScript 與現有 lockfile 對應的 package manager；無 lockfile 且無 repo 慣例時使用 npm，不混用 npm/pnpm/yarn。
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
- 各 worktree 使用 `worktree-splitter` 分配的 ports；整合驗證使用 integration 專用 ports，避免平行測試互相干擾。

## 規則更新紀錄
- 2026-05-10：依使用者目標固定採 multi-worktree 流程，啟用 splitter/runner/merge integrator，明確化每分類獨立 worktree、各自 spec-flow、平行 OpenSpec propose/apply、一般 merge integration、實際內容 diff 型 skill immutable gate、project rules read-back gate 與 bounded server smoke gate。
