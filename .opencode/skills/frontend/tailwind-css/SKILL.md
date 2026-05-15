---
name: tailwind-css
description: >-
  Tailwind CSS v4 與前端樣式開發的最高優先級強制規範。只要任務涉及任何樣式修改、UI 視覺調整、layout、spacing、typography、color、responsive design、dark mode、animation、component classes、CSS、Tailwind utilities、theme tokens、design tokens、global.css、PostCSS、Vite plugin、Next.js/PostCSS integration、Playwright/browser visual verification，或建立、啟動、修復、遷移 Tailwind CSS 專案，就必須使用此 skill。此 skill 要求先查閱 Tailwind CSS 官方文件，再依前端框架選擇 Tailwind CSS v4 正確整合方式；禁止使用 v3 舊設定或未經驗證的第三方範例。任何樣式變更若未完成 build 與瀏覽器驗證，不得宣稱完成。
---

# Tailwind CSS

此 skill 是前端樣式工作的強制規範，不是參考建議。凡任務涉及 UI 外觀、CSS、Tailwind class、responsive layout、design tokens、前端視覺缺陷、瀏覽器視覺驗證或 Tailwind CSS 設定，必須優先依本 skill 執行。若同時觸發前端架構 skill，前端架構由前端架構 skill 管理；樣式、Tailwind CSS、CSS entry、tokens、visual verification 由本 skill 管理。

未遵守本 skill 的任一強制條款，該任務不得視為完成。

## Bootstrap 硬規則

- 只要建立、初始化、scaffold、修復或重建受本 skill 管轄的 frontend 專案，且 repo 原本不存在可沿用的樣式基底，本 skill 內所有 Tailwind v4 installation、plugin wiring、CSS entry、source detection、theme/token、build 與 browser verification 條款都屬 bootstrap 階段硬要求，必須在 bootstrap 一次完成。
- 不得以「尚未開始做樣式」或「之後再接 UI」為理由延後 Tailwind v4 整合；也不得把本 skill 的 bootstrap 條款標記為 `optional`、`deferred`、`pending`、`placeholder`、`later` 或任何等價延後語意。
- 唯一例外是 repo 原本已存在對應檔案與可運作契約；此時必須優先沿用既有專案，但若現況不符合本 skill 契約，仍需在 bootstrap 補齊缺漏。

## 不可跳過條款

1. 必須先確認專案使用的前端框架、bundler、package manager、CSS entry 與 Tailwind 版本，再修改樣式或安裝套件。
2. 必須優先查閱 Tailwind CSS 官方文件。涉及安裝、設定、升級、plugin、directive、source detection、theme token 或 framework guide 時，不得只依賴記憶。
3. 必須使用 Tailwind CSS v4 寫法。除非任務明確要求維護 legacy v3，否則不得新增或延續 v3 setup。
4. 必須依框架選擇整合方式。不得把 Vite、Next.js、CLI、PostCSS 的設定互相套用。
5. 必須讀取既有全域樣式與 design tokens，再新增 class、token 或 arbitrary value。
6. 必須執行可用的 build 與瀏覽器視覺驗證。未驗證不得宣稱完成。

## 官方文件查核義務

只要涉及 Tailwind CSS 設定或語法正確性，必須優先查閱官方文件：

- Installation: `https://tailwindcss.com/docs/installation`
- Vite: `https://tailwindcss.com/docs/installation/using-vite`
- PostCSS: `https://tailwindcss.com/docs/installation/using-postcss`
- Framework guides: `https://tailwindcss.com/docs/installation/framework-guides`
- Upgrade guide: `https://tailwindcss.com/docs/upgrade-guide`
- Theme variables: `https://tailwindcss.com/docs/theme`
- Detecting classes: `https://tailwindcss.com/docs/detecting-classes-in-source-files`
- Functions and directives: `https://tailwindcss.com/docs/functions-and-directives`

禁止事項：

- 禁止以第三方文章作為主要依據。
- 禁止以 v3 文件作為 v4 專案規劃來源。
- 禁止在未確認官方文件前新增 plugin package、directive、config 或 migration 步驟。
- 禁止在官方文件與既有專案衝突時直接覆蓋設定；必須先判斷專案版本、框架限制與目前可運作路徑。

## 現況審核

任何樣式或 Tailwind 修改前，必須檢查下列項目：

1. `package.json` scripts 與 dependencies。
2. Lockfile：`package-lock.json`、`pnpm-lock.yaml` 或 `yarn.lock`。
3. Framework 與 bundler config：例如 `vite.config.*`、`next.config.*`、`astro.config.*`、`postcss.config.*`。
4. CSS entry：例如 `global.css`、`globals.css`、`app.css`、`index.css`、`src/styles/global.css`。
5. 既有 Tailwind 設定：`@import "tailwindcss";`、`@theme`、`@source`、legacy `tailwind.config.*`。
6. 既有 class helper：例如 `cn`、`clsx`、`classnames`、`cva`、`tailwind-merge`。
7. 代表性 UI components，確認 class ordering、layout pattern、tokens 與 responsive 慣例。

未完成現況審核，不得新增套件、修改 config 或重寫樣式。

## Tailwind CSS v4 整合規範

Tailwind CSS v4 必須依專案框架與建置工具選擇唯一整合路徑。

### Vite 路徑

適用於 Vite、React + Vite、Vue + Vite、SvelteKit、React Router、Nuxt、SolidJS、Astro，以及官方建議使用 Vite plugin 的專案。

必須安裝：

```bash
npm install tailwindcss @tailwindcss/vite
```

必須在 `vite.config.*` 註冊 `@tailwindcss/vite`：

```ts
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
});
```

CSS entry 必須包含：

```css
@import "tailwindcss";
```

### PostCSS 路徑

適用於 Next.js、Angular，或既有建置流程必須透過 PostCSS 載入 Tailwind 的專案。

必須安裝：

```bash
npm install tailwindcss @tailwindcss/postcss postcss
```

必須在 `postcss.config.*` 註冊 `@tailwindcss/postcss`：

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

CSS entry 必須包含：

```css
@import "tailwindcss";
```

### Next.js

Next.js 必須依官方 Next.js guide 使用 PostCSS 路徑：

- 安裝 `tailwindcss @tailwindcss/postcss postcss`。
- 建立或更新 `postcss.config.mjs`。
- 在 `app/globals.css` 或既有 global stylesheet 中加入 `@import "tailwindcss";`。
- 使用專案既有 dev script 啟動，例如 `npm run dev`。

### CLI 或靜態 HTML

只有在專案沒有 bundler，或使用者明確要求 CLI workflow 時，才可使用 CLI。

必須安裝並執行：

```bash
npm install tailwindcss @tailwindcss/cli
npx @tailwindcss/cli -i ./src/input.css -o ./src/output.css --watch
```

CSS input 必須包含：

```css
@import "tailwindcss";
```

## v4 硬性禁止事項

- 禁止新增 `npx tailwindcss init` 作為 v4 setup。
- 禁止以 `tailwind.config.js` scaffold 作為 v4 預設起點。
- 禁止新增 v3 `content` globs 作為 v4 預設 source detection。
- 禁止使用 `@tailwind base; @tailwind components; @tailwind utilities;` 作為 v4 新設定。
- 禁止把 `tailwindcss` 直接註冊成舊式 PostCSS plugin；PostCSS 路徑必須使用 `@tailwindcss/postcss`。
- 禁止在 Vite 專案優先使用 PostCSS 路徑，除非既有架構明確要求。
- 禁止混用 `npm`、`pnpm`、`yarn`。必須依 lockfile 使用同一個 package manager。
- 禁止新增未被需求使用的樣式套件或 UI library。

## 樣式決策順序

修改任何樣式前，必須依下列順序決策：

1. 使用既有 `@theme` tokens。
2. 使用既有 `:root` CSS variables。
3. 使用既有 `@layer base/components/utilities`。
4. 使用既有 component classes、variant helpers 或 `cn` helper。
5. 使用 Tailwind CSS v4 default utilities。
6. 最後才可使用局部 arbitrary values。

禁止跳過既有 design system 直接新增 arbitrary color、spacing、radius、shadow、font-size 或 breakpoint。只有當既有 tokens 不足、需求明確，且新增值不會破壞整體設計一致性時，才可新增。

## UI 品質硬性規範

1. 必須使用 mobile-first responsive utilities。
2. 固定格式 UI，例如 toolbar、grid、button、card、board、table、form control，必須有穩定尺寸或 responsive constraints。
3. 文字在 mobile 與 desktop 下不得溢出、遮擋或重疊。必要時必須調整結構、wrapping、min/max width、line clamp 或 spacing。
4. Hover、focus、loading、disabled、open、empty、error state 不得造成 layout shift。
5. 樣式必須保留 accessibility：`focus-visible`、contrast、hit target、disabled state、reduced motion、keyboard-visible feedback。
6. 不得使用只在單一 viewport 看起來正常、但在其他 viewport 會破版的樣式。

## Class 管理規範

- 必須優先沿用既有 class composition helper，例如 `cn`、`clsx`、`classnames`、`cva`、`tailwind-merge`。
- 禁止使用 Tailwind 無法可靠偵測的動態 class string，例如 `text-${color}-500`。必須改成完整 class mapping。
- 重複 class groups 只有在跨多處實際重用，且能降低複雜度時，才可抽成 variant helper 或 component。
- `@apply` 僅可用於穩定語意 class、第三方整合點或全域基礎樣式。Component-local styling 必須優先直接使用 utilities。
- Custom CSS 必須 scoped、有命名、有目的。禁止用 custom CSS 重寫 Tailwind utilities 已能清楚表達的樣式。

## 修復與遷移規範

- Missing styles：必須檢查 CSS entry 是否 import Tailwind、plugin 是否符合 v4、source files 是否被偵測，以及是否存在動態 class string。
- Broken Vite setup：必須檢查 `@tailwindcss/vite` 是否安裝並註冊於 `vite.config.*`。
- Broken PostCSS setup：必須檢查 `@tailwindcss/postcss` 是否安裝並註冊於 `postcss.config.*`。
- Legacy v3 setup：必須依官方 v4 upgrade guide 評估遷移，並將 `@tailwind` directives 改為 `@import "tailwindcss";`。
- Monorepo 或外部套件 source 未被掃描時，必須依官方 v4 source detection 文件使用 `@source` 或相關 v4 指令。
- 遷移時不得一次性重寫無關 UI。必須保持變更範圍可審查、可回滾、可驗證。

## 驗證門檻

完成 Tailwind CSS 或樣式工作前，必須完成下列驗證：

1. 若 dependencies 有變更，必須完成安裝。
2. 必須執行可用的 lint、typecheck、test 與 build scripts。
3. 必須啟動 dev server 或 preview server。
4. 必須在 browser 檢查主要頁面。
5. 必須檢查 mobile 與 desktop viewport。
6. 若修改互動樣式，必須檢查 hover、focus-visible、active、disabled、open、loading、empty、error states。
7. 若驗證失敗，必須修復或明確回報失敗原因；不得忽略。

## 未完成條件

出現任一情況時，任務不得宣稱完成：

- 未確認官方文件卻修改 Tailwind setup。
- 使用 v3 setup 建立新的 v4 專案。
- CSS entry 未正確載入 Tailwind。
- Build 失敗且未修復。
- Browser smoke check 未執行且未說明原因。
- Mobile 或 desktop 有明顯 overflow、overlap、layout shift。
- 新增樣式破壞既有 design tokens 或 visual consistency。
- 使用動態 class string 導致 Tailwind 無法偵測。

## 完成定義

只有同時符合下列條件，才可視為完成：

- Tailwind CSS v4 整合方式符合目前框架與官方文件。
- Package manager、plugin、CSS entry 與 build tool 設定一致。
- 樣式修改優先使用既有 tokens 與專案 guideline。
- 未引入 v3 setup、過期文件寫法或未使用依賴。
- UI 在 mobile 與 desktop 下不溢出、不重疊、不產生明顯 layout shift。
- Build 與 browser smoke check 已執行；若未執行，已明確列出原因與風險。
