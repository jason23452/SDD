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
  "實作語言",
  "前端框架",
  "後端框架",
  "資料庫",
  "登入驗證",
  "測試",
  "部署/執行環境",
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
    "輸出時請包含：推薦方案、選型理由、替代方案、取捨風險、官方文件 URL、需要再問使用者的關鍵問題。",
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

function buildQuestions(analysis) {
  const questions = []

  if (analysis.needFrontend) {
    questions.push("- 前端要採用哪個框架與語言？若沒有偏好，請交由大模型依需求推薦並說明取捨。")
    questions.push("- UI 是否有既有設計系統、元件庫、路由方式與狀態管理規範？")
  }

  if (analysis.needBackend) {
    questions.push("- 後端要採用哪個框架與語言？若沒有偏好，請交由大模型依需求推薦並說明取捨。")
    questions.push("- 資料要存在哪裡，是否需要資料庫、快取或 ORM？若沒有偏好，請交由大模型推薦。")
    questions.push("- 登入驗證、授權與權限邊界如何定義？若沒有偏好，請交由大模型推薦安全方案。")
  }

  if (analysis.missingDetails.includes("測試")) {
    questions.push("- 驗收與測試範圍為何？請由大模型依需求推薦適合的測試分層與工具。")
  }

  if (analysis.missingDetails.includes("部署/執行環境")) {
    questions.push("- 目標執行與部署環境是本機、容器化、平台服務、雲端 VM，或其他平台？")
  }

  if (questions.length === 0) {
    questions.push("- 需求已包含主要技術線索，下一步可確認版本、資料模型與驗收測試細節。")
  }

  return questions
}
