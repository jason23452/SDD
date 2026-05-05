import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { tool } from "@opencode-ai/plugin"
import {
  DEFAULT_REQUIREMENTS_DIR,
  readRequirementRepoMap,
  resolveRequirementsDir,
  writeRequirementRepoMap,
} from "./requirement-docs"
import type { RequirementRepoMapEntry } from "./requirement-docs"

function normalize(value?: string): string {
  const normalized = typeof value === "string" ? value.trim() : ""
  return normalized.length > 0 ? normalized : "待補"
}

export type AnalyzeRequirementsInput = {
  majorRequirement: string
  targetUsers: string
  constraints: string
  existingSystem: string
  referenceCases: string
  deliverables: string
  extraNotes: string
  mode: string
  relation?: string
  candidateFileName?: string
  diffSummary?: string
  compatibility?: string
  conflictResolution?: string
  versionDecision?: string
  targetFileName?: string
}

function safeTargetFilePath(outputPath: string, targetFileName?: string): string | undefined {
  const normalized = normalize(targetFileName)
  if (normalized === "待補") return undefined

  if (normalized !== path.basename(normalized) || !normalized.toLowerCase().endsWith(".md")) {
    throw new Error("targetFileName 必須是輸出目錄內的 Markdown 檔名")
  }

  return path.join(outputPath, normalized)
}

function buildIterativeUpdate(existingReport: string, nextReport: string, timestamp: string): string {
  return [
    existingReport.trimEnd(),
    "",
    "---",
    `## 迭代更新舊需求（${timestamp}）`,
    "",
    nextReport,
  ].join("\n")
}

function compactMapValue(value?: string, maxLength = 180): string {
  const normalized = normalize(value).replace(/\s+/g, " ")
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1)}…`
}

function deriveRelation(args: AnalyzeRequirementsInput, hasTargetFile: boolean): string {
  const relation = normalize(args.relation)
  if (["related", "new", "uncertain"].includes(relation.toLowerCase())) return relation.toLowerCase()
  if (relation === "相關") return "related"
  if (relation === "全新") return "new"
  if (relation === "不確定") return "uncertain"
  return hasTargetFile ? "related" : "new"
}

function deriveKeywords(args: AnalyzeRequirementsInput): string {
  const words = [
    args.majorRequirement,
    args.targetUsers,
    args.constraints,
    args.existingSystem,
    args.deliverables,
    args.relation,
    args.candidateFileName,
    args.diffSummary,
    args.compatibility,
    args.conflictResolution,
    args.versionDecision,
    args.extraNotes,
  ]
    .join(" ")
    .split(/[\s,，。；;、:：/\\|()（）\[\]{}<>「」『』"'`]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item !== "待補")

  return [...new Set(words)].slice(0, 18).join("、") || "待補"
}

function deriveCompatibility(args: AnalyzeRequirementsInput): string {
  const compatibility = normalize(args.compatibility).toLowerCase()
  if (["compatible", "conflict", "needs_decision"].includes(compatibility)) return compatibility
  if (compatibility === "相容") return "compatible"
  if (compatibility === "衝突") return "conflict"
  if (compatibility === "需決策" || compatibility === "需要決策") return "needs_decision"
  if (deriveRelation(args, Boolean(args.targetFileName)) === "new") return "compatible"
  return "needs_decision"
}

function deriveVersionDecision(args: AnalyzeRequirementsInput): string {
  const decision = normalize(args.versionDecision).toLowerCase()
  if (["keep_old", "use_new", "merge", "create_new", "needs_decision"].includes(decision)) return decision
  if (decision === "保留舊版") return "keep_old"
  if (decision === "採用新版") return "use_new"
  if (decision === "合併") return "merge"
  if (decision === "建立新需求") return "create_new"
  if (deriveRelation(args, Boolean(args.targetFileName)) === "new") return "create_new"
  return "needs_decision"
}

function assertOutputIntent(args: AnalyzeRequirementsInput, targetPath?: string): void {
  const relation = deriveRelation(args, Boolean(targetPath))

  if (relation === "uncertain") {
    throw new Error("relation 為 uncertain 時不可產檔或更新；請先讓使用者確認候選檔或改為 new")
  }

  if (relation === "related" && !targetPath) {
    throw new Error("relation 為 related 時必須提供 targetFileName，避免相關需求被誤建成新檔")
  }

  const compatibility = deriveCompatibility(args)
  const versionDecision = deriveVersionDecision(args)

  if (!targetPath) {
    if (versionDecision !== "create_new") {
      throw new Error("建立新需求檔時 versionDecision 必須是 create_new；保留舊版、採用新版、合併或需決策不可直接建新檔")
    }
    if (compatibility !== "compatible") {
      throw new Error("建立新需求檔前 compatibility 必須是 compatible；若仍有衝突或需決策，請先完成版本確認")
    }
    return
  }

  const diffSummary = normalize(args.diffSummary)
  const conflictResolution = normalize(args.conflictResolution)
  const candidateFileName = normalize(args.candidateFileName)
  const targetFileName = normalize(args.targetFileName)

  if (relation !== "related") {
    throw new Error("只有 relation 為 related 時才可更新既有需求檔")
  }

  if (candidateFileName === "待補") {
    throw new Error("迭代更新既有需求時必須提供 candidateFileName")
  }

  if (candidateFileName !== targetFileName) {
    throw new Error("candidateFileName 必須與 targetFileName 一致，避免更新錯誤舊需求")
  }

  if (diffSummary === "待補") {
    throw new Error("迭代更新既有需求時必須提供 diffSummary，說明新舊需求差異")
  }

  if (compatibility !== "compatible") {
    throw new Error("迭代更新既有需求前，compatibility 必須是 compatible；若有衝突或需決策，請先回到澄清流程")
  }

  if (["keep_old", "create_new", "needs_decision"].includes(versionDecision)) {
    throw new Error("迭代更新既有需求前，versionDecision 必須是 use_new 或 merge；保留舊版、建立新需求或需決策時不可更新舊檔")
  }

  if (conflictResolution === "待補") {
    throw new Error("迭代更新既有需求時必須提供 conflictResolution，說明如何避免與舊需求衝突")
  }
}

async function upsertRequirementRepoMap(
  outputPath: string,
  fileName: string,
  args: AnalyzeRequirementsInput,
  updatedAt: string,
  hasTargetFile: boolean,
): Promise<string> {
  const entries = await readRequirementRepoMap(outputPath)
  const nextEntry: RequirementRepoMapEntry = {
    fileName,
    updatedAt,
    relation: deriveRelation(args, hasTargetFile),
    summary: compactMapValue(`${args.majorRequirement}；差異：${normalize(args.diffSummary)}；交付：${args.deliverables}`, 220),
    scope: compactMapValue(`${args.constraints}；候選：${normalize(args.candidateFileName)}；相容性：${deriveCompatibility(args)}；版本決策：${deriveVersionDecision(args)}`, 160),
    latestChange: compactMapValue(`${normalize(args.diffSummary)}；版本決策：${deriveVersionDecision(args)}；衝突處理：${normalize(args.conflictResolution)}`, 180),
    versionDecision: deriveVersionDecision(args),
    keywords: compactMapValue(deriveKeywords(args), 160),
  }
  const nextEntries = [nextEntry, ...entries.filter((entry) => entry.fileName !== fileName)]
  return writeRequirementRepoMap(outputPath, nextEntries)
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
    `FE：${primary.includes("待補") ? "核心使用流程" : primary} 的畫面、互動、狀態與錯誤回饋`,
    `BE：${primary.includes("待補") ? "核心業務流程" : primary} 的資料、規則、API、權限與整合`,
    `Test：依需求邊界建立主流程、例外情境與回歸測試`,
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
    return `待補。建議以核心流程完成率、錯誤率、回歸通過率與使用者回饋為主要 KPI（待補）`
  }

  if (normalize(deliverables) === "待補") {
    return `待補。建議以主要交付項目完成率、回歸穩定性與回報回應時間為 KPI`
  }

  return `交付《${deliverables}》滿足 FE/BE/Test 各自目標`
}

function inferMainFlow(majorRequirement: string, targetUsers: string): string {
  const user = targetUsers.includes("待補") ? "目標使用者" : targetUsers
  const goal = majorRequirement.includes("待補") ? "核心需求" : majorRequirement
  return `${user} 進入相關情境 → 觸發或操作 ${goal} → 系統完成處理與回饋 → 使用者確認結果或進入下一步`
}

function buildReferenceSection(referenceCases: string): string {
  if (normalize(referenceCases) !== "待補") {
    return `- **參考依據：** ${referenceCases}\n- **採用判斷：** 僅採用可直接對應本需求目標、使用者情境、限制與交付邊界的做法。`
  }

  return [
    "- **參考依據：** 待補。建議補充競品、既有系統、設計規範、API 規格或法規依據。",
    "- **採用判斷：** 未補充前，先以可用性、穩定性、安全性、可維護性與可測試性作為通用基準。",
  ].join("\n")
}

function buildOpenQuestions(constraints: string, existingSystem: string, referenceCases: string): string[] {
  const questions = [
    constraints.includes("待補") ? "確認本次必做、不做、時程、技術與合規限制" : `確認限制是否完整：${constraints}`,
    existingSystem.includes("待補") ? "確認是否有既有系統、資料、API、權限或不可改動項" : `確認既有系統影響：${existingSystem}`,
    referenceCases.includes("待補") ? "確認是否有參考案例、設計風格或驗收依據" : `確認參考案例採用範圍：${referenceCases}`,
  ]

  return questions.slice(0, 5)
}

export function buildReport(args: AnalyzeRequirementsInput) {
  const majorRequirement = normalize(args.majorRequirement)
  const targetUsers = normalize(args.targetUsers)
  const constraints = normalize(args.constraints)
  const existingSystem = normalize(args.existingSystem)
  const referenceCases = normalize(args.referenceCases)
  const deliverables = normalize(args.deliverables)
  const extraNotes = normalize(args.extraNotes)
  const mode = normalize(args.mode)
  const relation = deriveRelation(args, Boolean(args.targetFileName))
  const candidateFileName = normalize(args.candidateFileName)
  const diffSummary = normalize(args.diffSummary)
  const compatibility = deriveCompatibility(args)
  const conflictResolution = normalize(args.conflictResolution)
  const versionDecision = deriveVersionDecision(args)

  const [sr1, sr2, sr3] = buildSubRequirements(majorRequirement)
  const [feLine, beLine, testLine] = [sr1, sr2, sr3]
  const reportHeader = `# 需求分析報告（精簡固定模板）`
  const timestamp = new Date().toISOString()
  const successIndicator = deriveKpi(extraNotes, deliverables)
  const executionRef = existingSystem.includes("待補")
    ? "待補。若無執行文件，請先補充需求驗收文件與測試清單"
    : existingSystem
  const mainFlow = inferMainFlow(majorRequirement, targetUsers)
  const openQuestions = buildOpenQuestions(constraints, existingSystem, referenceCases)

  return `${reportHeader}

## 1. 大需求摘要
${sectionLine("需求編號", "DR-01")}
- **一句話目標：** ${majorRequirement}
- **關聯判斷：** ${relation}（候選檔案：${candidateFileName}）
- **新舊差異：** ${diffSummary}
- **迭代完整性：** ${compatibility}；${conflictResolution}
- **版本決策：** ${versionDecision}
- **成功指標：** ${successIndicator}
- **影響範圍：** ${constraints.includes("待補") ? "待補" : `${constraints}、測試資源、使用者體驗`}

## 2. FE / BE / Test 分工與交付
### 2.1 FE（UI/UX）
- **目標：** 讓使用者能理解需求入口、完成關鍵操作並取得明確回饋
- **交付內容：** ${feLine}
- **主要驗收：** 關鍵畫面、狀態、錯誤訊息與操作路徑可被直接驗證
- **依賴：** 設計規範、使用者情境、裝置支援與可用性要求

### 2.2 BE（穩定 / 安全 / 性能）
- **目標：** 確保 ${majorRequirement.includes("待補") ? "核心流程" : majorRequirement} 的資料處理、商業規則、權限與整合一致可靠
- **交付內容：** ${beLine}
- **主要驗收：** API/資料/規則處理正確，錯誤回應一致，必要紀錄與保護機制到位
- **依賴：** 既有系統、資料模型、權限規則、外部服務與監控紀錄

### 2.3 Test（測試）
- **目標：** 依需求與執行文件新增可執行測試，支援回歸
- **測試依據：** ${executionRef}
- **測試交付：** ${testLine}
- **依賴：** ${targetUsers.includes("測試") ? targetUsers : "測試計畫、環境、Mock/Stub 資源"}

## 3. 參考依據與最佳實踐
${buildReferenceSection(referenceCases)}
- **通用檢核：** 需求需同時檢查可用性、資料正確性、權限/隱私、錯誤處理、可觀測性與測試覆蓋。

## 4. 邊緣情境與嚴重程度總覽
### 4.1 風險分級定義
- P0：核心流程完全中斷、資料遺失、權限外洩或重大合規風險
- P1：主要功能不可用或大量使用者受影響
- P2：局部流程退化、錯誤回饋不清或需人工補救
- P3：文字、視覺一致性或低影響體驗瑕疵

### 4.2 主要邊緣情境
- 情境名稱：核心流程輸入或前置條件不完整
  - 發生來源：使用者資料不足、狀態不符、必要欄位或條件缺漏
  - 發生機率：高
  - 影響範圍：主要流程無法完成或結果不可信
  - 嚴重程度：P2
  - 建議修復優先度：第二優先
- 情境名稱：既有系統或外部依賴不可用
  - 發生來源：API、資料庫、第三方服務、權限或設定異常
  - 發生機率：中
  - 影響範圍：交付流程中斷、資料不同步或需要降級處理
  - 嚴重程度：P1
  - 建議修復優先度：第一優先
- 情境名稱：錯誤訊息、狀態或驗收規則不明確
  - 發生來源：需求邊界不清、文案缺漏、驗收條件未定義
  - 發生機率：高
  - 影響範圍：使用者理解成本、客服/維運成本與測試返工上升
  - 嚴重程度：P2
  - 建議修復優先度：第三優先

## 5. 大需求拆解
### 5.1 大需求：DR-01
- **大需求名稱：** ${majorRequirement}
- **交付邊界：** ${deliverables}
- **關聯成功指標：** ${successIndicator}

### 5.2 子需求 SR-01（FE）
- **子需求名稱：** ${sr1}
- **業務目標：** 降低使用者理解與操作成本，讓關鍵流程可完成、可回饋、可追蹤
- **優先順序：** Must
- **驗收判斷：** 使用者入口、操作狀態、錯誤提示與完成回饋可直接驗證

### 5.3 子需求 SR-02（BE）
- **子需求名稱：** ${sr2}
- **業務目標：** 提供穩定、正確、可維護且可追溯的業務處理能力
- **優先順序：** Must
- **驗收判斷：** 資料處理、商業規則、權限檢查、錯誤碼與紀錄符合需求

### 5.4 子需求 SR-03（Test）
- **子需求名稱：** ${sr3}
- **業務目標：** 用需求 + 執行文件建立可重複測試
- **優先順序：** Should
- **驗收判斷：** 主流程、例外流程、權限/資料邊界與回歸場景均有測試依據

## 6. 每個子需求的最佳解決方案
### SR-01（FE）
- **推薦做法：** 以最小可用畫面先上線，搭配漸進優化規則
- **實作重點：** 資訊架構、操作入口、狀態呈現、錯誤回饋、Loading/空狀態與行動版可用性
- **預期效益：** 降低操作困擾與返工成本，提升完成率與可理解性
- **邊緣情境與影響分析：**
  - 情境1：必要資訊不足或狀態不符
  - 嚴重程度：P2
  - 是否阻斷上線：否
  - 情境2：使用者重複操作、返回或中斷流程
  - 嚴重程度：P1
  - 是否阻斷上線：否（需有防重複與回復策略）
- **最小可行版本（MVP）：** 完成核心操作入口、狀態與錯誤回饋
- **延展版本：** 補齊進階互動、偏好設定、輔助說明或管理能力
- **依賴與風險：** 設計資源不足、文案一致性不清、使用情境未完整定義
- **替代方案對比：**
  - 方案A：一次完成完整體驗，成本高且需求變動風險大
  - 方案B：先完成核心流程與回饋，再依驗證結果迭代（建議）
- **最佳實踐參考：** ${referenceCases.includes("待補") ? "待補" : referenceCases}

### SR-02（BE）
- **推薦做法：** 先定義資料、規則、權限、錯誤與整合邊界，再實作最小穩定 API/服務
- **實作重點：** 資料模型、商業規則、權限檢查、錯誤碼、交易一致性、日誌與監控
- **預期效益：** 降低資料錯誤與整合風險，提高服務穩定性與可追蹤性
- **邊緣情境與影響分析：**
  - 情境1：外部依賴延遲或不可用
  - 嚴重程度：P1
  - 是否阻斷上線：否（可降級錯誤提示）
  - 情境2：資料狀態衝突、重複提交或權限不足
  - 嚴重程度：P0
  - 是否阻斷上線：是（需明確防護與回滾策略）
- **最小可行版本（MVP）：** 支援核心資料處理、權限判斷、錯誤回應與必要紀錄
- **延展版本：** 進階規則、批次處理、通知、審核、報表或自動化整合
- **依賴與風險：** 既有資料品質、外部服務穩定性、權限模型與維運窗口
- **替代方案對比：**
  - 方案A：直接擴充既有流程（較快，但需確認技術債）
  - 方案B：抽出獨立服務/模組（較穩，但時程較長）
- **最佳實踐參考：** 參考依據：${executionRef}

### SR-03（Test）
- **推薦做法：** 以需求拆解直接展開測試矩陣，與執行文件雙向綁定
- **實作重點：** 功能測試、邊界條件、權限/資料情境、API/整合異常、回歸套件
- **預期效益：** 上線前可量化風險，減少回歸漏測
- **邊緣情境與影響分析：**
  - 情境1：測試案例未覆蓋例外流程
  - 嚴重程度：P2
  - 是否阻斷上線：否
  - 情境2：回歸腳本未更新
  - 嚴重程度：P1
  - 是否阻斷上線：是（高風險場景未被保護）
- **最小可行版本（MVP）：** 先建立主流程、失敗流程、權限/資料邊界與回歸測試
- **延展版本：** 加入自動化回歸、效能壓力、資料一致性與可觀測性檢查
- **依賴與風險：** 測試文件不完整、資料重置機制不足、環境差異造成誤判
- **替代方案對比：**
  - 方案A：只做手動驗證（快但品質低）
  - 方案B：需求驅動自動化測試（建議）
- **最佳實踐參考：** 參考依據：執行文件與交付流程（${existingSystem.includes("待補") ? "待補" : existingSystem}）

## 7. 使用者故事（可複製多條）
- **故事編號：** US-01
- **角色：** ${targetUsers.includes("待補") ? "一般使用者" : targetUsers}
- **行為：** 在指定情境中完成「${majorRequirement}」相關操作
- **目的：** 以可理解、可驗證且低返工的方式達成需求目標
- **對應子需求：** SR-01、SR-02

## 8. 非功能需求（NFR）
- **效能：** 核心操作需在可接受時間內完成；具體門檻待依系統規模補充
- **可用性：** 主要狀態、錯誤訊息與下一步行動需清楚可理解
- **安全/權限：** 涉及資料、角色、隱私或操作權限時，需明確檢查與紀錄
- **可觀測性：** 需記錄成功率、錯誤率、耗時、關鍵事件與異常原因

## 9. 流程與畫面草案
- **主流程：** ${mainFlow}
- **關鍵節點：** 需求入口、必要資訊、系統處理、結果回饋、失敗/重試/取消路徑
- **錯誤回饋策略：** 顯示可行動訊息（修正資料 / 重試 / 返回 / 聯繫管理者）並保留操作上下文

## 10. 驗收條件（至少 5 項）
- AC-01：使用者可依主流程完成「${majorRequirement}」並取得明確結果
- AC-02：必要資料缺漏、格式錯誤或狀態不符時，系統能阻擋並給出可行動回饋
- AC-03：BE/API/資料處理符合需求規則，錯誤碼與紀錄可追蹤
- AC-04：FE 需呈現主要狀態、錯誤、Loading/空狀態與成功回饋
- AC-05：測試文件對應主流程、例外流程、權限/資料邊界與回歸場景

## 11. 里程碑建議
- **MVP：** 完成主流程、必要資料處理、基本錯誤回饋與最小測試集
- **Beta 測試：** 補齊例外流程、權限/資料邊界、自動化回歸與觀測指標
- **正式上線：** 通過驗收、完成風險確認、監控告警與回滾/補救方案

---
## 12. 版本附註
- **待補資訊清單（3-5 項）：**
${openQuestions.map((question) => `  - ${question}`).join("\n")}
- **需要你確認的關鍵決策：**
  - ${constraints.includes("待補") ? "待補：本次需求的必做/不做與優先順序" : `${constraints} 是否已完整涵蓋本次開發邊界`}

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
    relation: tool.schema
      .string()
      .describe("需求關聯判斷：related、new 或 uncertain")
      .default(""),
    candidateFileName: tool.schema
      .string()
      .describe("候選既有需求 Markdown 檔名；沒有則空白")
      .default(""),
    diffSummary: tool.schema
      .string()
      .describe("本次新需求與候選舊需求的差異摘要")
      .default(""),
    compatibility: tool.schema
      .string()
      .describe("新需求與舊需求相容性：compatible、conflict 或 needs_decision")
      .default(""),
    conflictResolution: tool.schema
      .string()
      .describe("若迭代舊需求，說明如何保留舊需求完整性並避免衝突")
      .default(""),
    versionDecision: tool.schema
      .string()
      .describe("衝突或不確定確認後的版本決策：keep_old、use_new、merge、create_new 或 needs_decision")
      .default(""),
    targetFileName: tool.schema
      .string()
      .describe("若新需求要迭代既有需求，填輸出目錄內的 Markdown 檔名；空白才建立新檔")
      .default(""),
  },
  async execute(args, context) {
    const safeWorktree = context?.worktree ? context.worktree : process.cwd()
    const { report, filePath, repoMapPath } = await writeAnalyzeRequirementsOutput(args, safeWorktree)

    return `${report}\n\n## 產出檔案\n${filePath}\n\n## Repo Map\n${repoMapPath}`
  },
})

export async function writeAnalyzeRequirementsOutput(
  args: AnalyzeRequirementsInput,
  worktree: string,
  outputDir?: string,
): Promise<{ report: string; filePath: string; repoMapPath: string }> {
  const safeWorktree = worktree || process.cwd()
  const outputPath = resolveRequirementsDir(safeWorktree, outputDir || DEFAULT_REQUIREMENTS_DIR)
  const targetPath = safeTargetFilePath(outputPath, args.targetFileName)
  assertOutputIntent(args, targetPath)

  const filePath = targetPath || path.join(outputPath, `analyze-requirements_${randomUUID()}_${Date.now()}.md`)
  const timestamp = new Date().toISOString()

  await mkdir(outputPath, { recursive: true })
  if (targetPath) await access(targetPath)

  const report = buildReport(args)
  const output = targetPath ? buildIterativeUpdate(await readFile(targetPath, "utf-8"), report, timestamp) : report
  await writeFile(filePath, output, "utf-8")
  const repoMapPath = await upsertRequirementRepoMap(outputPath, path.basename(filePath), args, timestamp, Boolean(targetPath))

  return { report, filePath, repoMapPath }
}
