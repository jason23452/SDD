import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"

export const DEFAULT_REQUIREMENTS_DIR = path.posix.join(".opencode", "outputs", "analyze-requirements")

export type RequirementDoc = {
  name: string
  filePath: string
  size: number
  mtimeMs: number
  content?: string
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

export async function listRequirementDocs(outputDir: string, options: { readContent?: boolean } = {}): Promise<RequirementDoc[]> {
  try {
    const entries = await readdir(outputDir, { withFileTypes: true })
    const docs = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
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
