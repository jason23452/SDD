import { readdir, rm, stat } from "node:fs/promises"
import path from "node:path"
import { tool } from "@opencode-ai/plugin"

type Mode = "list" | "all" | "latest"

type FileInfo = {
  name: string
  absolutePath: string
  size: number
  mtimeMs: number
}

function sortByModifiedDesc(items: FileInfo[]) {
  return items.sort((a, b) => b.mtimeMs - a.mtimeMs)
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) {
    return "0B"
  }

  const unit = ["B", "KB", "MB", "GB"]
  let normalized = size
  let i = 0

  while (normalized >= 1024 && i < unit.length - 1) {
    normalized /= 1024
    i += 1
  }

  if (i === 0) return `${normalized}B`
  return `${normalized.toFixed(1)}${unit[i]}`
}

async function listRequirementFiles(outputDir: string): Promise<FileInfo[]> {
  try {
    const entries = await readdir(outputDir, { withFileTypes: true })
    const infos = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const absolutePath = path.join(outputDir, entry.name)
          const s = await stat(absolutePath)
          return {
            name: entry.name,
            absolutePath,
            size: s.size,
            mtimeMs: s.mtimeMs,
          }
        }),
    )

    return sortByModifiedDesc(infos)
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return []
    }

    throw error
  }
}

function renderSummary(files: FileInfo[], removed: string[], kept: string[]) {
  const lines = ["# 需求輸出清理結果", `總檔案數：${files.length}`, `已移除：${removed.length}`, `保留：${kept.length}`]

  if (removed.length > 0) {
    lines.push("", "已移除檔案：")
    removed.forEach((name) => lines.push(`- ${name}`))
  }

  if (kept.length > 0) {
    lines.push("", "保留檔案：")
    kept.forEach((name) => lines.push(`- ${name}`))
  }

  return lines.join("\n")
}

export default tool({
  description: "清理需求產生輸出資料夾中的舊檔案，可列舉、全部清除或保留最新 N 份",
  args: {
    outputDir: tool.schema
      .string()
      .describe("需求分析輸出目錄，預設為 .opencode/outputs/analyze-requirements")
      .default(path.join(".opencode", "outputs", "analyze-requirements")),
    mode: tool.schema
      .enum(["list", "all", "latest"] as const)
      .describe("list 列表，all 全部清空，latest 保留最新檔案並刪除其餘")
      .default("list"),
    keepLatest: tool.schema
      .number()
      .int()
      .min(0)
      .describe("當 mode=latest 時，保留的最新檔案數")
      .default(3),
    confirm: tool.schema
      .boolean()
      .describe("實際刪除前必須明確設為 true，否則只輸出預覽")
      .default(false),
  },
  async execute(args, context) {
    const mode = args.mode as Mode
    const keepLatest = Math.max(0, Number.isFinite(args.keepLatest) ? Math.floor(args.keepLatest) : 3)
    const shouldDelete = args.confirm === true
    const worktree = context?.worktree ? context.worktree : process.cwd()
    const resolvedDir = path.resolve(worktree, args.outputDir)

    const allFiles = await listRequirementFiles(resolvedDir)

    if (allFiles.length === 0) {
      return `目前沒有可清理的檔案，目錄：${resolvedDir}`
    }

    if (mode === "list") {
      const lines = [
        `目錄：${resolvedDir}`,
        `檔案總數：${allFiles.length}`,
        "",
        ...allFiles.map((file) => `- ${file.name} (${formatBytes(file.size)})`),
      ]
      return lines.join("\n")
    }

    let toRemove: FileInfo[] = []
    if (mode === "all") {
      toRemove = allFiles
    } else if (mode === "latest") {
      toRemove = allFiles.slice(keepLatest)
    }

    if (toRemove.length === 0) {
      return `目前無需刪除。目錄：${resolvedDir}`
    }

    const removedNames = toRemove.map((file) => file.name)
    const keptNames = allFiles.filter((file) => !toRemove.some((f) => f.name === file.name)).map((file) => file.name)

    if (!shouldDelete) {
      return [
        `預覽模式已啟用（尚未刪除任何檔案）`,
        `目錄：${resolvedDir}`,
        `模式：${mode}`,
        `預計刪除：${removedNames.length} 個`,
        `將保留：${keptNames.length} 個（可用 confirm=true 正式刪除）`,
        "",
        "預計刪除檔案：",
        ...removedNames.map((name) => `- ${name}`),
      ].join("\n")
    }

    await Promise.all(toRemove.map((file) => rm(file.absolutePath, { force: true })))
    const remain = allFiles.filter((file) => !toRemove.some((f) => f.absolutePath === file.absolutePath))

    return renderSummary(remain, removedNames, keptNames)
  },
})
