import { readdir, stat } from "node:fs/promises"
import path from "node:path"
import { tool } from "@opencode-ai/plugin"
import { writeAnalyzeRequirementsOutput, AnalyzeRequirementsInput } from "./analyze-requirements"

type FileInfo = {
  name: string
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

export default tool({
  description:
    "需求清單輸出與分析文件產生工具：先列出 analyze-requirements 歷史檔案，並可直接接續產出分析文件",
  args: {
    outputDir: tool.schema
      .string()
      .describe("需求分析輸出目錄，預設為 .opencode/outputs/analyze-requirements")
      .default(path.posix.join(".opencode", "outputs", "analyze-requirements")),
    runAnalyze: tool.schema
      .boolean()
      .describe("是否在列出歷史後直接執行 analyze-requirements 產生報告")
      .default(true),
    majorRequirement: tool.schema
      .string()
      .describe("大需求主題（可一段話）")
      .default("待補"),
    targetUsers: tool.schema
      .string()
      .describe("目標使用者與使用情境")
      .default("待補"),
    constraints: tool.schema
      .string()
      .describe("已知約束（時間、預算、法規、技術堆疊）")
      .default("待補"),
    existingSystem: tool.schema
      .string()
      .describe("既有系統資訊（若有）")
      .default("待補"),
    referenceCases: tool.schema
      .string()
      .describe("參考對象或想借鏡的案例（若有）")
      .default("待補"),
    deliverables: tool.schema
      .string()
      .describe("希望交付內容（PRD、規格、排程）")
      .default("待補"),
    extraNotes: tool.schema
      .string()
      .describe("其他補充")
      .default("待補"),
    mode: tool.schema.string().describe("使用者要求 initial 或 final").default("initial"),
  },
  async execute(args, context) {
    const worktree = context?.worktree ? context.worktree : process.cwd()
    const safeOutputDir =
      typeof args.outputDir === "string" && args.outputDir.trim().length > 0
        ? args.outputDir
        : path.posix.join(".opencode", "outputs", "analyze-requirements")

    const resolvedDir = path.resolve(worktree, safeOutputDir)

    const allFiles = await listRequirementFiles(resolvedDir)

    const baseInfo =
      allFiles.length === 0
        ? `目前沒有可列出的歷史需求報告，目錄：${resolvedDir}`
        : [
            `目錄：${resolvedDir}`,
            `歷史需求報告檔案總數：${allFiles.length}`,
            "",
            ...allFiles.map((file) => `- ${file.name} (${formatBytes(file.size)})`),
          ].join("\n")

    if (!args.runAnalyze) {
      return baseInfo
    }

    const analyzeArgs: AnalyzeRequirementsInput = {
      majorRequirement: args.majorRequirement,
      targetUsers: args.targetUsers,
      constraints: args.constraints,
      existingSystem: args.existingSystem,
      referenceCases: args.referenceCases,
      deliverables: args.deliverables,
      extraNotes: args.extraNotes,
      mode: args.mode,
    }

    const { report, filePath } = await writeAnalyzeRequirementsOutput(analyzeArgs, worktree, resolvedDir)

    return `${baseInfo}\n\n## 直接產出的需求分析\n${report}\n\n## 產出檔案\n${filePath}`
  },
})
