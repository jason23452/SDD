---
name: coss
description: "協助在 React 專案中正確使用 coss UI 元件庫。當需要使用 coss primitives 建立按鈕、對話框、表單、選單、分頁、輸入框、toast、overlay、資料展示元件，或從 shadcn/Radix 遷移到 coss/Base UI，或排查 coss 元件組合、樣式、可存取性與 Tailwind v4 問題時使用。"
---

# coss UI Skill

協助任何 AI 助手或模型在 React 專案中正確使用 coss UI。這份 skill 不依賴特定模型、代理框架或 IDE；只假設可以閱讀專案檔案、查閱本 skill 的 references，並依照使用者的專案環境產生或修改程式碼。

coss UI 是建立在 Base UI 之上的元件庫，提供類似 shadcn 的開發體驗、可複製的元件 registry，以及大量 particle 範例。使用時要以 coss 官方文件、registry 與本 skill references 為準，不要把 shadcn、Radix 或其他 UI 套件的 API 直接套用到 coss。

## Bootstrap 硬規則

- 只要建立、初始化、scaffold、修復或重建受本 skill 管轄的 coss UI 基底，且 repo 原本不存在可沿用的 coss 契約，本 skill 內所有 installation、registry/manual setup、required imports、Tailwind token 約定、reference-driven wiring 與 verification 條款都屬 bootstrap 階段硬要求，必須在 bootstrap 一次完成。
- 不得把本 skill 的 bootstrap 條款標記為 `optional`、`deferred`、`pending`、`placeholder`、`later` 或任何等價延後語意；也不得先用其他 UI library 或空殼元件暫代，再宣稱之後補成 coss。
- 唯一例外是 repo 原本已存在對應檔案與可運作契約；此時必須優先沿用既有專案，但若現況不符合本 skill 契約，仍需在 bootstrap 補齊缺漏。

## 適用情境

使用本 skill 處理：

- 使用 coss primitives 建立或修改 UI。
- 選擇合適的 coss 元件，例如 Dialog、Select、Form、Menu、Tabs、Toast、Input、Button。
- 組合 trigger、popup、portal、overlay、form、field、grouped controls 等複合互動。
- 從 shadcn、Radix、cmdk、input-otp 或自製元件遷移到 coss / Base UI。
- 修復 coss 元件的匯入、props、可存取性、樣式、portal、SSR 或 keyboard interaction 問題。
- 撰寫 coss 安裝指令、手動安裝步驟或 component registry 使用指南。

不適用於：

- 維護 coss monorepo 的內部建置流程，除非使用者明確要求。
- 未查證文件就發明新的 coss API。
- 把其他元件庫的範例只改 import path 後當作 coss 程式碼。

## 核心原則

1. 優先使用 coss 現有 primitives 與 particles，不要重新實作已有行為。
2. 使用 composition，而不是自製 dropdown、dialog、select、toast 等互動邏輯。
3. 匯入名稱、props、子元件結構必須符合 coss 文件或 references。
4. 預設使用 Tailwind CSS v4 與 coss token 約定。
5. 保留可存取性語意，例如 label、aria、role、error state、focus behavior。
6. 範例要接近真實產品，不要只回傳空洞 placeholder。
7. 若資訊不足，先查 component registry 與 primitive reference，再產生程式碼。

## 工作流程

1. 判斷使用者需求屬於單一 primitive、複合 flow、form flow、overlay flow、feedback flow 或 migration flow。
2. 讀 references/component-registry.md，找出候選元件與對應 primitive guide。
3. 若是高風險元件，先讀對應 reference：Dialog、Menu、Select、Form、InputGroup、Toast 等。
4. 若涉及樣式、表單、組合或遷移，讀 references/rules 內對應規則。
5. 若涉及安裝或 CLI，讀 references/cli.md。
6. 產生最小但完整的 coss 程式碼，使用正確 imports、props、trigger/content hierarchy。
7. 檢查可存取性、button type、input type、error semantics、portal 需求與 Tailwind token。
8. 若修改專案，執行可用的 typecheck、lint、測試或 build；無法執行時說明原因。

## 主要參考檔

本 skill 附帶 references，請按需讀取，不要一次載入所有檔案。

- references/component-registry.md：元件索引，用來快速選擇 primitive。
- references/cli.md：shadcn CLI 安裝、預覽、查詢與手動安裝流程。
- references/portal-props.md：支援 portalProps 的 popup/provider 清單與限制。
- references/rules/styling.md：Tailwind v4、token、icon、data-slot、全域樣式規則。
- references/rules/forms.md：Field、Label、Input、validation、button/input type 規則。
- references/rules/composition.md：trigger、popup、grouped controls 與 composition 規則。
- references/rules/migration.md：從 shadcn/Radix/Base UI 心智模型遷移到 coss 的差異。
- references/primitives/<name>.md：每個 primitive 的匯入、範例、陷阱與 particle 參考。

## 元件選擇速查

Overlay 與 popup：

- Dialog：置中 modal，需要使用者聚焦處理。
- AlertDialog：破壞性或高風險確認。
- Sheet：側邊面板，適合設定或詳細資料。
- Drawer：底部或側邊 drawer，常用於 mobile。
- Popover：錨定元素的非 modal 浮層。
- Tooltip：短提示文字。
- PreviewCard：hover/focus 觸發的 rich preview。
- Menu：dropdown action list、group、submenu。
- Command：搜尋式 command palette；不要假設是 cmdk。

輸入與選擇：

- Select：從既定清單選單一值，通常不搜尋。
- Combobox：可搜尋的選擇器。
- Autocomplete：自由輸入搭配建議。
- Input、Textarea：文字輸入。
- InputGroup：輸入框搭配 icon、button、badge、addon。
- OTPField：一次性驗證碼欄位。
- NumberField、Slider、Calendar：數值與日期輸入。

表單與驗證：

- Form：含 Zod validation 與提交流程。
- Field：Label、description、error 與 control 的標準組合。
- Fieldset：群組表單控制。
- Label：可存取性標籤。

版面、導覽與展示：

- Tabs、Accordion、Collapsible、Sidebar、Breadcrumb、Pagination、Toolbar、ScrollArea。
- Card、Frame、Table、Avatar、Badge、Kbd、Separator、Group、Empty。

回饋與狀態：

- Alert：頁面內持續性訊息。
- Toast：短暫通知；使用 coss toastManager，不要假設 Sonner。
- Progress、Meter、Spinner、Skeleton。

## 安裝與 CLI

優先使用專案既有套件管理器。

### UI 下載目錄規則

安裝 coss 元件前，必須先確認 shadcn/coss registry 會把元件寫到 shared components UI 目錄。此專案的正確 alias 是 `@/src/shared/components/ui`，不要使用 `@/component/ui`、`@/shared/ui`、`@/src/shared/ui`、根目錄 `component/ui`、`src/component/ui` 或拼錯的 `shard/component/ui`。

目標路徑規則：

1. `components.json` 的 `aliases.ui` 必須優先設為 `@/src/shared/components/ui`。
2. 實體檔案目錄對應為 `src/shared/components/ui`。
3. `aliases.components` 建議設為 `@/src/shared/components`。
4. `aliases.utils` 依專案實際工具函式位置設定；若共用工具在 shared layer，使用 `@/src/shared/lib/utils`。
5. 只有使用者明確指定其他架構時，才改用其他 UI 目錄。

建議 `components.json`：

~~~json
{
  "aliases": {
    "ui": "@/src/shared/components/ui",
    "components": "@/src/shared/components",
    "utils": "@/src/shared/lib/utils"
  }
}
~~~

設定前先檢查：

- `components.json` 的 `aliases.ui` 是否等於 `@/src/shared/components/ui`。
- `tsconfig.json` 或 `jsconfig.json` 的 `compilerOptions.paths` 是否支援 `@/src/*` 這類 import。
- 檔案系統是否存在或應建立 `src/shared/components/ui`。
- 專案是否已經有錯誤產物，例如 `component/ui`、`src/component/ui`、`src/shared/ui` 或 `shard/component/ui`。

執行 add 前先用 dry-run 或 diff 驗證輸出位置。若預覽結果不是寫到 `src/shared/components/ui`，先修正 `components.json` 與 path alias，再重新預覽。

已經下載錯位置時，先把檔案移到 `src/shared/components/ui`，再修正所有 imports；不要在錯誤目錄留下第二套 UI 元件。
~~~bash
npx shadcn@latest init @coss/style
npx shadcn@latest add @coss/ui
npx shadcn@latest add @coss/dialog
npx shadcn@latest add @coss/select
~~~

若專案使用 pnpm 或 bun：

~~~bash
pnpm dlx shadcn@latest add @coss/dialog
bunx --bun shadcn@latest add @coss/dialog
~~~

在實際寫入前可先預覽：

~~~bash
npx shadcn@latest add @coss/dialog --dry-run
npx shadcn@latest add @coss/dialog --diff
npx shadcn@latest add @coss/dialog --view
~~~

CLI 指令規則：

- 不要發明 flags。
- 執行 add 前先檢查 `components.json` 的 `aliases.ui` 是否等於 `@/src/shared/components/ui`。
- 若使用者只想知道會改什麼，先用 dry-run、diff 或 view。
- dry-run / diff 顯示輸出位置不是 `src/shared/components/ui` 時，先修正 `components.json` 與 path alias，不要安裝後才搬檔。
- 若 CLI 不支援 search、docs、info 等輔助指令，改查本 skill references 或 coss repo 文件。
- 手動安裝時，必須把 component files 放到 `src/shared/components/ui`，並同步調整 imports、dependencies、transitive imports 與 alias。

## 組合規則

Trigger 型元件必須遵守各自 hierarchy，不可混用其他套件心智模型。

Dialog 範例：

~~~tsx
<Dialog>
  <DialogTrigger render={<Button variant="outline" />}>Open</DialogTrigger>
  <DialogPopup>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    <DialogPanel>Body</DialogPanel>
  </DialogPopup>
</Dialog>
~~~

重點：

- coss/Base UI 常用 render-based composition，不要預設所有地方都有 asChild。
- 優先使用 styled coss exports；只有進階自訂組合才用 Primitive exports。
- Dialog、AlertDialog、Sheet、Drawer 要保留 title、description、footer、close/cancel 等必要語意。
- Select 優先使用 items-first pattern，再在 SelectPopup 中 map items。
- Menu action 通常使用 onClick，不要直接套用 Radix DropdownMenuItem onSelect 習慣。
- ToggleGroup 不要照搬 shadcn 的 type="single" 心智模型；依 coss 文件確認 value/defaultValue 形狀。

## 表單規則

表單控制預設使用 Field composition。

~~~tsx
<Field>
  <FieldLabel>Email</FieldLabel>
  <Input type="email" />
  <FieldDescription>Use your work email.</FieldDescription>
  <FieldError />
</Field>
~~~

必守規則：

- input 類控制要指定 type，例如 type="text"、type="email"。
- button 要指定 type，例如 type="button"、type="submit"、type="reset"。
- 沒有可見 label 時提供 aria-label。
- error state 要同步到 Field、control 與 aria-invalid 等語意。
- InputGroup 中 InputGroupAddon 要放在 InputGroupInput 或 InputGroupTextarea 後面，避免破壞 focus behavior。
- OTPField root 的 length 要與實際 OTPFieldInput 數量一致。

## 樣式規則

coss 樣式以 Tailwind v4 與語意 token 為主。

優先：

- 使用 text-muted-foreground、bg-destructive 等語意 token。
- 使用元件 variant 與 size props，再考慮 className 覆寫。
- 使用 flex flex-col gap-*，避免 space-x-* / space-y-*。
- 方形尺寸使用 size-*。
- 條件 class 使用 cn()。
- icon 優先繼承尺寸或使用 size-* class，不要傳 numeric size props。
- 裝飾性 icon 加 aria-hidden="true"。
- 優先使用 data-slot-aware selectors 與 in-* pattern，少用 group。

避免：

- 直接使用 bg-blue-500、text-white 取代 semantic token。
- 重複寫 primitive 已經處理的 layout 或 icon opacity。
- 把 Tailwind v4 的 --alpha() 改成 color-mix() 或 rgba()；--alpha() 是 coss token 中有效語法。
- 手動主題只貼一小段 token，導致 variable chain 斷裂。

## Portal 與 portalProps

只有特定 coss wrapper 支援 portalProps。需要改 portal 掛載點、keepMounted 或 container 時，先讀 references/portal-props.md。

支援 surfaces 包含：

- DialogPopup、AlertDialogPopup、SheetPopup、DrawerPopup、CommandDialogPopup。
- MenuPopup、PopoverPopup、TooltipPopup、PreviewCardPopup、AutocompletePopup、ComboboxPopup、SelectPopup。
- ToastProvider、AnchoredToastProvider。

portalProps 只影響 portal node。若要調整位置、side、align、offset 或 positioner 行為，不要把它塞進 portalProps；應使用元件文件支援的 placement props 或 Base UI composition。

## 遷移規則

從 shadcn/Radix 遷移時，先讀 references/rules/migration.md。核心差異：

- 不要假設 shadcn 範例可以一比一改 import。
- asChild 通常要依 coss/Base UI 文件改成 render-based composition。
- Select 優先 items-first。
- OTPField 從 input-otp 遷移時，改用 OTPField、OTPFieldInput、OTPFieldSeparator，使用 length 與 onValueChange，不使用 slot index。
- Slider 單值通常是 scalar value，不要直接照搬 array value。
- Accordion、ToggleGroup 等 value/defaultValue semantics 要依 coss 文件確認。
- Command 是 coss/Base UI pattern，不要預設 cmdk API。

## 高風險 primitive

遇到以下元件，先讀對應 primitive reference 再寫程式碼：

- references/primitives/dialog.md：modal、form-in-dialog、responsive dialog/drawer。
- references/primitives/menu.md：dropdown actions、checkbox/radio item、submenu。
- references/primitives/select.md：items-first、multiple、object values、groups。
- references/primitives/form.md：Field composition、validation、submission。
- references/primitives/input-group.md：addons、DOM order、textarea layouts。
- references/primitives/toast.md：toastManager、anchored toasts、providers。

## 常見反模式

避免：

- 發明 coss component、prop、variant 或 export name。
- 複製 shadcn/Radix 程式碼後只改 import path。
- 在 trigger 型元件中混用不同元件庫的 trigger/content 結構。
- 使用 Sonner、cmdk、input-otp 等 API 取代 coss 對應 primitive，除非使用者明確要求。
- 用原始 Tailwind palette class 破壞 coss semantic token。
- 移除 label、title、description、aria、error semantic。
- 手動處理 keyboard、focus trap、dismiss、selection state，而不是使用 coss primitive。
- 只給片段但漏掉必要 import、provider、dependencies 或本地 component files。

## 完成前檢查

回覆或交付前確認：

- 已根據 component-registry 選對 primitive。
- coss 元件 alias 已確認為 `@/src/shared/components/ui`，實體輸出路徑已確認為 `src/shared/components/ui`，不是 `component/ui`、`src/component/ui`、`src/shared/ui`、`@/component/ui`、`@/shared/ui` 或 `shard/component/ui`。
- imports、exports、props 與子元件結構符合 coss 文件或 reference。
- trigger、popup、portal、provider 的層級正確。
- 表單元件包含 label、type、error semantics 與可存取性資訊。
- 樣式使用 coss / Tailwind v4 token 與 conventions。
- 從 shadcn/Radix 遷移時已處理 asChild/render、Select、OTP、Slider、Accordion、ToggleGroup 等差異。
- 若修改專案，已執行可用的 typecheck、lint、test 或 build；若無法執行，清楚說明原因。

## 回覆格式

完成後簡短回報：

- 使用或修改了哪些 coss primitive。
- 是否讀取了特定 reference 或 primitive guide。
- 實際新增或修改的檔案。
- 執行過的驗證指令與結果。
- 若還有風險，列出最可能的原因與下一步。
