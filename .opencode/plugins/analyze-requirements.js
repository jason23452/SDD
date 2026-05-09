import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { tool } from "@opencode-ai/plugin"

const MAX_REQUIREMENT_CHARS = 20000
const MAX_REQUIREMENT_SIGNALS = 6
const MAX_GRANULAR_QUESTIONS = 10
const MAX_TECHNICAL_FOLLOW_UPS = 4

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
          "整理需求、偏好與專案線索；不定案技術選型。",
        args: {
          requirement: tool.schema
            .string()
            .optional()
            .describe("需求文字。"),
          requirement_file: tool.schema
            .string()
            .optional()
            .describe("workspace 內需求檔路徑。"),
          preferences: tool.schema
            .string()
            .optional()
            .describe("已指定偏好/限制。"),
          decision_mode: tool.schema
            .string()
            .optional()
            .describe("user_provided/recommend_best/mixed。"),
          user_packages: tool.schema
            .string()
            .optional()
            .describe("指定採用/排除套件。"),
          model_recommendation_needs: tool.schema
            .string()
            .optional()
            .describe("需模型推薦的決策項。"),
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

  for (const depName of depNames.slice(0, 12)) {
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

  const detailLines = buildDetailLines(analysis)

  const statusLines = [projectSignals.frontend, projectSignals.backend].map((area) => {
    if (!area.exists) return `- ${area.area}：不存在`

    const signals = area.signals.length > 0 ? area.signals.join("、") : "未從 README/package 偵測到明確技術棧"
    return `- ${area.area}：存在；${signals}`
  })

  const questionLines = buildQuestions(analysis)
  const preferenceLines = buildPreferenceLines(analysis)
  const packageDecisionLines = buildPackageDecisionLines(analysis)
  const sourceNote = requirementText
    ? `需求約 ${requirementText.length} 字`
    : "未提供需求；僅列專案線索"

  return [
    "# 需求分析",
    "",
    `- 來源：${sourceNote}`,
    `- 範圍：${projectType}；線索 frontend=${analysis.frontendScore} backend=${analysis.backendScore}`,
    "",
    "## 專案線索",
    ...statusLines,
    "",
    "## 細節缺口",
    ...detailLines,
    "",
    "## 偏好/套件",
    ...preferenceLines,
    ...packageDecisionLines,
    "",
    "## question 素材",
    ...buildQuestionFreedomLines(analysis),
    ...questionLines,
    "",
    "## 流程",
    "- 推薦先經 question；未確認只能列候選/待確認。",
    "- README 存在則沿用現有專案並交叉檢查實際檔案；不要空白重規劃。",
    "- 產檔前依序 technical-practice-classifier -> requirement-consistency-checker -> project-start-rules-definer；分類 ID 用 <run_id>-featurs-<name>。",
    "- project-start-rules-definer 只管長期規則與 .opencode/project-rules.md；skill 不可刪改，刪除要求回報 ERROR: skill rules are immutable and cannot be deleted。",
    "- 只有缺現行專案且使用者要求建立時才交 project-bootstrapper；現有專案直接改既有程式。",
  ].join("\n")
}

function buildDetailLines(analysis) {
  const topics = analysis.foundDetails.map(([topic]) => topic)
  const matches = [...new Set(analysis.foundDetails.flatMap(([, found]) => found))]

  return [
    `- 項目：${topics.join("、")}`,
    `- 線索：${matches.length > 0 ? matches.join("；") : "交由模型依需求判斷"}`,
  ]
}

function buildQuestionFreedomLines(analysis) {
  const scopeHint = analysis.needFrontend || analysis.needBackend
    ? "已判斷範圍：少問框架，多問 UI/API/資料/狀態/權限/測試/部署責任。"
    : "範圍未明：先問產出型態/是否實作。"

  return [
    "- 素材非固定問題庫；可拆、併、改、跳。",
    `- ${scopeHint}`,
    `- ${QUESTION_DESIGN_GUIDE}`,
    "- 原文已答者直接記已確認；每題只問會改變實作/驗收的決策。",
    "- 最後問執行方式：frontend、backend、frontend + backend、暫不初始化；有 README=沿用，無 README=最小啟動建立。",
  ]
}

function buildPreferenceLines(analysis) {
  const lines = [`- 決策模式：${analysis.decisionMode}`]

  if (!analysis.preferenceText) {
    return lines
  }

  lines.push(`- 原始偏好：${analysis.preferenceText}`)

  return lines
}

function buildPackageDecisionLines(analysis) {
  const lines = []

  if (analysis.userPackageText) {
    lines.push(`- 使用者指定套件：${analysis.userPackageText}`)
  }

  if (analysis.modelRecommendationNeeds) {
    lines.push(`- 交給大模型推薦：${analysis.modelRecommendationNeeds}`)
  }

  return lines
}

const QUESTION_DESIGN_GUIDE = "只問會改變實作/驗收的焦點；選項需說明 UI/API/資料/測試/風險影響。"

function buildDetailedQuestion(topic, checks, sourceClause = "") {
  const source = sourceClause ? `（源：「${truncateText(sourceClause, 24)}」）` : ""
  const focus = checks.slice(0, 3).join("、")
  const overflow = checks.length > 3 ? ` 等 ${checks.length} 項` : ""
  return `- ${topic}${source}：${focus}${overflow}`
}

function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text || ""
  return `${text.slice(0, maxLength - 1)}…`
}

const CLAUSE_FOCUS_STOP_WORDS = new Set([
  "需求",
  "功能",
  "系統",
  "使用者",
  "第一版",
  "本次",
  "需要",
  "必須",
  "不得",
  "不應",
  "可以",
  "包含",
  "支援",
])

function extractClauseFocusTerms(clause, limit = 6) {
  if (!clause) return []

  const normalized = clause
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*`|\-[\](){}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const candidates = normalized
    .split(/[\s、，,。；;：:／/]+/)
    .map((term) => term.replace(/^[「『（(]+|[」』）)]+$/g, "").trim())
    .filter((term) => term.length >= 2 && term.length <= 18)
    .filter((term) => !CLAUSE_FOCUS_STOP_WORDS.has(term))
    .filter((term) => !/^[0-9]+$/.test(term))

  const terms = [...new Set(candidates)]

  if (terms.length > 0) return terms.slice(0, limit)

  return normalized ? [truncateText(normalized, 18)] : []
}

function formatFocusLabel(clause) {
  const terms = extractClauseFocusTerms(clause, 3)
  if (terms.length === 0) return "此需求子句"

  return `「${terms.join("、")}」`
}

function getRequirementFocusTerms(analysis, limit = 6) {
  const terms = analysis.requirementSignals.flatMap((signal) => extractClauseFocusTerms(signal.clause, 3))
  return [...new Set(terms)].slice(0, limit)
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
  let score = 0

  if (/需|要|可|應|須|必須|不得|不應|不可|包含|支援|允許|禁止|限制/.test(clause)) score += 2
  if (/第一版|MVP|不做|不包含|排除|延後|範圍|邊界|限制|優先|後續/.test(clause)) score += 2
  if (/成功|失敗|例外|驗收|錯誤|風險|補救|通過|不通過/.test(clause)) score += 2
  if (/流程|操作|狀態|資料|畫面|頁面|API|服務|權限|輸入|輸出/.test(clause)) score += 1
  if (clause.length >= 20) score += 1

  score += Math.min(extractClauseFocusTerms(clause, 6).length, 3)

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
  const focusLabel = formatFocusLabel(clause)

  return [
    `${focusLabel} 必做/延後/不做`,
    `${focusLabel} 觸發者/時機/輸入輸出/狀態`,
    `${focusLabel} 成功/失敗/例外/驗收`,
  ]
}

function buildGranularQuestions(signal, analysis) {
  return buildQuestionAspects(signal, analysis).map((aspect) => {
    return buildDetailedQuestion(`${signal.topic} / ${aspect.topic}`, aspect.checks, signal.clause)
  })
}

function buildQuestionAspects(signal, analysis) {
  const focusLabel = formatFocusLabel(signal.clause)
  const aspects = []
  const addAspect = (topic, checks) => {
    if (aspects.some((aspect) => aspect.topic === topic)) return
    aspects.push({ topic, checks })
  }

  addAspect("範圍與驗收", [
    `${focusLabel} 必做/延後/不做`,
    `${focusLabel} 成功/失敗/可測驗收`,
    "需求子句衝突時的優先來源",
  ])

  addAspect("流程與資料變化", [
    `${focusLabel} 觸發者/前置/結束狀態`,
    `${focusLabel} 新增/讀取/修改/移除資料`,
    `${focusLabel} 失敗/取消時資料一致性`,
  ])

  if (analysis.needFrontend) {
    addAspect("前端呈現與互動", [
      `${focusLabel} 頁面/狀態/提示/互動`,
      `${focusLabel} loading/empty/error/無權限呈現`,
      "桌機/手機流程與驗收是否一致",
    ])
  }

  if (analysis.needBackend) {
    addAspect("後端契約與資料", [
      `${focusLabel} API/command/資料邊界`,
      `${focusLabel} request/response/驗證錯誤/權限錯誤`,
      `${focusLabel} 持久化/查詢/並發/一致性責任`,
    ])
  }

  if (analysis.needFrontend && analysis.needBackend) {
    addAspect("前後端責任分界", [
      `${focusLabel} 前端即時判斷 vs 後端權威`,
      "API 錯誤到畫面訊息",
      "前端暫存與後端狀態不一致恢復",
    ])
  }

  return aspects.slice(0, 3)
}

function buildAdaptiveTechnicalQuestions(analysis) {
  const questions = []
  const focusTerms = getRequirementFocusTerms(analysis, 5)
  const focusSuffix = focusTerms.length > 0 ? `；需求焦點：${focusTerms.join("、")}` : ""
  const scope = analysis.needFrontend && analysis.needBackend
    ? "frontend + backend"
    : analysis.needFrontend
      ? "frontend"
      : analysis.needBackend
        ? "backend"
        : "尚未判斷"
  const pushQuestion = (topic, checks) => {
    if (questions.length >= MAX_TECHNICAL_FOLLOW_UPS) return
    questions.push(buildDetailedQuestion(`技術補問：${topic}${focusSuffix}`, checks))
  }

  if (!analysis.needFrontend && !analysis.needBackend) return questions

  pushQuestion("落地責任分界", [
    `${scope} 的 UI/API/資料/背景工作/第三方責任`,
    "安全/一致性/驗收的權威來源",
    "模型可建議項 vs 必問項",
  ])

  if (analysis.needFrontend) {
    pushQuestion("前端互動與狀態", [
      "畫面/輸入/提示/loading/empty/error 對驗收影響",
      "前端暫存 vs 後端/持久化同步",
      "裝置/入口流程差異",
    ])
  }

  if (analysis.needBackend) {
    pushQuestion("後端契約與資料", [
      "資料/API/驗證/權限/一致性對 MVP 影響",
      "request/response/錯誤格式/狀態碼",
      "migration/seed/備份/清理是否納入",
    ])
  }

  if (analysis.needFrontend && analysis.needBackend) {
    pushQuestion("整合與失敗恢復", [
      "資料不同步/請求失敗/權限失效恢復",
      "本機啟動前後端與依賴",
      "API/整合/E2E 測試切分",
    ])
  }

  pushQuestion("執行、測試與風險", [
    "自動化測試 vs 人工驗收",
    "env/secret/外部服務/部署限制",
    "模型推薦套件/架構的取捨與替代",
  ])

  return questions
}

function buildQuestions(analysis) {
  const questions = []

  if (analysis.requirementSignals.length > 0) {
    questions.push(
      "- 策略：依需求子句出題材；可拆/併/延後。"
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
      "保留引用/原文",
      "需求摘要條目化",
      "產出檔案數量/位置",
      "待確認 vs 推測",
    ]))
    questions.push(buildDetailedQuestion("MVP 與不做範圍", [
      "必做",
      "延後",
      "不做",
      "驗收條件",
    ]))
  }

  const technicalQuestions = buildAdaptiveTechnicalQuestions(analysis)
  if (technicalQuestions.length > 0) {
    questions.push(
      "- 技術補問：只補落地缺口；明確/低風險項可跳。"
    )
    questions.push(...technicalQuestions)
  }

  if (analysis.needFrontend || analysis.needBackend) {
    const recommendedExecution = analysis.needFrontend && analysis.needBackend
      ? "frontend + backend（推薦）"
      : analysis.needFrontend
        ? "frontend（推薦）"
        : "backend（推薦）"
    questions.push(
      `- 最後 question：執行方式確認；第一推薦「${recommendedExecution}」。選項含 frontend/backend/frontend+backend/暫不初始化；README 存在=沿用，否則=最小啟動建立；bootstrapper 不實作需求功能。`
    )
  }

  if (!analysis.needFrontend && !analysis.needBackend) {
    questions.push(buildDetailedQuestion("落地範圍確認", [
      "整理/討論/文件或落地",
      "是否可執行功能",
      "frontend/backend/兩者",
      "不建專案時輸出",
    ]))
  }

  return questions
}
