import { tool } from "@opencode-ai/plugin"
import {
  DEFAULT_REQUIREMENTS_DIR,
  listRequirementDocs,
  normalizeLimit,
  normalizeText,
  resolveRequirementsDir,
} from "./requirement-docs"
import type { RequirementDoc } from "./requirement-docs"

type ScoredDoc = RequirementDoc & {
  score: number
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter((item) => item.length > 0))]
}

function extractTerms(query: string): string[] {
  const normalized = query.toLowerCase()
  const coarseTerms = normalized
    .split(/[\s,，。；;、:：/\\|()（）\[\]{}<>「」『』"'`]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)

  const compactQuery = normalized.replace(/\s+/g, "")
  const phraseTerms = compactQuery.length >= 2 ? [compactQuery] : []

  return unique([...phraseTerms, ...coarseTerms])
}

function firstNonEmptyLine(content: string): string {
  const line = content
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.length > 0)

  return line || "需求分析文件"
}

function scoreDoc(doc: RequirementDoc, query: string): ScoredDoc {
  const terms = extractTerms(query)
  const content = doc.content || ""
  const lowerContent = content.toLowerCase()
  const lowerTitle = firstNonEmptyLine(content).toLowerCase()
  const lowerName = doc.name.toLowerCase()
  let score = 0

  for (const term of terms) {
    if (lowerTitle.includes(term)) {
      score += 10
    }

    if (lowerName.includes(term)) {
      score += 4
    }

    const count = lowerContent.split(term).length - 1
    if (count > 0) {
      score += Math.min(count, 8)
    }
  }

  return {
    ...doc,
    score,
  }
}

function formatLatestList(outputDir: string, docs: RequirementDoc[], limit: number): string {
  if (docs.length === 0) {
    return [
      "需求文件搜尋結果",
      `- 搜尋目錄：${outputDir}`,
      "- 查詢內容：(空)",
      "- 找到文件數：0/0",
      "目前沒有可搜尋的需求分析文件。",
    ].join("\n")
  }

  return [
    "最新需求文件名稱清單",
    `- 搜尋目錄：${outputDir}`,
    "- 查詢內容：(空)",
    `- 顯示文件數：${Math.min(limit, docs.length)}/${docs.length}`,
    "",
    ...docs.slice(0, limit).map((doc) => `- ${doc.name}`),
  ].join("\n")
}

function formatNoMatches(outputDir: string, query: string, scanned: number): string {
  return [
    "需求文件搜尋結果",
    `- 搜尋目錄：${outputDir}`,
    `- 查詢內容：${query}`,
    `- 找到文件數：0/${scanned}`,
    "目前沒有找到明確相關的需求分析文件。",
  ].join("\n")
}

function formatMatches(outputDir: string, query: string, docs: ScoredDoc[], scanned: number): string {
  const lines = [
    "需求文件名稱搜尋結果",
    `- 搜尋目錄：${outputDir}`,
    `- 查詢內容：${query}`,
    `- 找到文件數：${docs.length}/${scanned}`,
    "",
  ]

  docs.forEach((doc) => {
    lines.push(`- ${doc.name}`)
  })

  return lines.join("\n").trimEnd()
}

export default tool({
  description:
    "在 .opencode/outputs/analyze-requirements 中依需求描述查找最相關的需求分析 Markdown 檔案名稱。",
  args: {
    query: tool.schema.string().describe("需求描述、關鍵字、功能名稱或問題情境").default(""),
    outputDir: tool.schema
      .string()
      .describe("需求分析文件目錄，預設為 .opencode/outputs/analyze-requirements")
      .default(DEFAULT_REQUIREMENTS_DIR),
    limit: tool.schema.number().describe("最多回傳幾份文件，預設 3，最大 20").default(3),
  },
  async execute(args, context) {
    const worktree = context?.worktree ? context.worktree : process.cwd()
    const resolvedDir = resolveRequirementsDir(worktree, args.outputDir)
    const displayDir = args.outputDir || DEFAULT_REQUIREMENTS_DIR
    const query = normalizeText(args.query)
    const limit = normalizeLimit(args.limit, 3)

    const docs = await listRequirementDocs(resolvedDir, { readContent: query.length > 0 })

    if (query.length === 0) {
      return formatLatestList(displayDir, docs, limit)
    }

    if (docs.length === 0) {
      return formatNoMatches(displayDir, query, 0)
    }

    const scored = docs
      .map((doc) => scoreDoc(doc, query))
      .filter((doc) => doc.score > 0)
      .sort((a, b) => b.score - a.score || b.mtimeMs - a.mtimeMs)
      .slice(0, limit)

    if (scored.length === 0) {
      return formatNoMatches(displayDir, query, docs.length)
    }

    return formatMatches(displayDir, query, scored, docs.length)
  },
})
