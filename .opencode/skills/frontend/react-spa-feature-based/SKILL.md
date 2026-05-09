---
name: react-spa-feature-based
description: >-
  前端開發的強制規範 skill。只要任務涉及任何前端開發、前端修改、前端修復、前端重構、UI、樣式、component、layout、route、navigation、form、state、store、hook、API 串接、assets、tests、Playwright、browser smoke check、React SPA、Vite、TypeScript、package scripts、dev/build/preview 啟動流程，或判斷程式碼應放入 feature 或 shared，就必須使用此 skill。此 skill 以 feature-based 架構管理 routes、pages、features、shared、components、state、API services、assets 與 tests，並要求交付可安裝、可啟動、可建置、可驗證的前端專案或前端變更。
---

# React SPA Feature Based

此 skill 是前端開發的強制規範。只要任務涉及任何前端開發、前端修改、前端修復、前端重構、UI、樣式、路由、狀態、API 串接、測試或瀏覽器驗證，就必須使用此 skill。目標是交付可安裝、可啟動、可建置、可驗證的前端專案或前端變更；不得只提供目錄結構建議。

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
3. `package.json` 至少應具備下列 scripts；若既有 framework 使用不同名稱，必須保留既有慣例並確保功能等價：
   - `dev`：啟動本機開發伺服器。
   - `build`：產生 production build。
   - `preview`：在 bundler 支援時預覽 production build。
4. Vite React 專案應採用以下 scripts，除非既有專案已有明確且可用的替代設定：

```json
{
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 0.0.0.0"
  }
}
```

5. 若使用者需要試用介面，必須啟動 dev server，並回報實際 URL。若預設 port 被占用，必須使用該工具支援的方式改用其他 port。
6. 啟動後必須進行瀏覽器驗證。至少確認畫面非空白、主要 route 可載入、核心互動可執行，且沒有阻塞流程的 runtime error。

## 新專案契約

當 repo 尚無 React SPA 且使用者要求建立前端應用時，除非使用者明確指定其他 stack，必須建立 Vite + React + TypeScript 專案。

建議 scaffold：

```bash
npm create vite@latest . -- --template react-ts
npm install
```

依賴新增規範：

- `react-router-dom`：當專案需要 SPA routing 時加入。
- `axios`：只有既有專案已使用，或任務明確需要 HTTP service layer 時加入。
- `zustand`：只有既有專案已使用，或任務明確需要跨 component/feature 的 client state 時加入。
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
- Backend response shape 不適合 UI 時，必須在 feature boundary normalize，不得讓 backend shape 擴散到整個 UI。
- API service 不得直接綁定 visual component；component 應透過 feature hook 或 feature entry point 使用資料。

## 測試與驗證

使用者可見行為應優先以 user-facing tests 驗證。

- Route、feature 與 user-flow tests 應放在 top-level `tests/`，或 repo 既有測試位置。
- Browser-level flows 應使用 Playwright；若既有專案尚未使用 Playwright，只有在任務需要 browser smoke coverage 時才新增。
- Selector 應優先使用 role、label、text 或 accessible name。只有在 accessible selectors 不穩定時，才可使用 `data-testid`。
- 完成後必須執行可用命令，例如：

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

若 package manager 不是 `npm`，必須改用對應命令。若某個 script 不存在，不得假裝已執行；必須說明該檢查不存在或無法執行。

## 禁止事項

- 不得只新增資料夾結構而不提供可啟動專案。
- 不得在未檢查既有專案前直接套用模板。
- 不得混用 `npm`、`pnpm`、`yarn`。
- 不得把 feature-specific business rule 放入 `shared/`。
- 不得讓 `shared/` import `features/`。
- 不得從其他 feature 深層 import internal files。
- 不得新增未被需求使用的依賴。
- 不得在 build、test 或 browser smoke check 失敗時宣稱工作完成。

## 完成定義

只有同時符合下列條件，才可視為完成：

- 專案 dependencies 可安裝，或已清楚說明無法安裝的原因。
- `package.json` 具備可用的 `dev` script 或等價啟動方式。
- 開發伺服器可啟動，並已回報實際 URL；若未啟動，已說明原因。
- 主要 route 或使用者流程在瀏覽器中不是空白頁。
- Feature/shared 邊界符合本 skill 規範。
- Relevant loading、empty、error、disabled 與 success states 已按需求處理。
- Typecheck、lint、tests、build 與 browser smoke checks 已執行；若未執行，已明確列出原因與風險。
