import { tool } from "@opencode-ai/plugin"
import {
  DEFAULT_REQUIREMENTS_DIR,
  listRequirementDocs,
  normalizeText,
  resolveRequirementsDir,
  writeRequirementRepoMap,
} from "./requirement-docs"
import type { RequirementDoc, RequirementRepoMapEntry } from "./requirement-docs"

function cleanMarkdown(value: string): string {
  return normalizeText(value)
    .replace(/[*_`#>\-]/g, "")
    .replace(/\s+/g, " ")
}

function compact(value: string, fallback = "待補", maxLength = 180): string {
  const normalized = cleanMarkdown(value)
  if (normalized.length === 0) return fallback
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1)}…`
}

function firstMatch(content: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match?.[1]) return match[1]
  }

  return ""
}

function deriveKeywords(value: string): string {
  const words = cleanMarkdown(value)
    .split(/[\s,，。；;、:：/\\|()（）\[\]{}<>「」『』"'`]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item !== "待補")

  return [...new Set(words)].slice(0, 18).join("、") || "待補"
}

function buildEntry(doc: RequirementDoc): RequirementRepoMapEntry {
  const content = doc.content || ""
  const summary = firstMatch(content, [
    /一句話目標[：:]\*?\s*(.+)/,
    /大需求名稱[：:]\*?\s*(.+)/,
    /^#\s+(.+)$/m,
  ])
  const scope = firstMatch(content, [
    /影響範圍[：:]\*?\s*(.+)/,
    /交付邊界[：:]\*?\s*(.+)/,
    /constraints?[：:]\s*(.+)/i,
  ])
  const relation = firstMatch(content, [
    /關聯判斷[：:]\*?\s*(related|new|uncertain|相關|全新|不確定)/i,
  ]) || "unknown"
  const diffSummary = firstMatch(content, [
    /新舊差異[：:]\*?\s*(.+)/,
  ])
  const summaryText = compact([summary, diffSummary].filter(Boolean).join("；"), doc.name, 220)
  const scopeText = compact(scope, "待補", 160)

  return {
    fileName: doc.name,
    updatedAt: new Date(doc.mtimeMs).toISOString(),
    relation: compact(relation, "unknown", 80),
    summary: summaryText,
    scope: scopeText,
    keywords: compact(deriveKeywords(`${doc.name} ${summaryText} ${scopeText}`), "待補", 160),
  }
}

export default tool({
  description: "依既有需求 Markdown 重建 requirement-repo-map.md 摘要索引。",
  args: {
    outputDir: tool.schema
      .string()
      .describe("需求分析文件目錄，預設為 .opencode/outputs/analyze-requirements")
      .default(DEFAULT_REQUIREMENTS_DIR),
  },
  async execute(args, context) {
    const worktree = context?.worktree ? context.worktree : process.cwd()
    const resolvedDir = resolveRequirementsDir(worktree, args.outputDir)
    const displayDir = args.outputDir || DEFAULT_REQUIREMENTS_DIR
    const docs = await listRequirementDocs(resolvedDir, { readContent: true })
    const entries = docs.map(buildEntry)
    const repoMapPath = await writeRequirementRepoMap(resolvedDir, entries)

    return [
      "Repo Map 已重建",
      `- 來源目錄：${displayDir}`,
      `- 文件數：${docs.length}`,
      `- Repo Map：${repoMapPath}`,
    ].join("\n")
  },
})
