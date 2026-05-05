import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { tool } from "@opencode-ai/plugin"

type MatchMode = "keyword" | "semantic" | "hybrid"

type RequirementDoc = {
  name: string
  filePath: string
  content: string
  size: number
  mtimeMs: number
}

type ScoredDoc = RequirementDoc & {
  score: number
}

function normalizeText(value?: string): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeLimit(value: number): number {
  if (!Number.isFinite(value)) return 5
  return Math.max(1, Math.min(Math.floor(value), 20))
}

function normalizeMatchMode(value?: string): MatchMode {
  if (value === "keyword" || value === "semantic" || value === "hybrid") {
    return value
  }

  return "hybrid"
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

function sectionScore(content: string, terms: string[], heading: RegExp, weight: number): number {
  const lines = content.split(/\r?\n/)
  let active = false
  let score = 0

  for (const line of lines) {
    if (/^#{1,3}\s/.test(line)) {
      active = heading.test(line)
    }

    if (!active) continue


    const lowerLine = line.toLowerCase()
    for (const term of terms) {
      if (lowerLine.includes(term)) {
        score += weight
      }
    }
  }

  return score
}

function scoreDoc(doc: RequirementDoc, query: string, matchMode: MatchMode): ScoredDoc {
  const terms = extractTerms(query)
  const lowerContent = doc.content.toLowerCase()
  const lowerTitle = firstNonEmptyLine(doc.content).toLowerCase()
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

  if (matchMode === "semantic" || matchMode === "hybrid") {
    score += sectionScore(doc.content, terms, /大需求|子需求|使用者故事|驗收條件/, 4)
    score += sectionScore(doc.content, terms, /FE|BE|Test|分工|交付/, 3)
    score += sectionScore(doc.content, terms, /非功能|限制|風險|邊緣|情境/, 2)
  }

  return {
    ...doc,
    score,
  }
}

async function listMarkdownFiles(outputDir: string): Promise<RequirementDoc[]> {
  try {
    const entries = await readdir(outputDir, { withFileTypes: true })
    const docs = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
        .map(async (entry) => {
          const filePath = path.join(outputDir, entry.name)
          const [content, fileStat] = await Promise.all([readFile(filePath, "utf-8"), stat(filePath)])
          return {
            name: entry.name,
            filePath,
            content,
            size: fileStat.size,
            mtimeMs: fileStat.mtimeMs,
          }
        }),
    )

    return docs.sort((a, b) => b.mtimeMs - a.mtimeMs)
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return []
    }

    throw error
  }
}

function formatLatestList(outputDir: string, docs: RequirementDoc[], limit: number): string {
  if (docs.length === 0) {
    return [
      "## 需求文件搜尋結果",
      "",
      `- 搜尋目錄：${outputDir}`,
      "- 查詢內容：(空)",
      "- 找到文件數：0/0",
      "",
      "目前沒有可搜尋的需求分析文件。",
    ].join("\n")
  }

  return [
    "## 最新需求文件名稱清單",
    "",
    `- 搜尋目錄：${outputDir}`,
    "- 查詢內容：(空)",
    `- 顯示文件數：${Math.min(limit, docs.length)}/${docs.length}`,
    "",
    "請補充 `query` 後可依需求內容排序相關文件。",
    "",
    ...docs.slice(0, limit).map((doc) => `- ${doc.name}`),
  ].join("\n")
}

function formatNoMatches(outputDir: string, query: string, scanned: number): string {
  return [
    "## 需求文件搜尋結果",
    "",
    `- 搜尋目錄：${outputDir}`,
    `- 查詢內容：${query}`,
    `- 找到文件數：0/${scanned}`,
    "",
    "目前沒有找到明確相關的需求分析文件。",
    "",
    "建議：",
    "- 使用更明確的功能名稱或使用者情境重新搜尋。",
    "- 若這是新需求，請改用 `analyze-requirements` 或 `requirements-clarify` 建立新的需求分析文件。",
  ].join("\n")
}

function formatMatches(outputDir: string, query: string, docs: ScoredDoc[], scanned: number): string {
  const lines = [
    "## 需求文件名稱搜尋結果",
    "",
    `- 搜尋目錄：${outputDir}`,
    `- 查詢內容：${query}`,
    `- 找到文件數：${docs.length}/${scanned}`,
    "",
    "### 相關檔案名稱",
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
      .default(path.posix.join(".opencode", "outputs", "analyze-requirements")),
    limit: tool.schema.number().describe("最多回傳幾份文件，預設 5，最大 20").default(5),
    matchMode: tool.schema.string().describe("比對模式：keyword、semantic 或 hybrid").default("hybrid"),
  },
  async execute(args, context) {
    const worktree = context?.worktree ? context.worktree : process.cwd()
    const safeOutputDir = normalizeText(args.outputDir) || path.posix.join(".opencode", "outputs", "analyze-requirements")
    const resolvedDir = path.resolve(worktree, safeOutputDir)
    const query = normalizeText(args.query)
    const limit = normalizeLimit(args.limit)
    const matchMode = normalizeMatchMode(args.matchMode)

    const docs = await listMarkdownFiles(resolvedDir)

    if (query.length === 0) {
      return formatLatestList(resolvedDir, docs, limit)
    }

    if (docs.length === 0) {
      return formatNoMatches(resolvedDir, query, 0)
    }

    const scored = docs
      .map((doc) => scoreDoc(doc, query, matchMode))
      .filter((doc) => doc.score > 0)
      .sort((a, b) => b.score - a.score || b.mtimeMs - a.mtimeMs)
      .slice(0, limit)

    if (scored.length === 0) {
      return formatNoMatches(resolvedDir, query, docs.length)
    }

    return formatMatches(resolvedDir, query, scored, docs.length)
  },
})
