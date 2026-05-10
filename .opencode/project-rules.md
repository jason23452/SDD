# 專案規則

## 規則來源
- 使用者最新明確規則優先於既有 README、舊流程說明與舊 agent 文字。
- 本專案固定採 multi-worktree 雙平面流程：`propose/spec planning plane` 先為所有通用需求分類建立 spec-plan worktree，並同輪平行產 OpenSpec proposal/spec/design/tasks/alignment；`apply execution plane` 才依 apply stage、contract 與 integration baseline 分批建立 apply-stage worktree 實作。
- 分類需輸出 `specPlanGroupId`、`specPlanWave`、Spec Planning Dispatch Graph、`parallelGroupId`、`eligibleSetId`、`touchSet`、`contractInputs`、`contractOutputs`、`conflictRisk` 與 Stage Execution Graph；主流程在 spec plane 依全分類 ready set 同批平行呼叫 runner，在 apply plane 依 `stage + lane + priority + parallelGroupId` eligible set 同批平行呼叫 runner，並用 dispatch ledger 追蹤每批啟動、完成、錯誤與重試。
- Frontend 變更需遵守 `react-spa-feature-based`；樣式/Tailwind 變更需遵守 `tailwind-css`。
- Backend 變更需遵守 `fastapi-feature-builder`。
- `.opencode/skills/**/SKILL.md` 是不可變規則來源，不得刪除、覆寫、截斷、清空或弱化。

## 已確認長期流程決策
- 使用者要求極致開發效率與品質，因此 OpenSpec propose/spec 不再受 apply stage gate 限制；只要 bootstrap/planner 完成，所有分類都要先建立 spec-plan worktree 並同輪平行產 spec。
- apply/fallback 仍必須穩定優先：每個 apply stage 只使用該 stage 的 integration baseline，stage N 必須等 stage N-1 integration 完成後再建立 apply-stage worktree。
- spec-plan worktree 只產 OpenSpec artifacts，不得 apply、測試、commit、merge 或被 merge 到產品 integration。
- apply-stage worktree 必須複製或引用對應 spec-plan artifacts，先做 strict validate、alignment/revalidation，確認目前 stage baseline 滿足 contractInputs/assumptions 後才可 apply/fallback。
- 若上游 contract 已變更，runner 必須回報 `SPEC_REVALIDATION_REQUIRED`，主流程只更新受影響分類 spec，不得直接套舊 spec。
- 若同一 planning wave 或同一 apply eligible set 有多個 worktree，主流程必須同一輪平行呼叫多個 `openspec-worktree-change-runner`；若工具無法平行，停止並回報 `PARALLEL_DISPATCH_UNAVAILABLE`。
- runner 永遠只處理單一 worktree、單一 classification、單一 OpenSpec change；不得 merge upstream/stage integration、不得切到其他 worktree、不得替主流程調度其他 runner。

## 本次已確認需求決策（run-20260510-cal-auth）
- 本次落地範圍為 `frontend + backend`，MVP 為 `test.md` 的「個人行事曆完整第一版 + 登入迭代」：登入門檻、行程/重要日期/具日期待辦、CRUD、刪除前確認、取消/恢復、完成可回復、日/週/月/清單檢視、提醒、重複、分類顏色/篩選、跨日衝突提示與確認保留都納入第一版。
- Frontend 已確認使用 React + Vite + TypeScript + Tailwind CSS v4；沿用既有專案規則以 pnpm 管理，不得混用 npm/pnpm/yarn。Backend 已確認使用 FastAPI + PostgreSQL，沿用既有專案規則以 uv 管理；PostgreSQL 本機開發依賴由 Docker Compose 啟動。
- 登入採 seed/demo 既有帳號供本機與驗收使用；沿用既有專案規則以 DB server-side session 作為第一版 session 方案，若要改 JWT、signed-cookie-only 或 in-memory session 需另行確認；不做新註冊、社群登入、管理後台或帳號救援/忘記密碼。
- 個人行事曆登入迭代必須保留既有行程管理、重要日期、具日期待辦、日/週/月/清單檢視、提醒、重複、分類、衝突、取消、恢復、完成、完成可回復與逾期規則；登入僅作為個人行事曆進入門檻與存取隔離，不覆蓋既有規則。
- 沿用既有專案日期時間規則：Asia/Taipei 是日期、今日清單、跨日、逾期與重複展開的第一版判斷基準；本次已確認後端是日期、重複、衝突、逾期與提醒狀態的權威，前端負責輸入、顯示、互動與使用者回饋，不得自行成為業務規則權威。
- 提醒第一版採站內提醒、提醒設定、提醒關閉狀態、逾期標示與今日清單補救；必須支援行程前、當日、多次、逾期與可關閉提醒；不保證系統推播或通知絕對送達，且關閉提醒後不得再打擾該行程。
- 登入/登出/失敗/失效狀態不得非必要外露帳號存在性、行程內容、提醒或敏感原因；登出後個人內容不得繼續顯示，再操作需重新登入。
- 第一版不做：純筆記、新註冊、社群登入、多人共享/協作、管理後台、帳號救援/忘記密碼、外部日曆同步、智慧自動排程、地圖/交通整合。
- 已確認驗收層級為完整 E2E，且功能測試必須放回 owning slice；測試與 smoke 必須遵守單點測試矩陣、one-shot、非互動、timeout、`TEST_TIMEOUT` cleanup、process-tree cleanup 與 port-listener cleanup。
- 使用者已授權完整 downstream：`project-bootstrapper -> development-detail-planner -> worktree-splitter(spec-plan all classifications) -> all-classification parallel OpenSpec propose/spec -> worktree-splitter(apply-stage) -> staged/priority-lane/parallelGroup apply-change/fallback -> stage merge integration -> final integration`，且 apply/fallback 成功後授權依小功能建立中文細分 commit。
- 本 run 的 dispatch ledger 固定為 `.opencode/run-artifacts/run-20260510-cal-auth/dispatch-ledger.json`；重試只針對同 planning wave 或同 `eligibleSetId` 內 failed/aborted worktree，不得重跑已完成且 ledger/commit/verification 對齊的 worktree。

## 通用流程
- 需求落地前必須先讀取需求來源與相關 `frontend/README.md`、`backend/README.md`，並沿用現有專案脈絡。
- 既有專案不得重新初始化；若基底不完整，優先在既有資料夾內補齊可啟動、可建置、可測試的必要檔案。
- 不得提交 secrets、真實憑證或個資；範例設定只能放非機密預設值。
- 重大需求變更需先完成分類、一致性檢查與規則檢查，再進入實作。
- 使用者選擇初始化、建立、啟動或落地 frontend/backend 時，除非主動明確限制 downstream，預設授權完整鏈路：`project-bootstrapper -> development-detail-planner -> worktree-splitter(spec-plan all classifications) -> all-classification parallel OpenSpec propose/spec -> worktree-splitter(apply-stage) -> staged/priority-lane/parallelGroup apply-change/fallback -> stage merge integration -> final integration`。
- 進入 bootstrap、worktree split、OpenSpec propose/apply 或整合測試前，必須確認 `.opencode/skills/**/SKILL.md` 沒有實際內容 diff。只以 `git diff --name-only -- .opencode/skills` 與 `git diff --cached --name-only -- .opencode/skills` 判斷；若有實際內容修改，一律停止並回報 `ERROR: skill rules are immutable and cannot be changed`。純 line-ending/stat 假異動或其他非 skill 檔的 `needs update` 不得當成 blocker，也不得 stage/commit skill 檔。
- project-start-rules-definer 更新 `.opencode/project-rules.md` 後，主流程必須重新讀取該檔並確認最新使用者決策已落地；若 planner、question 回答與 project rules 不一致，不得進入 bootstrap、OpenSpec propose/spec、apply 或 verification。

## Multi-Worktree OpenSpec 自動化
- 技術實踐分類必須以「通用需求能力」為基本單位，同類能力放同一分類，並輸出 specPlanGroupId、specPlanWave、apply 階段、優先度 lane、執行優先度、parallelGroupId、eligibleSetId、touchSet、contractInputs、contractOutputs、conflictRisk、Spec Planning Dispatch Graph、Stage Execution Graph 與上游依賴。
- 同一後端 bounded capability 的 model、migration、schema、repository、service、router、dependencies、fixtures 與 tests 必須優先在同一 worktree；同一前端使用者流程的 route/page、feature UI、hook/state、API service、types、tests 與必要樣式必須優先在同一 worktree；同一能力若跨 frontend/backend，仍應同類聚合。
- Core domain 可在 contract 穩定後拆成多個 vertical micro-slices；每個 slice 必須能在 stage baseline 上獨立 apply、驗證與 commit。若共同 schema/API/helper 尚未穩定，必須先建立 contract-first stage 或合併分類。
- `backend-tests`、`frontend-tests` 這類純測試分類只有在處理跨專案測試基礎設施或 smoke orchestrator 時才可獨立；功能行為測試必須回到 owning feature 分類。
- Spec Planning Dispatch Graph 是 propose/spec 派工依據：bootstrap/planner 完成後，主流程必須一次建立所有分類的 spec-plan worktree，並在同一輪平行呼叫所有 `openspec-worktree-change-runner phase=propose-spec`。未來 apply stage 的分類不得因上游尚未 merge 而延後 propose/spec；只能在 spec artifact 中標明 contractInputs、assumptions 與 apply 前 revalidation gate。
- Stage Execution Graph 是 apply/fallback 派工依據；eligible set 固定為 `stage + lane + priority + parallelGroupId`，並派生 canonical `eligibleSetId`，格式為 `stage-<n>::lane-<lane>::priority-<p-or-none>::pg-<parallelGroupId>`。
- `worktree-splitter` 支援兩種模式：`spec-plan` 一次為所有分類建立 `.worktree/<run_id>/spec/<name>` 與 branch `worktree/<run_id>/spec/<name>`；`apply-stage` 依目前 apply 階段建立 `.worktree/<run_id>/stage-<n>/<name>` 與對應 branch。禁止預建未來 apply worktree；spec-plan worktree 不屬於 apply worktree，可全量預建。
- Splitter 的 manifest 與 port map 必須保留 `mode`、`specPlanGroupId`、`specPlanWave`、`parallelGroupId`、`eligibleSetId`、`touchSet`、`contractInputs`、`contractOutputs`、`conflictRisk`、spec-plan artifact source 與 dispatch ledger path，供 runner、merge integrator 與主流程驗證 dispatch/contract/revalidation gate。
- OpenSpec propose/spec 依 Spec Planning Dispatch Graph 全量平行啟動；每個 spec-plan worktree 在自己的 `spec-flow/` 內建立 OpenSpec change、proposal、specs、design、tasks 與 alignment-check，並 strict validate。
- Apply 前必須用 `apply-stage` splitter 從正確 stage baseline 建立/同步 apply worktree，並複製或引用對應 spec-plan worktree 中已通過的 OpenSpec artifacts；runner 必須先對目前 apply baseline 重新 strict validate 與 alignment/revalidation。
- 每個 apply 階段 worktree apply/fallback 完成、驗證完成且沒有未 commit 變更後，由 `worktree-merge-integrator` 一般 merge 到 stage integration；spec-plan worktree 不得 merge 到產品 integration，只作為 OpenSpec artifact source。
- 如果分類 apply 時必須等待同階段另一 worktree 尚未 merge 的程式碼、schema、helper、dependency 或 fixture，代表分類或 apply 階段錯誤；主流程必須回到 classifier/planner 調整階段或合併分類，不得以 dependency hydrate、手動猜測 contract 或在 runner 內跨 worktree merge 取代。
- 主流程必須維護 `.opencode/run-artifacts/<run_id>/dispatch-ledger.json`：每批 `propose-spec-plan` / `apply-change` 啟動前記錄 phase、mode、stage、specPlanGroupId、specPlanWave、eligibleSetId、預期 worktree/branch/classification、Task 啟動結果；完成後記錄 runner final output、commit/verification、錯誤碼與重試次數。ledger 缺失或與實際 worktree 不一致時，不得進入下一批或 merge。

## 中斷恢復與 Stale Process 防護
- 任何 bootstrap、worktree apply 或 integration server smoke 不得只依賴 `finally` cleanup；使用者或工具中斷 subagent 時，`finally` 可能無法執行，因此每次啟動 smoke server 前都必須具備可重入的 stale process recovery gate。
- 每個 smoke server 啟動後必須立即寫入 PID registry：`.opencode/run/<run_id>/smoke-processes/<scope>-<port>.json`。registry 至少記錄 `run_id`、scope、workspace/worktree path、command、port、parent PID、startedAt。`.opencode/run/` 是 generated runtime state，不得 commit。
- 執行任何 install/build/test/smoke 前，必須先執行 stale process recovery gate：讀取 PID registry 與 assigned ports，檢查 process command line；只有 command line 同時符合目前 workspace/worktree path、registry command 或該次 smoke 命令、assigned port 時，才可遞迴停止 process tree 與 port listener。
- 若 assigned port 被未知行程佔用、command line 不屬於目前 workspace/worktree 或無法確認是本流程殘留，不得自動換 port 或強殺；必須 fail fast，列出 port、PID、command line，請主流程或使用者決策。

## 測試與卡住防護
- 執行任何 bootstrap、worktree apply 或 integration 驗證前，必須先產生單點測試矩陣，列出 frontend、backend、E2E 是否可測、入口檔、命令、timeout、skip/blocker 原因。
- 測試命令必須 one-shot、非互動且可自動結束。禁止 watch mode；Vitest 使用 `vitest run` 或 package script 等價命令；pytest 使用 `pytest -q --maxfail=1` 或既有等價命令；Playwright 使用 headless/non-interactive。
- 每個 install/build/test/smoke 命令都必須有 timeout。逾時時回報 `TEST_TIMEOUT`、清理 process tree、檢查 assigned port listener，不能無限等待、不能自動換未知 port、不能宣稱完成。
- 只有 generated artifacts（`node_modules`、`.venv`、`dist`、`test-results`、`.pytest_cache`、`.ruff_cache`、`__pycache__`）不得視為可測專案；README 佔位也不等於可測專案。
- Bootstrapper 建立新專案時必須同步建立忽略規則，避免 `node_modules`、`.venv`、`dist`、cache、test results、`.opencode/run` 與 `.opencode/run-artifacts` 成為待 commit 檔案。

## Frontend 規則
- Frontend 沿用 React SPA、Vite、TypeScript 與現有 lockfile 對應的 package manager；本次已明確指定 frontend 使用 pnpm，後續不得混用 npm/pnpm/yarn。
- 前端採 feature-based 結構：使用者可見流程放在 `src/features/<feature>/`，route/page 組裝放在 `src/pages/` 或 `src/app/`，跨功能且不含業務語意的程式才放 `src/shared/`。
- `shared/` 不得 import `features/`；跨 feature 使用需透過 feature public entry 或抽成真正通用的 shared code。
- 前端完成標準至少包含可安裝、可啟動、可 build，並針對主要 route/流程做 smoke 驗證；無法驗證時需記錄原因與風險。
- 若導入或修改 Tailwind/CSS，必須依 Tailwind CSS v4 官方文件與目前 bundler 整合，不使用 v3 初始化方式，不新增未確認的 UI/styling 套件。

## Backend 規則
- Backend 已確認採 FastAPI + PostgreSQL（migration 管理 schema）；新增後端功能需沿用 `app/`、`app/core/`、`app/features/` 的 feature-based 結構。若未來要改用 SQLite 或其他資料庫，需先經使用者明確確認並記錄遷移影響。
- Backend 本次已明確指定以 uv 管理套件與執行命令，PostgreSQL 本機開發依賴使用 Docker Compose；登入 session 使用 DB server-side session，不得未確認改為 JWT、signed-cookie-only 或 in-memory session。
- FastAPI `app/main.py` 保持薄，只負責建立 app、middleware/exception handlers、lifespan 與 router include。
- Router 只處理 HTTP boundary；business rules 放 service；persistence/query 放 repository；schema/DTO 與 ORM model 不混用。
- 資料結構變更必須使用 migration；不得以 startup `create_all()` 取代正式 migration。
- Auth、settings、database session、security helpers 屬於 backend core 或 feature dependency，不得把 request-specific 狀態放入 global。

## 驗證與交付
- 前後端整合變更需明確列出 API contract、錯誤格式、狀態碼與前端對應行為。
- 可用的 build、test、typecheck、lint、migration、startup、smoke 指令不得跳過；不存在或失敗時要明確回報。
- 各 worktree 使用 `worktree-splitter` 分配的 ports；整合驗證使用 integration 專用 ports，避免平行測試互相干擾。
- 若測試入口不存在，必須依單點測試矩陣標記 skip 或 blocker；不得直接執行會卡住的預設命令。

## 規則更新紀錄
- 2026-05-10：依使用者目標固定採 multi-worktree 流程，啟用 splitter/runner/merge integrator，明確化每個通用需求分類一個 worktree、各自 spec-flow、依 apply 階段分成需要優先度與不需優先度 lane。
- 2026-05-10：新增測試卡住防護規則：測試前必須有單點測試矩陣、frontend/backend/E2E gate、one-shot 非互動命令、timeout、`TEST_TIMEOUT` cleanup；worktree snapshot 不同步 dependency/cache/build/test artifacts。
- 2026-05-10：依使用者要求提升極致開發效率與品質，將 multi-worktree 改為雙平面：`propose/spec planning plane` 全分類 spec-plan worktree 同輪平行產 OpenSpec artifacts；`apply execution plane` 才依 stage integration baseline、contractInputs、eligibleSetId 與 revalidation gate 分批 apply/fallback。禁止預建未來 apply worktree，但允許全量預建 spec-plan worktree。
