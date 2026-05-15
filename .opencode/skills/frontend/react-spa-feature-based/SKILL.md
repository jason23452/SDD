---
name: react-spa-feature-based
description: >-
  前端開發的強制規範 skill。只要任務涉及任何前端開發、前端修改、前端修復、前端重構、UI、樣式、component、layout、route、navigation、form、state、store、hook、API 串接、assets、tests、Playwright、browser smoke check、React SPA、Vite、TypeScript、package scripts、dev/build/preview 啟動流程，或判斷程式碼應放入 feature 或 shared，就必須使用此 skill。此 skill 以 feature-based 架構管理 routes、pages、features、shared、components、state、API services、assets 與 tests，並要求交付可安裝、可啟動、可建置、可驗證的前端專案或前端變更。
---

# React SPA Feature Based

此 skill 是前端開發的強制執行契約。只要任務涉及任何前端開發、前端修改、前端修復、前端重構、UI、樣式、路由、狀態、API 串接、測試或瀏覽器驗證，就必須使用此 skill。目標只有三件事：交付可安裝、可啟動、可建置、可驗證的 React SPA；維持清楚的 app/page/feature/shared 邊界；優先使用成熟套件完成需求，不得把手動造輪子當成預設方案。

## Bootstrap 硬規則

- 只要建立、初始化、scaffold、修復或重建 frontend 專案，且 repo 原本不存在可沿用的前端基底，本 skill 內所有 baseline、setup、installation、routing、scripts、providers、alias、verification 與 browser smoke 條款都屬 bootstrap 階段硬要求，必須在 bootstrap 一次完成。
- 不得把本 skill 的 bootstrap 條款標記為 `optional`、`deferred`、`pending`、`placeholder`、`later` 或任何等價延後語意。
- 唯一例外是 repo 原本已存在對應檔案與可運作契約；此時必須優先沿用既有專案，但若現況不符合本 skill 契約，仍需在 bootstrap 補齊缺漏。

## 適用總則

- 新專案、專案初始化、骨架建立、或使用者明確要求套用本 skill 架構時，必須完整遵守本 skill 的檔案架構、baseline 套件、啟動契約、驗證規則與瀏覽器檢查規則。
- 既有專案若未明確要求遷移架構，必須優先沿用既有 layout、router、state library、styling system、test runner、bundler 與部署契約；但 feature/shared 邊界、套件決策規則、啟動契約、驗證門檻與 browser smoke check 仍然必須遵守。
- 既有專案與本 skill 的新專案骨架不同時，不得直接套模板覆蓋；必須在不破壞既有契約的前提下，套用本 skill 的等價約束。

## 執行順序

1. 必須先檢查現況，再修改檔案。至少檢查 `package.json`、lockfile、source tree、entry files、router、styles、state/data library、test/build scripts、alias 設定與既有命名慣例。
2. 必須先確認專案是否已可啟動。若缺少啟動方式，必須補齊 package scripts 或建立必要的 React SPA scaffold。
3. 必須優先沿用既有技術選型。不得在未必要時更換 router、state library、styling system、test runner、package manager 或 bundler。
4. 必須以 vertical slice 實作使用者可見功能。route/page、feature UI、hooks、services、state、types、assets 與 tests 應依同一個使用者流程一起交付。
5. 必須在完成後執行可用的 typecheck、lint、test、build 與 browser smoke check。若無法執行，必須回報原因、影響範圍與剩餘風險。

## 啟動契約

任務涉及建立、修改或修復 React SPA 時，專案必須具備明確且可執行的啟動流程。

1. 必須依 lockfile 決定 package manager：
   - `pnpm-lock.yaml`：使用 `pnpm`。
   - `yarn.lock`：使用 `yarn`。
   - `package-lock.json`：使用 `npm`。
   - 沒有 lockfile：除非 repo 文件或既有慣例指定其他工具，否則使用 `npm`。
2. 不得混用 package manager。若專案已有 lockfile，新增依賴與執行 scripts 必須使用同一套工具。
3. `package.json` 至少必須具備下列 scripts；若既有 framework 使用不同名稱，必須保留既有慣例並確保功能等價：
    - `dev`：啟動本機開發伺服器。
    - `build`：產生 production build。
    - `preview`：在 bundler 支援時預覽 production build。
    - `typecheck`：執行 TypeScript 型別檢查；若專案不是 TypeScript，必須在規劃或回報中明確說明。
4. Vite React 專案應採用以下 scripts，除非既有專案已有明確且可用的替代設定：

```json
{
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 0.0.0.0",
    "typecheck": "tsc --noEmit"
  }
}
```

5. 若使用者需要試用介面，必須啟動 dev server，並回報實際 URL。若預設 port 被占用，必須使用該工具支援的方式改用其他 port。
6. 啟動後必須進行瀏覽器驗證。至少確認畫面非空白、主要 route 可載入、核心互動可執行，且沒有阻塞流程的 runtime error。
7. 驗證層級必須分開處理，不得混為一談：
   - `dev`：用於本機開發與互動式 smoke check。
   - `build`：用於 production build 驗證。
   - `preview`：只在 bundler 或既有專案提供正式 preview 流程時執行，用於驗證 production build 可被預覽。
   - `test:e2e`：只在 repo 已提供 e2e script，或本次任務已明確採用 Playwright/browser automation 路線時執行。

## 套件決策契約

套件選用是強制決策流程，不是自由發揮區：

- 能用成熟、主流、維護中的套件完成需求時，必須優先使用套件；禁止先手動造輪子，再把套件當備案。
- 新專案必須先安裝 scaffold 產生的 baseline 套件；baseline 指 React、React DOM、Vite、TypeScript 與其 scaffold 預設帶入的必要工具。只有 capability 套件才由 user story 決定是否安裝。
- capability 套件必須根據 user story 判斷；不得為未被需求證明的能力預裝依賴。
- 若 user story 已明確要求某能力，必須安裝對應套件並完成 wiring；不得只留下 TODO、假資料流程或空殼 hooks/store/services。
- 若同一能力存在多個合理套件方案，或 user story 不足以唯一決定是否需要該能力，必須先詢問使用者，再進行安裝或實作。
- 若決定不採用成熟套件，必須有明確理由，例如既有依賴衝突、授權限制、bundle 限制、部署限制、效能限制或使用者明確要求；不得只因個人偏好而手作通用前端基礎能力。
- 一旦選擇安裝某能力所需套件，必須同步完成 route wiring、providers、types、validation、state wiring、API integration、tests 與 browser verification；不得只安裝套件或只改一半。
- 套件決策必須與既有 package manager、lockfile、runtime stack、styling system、test runner 與 deployment contract 一致；不得為了單一功能引入第二套等價基礎框架。
- 樣式、theme、design token、utility class 與 UI primitives 必須沿用既有 styling system；若任務涉及 Tailwind、全域樣式或設計 token，必須同時遵守對應的樣式 skill 與既有專案規範。

## 新專案契約

當 repo 尚無 React SPA 且使用者要求建立前端應用時，除非使用者明確指定其他 stack，必須建立 Vite + React + TypeScript 專案。

標準 scaffold 命令：

```bash
npm create vite@latest . -- --template react-ts
npm install
```

Baseline 與 capability 依賴規範：

- baseline 依賴以 scaffold 預設產物為準，不得任意刪減或替換，除非使用者明確要求其他 stack。
- capability 依賴只有在 user story 證明需要時才可新增；不得把 capability 套件偽裝成 baseline。

- `react-router-dom`：當專案需要 SPA routing 時加入；使用 route-based navigation 時不得手刻 router。
- `@tanstack/react-query` 或既有 server-state library：當任務需要快取、重新抓取、stale state 管理、mutation status 或複數畫面共享 remote state 時優先使用；不得手刻等價 server-state framework。
- `react-hook-form` 搭配 `zod` 或既有 form/validation 套件：當任務涉及中大型表單、欄位驗證、錯誤訊息映射或 schema-based validation 時優先使用；不得手刻通用表單框架。
- `axios`：只有既有專案已使用，或任務明確需要 HTTP service layer、interceptors、instance config 或統一錯誤處理時加入。
- `zustand`：只有既有專案已使用，或任務明確需要跨 component/feature 的 client state 時加入；不得為局部 UI state 濫用 global store。
- `playwright`：當任務需要 browser smoke coverage 或既有專案已使用 Playwright 時加入。
- 不得為了套用模板而新增未被需求使用的依賴。

新 React SPA 至少必須具備：

```text
src/
  main.tsx
  app/
    App.tsx
    router.tsx
    providers.tsx
  pages/
  features/
  shared/
    ui/
    components/
    lib/
    hooks/
    store/
    types/
  assets/
tests/
```

若使用 Vite + TypeScript，應將 `@` 設為 `src/` alias，並同步設定 `tsconfig.json` 與 `vite.config.ts`。

新專案建立完成後，不得停在 scaffold 狀態。至少必須補齊 app shell、router wiring、可啟動首頁、基本 route 驗證與 build 驗證；未達到前不得宣稱完成。

## 架構邊界

所有使用者可見功能必須優先放入 feature。只有符合 domain-neutral 條件的程式碼才可放入 shared。

`src/features/<feature-name>/` 必須用於：

- product-specific UI、business rule、workflow、route flow、API interaction。
- feature-specific hooks、services、state、types、utils、assets。
- 只被單一 feature 使用的 component 或 helper。

`src/shared/` 只能用於：

- 不含產品語意的 visual primitives。
- 不含 feature business rule 的 composed reusable components。
- domain-neutral utilities、API clients、format helpers、generic hooks、generic types。
- 多個無關 features 共同依賴的 app-wide client state。

`shared/` 不得 import `features/`。若 shared code 需要 feature-specific logic，該程式碼必須移回 feature，或拆分出真正 domain-neutral 的部分。

`src/app/` 必須只放 app shell、providers、router、全域 bootstrapping 與 app-level wiring。`src/pages/` 必須只放 route-level screens。`src/features/` 必須只放使用者可見流程的 feature-owned code。不得把 feature business flow 塞進 `app/` 或把 route screen 塞進 `shared/`。

## Feature 結構

feature-owned code 必須依下列結構組織：

```text
src/features/<feature-name>/
  index.ts
  assets/
  components/
  services/
    <feature-name>.services.ts
  hooks/
    <feature-name>.hook.ts
  store/
    <feature-name>.store.ts
  utils/
    <feature-name>.utils.ts
  types/
    <feature-name>.types.ts
```

規範：

- `index.ts` 必須作為 feature public entry point。
- route/page files 應只負責組裝 layout、URL params、navigation 與 feature entry points。
- 不得從其他 feature 深層 import internal folders，例如 `@/features/order/components/...`。
- 跨 feature 使用時，必須透過 public entry point，或先抽出 domain-neutral shared code。
- feature-specific API request functions 必須放在 `services/`。
- feature-specific client state 必須放在 `store/`。
- 小 feature 不得硬建空資料夾或空檔案。只有在有明確職責與使用點時，才可新增 `components/`、`services/`、`hooks/`、`store/`、`utils/`、`types/`、`assets/`。
- 不得為了模板完整性建立未被 import、未被 route 使用、未被測試覆蓋的空殼 feature。

## Routing 規範

- 標準 React SPA 應使用 `react-router-dom`，除非既有專案已採用其他 router。
- Router setup 應放在 `src/app/router.tsx` 或既有 app-level router file。
- Route-level screens 應放在 `src/pages/`。
- 使用者可直接進入的 route 必須處理 not-found 與 error states。
- 大型 route 可在符合既有專案風格時使用 lazy loading。

## State 與 Data 規範

- Local UI behavior 必須優先使用 local component state。
- Filters、pagination、selected tabs 與可分享 view state 應優先使用 URL state。
- Remote data 應優先沿用既有 server-state library。不得為簡單需求任意新增 server-state library。
- 若專案尚無 server-state library，且需求已超出單次 fetch + local loading/error state，可優先使用成熟套件，不得手刻 query cache、request dedupe、mutation orchestration 或 stale-state framework。
- Backend response shape 不適合 UI 時，必須在 feature boundary normalize，不得讓 backend shape 擴散到整個 UI。
- API service 不得直接綁定 visual component；component 應透過 feature hook 或 feature entry point 使用資料。

## 測試與驗證

使用者可見行為必須以 user-facing tests 或等價的使用者流程驗證方式覆蓋；不得只用實作細節測試取代使用者流程驗證。

- Route、feature 與 user-flow tests 應放在 top-level `tests/`，或 repo 既有測試位置。
- Browser-level flows 應使用 Playwright；若既有專案尚未使用 Playwright，只有在任務需要 browser smoke coverage、跨 route 驗證或互動回歸檢查時才新增。若未新增 Playwright，仍必須使用可用的瀏覽器驗證方式完成 smoke check，並回報實際驗證路徑。
- Selector 應優先使用 role、label、text 或 accessible name。只有在 accessible selectors 不穩定時，才可使用 `data-testid`。
- 完成後必須依驗證層級執行對應命令。例如：

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
npm run test:e2e
```

若 package manager 不是 `npm`，必須改用對應命令。若某個 script 不存在，不得假裝已執行；必須說明該檢查不存在或無法執行。若 `preview` 不存在，必須明確說明既有 production build 驗證方式。若 `test:e2e` 不存在，也必須明確說明改以哪種瀏覽器 smoke check 完成驗證。

## 禁止事項

- 不得只新增資料夾結構而不提供可啟動專案。
- 不得在未檢查既有專案前直接套用模板。
- 不得混用 `npm`、`pnpm`、`yarn`。
- 不得把 feature-specific business rule 放入 `shared/`。
- 不得讓 `shared/` import `features/`。
- 不得從其他 feature 深層 import internal files。
- 不得新增未被需求使用的依賴。
- 不得為了避免安裝套件而手刻 router、query cache、form framework、schema validation framework、HTTP client abstraction 或 global store framework。
- 不得建立未被 route、provider、component、test 或 page 使用的空殼 feature/module。
- 不得在 build、test 或 browser smoke check 失敗時宣稱工作完成。

## 完成定義

只有同時符合下列條件，才可視為完成：

- 專案 dependencies 可安裝，或已清楚說明無法安裝的原因。
- `package.json` 具備可用的 `dev`、`build`、`typecheck` script，以及在 bundler 支援時可用的 `preview` script；若既有專案使用其他命令，必須已明確說明等價流程。
- 開發伺服器可啟動，並已回報實際 URL；若未啟動，已說明原因。
- 主要 route 或使用者流程在瀏覽器中不是空白頁。
- Feature/shared 邊界符合本 skill 規範。
- Relevant loading、empty、error、disabled 與 success states 已按需求處理。
- Typecheck、lint、tests、build 與 browser smoke checks 已執行；`preview` 與 `test:e2e` 在 script 存在或本次任務明確需要時也必須執行。若任一檢查未執行，必須明確列出原因與風險。
