import { readdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"

export const DEFAULT_REQUIREMENTS_DIR = path.posix.join(".opencode", "outputs", "analyze-requirements")
export const REQUIREMENT_REPO_MAP_FILE = "requirement-repo-map.md"
export const REQUIREMENT_HISTORY_SUFFIX = ".history.md"

export type RequirementDoc = {
  name: string
  filePath: string
  size: number
  mtimeMs: number
  content?: string
}

export type RequirementRepoMapEntry = {
  fileName: string
  updatedAt: string
  relation: string
  summary: string
  scope: string
  latestChange: string
  versionDecision: string
  source: string
  confidence: string
  keywords: string
}

export function normalizeText(value?: string): string {
  return typeof value === "string" ? value.trim() : ""
}

export function normalizeLimit(value: number, fallback = 5, max = 20): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.min(Math.floor(value), max))
}

export function resolveRequirementsDir(worktree: string, outputDir?: string): string {
  const safeOutputDir = normalizeText(outputDir) || DEFAULT_REQUIREMENTS_DIR
  return path.isAbsolute(safeOutputDir) ? safeOutputDir : path.resolve(worktree || process.cwd(), safeOutputDir)
}

export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) return "0B"

  const units = ["B", "KB", "MB", "GB"]
  let normalized = size
  let unitIndex = 0

  while (normalized >= 1024 && unitIndex < units.length - 1) {
    normalized /= 1024
    unitIndex += 1
  }

  return unitIndex === 0 ? `${normalized}B` : `${normalized.toFixed(1)}${units[unitIndex]}`
}

function compactLine(value?: string, maxLength = 180): string {
  const normalized = normalizeText(value).replace(/\s+/g, " ")
  if (normalized.length <= maxLength) return normalized || "待補"
  return `${normalized.slice(0, maxLength - 1)}…`
}

function extractField(section: string, label: string): string {
  const match = section.match(new RegExp(`^- ${label}：(.+)$`, "m"))
  return match?.[1]?.trim() || "待補"
}

export function requirementRepoMapPath(outputDir: string): string {
  return path.join(outputDir, REQUIREMENT_REPO_MAP_FILE)
}

export async function readRequirementRepoMap(outputDir: string): Promise<RequirementRepoMapEntry[]> {
  try {
    const content = await readFile(requirementRepoMapPath(outputDir), "utf-8")
    return content
      .split(/\n(?=## )/)
      .filter((section) => section.startsWith("## "))
      .map((section) => ({
        fileName: section.match(/^##\s+(.+)$/m)?.[1]?.trim() || "",
        updatedAt: extractField(section, "updatedAt"),
        relation: extractField(section, "relation"),
        summary: extractField(section, "summary"),
        scope: extractField(section, "scope"),
        latestChange: extractField(section, "latestChange"),
        versionDecision: extractField(section, "versionDecision"),
        source: extractField(section, "source"),
        confidence: extractField(section, "confidence"),
        keywords: extractField(section, "keywords"),
      }))
      .filter((entry) => entry.fileName.length > 0)
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return []
    throw error
  }
}

export async function writeRequirementRepoMap(outputDir: string, entries: RequirementRepoMapEntry[]): Promise<string> {
  const content = [
    "# Requirement Repo Map",
    "",
    "此檔只記錄需求文件最新摘要，供搜尋與判斷關聯使用；完整歷史仍保留在各 Markdown 需求檔。",
    "",
    ...entries.map((entry) => [
      `## ${entry.fileName}`,
      `- updatedAt：${compactLine(entry.updatedAt, 80)}`,
      `- relation：${compactLine(entry.relation, 80)}`,
      `- summary：${compactLine(entry.summary, 220)}`,
      `- scope：${compactLine(entry.scope, 160)}`,
      `- latestChange：${compactLine(entry.latestChange, 180)}`,
      `- versionDecision：${compactLine(entry.versionDecision, 80)}`,
      `- source：${compactLine(entry.source, 80)}`,
      `- confidence：${compactLine(entry.confidence, 80)}`,
      `- keywords：${compactLine(entry.keywords, 160)}`,
      "",
    ].join("\n")),
  ].join("\n").trimEnd()

  const filePath = requirementRepoMapPath(outputDir)
  await writeFile(filePath, `${content}\n`, "utf-8")
  return filePath
}

export async function listRequirementDocs(outputDir: string, options: { readContent?: boolean } = {}): Promise<RequirementDoc[]> {
  try {
    const entries = await readdir(outputDir, { withFileTypes: true })
    const docs = await Promise.all(
      entries
        .filter((entry) =>
          entry.isFile() &&
          entry.name.toLowerCase().endsWith(".md") &&
          entry.name !== REQUIREMENT_REPO_MAP_FILE &&
          !entry.name.toLowerCase().endsWith(REQUIREMENT_HISTORY_SUFFIX),
        )
        .map(async (entry) => {
          const filePath = path.join(outputDir, entry.name)
          const [fileStat, content] = await Promise.all([
            stat(filePath),
            options.readContent ? readFile(filePath, "utf-8") : Promise.resolve(undefined),
          ])

          return {
            name: entry.name,
            filePath,
            size: fileStat.size,
            mtimeMs: fileStat.mtimeMs,
            content,
          }
        }),
    )

    return docs.sort((a, b) => b.mtimeMs - a.mtimeMs)
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return []
    throw error
  }
}
