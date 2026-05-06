import { tool } from "@opencode-ai/plugin"
import {
  DEFAULT_REQUIREMENTS_DIR,
  listRequirementDocs,
  normalizeText,
  resolveRequirementsDir,
  writeRequirementRepoMap,
} from "../lib/requirement-docs"
import type { RequirementDoc, RequirementRepoMapEntry } from "../lib/requirement-docs"

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

function lastMatch(content: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`
    const matches = [...content.matchAll(new RegExp(pattern.source, flags))]
    const match = matches.at(-1)
    if (match?.[1]) return match[1]
  }

  return ""
}

function markdownField(label: string): RegExp {
  return new RegExp(`${label}[：:]\\*\\*\\s*(.+)`, "i")
}

function deriveKeywords(value: string): string {
  const words = cleanMarkdown(value)
    .split(/[\s,，。；;、:：/\\|()（）\[\]{}<>「」『』"'`]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item !== "待補")

  return [...new Set(words)].slice(0, 18).join("、") || "待補"
}

function buildQuality(fields: Record<string, string>): string {
  const missing = Object.entries(fields)
    .filter(([, value]) => compact(value, "") === "")
    .map(([key]) => key)

  return missing.length === 0 ? "ok" : `issues:missing_${missing.join("+")}`
}

function buildEntry(doc: RequirementDoc): RequirementRepoMapEntry {
  const content = doc.content || ""
  const summary = lastMatch(content, [
    markdownField("一句話目標"),
    markdownField("大需求名稱"),
    /一句話目標[：:]\s*(.+)/,
    /大需求名稱[：:]\s*(.+)/,
    /^#\s+(.+)$/m,
  ])
  const scope = lastMatch(content, [
    markdownField("影響範圍"),
    markdownField("交付邊界"),
    /影響範圍[：:]\s*(.+)/,
    /交付邊界[：:]\s*(.+)/,
    /constraints?[：:]\s*(.+)/i,
  ])
  const relation = lastMatch(content, [
    /關聯判斷[：:]\*\*\s*(related|new|uncertain|相關|全新|不確定)/i,
    /關聯判斷[：:]\s*(related|new|uncertain|相關|全新|不確定)/i,
  ]) || "unknown"
  const diffSummary = lastMatch(content, [
    markdownField("新舊差異"),
    /新舊差異[：:]\s*(.+)/,
  ])
  const integrity = lastMatch(content, [
    markdownField("迭代完整性"),
    /迭代完整性[：:]\s*(.+)/,
  ])
  const versionDecision = lastMatch(content, [
    markdownField("版本決策"),
    /版本決策[：:]\s*(.+)/,
  ])
  const hasStructuredFields = Boolean(summary && scope && relation !== "unknown")
  const quality = buildQuality({ summary, scope, relation, versionDecision })
  const summaryText = compact([summary, diffSummary].filter(Boolean).join("；"), doc.name, 220)
  const scopeText = compact(scope, "待補", 160)
  const latestChange = [diffSummary, versionDecision ? `版本決策：${versionDecision}` : "", integrity ? `完整性：${integrity}` : ""]
    .filter(Boolean)
    .join("；")

  return {
    fileName: doc.name,
    updatedAt: new Date(doc.mtimeMs).toISOString(),
    relation: compact(relation, "unknown", 80),
    summary: summaryText,
    scope: scopeText,
    latestChange: compact(latestChange, "待補", 180),
    versionDecision: compact(versionDecision, "unknown", 80),
    source: "rebuild",
    confidence: hasStructuredFields ? "rule_medium:65;rebuild_structured_fields" : "rule_low:35;rebuild_missing_structured_fields",
    quality: compact(quality, "ok", 180),
    keywords: compact(deriveKeywords(`${doc.name} ${summaryText} ${scopeText} ${latestChange}`), "待補", 160),
  }
}

export default tool({
  description: "重建需求索引。",
  args: {
    outputDir: tool.schema
      .string()
      .describe("需求文件目錄")
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
