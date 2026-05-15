import { mkdir, readdir } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"

export const DEFAULT_USERSTORY_DIR = path.posix.join(".opencode", "outputs", "userstory")
export const SCREENSHOTS_DIR = "screenshots"
export const DRAFT_HTML_FILE = "draft.html"
export const FINAL_HTML_FILE = "final.html"
export const USERSTORY_MD_FILE = "userstory.md"

export type UserstoryRunPaths = {
  outputDir: string
  runId: string
  runDir: string
  screenshotsDir: string
  draftHtmlPath: string
  finalHtmlPath: string
  markdownPath: string
}

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"])

export function normalizeText(value?: string): string {
  return typeof value === "string" ? value.trim() : ""
}

export function resolveUserstoryDir(worktree: string, outputDir?: string): string {
  const safeOutputDir = normalizeText(outputDir) || DEFAULT_USERSTORY_DIR
  return path.isAbsolute(safeOutputDir) ? safeOutputDir : path.resolve(worktree || process.cwd(), safeOutputDir)
}

function compactTimestamp(): string {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)
}

function sanitizeRunId(value: string): string {
  const sanitized = value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80)

  if (!sanitized || sanitized === "." || sanitized === "..") {
    throw new Error("runId 只能包含英數字、底線、連字號或點，且不可為空")
  }

  return sanitized
}

export function createRunId(candidate?: string): string {
  const normalized = normalizeText(candidate)
  if (normalized.length > 0) return sanitizeRunId(normalized)
  return `run_${compactTimestamp()}_${randomUUID().slice(0, 8)}`
}

export function requireRunId(candidate?: string): string {
  const normalized = normalizeText(candidate)
  if (normalized.length === 0) throw new Error("runId 必填，請先呼叫 init-userstory-run 建立本次流程資料夾")
  return sanitizeRunId(normalized)
}

export function buildRunPaths(worktree: string, outputDir: string | undefined, runId: string): UserstoryRunPaths {
  const resolvedOutputDir = resolveUserstoryDir(worktree, outputDir)
  const safeRunId = requireRunId(runId)
  const runDir = path.join(resolvedOutputDir, safeRunId)
  const screenshotsDir = path.join(runDir, SCREENSHOTS_DIR)

  return {
    outputDir: resolvedOutputDir,
    runId: safeRunId,
    runDir,
    screenshotsDir,
    draftHtmlPath: path.join(runDir, DRAFT_HTML_FILE),
    finalHtmlPath: path.join(runDir, FINAL_HTML_FILE),
    markdownPath: path.join(runDir, USERSTORY_MD_FILE),
  }
}

export async function ensureRunDirs(paths: Pick<UserstoryRunPaths, "runDir" | "screenshotsDir">): Promise<void> {
  await mkdir(paths.screenshotsDir, { recursive: true })
}

export function parseDelimited(value?: string): string[] {
  return normalizeText(value)
    .split(/\r?\n|[,，；;]/)
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
    .filter((item) => item.length > 0)
}

export function parseLines(value?: string): string[] {
  return normalizeText(value)
    .split(/\r?\n/)
    .map((item) => item.trim().replace(/^[-*]\s*/, ""))
    .filter((item) => item.length > 0)
}

export function imageExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return IMAGE_EXTENSIONS.has(ext) ? ext : ".png"
}

export function isImageFile(fileName: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase())
}

export function escapeHtml(value?: string): string {
  return normalizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function escapeAttribute(value?: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;")
}

export function relativeScreenshotPath(fileName: string): string {
  return path.posix.join(SCREENSHOTS_DIR, fileName)
}

export async function listScreenshots(runDir: string): Promise<string[]> {
  const screenshotsDir = path.join(runDir, SCREENSHOTS_DIR)

  try {
    const entries = await readdir(screenshotsDir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && isImageFile(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b))
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return []
    throw error
  }
}

export function jsonForHtmlScript(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/</g, "\\u003c")
}
