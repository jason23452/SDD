# 專案規則

## 規則來源
- 使用者最新明確規則優先於既有 README、舊流程說明與舊 agent 文字。
- 本專案固定採 multi-worktree 流程：每個技術實踐分類一個 worktree，各自擁有自己的 `spec-flow/` 與 OpenSpec change。
- Frontend 變更需遵守 `react-spa-feature-based`；樣式/Tailwind 變更需遵守 `tailwind-css`。
- Backend 變更需遵守 `fastapi-feature-builder`。
- `.opencode/skills/**/SKILL.md` 是不可變規則來源，不得刪除、覆寫、截斷、清空或弱化。

## 本次已確認需求決策（calendar-fullstack-20260510-b1）
- 本次落地範圍為 `frontend + backend`，採完整 MVP；frontend 使用 Vite + React + TypeScript，backend 使用 FastAPI，資料與登入採 PostgreSQL + JWT。
- 個人行事曆登入迭代必須保留既有行程管理、檢視、提醒、重複、分類、衝突、取消、恢復、完成與逾期規則；登入僅作為個人行事曆進入門檻與存取隔離，不覆蓋既有規則。
- 後端是日期、重複、衝突、逾期與提醒狀態的權威；前端負責輸入、顯示、互動與使用者回饋，不得自行成為業務規則權威。
- 提醒第一版採站內提醒狀態與今日清單補救；必須支援行程前、當日、多次、逾期與可關閉提醒；不保證系統推播或通知絕對送達，且關閉提醒後不得再打擾該行程。
- 登入/登出/失敗/失效狀態不得非必要外露帳號存在性、行程內容、提醒或敏感原因；登出後個人內容不得繼續顯示，再操作需重新登入。
- 第一版不做：純筆記、新註冊、社群登入、多人共享/協作、管理後台、帳號救援/忘記密碼、外部日曆同步、智慧自動排程、地圖/交通整合。
- 已確認驗收包含單元測試與 E2E；測試與 smoke 必須遵守單點測試矩陣、one-shot、非互動、timeout、`TEST_TIMEOUT` cleanup、process-tree cleanup 與 port-listener cleanup。
- 使用者已授權完整 downstream：`project-bootstrapper -> development-detail-planner -> worktree-splitter -> parallel OpenSpec propose/spec -> parallel apply-change/fallback -> worktree-merge-integrator`，且 apply/fallback 成功後授權依小功能建立中文細分 commit。

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
- `worktree-splitter` 依分類 ID 建立 `.worktree/<run_id>/<name>` 與對應 branch，並同步目前主工作區完整檔案快照；同步時排除 `.git`、`.worktree`、主工作區 `spec-flow`、`.opencode/skills`、`node_modules`、`.venv`、`dist`、`build`、cache、coverage 與測試報告等 generated artifacts，讓各 worktree 保留 HEAD 中乾淨的 skill 檔並自行依 lockfile/pyproject 重建依賴；不得在 splitter 階段實作、測試、commit、merge 或 push。
- OpenSpec propose/spec 必須同批平行啟動：每個 worktree 先用 `openspec new change "<change>" --schema spec-driven` 建立 change，再產生 `proposal.md`、`design.md`、`tasks.md`、`specs/**/spec.md`、`alignment-check.md`，並通過 strict validate。
- 所有 worktree 的 alignment 與 strict validate 全部通過後，才能同批平行執行 apply-change/fallback；每個 worktree 必須獨立 apply、驗證，並依小功能建立中文細分 commit。
- 所有 worktree apply/fallback 完成、驗證完成且沒有未 commit 變更後，才可由 `worktree-merge-integrator` 一般 merge 到 `.worktree/<run_id>/merge` 與 `integration/<run_id>`；禁止 squash/rebase，遇到衝突需先讀 planner 與相關 `spec-flow` artifacts 並用 question 確認解法。
- Server smoke 必須 bounded：啟動前檢查 port、啟動後記錄 PID/job、驗證完成或失敗都必須停止，最後檢查 port 釋放；不得留下長駐 dev server。

## 中斷恢復與 Stale Process 防護
- 任何 bootstrap、worktree apply 或 integration server smoke 不得只依賴 `finally` cleanup；使用者或工具中斷 subagent 時，`finally` 可能無法執行，因此每次啟動 smoke server 前都必須具備可重入的 stale process recovery gate。
- 每個 smoke server 啟動後必須立即寫入 PID registry：`.opencode/run/<run_id>/smoke-processes/<scope>-<port>.json`；worktree 內可使用該 worktree 自己的 `.opencode/run/<run_id>/...`。registry 至少記錄 `run_id`、scope、workspace/worktree path、command、port、parent PID、startedAt。`.opencode/run/` 是 generated runtime state，不得 commit。
- 執行任何 install/build/test/smoke 前，必須先執行 stale process recovery gate：讀取 PID registry 與 assigned ports，檢查 process command line；只有 command line 同時符合目前 workspace/worktree path、registry command 或該次 smoke 命令、assigned port 時，才可遞迴停止 process tree 與 port listener。
- 若 assigned port 被未知行程佔用、command line 不屬於目前 workspace/worktree 或無法確認是本流程殘留，不得自動換 port 或強殺；必須 fail fast，列出 port、PID、command line，請主流程或使用者決策。
- smoke script 成功、失敗或 timeout 時仍必須在 cleanup 段遞迴停止 descendants、停止 parent、檢查並清理本次 smoke listener、刪除 registry；若 script 被中斷，下次流程必須靠 recovery gate 清理 registry 指向的 stale process。
- subagent 被 abort、工具中斷或沒有回傳 final output 時，主流程不得直接重跑同一步驟或宣稱卡住；必須先回收已產生檔案、PID registry、port listener 與測試 cache，清理可確認的本流程殘留後，再判斷 resume、cleanup 或回報 blocker。

## 測試與卡住防護
- 執行任何 bootstrap、worktree apply 或 integration 驗證前，必須先產生單點測試矩陣，列出 frontend、backend、E2E 是否可測、入口檔、命令、timeout、skip/blocker 原因。
- Frontend 測試 gate：只有存在 `frontend/package.json`、對應 script 與 source/test entry 時才可跑 npm/pnpm/yarn scripts；缺入口且分類需要前端功能時是 blocker，不得硬跑。
- Backend 測試 gate：只有存在 `backend/pyproject.toml` 或既有 dependency file、正式 app entrypoint 與測試檔或 import/health check 時才可跑 uv/pytest；缺入口且分類需要後端功能時是 blocker，不得硬跑。
- E2E gate：只有存在 Playwright config、E2E 測試檔、必要 server 啟動方式與 assigned ports 時才可跑；缺入口時需標記未執行原因，不得進入互動或 watch mode。
- 測試命令必須 one-shot、非互動且可自動結束。禁止 watch mode；Vitest 使用 `vitest run` 或 package script 等價命令；pytest 使用 `pytest -q --maxfail=1` 或既有等價命令；Playwright 使用 headless/non-interactive。
- 每個 install/build/test/smoke 命令都必須有 timeout。逾時時回報 `TEST_TIMEOUT`、清理 process tree、檢查 assigned port listener，不能無限等待、不能自動換未知 port、不能宣稱完成。
- 只有 generated artifacts（`node_modules`、`.venv`、`dist`、`test-results`、`.pytest_cache`、`.ruff_cache`、`__pycache__`）不得視為可測專案；README 佔位也不等於可測專案。
- Bootstrapper 建立新專案時必須同步建立忽略規則，避免 `node_modules`、`.venv`、`dist`、cache、test results 與 `.opencode/run` 成為待 commit 檔案。

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
- 若測試入口不存在，必須依單點測試矩陣標記 skip 或 blocker；不得直接執行會卡住的預設命令。

## 規則更新紀錄
- 2026-05-10：依使用者目標固定採 multi-worktree 流程，啟用 splitter/runner/merge integrator，明確化每分類獨立 worktree、各自 spec-flow、平行 OpenSpec propose/apply、一般 merge integration、實際內容 diff 型 skill immutable gate、project rules read-back gate 與 bounded server smoke gate。
- 2026-05-10：新增測試卡住防護規則：測試前必須有單點測試矩陣、frontend/backend/E2E gate、one-shot 非互動命令、timeout、`TEST_TIMEOUT` cleanup；worktree snapshot 不同步 dependency/cache/build/test artifacts。
