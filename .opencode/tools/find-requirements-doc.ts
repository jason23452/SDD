import { tool } from "@opencode-ai/plugin"
import { readFile } from "node:fs/promises"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import {
  DEFAULT_REQUIREMENTS_DIR,
  REQUIREMENT_HISTORY_SUFFIX,
  REQUIREMENT_REPO_MAP_FILE,
  listRequirementDocs,
  normalizeLimit,
  normalizeText,
  readRequirementRepoMap,
  resolveRequirementsDir,
} from "../lib/requirement-docs"
import type { RequirementDoc, RequirementRepoMapEntry } from "../lib/requirement-docs"

const execFileAsync = promisify(execFile)

type ScoredDoc = RequirementDoc & {
  score: number
  matchedTerms: string[]
  matchedAreas: string[]
  source?: string
  confidence?: string
}

const STOP_TERMS = new Set([
  "需求",
  "功能",
  "新增",
  "修改",
  "調整",
  "優化",
  "原有",
  "基礎",
  "可以",
  "需要",
  "幫我",
  "這個",
  "一個",
  "後續",
])

const SEARCH_AREAS = [
  { name: "摘要", heading: /大需求|摘要|子需求/, weight: 5 },
  { name: "故事", heading: /使用者故事|情境|流程/, weight: 4 },
  { name: "驗收", heading: /驗收|交付|限制|品質/, weight: 3 },
  { name: "範圍", heading: /範圍|邊界|依賴|關聯|版本|風險/, weight: 3 },
]

function unique(items: string[]): string[] {
  return [...new Set(items.filter((item) => item.length > 0))]
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function extractTerms(query: string): string[] {
  const normalized = query.toLowerCase()
  const coarseTerms = normalized
    .split(/[\s,，。；;、:：/\\|()（）\[\]{}<>「」『』"'`]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && !STOP_TERMS.has(item))

  const compactQuery = normalized.replace(/\s+/g, "")
  const phraseTerms = compactQuery.length >= 2 && compactQuery.length <= 40 ? [compactQuery] : []
  const cjkTerms = Array.from(normalized.matchAll(/[\p{Script=Han}]{2,}/gu)).flatMap((match) => {
    const value = match[0]
    const terms = value.length <= 8 && !STOP_TERMS.has(value) ? [value] : []

    for (let size = 2; size <= 3; size += 1) {
      for (let index = 0; index <= value.length - size; index += 1) {
        const term = value.slice(index, index + size)
        if (!STOP_TERMS.has(term)) terms.push(term)
      }
    }

    return terms
  })

  return unique([...phraseTerms, ...coarseTerms, ...cjkTerms]).slice(0, 50)
}

function buildSearchRegex(query: string): string {
  const terms = extractTerms(query)
    .filter((term) => term.length >= 2)
    .sort((a, b) => b.length - a.length)
    .slice(0, 24)

  return terms.map(escapeRegex).join("|")
}

async function grepCandidateNames(outputDir: string, query: string): Promise<Set<string> | undefined> {
  const pattern = buildSearchRegex(query)
  if (pattern.length === 0) return new Set()

  try {
    const { stdout } = await execFileAsync("rg", [
      "--files-with-matches",
      "--ignore-case",
      "--glob",
      "*.md",
      "--glob",
      `!${REQUIREMENT_REPO_MAP_FILE}`,
      "--glob",
      `!*${REQUIREMENT_HISTORY_SUFFIX}`,
      "--regexp",
      pattern,
      outputDir,
    ])

    return new Set(
      stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((filePath) => filePath.split(/[\\/]/).pop() || ""),
    )
  } catch (error) {
    if ((error as { code?: number }).code === 1) return new Set()
    return undefined
  }
}

async function loadContent(docs: RequirementDoc[]): Promise<RequirementDoc[]> {
  return Promise.all(
    docs.map(async (doc) => ({
      ...doc,
      content: await readFile(doc.filePath, "utf-8"),
    })),
  )
}

function repoMapDoc(entry: RequirementRepoMapEntry): RequirementDoc {
  return {
    name: entry.fileName,
    filePath: "",
    size: 0,
    mtimeMs: Date.parse(entry.updatedAt) || 0,
    content: [
      `# ${entry.fileName}`,
      "## 摘要",
      entry.summary,
      "## 交付與限制",
      entry.scope,
      "## 關聯",
      entry.relation,
      "## 最新變更",
      entry.latestChange,
      "## 版本決策",
      entry.versionDecision,
      "## 來源與信心",
      `${entry.source} ${entry.confidence}`,
      "## 品質檢查",
      entry.quality,
      "## 關鍵字",
      entry.keywords,
    ].join("\n"),
  }
}

async function scoreRepoMapEntries(outputDir: string, query: string): Promise<Map<string, ScoredDoc>> {
  const entries = await readRequirementRepoMap(outputDir)
  const scoredEntries = entries
    .map((entry) => ({
      ...scoreDoc(repoMapDoc(entry), query),
      source: entry.source,
      confidence: entry.confidence,
    }))
    .filter((doc) => doc.score > 0)

  return new Map(scoredEntries.map((doc) => [doc.name, doc]))
}

function firstNonEmptyLine(content: string): string {
  const line = content
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.length > 0)

  return line || "需求分析文件"
}

function countMatches(content: string, term: string): number {
  return content.split(term).length - 1
}

function sectionText(content: string, heading: RegExp): string {
  const lines = content.split(/\r?\n/)
  const matched: string[] = []
  let active = false

  for (const line of lines) {
    if (/^#{1,3}\s/.test(line)) active = heading.test(line)
    if (active) matched.push(line)
  }

  return matched.join("\n").toLowerCase()
}

function scoreDoc(doc: RequirementDoc, query: string): ScoredDoc {
  const terms = extractTerms(query)
  const content = doc.content || ""
  const lowerContent = content.toLowerCase()
  const lowerTitle = firstNonEmptyLine(content).toLowerCase()
  const lowerName = doc.name.toLowerCase()
  const matchedTerms = new Set<string>()
  const matchedAreas = new Set<string>()
  let score = 0

  for (const term of terms) {
    if (lowerTitle.includes(term)) {
      score += 10
      matchedTerms.add(term)
      matchedAreas.add("標題")
    }

    if (lowerName.includes(term)) {
      score += 4
      matchedTerms.add(term)
      matchedAreas.add("檔名")
    }

    const count = countMatches(lowerContent, term)
    if (count > 0) {
      score += Math.min(count, 4)
      matchedTerms.add(term)
    }

    for (const area of SEARCH_AREAS) {
      const areaCount = countMatches(sectionText(content, area.heading), term)
      if (areaCount === 0) continue
      score += Math.min(areaCount * area.weight, area.weight * 3)
      matchedTerms.add(term)
      matchedAreas.add(area.name)
    }
  }

  return {
    ...doc,
    score,
    matchedTerms: [...matchedTerms].slice(0, 5),
    matchedAreas: [...matchedAreas].slice(0, 4),
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
    "流程指示：視為全新需求，直接進入 requirements-clarify 的全新需求澄清；不要停在候選確認或輸出下一步選單。",
  ].join("\n")
}

function formatMatches(outputDir: string, query: string, docs: ScoredDoc[], scanned: number): string {
  const topScore = docs[0]?.score || 0
  const secondScore = docs[1]?.score || 0
  const ambiguous = docs.length > 1 && secondScore >= topScore * 0.8
  const lines = [
    "需求文件名稱搜尋結果",
    `- 搜尋目錄：${outputDir}`,
    `- 查詢內容：${query}`,
    `- 找到文件數：${docs.length}/${scanned}`,
    `- 候選判斷：${ambiguous ? "不明確，請讓使用者選擇候選檔" : "明確"}`,
    "",
  ]

  docs.forEach((doc) => {
    const reason = [
      doc.matchedAreas.length > 0 ? `區塊:${doc.matchedAreas.join("/")}` : "",
      doc.matchedTerms.length > 0 ? `詞:${doc.matchedTerms.join("/")}` : "",
      doc.source ? `source:${doc.source}` : "",
      doc.confidence ? `confidence:${doc.confidence}` : "",
      doc.confidence?.includes("rule_low") ? "需人工確認" : "",
    ]
      .filter(Boolean)
      .join("；")

    lines.push(`- ${doc.name}${reason ? `（${reason}）` : ""}`)
  })

  lines.push("")
  if (ambiguous) {
    lines.push("流程指示：候選不明確，先用 question 讓使用者選定候選或全新需求；選定後仍必須立刻進入 requirements-clarify，不可停在候選清單。")
  } else {
    lines.push("流程指示：第一候選為明確相關檔案，讀取第一候選的必要片段後必須立刻進入 requirements-clarify；不可把候選結果當作最終回應。")
  }

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

    const docs = await listRequirementDocs(resolvedDir)

    if (query.length === 0) {
      return formatLatestList(displayDir, docs, limit)
    }

    if (docs.length === 0) {
      return formatNoMatches(displayDir, query, 0)
    }

    const [mapScores, grepNames] = await Promise.all([
      scoreRepoMapEntries(resolvedDir, query),
      grepCandidateNames(resolvedDir, query),
    ])
    const candidateNames = new Set([
      ...mapScores.keys(),
      ...(grepNames ? [...grepNames] : []),
    ])
    const candidateDocs = candidateNames.size > 0
      ? docs.filter((doc) => candidateNames.has(doc.name))
      : grepNames
        ? []
        : docs

    if (candidateDocs.length === 0) {
      return formatNoMatches(displayDir, query, docs.length)
    }

    const docsWithContent = await loadContent(candidateDocs)
    const scored = docsWithContent
      .map((doc) => {
        const scoredDoc = scoreDoc(doc, query)
        const mapScore = mapScores.get(doc.name)
        if (!mapScore) return scoredDoc

        return {
          ...scoredDoc,
          score: scoredDoc.score + mapScore.score + 8,
          matchedTerms: [...new Set([...mapScore.matchedTerms, ...scoredDoc.matchedTerms])].slice(0, 5),
          matchedAreas: [...new Set(["RepoMap", ...mapScore.matchedAreas, ...scoredDoc.matchedAreas])].slice(0, 4),
          source: mapScore.source,
          confidence: mapScore.confidence,
        }
      })
      .filter((doc) => doc.score > 0)
      .sort((a, b) => b.score - a.score || b.mtimeMs - a.mtimeMs)
      .slice(0, limit)

    if (scored.length === 0) {
      return formatNoMatches(displayDir, query, docs.length)
    }

    return formatMatches(displayDir, query, scored, docs.length)
  },
})
