import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { tool } from "@opencode-ai/plugin"

const MAX_REQUIREMENT_CHARS = 20000
const MAX_REQUIREMENT_SIGNALS = 10
const MAX_GRANULAR_QUESTIONS = 18
const MAX_TECHNICAL_FOLLOW_UPS = 8

const FRONTEND_HINTS = [
  "畫面",
  "頁面",
  "UI",
  "UX",
  "表單",
  "元件",
  "互動",
  "瀏覽器",
  "檢視",
]

const BACKEND_HINTS = [
  "API",
  "資料庫",
  "登入",
  "驗證",
  "權限",
  "server",
  "後端",
  "排程",
  "資料模型",
  "服務端",
  "伺服器",
]

const DETAIL_TOPICS = [
  "需求來源/原文整理",
  "MVP 範圍與不做範圍",
  "使用者角色/權限矩陣",
  "實作語言",
  "前端框架",
  "前端頁面/路由/狀態",
  "前端表單/驗證/錯誤顯示",
  "前端資料流/API 快取",
  "後端框架",
  "API contract 與錯誤格式",
  "API pagination/filter/sort",
  "資料庫",
  "資料模型/查詢/索引",
  "資料 migration/seed/備份",
  "登入驗證",
  "權限/隱私/安全",
  "核心計算/資料一致性",
  "背景工作/排程/通知",
  "檔案上傳/第三方整合",
  "可觀測性/logging/audit",
  "第三方套件選型",
  "測試",
  "部署/執行環境",
  "環境變數/secret 管理",
]

export const AnalyzeRequirementsTools = async () => {
  return {
    tool: {
      analyze_requirements: tool({
        description:
          "分析需求內容與目前專案線索，協助釐清開發細節。工具只整理需求、偏好與專案線索；技術架構與套件建議需由大模型依上下文自動產生，避免在工具內寫死。",
        args: {
          requirement: tool.schema
            .string()
            .optional()
            .describe("需求文字。若同時提供 requirement_file，會與檔案內容合併分析。"),
          requirement_file: tool.schema
            .string()
            .optional()
            .describe("需求檔案路徑，可用相對於 workspace 的路徑，例如 123.md。"),
          preferences: tool.schema
            .string()
            .optional()
            .describe("使用者已指定或偏好的技術選擇、限制條件或排除項目。"),
          decision_mode: tool.schema
            .string()
            .optional()
            .describe("決策模式：user_provided 代表優先整理使用者提供選項；recommend_best 代表要求大模型根據需求推薦最佳方案；mixed 代表兩者並行。"),
          user_packages: tool.schema
            .string()
            .optional()
            .describe("使用者自己指定想採用或排除的套件、函式庫或工具。"),
          model_recommendation_needs: tool.schema
            .string()
            .optional()
            .describe("希望交給大模型推薦的技術架構、套件類型或決策項目。"),
        },
        async execute(args, context) {
          const requirementText = await loadRequirementText(args, context)
          const projectSignals = await inspectProject(context.worktree)
          const analysis = analyzeRequirement(requirementText, projectSignals, args)

          return formatAnalysis(analysis, projectSignals, requirementText)
        },
      }),
    },
  }
}

async function loadRequirementText(args, context) {
  const parts = []

  if (args.requirement_file) {
    const filePath = resolveInsideWorktree(args.requirement_file, context.worktree)
    const text = await readFile(filePath, "utf8")
    parts.push(`# ${path.relative(context.worktree, filePath)}\n\n${text}`)
  }

  if (args.requirement) {
    parts.push(args.requirement)
  }

  return parts.join("\n\n").slice(0, MAX_REQUIREMENT_CHARS)
}

function resolveInsideWorktree(inputPath, worktree) {
  const resolved = path.resolve(worktree, inputPath)
  const relative = path.relative(worktree, resolved)

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("requirement_file must be inside the current workspace")
  }

  return resolved
}

async function inspectProject(worktree) {
  const frontend = await inspectArea(worktree, "frontend")
  const backend = await inspectArea(worktree, "backend")
  const root = await inspectArea(worktree, ".")

  return { frontend, backend, root }
}

async function inspectArea(worktree, area) {
  const dir = path.join(worktree, area)
  const exists = await pathExists(dir)

  if (!exists) {
    return { area, exists: false, files: [], packageJson: null, readme: null, signals: [] }
  }

  const entries = await readdir(dir, { withFileTypes: true })
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort()
  const packageJson = await readJsonIfExists(path.join(dir, "package.json"))
  const readme = await readTextIfExists(path.join(dir, "README.md"))
  const signals = inferSignals(files, packageJson, readme)

  return { area, exists: true, files, packageJson, readme, signals }
}

async function pathExists(filePath) {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"))
  } catch {
    return null
  }
}

async function readTextIfExists(filePath) {
  try {
    return await readFile(filePath, "utf8")
  } catch {
    return null
  }
}

function inferSignals(files, packageJson, readme) {
  const signals = new Set()
  const deps = {
    ...packageJson?.dependencies,
    ...packageJson?.devDependencies,
  }
  const depNames = Object.keys(deps)

  for (const file of files) {
    if (isLikelyProjectSignalFile(file)) signals.add(`檔案:${file}`)
  }

  for (const depName of depNames.slice(0, 20)) {
    signals.add(`套件:${depName}`)
  }

  if (packageJson?.name) signals.add(`專案名稱:${packageJson.name}`)
  if (packageJson?.type) signals.add(`模組類型:${packageJson.type}`)
  if (packageJson?.scripts) signals.add(`scripts:${Object.keys(packageJson.scripts).join(",")}`)
  if (readme?.trim()) signals.add("README:存在")

  return [...signals]
}

function isLikelyProjectSignalFile(file) {
  const lower = file.toLowerCase()
  return lower.endsWith(".json")
    || lower.endsWith(".toml")
    || lower.endsWith(".yaml")
    || lower.endsWith(".yml")
    || lower.endsWith(".config.js")
    || lower.endsWith(".config.mjs")
    || lower.endsWith(".config.cjs")
    || lower === "makefile"
    || lower === "readme.md"
}

function analyzeRequirement(requirementText, projectSignals, args = {}) {
  const text = requirementText || ""
  const preferenceText = args.preferences || ""
  const userPackageText = args.user_packages || ""
  const modelRecommendationNeeds = args.model_recommendation_needs || ""
  const frontendScore = scoreHints(text, FRONTEND_HINTS)
  const backendScore = scoreHints(text, BACKEND_HINTS)
  const detailContext = buildDetailContext({ preferenceText, userPackageText, modelRecommendationNeeds })
  const requirementSignals = extractRequirementSignals(text)
  const needFrontend = frontendScore > 0
  const needBackend = backendScore > 0
  const detailTopics = selectDetailTopics(text, { needFrontend, needBackend, requirementSignals })
  const foundDetails = detailTopics.map((topic) => [topic, detailContext])
  const missingDetails = detailContext.length === 0 ? [...detailTopics] : []
  const modelRecommendationPrompt = buildModelRecommendationPrompt({
    needFrontend,
    needBackend,
    foundDetails,
    missingDetails,
    preferenceText,
    userPackageText,
    modelRecommendationNeeds,
    projectSignals,
    decisionMode: args.decision_mode || "mixed",
  })

  return {
    needFrontend,
    needBackend,
    frontendScore,
    backendScore,
    foundDetails,
    missingDetails,
    preferenceText,
    userPackageText,
    modelRecommendationNeeds,
    decisionMode: args.decision_mode || "mixed",
    modelRecommendationPrompt,
    requirementSignals,
    projectSignals,
  }
}

function buildDetailContext({ preferenceText, userPackageText, modelRecommendationNeeds }) {
  const details = []

  if (preferenceText) details.push(`使用者偏好:${preferenceText}`)
  if (userPackageText) details.push(`使用者指定套件:${userPackageText}`)
  if (modelRecommendationNeeds) details.push(`模型推薦需求:${modelRecommendationNeeds}`)

  return details
}

function scoreHints(text, hints) {
  return hints.reduce((count, hint) => count + (matchesHint(text, hint) ? 1 : 0), 0)
}

function matchesHint(text, hint) {
  if (!text) return false

  const escaped = hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const asciiOnly = /^[A-Za-z0-9.# +/-]+$/.test(hint)

  if (!asciiOnly) {
    return text.toLowerCase().includes(hint.toLowerCase())
  }

  return new RegExp(`(^|[^A-Za-z0-9])${escaped}($|[^A-Za-z0-9])`, "i").test(text)
}

function selectDetailTopics(text, { needFrontend, needBackend, requirementSignals }) {
  const topics = new Set([
    "需求來源/原文整理",
    "MVP 範圍與不做範圍",
  ])
  const signalText = requirementSignals.map((signal) => signal.clause).join("\n")
  const combined = `${text}\n${signalText}`

  if (needFrontend) {
    topics.add("前端頁面/路由/狀態")
    if (includesAny(combined, ["表單", "新增", "修改", "登入", "輸入", "驗證"])) {
      topics.add("前端表單/驗證/錯誤顯示")
    }
    if (includesAny(combined, ["檢視", "頁面", "畫面", "日", "週", "月", "清單", "互動"])) {
      topics.add("前端框架")
    }
  }

  if (needBackend) {
    topics.add("API contract 與錯誤格式")
    topics.add("資料模型/查詢/索引")
    if (includesAny(combined, ["資料庫", "保存", "建立", "刪除", "修改", "查詢", "紀錄"])) {
      topics.add("資料庫")
    }
    if (includesAny(combined, ["登入", "登出", "未登入", "session", "驗證", "權限", "身分"])) {
      topics.add("登入驗證")
      topics.add("權限/隱私/安全")
    }
  }

  if (needFrontend && needBackend) topics.add("核心計算/資料一致性")
  if (includesAny(combined, ["提醒", "通知", "排程", "逾期", "多次", "當日"])) topics.add("背景工作/排程/通知")
  if (includesAny(combined, ["重複", "衝突", "重疊", "跨日", "時區", "單次", "後續", "整組"])) topics.add("核心計算/資料一致性")
  if (includesAny(combined, ["敏感", "隱私", "外露", "隔離", "個人", "安全"])) topics.add("權限/隱私/安全")
  if (includesAny(combined, ["驗收", "通過", "不通過", "測試", "E2E", "API test", "失敗"])) topics.add("測試")
  if (includesAny(combined, ["部署", "Docker", "環境", "CI", "本機", "容器"])) topics.add("部署/執行環境")

  return [...topics].filter((topic) => DETAIL_TOPICS.includes(topic))
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword))
}

function formatAnalysis(analysis, projectSignals, requirementText) {
  const projectType = analysis.needFrontend && analysis.needBackend
    ? "frontend + backend"
    : analysis.needFrontend
      ? "frontend"
      : analysis.needBackend
        ? "backend"
        : "尚無法由需求判斷需要 frontend/backend"

  const detailLines = analysis.foundDetails.map(([topic, matches]) => {
    return `- ${topic}：${matches.length > 0 ? matches.join("；") : "交由大模型依需求判斷"}`
  })

  const statusLines = [projectSignals.frontend, projectSignals.backend].map((area) => {
    if (!area.exists) return `- ${area.area}：不存在`

    const signals = area.signals.length > 0 ? area.signals.join("、") : "未從 README/package 偵測到明確技術棧"
    return `- ${area.area}：存在；${signals}`
  })

  const questionLines = buildQuestions(analysis)
  const preferenceLines = buildPreferenceLines(analysis)
  const packageDecisionLines = buildPackageDecisionLines(analysis)
  const recommendationLines = buildRecommendationLines(analysis)
  const sourceNote = requirementText
    ? `已分析需求內容約 ${requirementText.length} 字。`
    : "未提供需求文字或檔案；以下只反映目前專案線索。"

  return [
    "# 需求開發細節分析",
    "",
    `- 分析來源：${sourceNote}`,
    `- 建議專案範圍：${projectType}`,
    `- frontend 命中線索：${analysis.frontendScore}`,
    `- backend 命中線索：${analysis.backendScore}`,
    "",
    "## 目前專案線索",
    ...statusLines,
    "",
    "## 已知/待釐清開發細節",
    ...detailLines,
    "",
    "## 使用者指定或偏好",
    ...preferenceLines,
    "",
    "## 套件決策方式",
    ...packageDecisionLines,
    "",
    "## 大模型技術架構產生指令",
    ...recommendationLines,
    "",
    "## 提問生成自由度",
    ...buildQuestionFreedomLines(analysis),
    "",
    "## 建議優先釐清問題",
    ...questionLines,
    "",
    "## 產檔整理提醒",
    "- 後續需求開發實踐檔應把原始需求整理、引用來源、使用者已確認技術決策與開發實踐建議放在同一份文件中。",
    "- 不要把未經 question 確認的推薦方案寫成已採用；未確認項目只能列為待確認或候選方案。",
  ].join("\n")
}

function buildQuestionFreedomLines(analysis) {
  const scopeHint = analysis.needFrontend || analysis.needBackend
    ? "已能判斷落地範圍時，少問框架大方向，多問會改變 UI、API、資料、狀態、權限、測試或部署責任的細節。"
    : "尚不能判斷落地範圍時，先問產出型態與是否要實作，不要直接套前端/後端技術題。"

  return [
    "- 下方內容是可轉成 question 工具的提問素材，不是固定問句或必問題庫；可依上下文拆分、合併、改寫、跳過或追加追問。",
    `- ${scopeHint}`,
    "- 若需求原文已給出答案，直接記為已確認；若只是低風險工程偏好，放入實踐建議即可，不必為了填表打斷使用者。",
    "- 每個 question 只確認一個會改變實作路徑或驗收標準的決策；選項數量與類型依情境自由設計，通常 2-5 個，不固定套推薦/替代/待確認三分法。",
  ]
}

function buildPreferenceLines(analysis) {
  const lines = [`- 決策模式：${analysis.decisionMode}`]

  if (!analysis.preferenceText) {
    lines.push("- 尚未提供偏好；可提供已指定的語言、框架、資料庫、套件或排除條件。")
    return lines
  }

  lines.push(`- 原始偏好：${analysis.preferenceText}`)

  return lines
}

function buildModelRecommendationPrompt(analysis) {
  const scope = analysis.needFrontend && analysis.needBackend
    ? "frontend + backend"
    : analysis.needFrontend
      ? "frontend"
      : analysis.needBackend
        ? "backend"
        : "尚無法判斷，請先依需求判斷是否需要 frontend/backend"
  const foundDetails = analysis.foundDetails
    .map(([topic, matches]) => `${topic}=${matches.length > 0 ? matches.join("；") : "交由大模型依需求判斷"}`)
    .join("；")
  const projectSignals = [analysis.projectSignals.frontend, analysis.projectSignals.backend, analysis.projectSignals.root]
    .map((area) => `${area.area}:${area.exists ? area.signals.join("、") || "未偵測到技術棧" : "不存在"}`)
    .join("；")

  return [
    "請由大模型根據需求內容、目前專案線索與使用者偏好，自動產生技術架構建議；工具不得提供固定預設技術棧，也不得把下列提示當成必填表單。",
    `建議專案範圍：${scope}`,
    `已知/待釐清技術線索：${foundDetails}`,
    `目前專案線索：${projectSignals}`,
    `使用者偏好：${analysis.preferenceText || "未提供"}`,
    `使用者指定套件：${analysis.userPackageText || "未提供"}`,
    `使用者希望模型推薦項目：${analysis.modelRecommendationNeeds || "未指定，請只評估需求中會改變落地方案的技術決策；不要為未出現或低風險的分類硬補問題"}`,
    `決策模式：${analysis.decisionMode}`,
    "輸出時請先說明推薦路徑與理由，再列出足以改變實作的替代路線、取捨風險、必要官方文件 URL 與待問問題；待問問題要從需求情境拆出，不需固定包含所有技術分類，也不要固定套推薦/替代/待確認三選項。",
    "若使用者已指定偏好，請優先尊重；若偏好與需求或專案線索衝突，請明確指出風險並提供替代方案。",
  ]
}

function buildPackageDecisionLines(analysis) {
  const lines = []

  if (analysis.userPackageText) {
    lines.push(`- 使用者指定套件：${analysis.userPackageText}`)
    lines.push("- 工具不內建套件白名單或 URL 對照；官方連結與替代套件由大模型依上下文補齊。")
  } else {
    lines.push("- 使用者尚未指定套件；可用 user_packages 提供想採用或排除的套件。")
  }

  if (analysis.modelRecommendationNeeds) {
    lines.push(`- 交給大模型推薦：${analysis.modelRecommendationNeeds}`)
    lines.push("- 後續模型應依需求、既有技術棧、維護性、社群成熟度與官方文件 URL 補齊推薦套件。")
  } else {
    lines.push("- 尚未指定要交給大模型推薦的套件類型；可用 model_recommendation_needs 指定 UI、日期、驗證、ORM、測試等。")
  }

  return lines
}

function buildRecommendationLines(analysis) {
  if (analysis.decisionMode === "user_provided") {
    return [
      "- 已選擇 user_provided：優先整理使用者提供方案；若要大模型主動推薦，請改用 decision_mode=mixed 或 recommend_best。",
      ...analysis.modelRecommendationPrompt.map((line) => `- ${line}`),
    ]
  }

  return analysis.modelRecommendationPrompt.map((line) => `- ${line}`)
}

const QUESTION_DESIGN_GUIDE = "把這列當成 question 設計素材而非固定問句；只挑會改變實作路徑或驗收標準的焦點，可拆分、合併、改寫或跳過；選項需依需求情境自訂，避免固定技術棧或固定推薦/替代/延後格式，description 說明採用後對 UI/API/資料/狀態/測試/風險的具體影響"

function buildDetailedQuestion(topic, checks, sourceClause = "") {
  const source = sourceClause ? `（來源：「${truncateText(sourceClause, 52)}」）` : ""
  const focus = checks.slice(0, 5).join("、")
  const overflow = checks.length > 5 ? ` 等 ${checks.length} 個焦點` : ""
  return `- ${topic}${source}：可拆問焦點：${focus}${overflow}；${QUESTION_DESIGN_GUIDE}。`
}

function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text || ""
  return `${text.slice(0, maxLength - 1)}…`
}

function extractRequirementSignals(requirementText) {
  if (!requirementText) return []

  const clauses = requirementText
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*`|\-[\]]/g, " ")
    .split(/[\n。；;，,]/)
    .map((clause) => clause.replace(/\s+/g, " ").trim())
    .filter((clause) => clause.length >= 8 && clause.length <= 120)

  const scored = clauses
    .map((clause) => ({ clause, score: scoreRequirementClause(clause) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  const seen = new Set()
  const signals = []

  for (const item of scored) {
    const key = item.clause.replace(/[\s：:「」『』]/g, "").slice(0, 40)
    if (seen.has(key)) continue

    seen.add(key)
    signals.push({
      index: signals.length + 1,
      topic: buildRequirementTopic(item.clause, signals.length + 1),
      clause: item.clause,
      checks: buildRequirementChecks(item.clause),
    })

    if (signals.length >= MAX_REQUIREMENT_SIGNALS) break
  }

  return signals
}

function scoreRequirementClause(clause) {
  const keywordGroups = [
    ["登入", "登出", "未登入", "session", "權限", "驗證", "身分"],
    ["新增", "查看", "修改", "刪除", "取消", "恢復", "完成", "回復"],
    ["提醒", "通知", "逾期", "關閉", "多次", "當日"],
    ["重複", "每日", "每週", "每月", "指定星期", "單次", "後續", "整組"],
    ["衝突", "重疊", "跨日", "保留"],
    ["分類", "顏色", "篩選"],
    ["不做", "不包含", "排除", "第一版", "邊界", "範圍"],
    ["敏感", "隱私", "外露", "個人", "隔離", "安全"],
    ["驗收", "通過", "不通過", "成功", "失敗", "例外"],
  ]

  let score = 0
  for (const group of keywordGroups) {
    const hits = group.filter((keyword) => clause.includes(keyword)).length
    if (hits > 0) score += 1 + hits
  }

  if (/需|要|可|不得|不應|必須|包含|支援/.test(clause)) score += 1
  if (/情境|邊界|例外|驗收/.test(clause)) score += 1

  return score
}

function buildRequirementTopic(clause, index) {
  const compact = clause
    .replace(/^(情境|邊界|例外|驗收|目標|需求|第一版)[:：]?/, "")
    .replace(/^(使用者|系統|本迭代|本次)/, "")
    .trim()
    .slice(0, 26)

  return compact ? `需求情境 ${index}：${compact}` : `需求情境 ${index}`
}

function buildRequirementChecks(clause) {
  const checks = [
    "此情境第一版必做、延後與不做邊界",
    "使用者操作、系統回饋與資料狀態變化",
    "成功條件、失敗條件與例外補救",
  ]

  if (/登入|登出|未登入|session|驗證|身分/.test(clause)) {
    checks.push("登入狀態來源、失效處理、登出後資料清除")
  }

  if (/權限|隱私|敏感|外露|隔離/.test(clause)) {
    checks.push("後端權限檢查、資料隔離與錯誤訊息揭露邊界")
  }

  if (/新增|查看|修改|刪除|取消|恢復|完成|回復/.test(clause)) {
    checks.push("CRUD 或狀態轉換的欄位、確認流程與可回復性")
  }

  if (/提醒|通知|逾期|關閉|多次|當日/.test(clause)) {
    checks.push("提醒觸發時間、關閉規則、失效風險與替代補救")
  }

  if (/重複|每日|每週|每月|指定星期|單次|後續|整組/.test(clause)) {
    checks.push("重複規則、例外切分、單次/後續/整組影響範圍")
  }

  if (/衝突|重疊|跨日|保留/.test(clause)) {
    checks.push("衝突判斷責任、跨日規則、保留衝突與 409/API 行為")
  }

  if (/分類|顏色|篩選/.test(clause)) {
    checks.push("分類資料模型、預設/自訂差異、顏色與篩選互動")
  }

  if (/日|週|月|清單|檢視|頁面|畫面/.test(clause)) {
    checks.push("頁面/檢視切換、空狀態、loading、error 與響應式行為")
  }

  return [...new Set(checks)]
}

function buildGranularQuestions(signal, analysis) {
  return buildQuestionAspects(signal, analysis).map((aspect) => {
    return buildDetailedQuestion(`${signal.topic} / ${aspect.topic}`, aspect.checks, signal.clause)
  })
}

function buildQuestionAspects(signal, analysis) {
  const clause = signal.clause
  const aspects = []
  const addAspect = (topic, checks) => {
    if (aspects.some((aspect) => aspect.topic === topic)) return
    aspects.push({ topic, checks })
  }

  if (/第一版|不做|不包含|排除|邊界|範圍|延後|限制/.test(clause)) {
    addAspect("版本邊界", [
      "哪些內容本版必做",
      "哪些內容只列為不做或後續",
      "需求衝突時以哪個描述為準",
    ])
  }

  if (/登入|登出|未登入|session|驗證|身分|狀態失效/.test(clause)) {
    addAspect("登入狀態", [
      "登入狀態來源與刷新時機",
      "未登入/失效/登出後各自的畫面與 API 行為",
      "登入成功後是否回原入口",
    ])
  }

  if (/權限|隱私|敏感|外露|隔離|個人/.test(clause)) {
    addAspect("資料隔離與揭露", [
      "後端如何強制 user scope",
      "錯誤訊息哪些資訊不可揭露",
      "log/通知/cache 是否需要遮罩或清除",
    ])
  }

  if (/新增|查看|修改|刪除|取消|恢復|完成|回復|建立|操作/.test(clause)) {
    addAspect("資料操作與狀態機", [
      "每個操作需要哪些欄位與權限",
      "狀態轉換是否可回復",
      "刪除或批次影響是否需要確認",
    ])
  }

  if (/提醒|通知|逾期|關閉|多次|當日|行程前/.test(clause)) {
    addAspect("提醒與逾期", [
      "提醒規則由哪一層保存與驗證",
      "權限拒絕/瀏覽器關閉/逾期時如何補救",
      "關閉提醒後哪些狀態仍需保留",
    ])
  }

  if (/重複|每日|每週|每月|指定星期|單次|後續|整組/.test(clause)) {
    addAspect("重複規則切分", [
      "規則欄位與結束條件",
      "單次/後續/整組修改的資料保存方式",
      "例外不應影響哪些既有 occurrence",
    ])
  }

  if (/衝突|重疊|跨日|保留/.test(clause)) {
    addAspect("衝突判斷", [
      "哪些事件類型會參與衝突",
      "跨日與全天規則如何判斷",
      "使用者確認保留後 API 與資料如何記錄",
    ])
  }

  if (/分類|顏色|篩選/.test(clause)) {
    addAspect("分類與篩選", [
      "預設分類與自訂分類的差異",
      "顏色欄位與排序/篩選規則",
      "刪除分類時既有事件如何處理",
    ])
  }

  if (/檢視|頁面|畫面|UI|UX|日週月|日\/週\/月|清單|手機|桌機/.test(clause)) {
    addAspect("畫面與回饋", [
      "需要哪些頁面或檢視切換",
      "loading/empty/error/無權限狀態如何呈現",
      "桌機與手機是否同一流程",
    ])
  }

  if (analysis.needBackend && /API|新增|查看|修改|刪除|登入|提醒|重複|衝突|分類|保存|資料/.test(clause)) {
    addAspect("API 與錯誤", [
      "endpoint 或 command 邊界",
      "request/response schema",
      "401/403/409/validation error 如何對應使用者訊息",
    ])
  }

  if (/驗收|通過|不通過|成功|失敗|例外|補救/.test(clause) || aspects.length < 2) {
    addAspect("驗收拆分", [
      "成功條件是否可被測試",
      "失敗條件與例外補救是否要獨立驗收",
      "哪些情境需要 API 測試或 E2E 測試",
    ])
  }

  if (aspects.length === 0) {
    addAspect("情境拆分", [
      "使用者觸發點",
      "系統回饋",
      "資料狀態變更",
      "成功/失敗驗收",
    ])
  }

  return aspects.slice(0, 4)
}

function buildAdaptiveTechnicalQuestions(analysis) {
  const signalText = getRequirementSignalText(analysis)
  const questions = []
  const pushIf = (condition, keywords, topic, checks) => {
    if (!condition || questions.length >= MAX_TECHNICAL_FOLLOW_UPS) return
    const evidence = pickEvidence(analysis.requirementSignals, keywords)
    const evidenceSuffix = evidence ? `（因需求提到「${evidence}」）` : ""
    questions.push(buildDetailedQuestion(`技術補問：${topic}${evidenceSuffix}`, checks))
  }

  pushIf(analysis.needFrontend && includesAny(signalText, ["頁面", "畫面", "檢視", "清單", "登入", "互動"]), ["頁面", "畫面", "檢視", "清單", "登入", "互動"], "前端路由與狀態", [
    "是否需要受保護路由",
    "哪些狀態需要全域保存或 API cache",
    "不同檢視是否共用同一資料來源",
  ])

  pushIf(analysis.needFrontend && includesAny(signalText, ["新增", "修改", "表單", "驗證", "刪除", "取消", "恢復"]), ["新增", "修改", "表單", "驗證", "刪除", "取消", "恢復"], "前端表單與互動防呆", [
    "表單欄位與必填規則",
    "送出中/重複提交/取消離開如何處理",
    "刪除與批次變更是否要二次確認",
  ])

  pushIf(analysis.needBackend && includesAny(signalText, ["新增", "查看", "修改", "刪除", "分類", "提醒", "重複", "衝突", "保存"]), ["新增", "查看", "修改", "刪除", "分類", "提醒", "重複", "衝突", "保存"], "API contract 與資料模型", [
    "資源與 endpoint 邊界",
    "核心 entity/欄位/關聯",
    "pagination/filter/sort 是否第一版需要",
  ])

  pushIf(analysis.needBackend && includesAny(signalText, ["登入", "登出", "未登入", "session", "權限", "驗證", "身分"]), ["登入", "登出", "未登入", "session", "權限", "驗證", "身分"], "session 與安全", [
    "cookie/token/session 策略",
    "CSRF/CORS/rate limit 邊界",
    "失敗訊息與帳號列舉防護",
  ])

  pushIf(analysis.needBackend && includesAny(signalText, ["重複", "衝突", "重疊", "跨日", "逾期", "時區"]), ["重複", "衝突", "重疊", "跨日", "逾期", "時區"], "核心計算責任", [
    "計算權威在前端、後端、worker 或資料庫哪一層",
    "時區與日期邊界",
    "並發修改與資料衝突處理",
  ])

  pushIf(includesAny(signalText, ["提醒", "通知", "逾期", "多次", "當日", "關閉"]), ["提醒", "通知", "逾期", "多次", "當日", "關閉"], "通知可靠性", [
    "是否需要 scheduler/worker/queue",
    "通知失敗或權限拒絕的使用者補救",
    "提醒關閉與偏好設定保存方式",
  ])

  pushIf(includesAny(signalText, ["驗收", "通過", "不通過", "成功", "失敗", "例外"]), ["驗收", "通過", "不通過", "成功", "失敗", "例外"], "測試切片", [
    "哪些情境用 API 測試",
    "哪些情境用 E2E",
    "高風險計算是否需要單元測試",
  ])

  pushIf(analysis.missingDetails.includes("部署/執行環境") || includesAny(signalText, ["Docker", "部署", "環境", "本機", "CI"]), ["Docker", "部署", "環境", "本機", "CI"], "執行環境", [
    "本機或容器化啟動方式",
    "環境變數與 secret 管理",
    "migration 與測試資料如何執行",
  ])

  if (questions.length === 0 && (analysis.needFrontend || analysis.needBackend)) {
    questions.push(buildDetailedQuestion("技術補問：最小落地方式", [
      "是否要建立 frontend/backend 專案",
      "是否沿用既有 README 或 package 線索",
      "本輪只產規劃檔或也要開始實作",
    ]))
  }

  return questions
}

function getRequirementSignalText(analysis) {
  const signalText = analysis.requirementSignals.map((signal) => signal.clause).join("\n")
  return signalText || `${analysis.preferenceText}\n${analysis.modelRecommendationNeeds}`
}

function pickEvidence(signals, keywords) {
  const match = signals.find((signal) => keywords.some((keyword) => signal.clause.includes(keyword)))
  return match ? truncateText(match.clause, 30) : ""
}

function buildQuestions(analysis) {
  const questions = []

  if (analysis.requirementSignals.length > 0) {
    questions.push(
      "- 提問策略：先依需求原文中的具體情境產生提問素材；同一情境若同時牽涉畫面、API、資料、權限、狀態或驗收，可自由拆成小題、合併成決策題或延後追問，不再逐題套固定技術清單。"
    )

    for (const signal of analysis.requirementSignals) {
      for (const question of buildGranularQuestions(signal, analysis)) {
        if (questions.length >= MAX_GRANULAR_QUESTIONS + 1) break
        questions.push(question)
      }

      if (questions.length >= MAX_GRANULAR_QUESTIONS + 1) break
    }
  } else {
    questions.push(buildDetailedQuestion("原始需求與產檔範圍", [
      "引用檔案或使用者原文是否完整保留",
      "需求摘要是否需要條目化",
      "產出檔案數量與位置",
      "哪些內容需標示待確認而不是推測",
    ]))
    questions.push(buildDetailedQuestion("MVP 與不做範圍", [
      "第一版必做功能",
      "延後功能",
      "明確不做事項",
      "每項功能的驗收條件",
    ]))
  }

  const technicalQuestions = buildAdaptiveTechnicalQuestions(analysis)
  if (technicalQuestions.length > 0) {
    questions.push(
      "- 技術補問策略：以下只補需求未交代但會影響落地的缺口；已有明確偏好或可由模型低風險決定時，可跳過、合併或改寫成更貼近需求的選項。"
    )
    questions.push(...technicalQuestions)
  }

  if (!analysis.needFrontend && !analysis.needBackend) {
    questions.push(buildDetailedQuestion("落地範圍確認", [
      "此需求是否只是整理/討論/文件",
      "是否要落地為可執行功能",
      "若要落地需 frontend、backend 或兩者",
      "不建立專案時本次輸出內容為何",
    ]))
  }

  return questions
}
