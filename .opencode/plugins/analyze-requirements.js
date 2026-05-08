import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { tool } from "@opencode-ai/plugin"

const MAX_REQUIREMENT_CHARS = 20000

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
  const foundDetails = DETAIL_TOPICS.map((topic) => [topic, detailContext])
  const missingDetails = detailContext.length === 0 ? [...DETAIL_TOPICS] : []
  const needFrontend = frontendScore > 0
  const needBackend = backendScore > 0
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
    "## 建議優先釐清問題",
    ...questionLines,
    "",
    "## 產檔整理提醒",
    "- 後續需求開發實踐檔應把原始需求整理、引用來源、使用者已確認技術決策與開發實踐建議放在同一份文件中。",
    "- 不要把未經 question 確認的推薦方案寫成已採用；未確認項目只能列為待確認或候選方案。",
  ].join("\n")
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
    "請由大模型根據需求內容、目前專案線索與使用者偏好，自動產生技術架構建議；工具不得提供固定預設技術棧。",
    `建議專案範圍：${scope}`,
    `已知/待釐清技術線索：${foundDetails}`,
    `目前專案線索：${projectSignals}`,
    `使用者偏好：${analysis.preferenceText || "未提供"}`,
    `使用者指定套件：${analysis.userPackageText || "未提供"}`,
    `使用者希望模型推薦項目：${analysis.modelRecommendationNeeds || "未指定，請至少評估語言、前端、後端、資料庫、登入、安全、測試、部署與替代方案"}`,
    `決策模式：${analysis.decisionMode}`,
    "輸出時請包含：推薦方案、選型理由、替代方案、取捨風險、官方文件 URL、需要再問使用者的關鍵問題；關鍵問題必須細到可直接轉成 question 工具選項，不能只問框架、資料庫或是否登入。",
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

const QUESTION_OPTION_REQUIREMENT = "選項需提供推薦方案、替代方案、延後/待確認；description 需說明採用內容、適用情境、主要取捨、影響範圍與不選風險"

function buildDetailedQuestion(topic, checks) {
  return `- ${topic}：請確認${checks.join("、")}；${QUESTION_OPTION_REQUIREMENT}。`
}

function buildQuestions(analysis) {
  const questions = [
    buildDetailedQuestion("原始需求與產檔範圍", [
      "引用檔案或使用者原文是否完整保留",
      "需求摘要是否需要條目化",
      "產出檔是否只建立一份並同時包含原始需求整理與開發實踐內容",
      "哪些原文可摘錄、哪些內容需標示截斷",
    ]),
    buildDetailedQuestion("MVP 與不做範圍", [
      "第一版必做功能",
      "延後功能",
      "明確不做事項",
      "每項功能的驗收條件",
      "需求若超出 MVP 時的處理方式",
    ]),
  ]

  if (analysis.needFrontend) {
    questions.push(buildDetailedQuestion("前端框架/語言/建置", [
      "是否沿用既有 README 技術棧",
      "SPA/SSR/SSG 或純前端模式",
      "TypeScript/JavaScript",
      "建置工具與 package manager",
      "版本限制與瀏覽器支援範圍",
    ]))
    questions.push(buildDetailedQuestion("前端頁面/路由/版面", [
      "第一版頁面清單",
      "路由層級與保護頁面",
      "layout/nav/sidebar/header/footer 是否需要",
      "桌機與手機斷點",
      "空狀態、loading、error、無權限狀態",
    ]))
    questions.push(buildDetailedQuestion("前端互動/表單/驗證", [
      "表單欄位與必填規則",
      "同步/非同步驗證",
      "送出後成功與失敗回饋",
      "重複提交防護",
      "草稿、重設、取消與離開頁面提醒",
    ]))
    questions.push(buildDetailedQuestion("前端套件選型", [
      "UI 元件庫",
      "樣式方案",
      "路由",
      "狀態管理/API 快取",
      "表單驗證",
      "日期時間",
      "圖表/日曆/地圖/編輯器等需求套件",
      "測試與 lint/format 工具",
    ]))
    questions.push(buildDetailedQuestion("前端資料流與使用者狀態", [
      "API 資料來源",
      "快取失效策略",
      "樂觀更新是否需要",
      "重試與取消請求",
      "登入狀態同步",
      "權限不足時 UI 行為",
    ]))
  }

  if (analysis.needBackend) {
    questions.push(buildDetailedQuestion("後端框架/語言/API 型式", [
      "是否沿用既有 README 技術棧",
      "REST/RPC/GraphQL 或其他 API 型式",
      "專案目錄慣例",
      "設定載入方式",
      "本機啟動與測試指令",
      "版本與 runtime 限制",
    ]))
    questions.push(buildDetailedQuestion("API contract 與錯誤格式", [
      "endpoint 清單",
      "request/response schema",
      "狀態碼",
      "驗證失敗格式",
      "業務錯誤代碼",
      "pagination/filter/sort",
      "API 版本策略",
    ]))
    questions.push(buildDetailedQuestion("資料庫/ORM/資料生命週期", [
      "資料庫種類",
      "ORM/query builder",
      "migration",
      "seed",
      "索引與查詢模式",
      "交易一致性",
      "備份、清除與資料保留策略",
    ]))
    questions.push(buildDetailedQuestion("資料模型與關聯", [
      "核心 entity",
      "欄位型別與 nullable 規則",
      "唯一性與外鍵",
      "狀態機",
      "軟刪除/硬刪除",
      "audit 欄位",
      "多租戶或使用者隔離需求",
    ]))
    questions.push(buildDetailedQuestion("登入驗證/授權/安全", [
      "session/token/cookie 策略",
      "密碼雜湊或第三方登入",
      "角色權限矩陣",
      "CSRF/CORS",
      "rate limit",
      "敏感資料遮罩",
      "隱私資料保存與刪除",
    ]))
    questions.push(buildDetailedQuestion("後端套件選型", [
      "API framework",
      "schema validation",
      "ORM/migration",
      "auth/session",
      "password hashing",
      "queue/scheduler",
      "logging",
      "testing",
      "lint/format",
    ]))
  }

  if (analysis.needFrontend && analysis.needBackend) {
    questions.push(buildDetailedQuestion("前後端整合責任", [
      "API contract 由哪一端維護",
      "型別/schema 是否共享或生成",
      "跨端錯誤訊息對應",
      "登入狀態同步",
      "CORS/cookie/domain 設定",
      "本機同時啟動流程",
      "前後端版本不一致時的處理方式",
    ]))
  }

  questions.push(buildDetailedQuestion("核心計算與資料一致性", [
    "計算責任在前端、後端、worker、資料庫或第三方服務哪一層",
    "即時計算或預先計算",
    "快取與失效",
    "並發與資料衝突",
    "時區/日期邊界",
    "計算錯誤時的回復方式",
  ]))
  questions.push(buildDetailedQuestion("失敗與例外情境", [
    "網路失敗",
    "權限不足",
    "資料不存在",
    "資料衝突",
    "重複提交",
    "第三方服務失敗",
    "使用者取消操作",
    "錯誤紀錄與使用者可見訊息",
  ]))
  questions.push(buildDetailedQuestion("背景工作/排程/通知", [
    "是否需要 queue/worker/scheduler",
    "觸發時機",
    "重試策略",
    "冪等性",
    "通知管道",
    "使用者可關閉或偏好設定",
  ]))
  questions.push(buildDetailedQuestion("第三方整合與檔案處理", [
    "是否需要外部 API",
    "憑證/secret 管理",
    "webhook",
    "檔案大小與類型限制",
    "儲存位置",
    "掃毒/安全檢查",
    "失敗補償流程",
  ]))
  questions.push(buildDetailedQuestion("可觀測性與營運", [
    "log 欄位",
    "audit trail",
    "錯誤追蹤",
    "指標/健康檢查",
    "管理者排查資訊",
    "個資是否需要遮罩",
  ]))

  if (analysis.missingDetails.includes("測試")) {
    questions.push(buildDetailedQuestion("驗收與測試範圍", [
      "需求情境與通過條件",
      "單元測試",
      "整合測試",
      "E2E",
      "API contract",
      "權限測試",
      "核心計算測試",
      "測試資料與 mock 策略",
    ]))
  }

  if (analysis.missingDetails.includes("部署/執行環境")) {
    questions.push(buildDetailedQuestion("部署/環境/CI", [
      "本機或容器化",
      "平台服務或雲端 VM",
      "環境變數與 secret",
      "資料庫連線",
      "migration 執行時機",
      "CI/CD",
      "rollback 與版本發布方式",
    ]))
  }

  if (!analysis.needFrontend && !analysis.needBackend) {
    questions.push(buildDetailedQuestion("是否需要建立或使用 frontend/backend 專案", [
      "此需求是否只是整理/討論/文件",
      "是否要落地為可執行功能",
      "若要落地需 frontend、backend 或兩者",
      "不建立專案時本次輸出內容為何",
    ]))
  }

  return questions
}
