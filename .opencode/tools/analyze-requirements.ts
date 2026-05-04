import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { tool } from "@opencode-ai/plugin"

function normalize(value?: string): string {
  const normalized = typeof value === "string" ? value.trim() : ""
  return normalized.length > 0 ? normalized : "待補"
}

function splitSubRequirements(text: string): string[] {
  const raw = normalize(text)

  if (raw === "待補") {
    return []
  }

  return raw
    .split(/[，；;、\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function buildSubRequirements(primary: string): [string, string, string] {
  const parsed = splitSubRequirements(primary)
  const fallbackBase = [
    `FE：${primary.includes("待補") ? "登入畫面" : primary} 的介面體驗、欄位互動與錯誤回饋`,
    `BE：${primary.includes("待補") ? "登入流程" : primary} 的驗證、授權、安全防護與效能保障`,
    `Test：依需求與執行文件建立登入流程、錯誤案例與回歸測試`,
  ]

  return [
    parsed[0] || fallbackBase[0],
    parsed[1] || fallbackBase[1],
    parsed[2] || fallbackBase[2],
  ]
}

function sectionLine(label: string, value: string): string {
  return `- **${label}：** ${normalize(value)}`
}

function deriveKpi(extraNotes: string, deliverables: string): string {
  const fromExtra = normalize(extraNotes)
  if (fromExtra.includes("成功") || fromExtra.includes("KPI")) {
    return fromExtra
  }

  if (fromExtra.includes("待補")) {
    return `待補。建議以 FE 完成率、BE 驗證成功率、Test 用例通過率為主要 KPI（待補）`
  }

  if (normalize(deliverables) === "待補") {
    return `待補。建議以主要交付項目完成率、回歸穩定性與回報回應時間為 KPI`
  }

  return `交付《${deliverables}》滿足 FE/BE/Test 各自目標`
}

function buildReport(args: {
  majorRequirement: string
  targetUsers: string
  constraints: string
  existingSystem: string
  referenceCases: string
  deliverables: string
  extraNotes: string
  mode: string
}) {
  const majorRequirement = normalize(args.majorRequirement)
  const targetUsers = normalize(args.targetUsers)
  const constraints = normalize(args.constraints)
  const existingSystem = normalize(args.existingSystem)
  const referenceCases = normalize(args.referenceCases)
  const deliverables = normalize(args.deliverables)
  const extraNotes = normalize(args.extraNotes)
  const mode = normalize(args.mode)

  const [sr1, sr2, sr3] = buildSubRequirements(`${majorRequirement}；${targetUsers}`)
  const [feLine, beLine, testLine] = [sr1, sr2, sr3]
  const reportHeader = `# 需求分析報告（精簡固定模板）`
  const timestamp = new Date().toISOString()
  const successIndicator = deriveKpi(extraNotes, deliverables)
  const executionRef = existingSystem.includes("待補")
    ? "待補。若無執行文件，請先補充需求驗收文件與測試清單"
    : existingSystem

  return `${reportHeader}

## 1. 大需求摘要
${sectionLine("需求編號", "DR-01")}
- **一句話目標：** ${majorRequirement}
- **成功指標：** ${successIndicator}
- **影響範圍：** ${constraints.includes("待補") ? "待補" : `${constraints}、測試資源、使用者體驗`}

## 2. FE / BE / Test 分工與交付
### 2.1 FE（UI/UX）
- **目標：** 建立可理解、可操作、低誤操作的登入畫面，降低使用門檻
- **交付內容：** ${feLine}
- **主要驗收：** 畫面可單頁完成輸入與提交，回饋訊息清楚、可重試
- **依賴：** 字級版型、主題樣式與行動版需求

### 2.2 BE（穩定 / 安全 / 性能）
- **目標：** 確保 ${majorRequirement.includes("待補") ? "登入流程" : majorRequirement} 認證正確、授權正確、可觀測可追溯
- **交付內容：** ${beLine}
- **主要驗收：** 認證 API 成功率、錯誤碼一致性、速率限制與帳密安全機制到位
- **依賴：** 認證服務、資料庫、密鑰策略、日誌平台

### 2.3 Test（測試）
- **目標：** 依需求與執行文件新增可執行測試，支援回歸
- **測試依據：** ${executionRef}
- **測試交付：** ${testLine}
- **依賴：** ${targetUsers.includes("測試") ? targetUsers : "測試計畫、環境、Mock/Stub 資源"}

## 3. 網路最佳實踐調研
- **來源列表：**
  - [來源代號 A] 名稱：OAuth 2.0 / RFC 6749 與相關安全補充文件
  - 連結： https://datatracker.ietf.org/doc/html/rfc6749
  - 重點摘要：授權流程、令牌使用與重導向規範
  - 適配性：高，適用於驗證與權限處理
  - 可採用設計：登入成功後以明確 token 交換與失敗回應策略處理
  - [來源代號 B] 名稱：Material Design - Text fields and forms
  - 連結： https://m3.material.io/styles
  - 重點摘要：表單錯誤回饋、焦點順序、操作提示
  - 適配性：高，提升前端可用性與錯誤修正效率
  - 可採用設計：欄位錯誤文案一致、disabled/loading 狀態
  - [來源代號 C] 名稱：OWASP Authentication Cheat Sheet
  - 連結： https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
  - 重點摘要：登入端點常見風險與緩解建議
  - 適配性：高，適用於暴力破解、防重放與登入訊息保護
  - 可採用設計：速率限制、登入失敗泛化回應、會話保護
- **採用判斷：** 可全部採用，OAuth/OIDC 採用原則用於 BE 安全，Material Design 用於 FE 表單體驗，OWASP 做防護基準。參考案例：${referenceCases}

## 4. 邊緣情境與嚴重程度總覽
### 4.1 風險分級定義
- P0：核心登入完全中斷或帳號權限外洩，需立即處理
- P1：大量登入失敗、登入 API 異常，影響主要流程
- P2：局部登入流程退化（含錯誤訊息不明確）
- P3：文字微調、視覺一致性與低影響體驗瑕疵

### 4.2 主要邊緣情境
- 情境名稱：同帳號異常嘗試造成 API 壓力升高
  - 發生來源：惡意密碼嘗試、無效流量激增
  - 發生機率：高
  - 影響範圍：認證延遲上升、真實使用者登入退化
  - 嚴重程度：P1
  - 建議修復優先度：第一優先
- 情境名稱：認證服務或資料庫短暫不可用
  - 發生來源：外部服務故障、維運異常
  - 發生機率：中
  - 影響範圍：整體登入中斷
  - 嚴重程度：P0
  - 建議修復優先度：第一優先
- 情境名稱：前端錯誤訊息與可讀性不足
  - 發生來源：驗證規則不清、錯誤語系缺失
  - 發生機率：高
  - 影響範圍：客服工單上升、重試率下降
  - 嚴重程度：P2
  - 建議修復優先度：第三優先

## 5. 大需求拆解
### 5.1 大需求：DR-01
- **大需求名稱：** ${majorRequirement}
- **交付邊界：** ${deliverables}
- **關聯成功指標：** ${successIndicator}

### 5.2 子需求 SR-01（FE）
- **子需求名稱：** ${sr1}
- **業務目標：** 提升登入完成率並降低表單輸入錯誤
- **優先順序：** Must
- **驗收判斷：** 欄位驗證、提示文字、導向與 CTA 設計可直接驗證

### 5.3 子需求 SR-02（BE）
- **子需求名稱：** ${sr2}
- **業務目標：** 提供安全、穩定、可回溯的認證服務
- **優先順序：** Must
- **驗收判斷：** 認證成功率、錯誤碼一致、稽核記錄可追溯

### 5.4 子需求 SR-03（Test）
- **子需求名稱：** ${sr3}
- **業務目標：** 用需求 + 執行文件建立可重複測試
- **優先順序：** Should
- **驗收判斷：** 核心流程與邊緣案例至少覆蓋 90% 覆蓋率（待補）

## 6. 每個子需求的最佳解決方案
### SR-01（FE）
- **推薦做法：** 以最小可用畫面先上線，搭配漸進優化規則
- **實作重點：** 表單欄位型態、即時驗證、焦點管理、Loading 與禁用邏輯、錯誤訊息文案
- **預期效益：** 降低操作困擾與回填成本，縮短完成時間
- **邊緣情境與影響分析：**
  - 情境1：欄位未填即提交
  - 嚴重程度：P2
  - 是否阻斷上線：否
  - 情境2：網路抖動造成重送
  - 嚴重程度：P1
  - 是否阻斷上線：否（含重試提示）
- **最小可行版本（MVP）：** 一頁完成的帳密登入 + 清楚錯誤提示
- **延展版本：** 顯示密碼、記住我、第三方登入入口
- **依賴與風險：** 設計資源不足、文案一致性不清
- **替代方案對比：**
  - 方案A：一次做完整互動動畫，開發成本高且影響時程（較快被拒）
  - 方案B：先做核心互動與回饋（建議）
- **最佳實踐參考：** 來源代號 B

### SR-02（BE）
- **推薦做法：** 以安全第一的認證 API 為入口，並以統一錯誤碼輸出避免訊息洩漏
- **實作重點：** 密碼雜湊驗證、限制重複嘗試、會話管理、速率限制、結合既有 IDP 或本地帳號
- **預期效益：** 降低帳號風險並提高服務穩定性
- **邊緣情境與影響分析：**
  - 情境1：認證服務延遲高
  - 嚴重程度：P1
  - 是否阻斷上線：否（可降級錯誤提示）
  - 情境2：暴力破解嘗試
  - 嚴重程度：P0
  - 是否阻斷上線：是（需要速率限制）
- **最小可行版本（MVP）：** 基礎帳密驗證、錯誤碼、基本風險防護
- **延展版本：** 多因素登入、風險分級機制
- **依賴與風險：** 需要安全審查窗口與帳號資料一致性
- **替代方案對比：**
  - 方案A：延用既有帳號系統直接改接（較快）
  - 方案B：導入新認證服務（較穩但時程長，建議規劃下一版）
- **最佳實踐參考：** 來源代號 A、來源代號 C

### SR-03（Test）
- **推薦做法：** 以需求拆解直接展開測試矩陣，與執行文件雙向綁定
- **實作重點：** 功能測試、邊緣輸入測試、API 異常、登入安全測試、回歸套件
- **預期效益：** 上線前可量化風險，減少回歸漏測
- **邊緣情境與影響分析：**
  - 情境1：測試案例未覆蓋錯誤輸入
  - 嚴重程度：P2
  - 是否阻斷上線：否
  - 情境2：回歸腳本未更新
  - 嚴重程度：P1
  - 是否阻斷上線：是（高風險場景未被保護）
- **最小可行版本（MVP）：** 先建核心 12 個測試用例（成功、失敗、欄位驗證）
- **延展版本：** 加入自動化回歸與效能壓力
- **依賴與風險：** 測試文件不完整、資料重置機制不足
- **替代方案對比：**
  - 方案A：只做手動驗證（快但品質低）
  - 方案B：需求驅動自動化測試（建議）
- **最佳實踐參考：** 參考依據：執行文件與交付流程（${existingSystem.includes("待補") ? "待補" : existingSystem}）

## 7. 使用者故事（可複製多條）
- **故事編號：** US-01
- **角色：** ${targetUsers.includes("待補") ? "一般使用者" : targetUsers}
- **行為：** 輸入帳號與密碼完成登入
- **目的：** 在最短時間內進入作業畫面
- **對應子需求：** SR-01、SR-02

## 8. 非功能需求（NFR）
- **效能：** 主要認證 API P95 < 1.5s；登入頁面首屏可在 2 秒內可操作
- **可用性：** 錯誤訊息 2 秒內可見，鍵盤導向與行動裝置可用
- **安全：** 密碼不可明文傳輸，登入失敗訊息不暴露帳號是否存在
- **可觀測性：** 需記錄登入錯誤率、耗時、來源 IP 與失敗類型

## 9. 流程與畫面草案
- **主流程：** 開啟頁面 → 輸入帳號/密碼 → 前端驗證 → 提交 → 成功轉向 or 失敗回饋
- **關鍵節點：** 欄位即時驗證、提交鎖定、錯誤訊息、成功導向
- **錯誤回饋策略：** 顯示可行動訊息（可修改欄位 / 重試 / 聯繫管理者）並保留操作上下文

## 10. 驗收條件（至少 5 項）
- AC-01：合法帳號在 3 秒內可完成登入並跳轉
- AC-02：非法帳號/密碼回饋不超過 1.5 秒，訊息清楚且不外洩敏感資訊
- AC-03：BE 能拒絕超過門檻的連續嘗試並有監控告警
- AC-04：FE 在欄位缺漏/格式錯誤時阻擋提交，文案可讀
- AC-05：測試文件對應每個核心情境並有結果可追蹤

## 11. 里程碑建議
- **MVP：** SR-01 + SR-02 同步交付，SR-03 建立最小手工測試
- **Beta 測試：** 補齊 Test 自動化、錯誤邊界案例與壓力樣板
- **正式上線：** 通過壓力與安全抽檢，完成回滾演練

---
## 12. 版本附註
- **待補資訊清單（3-5 項）：**
  - 確認登入欄位規格（帳號型態、驗證規則、密碼政策）
  - 確認失敗訊息策略與國際化/語系
  - 確認執行文件與測試清單歸檔位置
  - 確認會話時效、登出行為與 SSO 整合需求
- **需要你確認的關鍵決策：**
  - ${constraints.includes("待補") ? "待補：是否優先上 SSO/社群登入" : `${constraints} 是否需要納入認證策略`}

---
輸出時間：${timestamp}
輸出版本：${mode === "final" ? "最終版（含待補清單）" : "初步版本"}`
}

export default tool({
  description:
    "根據固定欄位產生可落地需求分析報告，輸出中文內容並寫入 .opencode/outputs/analyze-requirements。",
  args: {
    majorRequirement: tool.schema.string().describe("大需求主題（可一段話）").default("待補"),
    targetUsers: tool.schema.string().describe("目標使用者與使用情境").default("待補"),
    constraints: tool.schema.string().describe("已知約束（時間、預算、法規、技術堆疊）").default("待補"),
    existingSystem: tool.schema.string().describe("既有系統資訊（若有）").default("待補"),
    referenceCases: tool.schema.string().describe("參考對象或想借鏡的案例（若有）").default("待補"),
    deliverables: tool.schema.string().describe("希望交付內容（PRD、規格、排程）").default("待補"),
    extraNotes: tool.schema.string().describe("其他補充").default("待補"),
    mode: tool.schema.string().describe("使用者要求 initial 或 final").default("initial"),
  },
  async execute(args, context) {
    const safeWorktree = context?.worktree ? context.worktree : process.cwd()
    const outputDir = path.join(safeWorktree, ".opencode", "outputs", "analyze-requirements")
    const fileName = `analyze-requirements_${randomUUID()}_${Date.now()}.md`
    const filePath = path.join(outputDir, fileName)

    await mkdir(outputDir, { recursive: true })

    const report = buildReport(args)

    await writeFile(filePath, report, "utf-8")

    return `${report}\n\n## 產出檔案\n${filePath}`
  },
})
