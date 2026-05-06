import { tool } from "@opencode-ai/plugin"
import { DEFAULT_REQUIREMENTS_DIR, listRequirementDocs, normalizeLimit, resolveRequirementsDir } from "../lib/requirement-docs"

export default tool({
  description: "列出需求 Markdown。",
  args: {
    outputDir: tool.schema
      .string()
      .describe("需求文件目錄")
      .default(DEFAULT_REQUIREMENTS_DIR),
    limit: tool.schema.number().describe("列出數，最大 20").default(10),
  },
  async execute(args, context) {
    const worktree = context?.worktree ? context.worktree : process.cwd()
    const resolvedDir = resolveRequirementsDir(worktree, args.outputDir)
    const displayDir = args.outputDir || DEFAULT_REQUIREMENTS_DIR
    const limit = normalizeLimit(args.limit, 10)
    const docs = await listRequirementDocs(resolvedDir)

    if (docs.length === 0) return `目前沒有歷史需求報告，目錄：${displayDir}`

    return [
      `目錄：${displayDir}`,
      `歷史需求報告：${Math.min(limit, docs.length)}/${docs.length}`,
      "",
      ...docs.slice(0, limit).map((doc) => `- ${doc.name}`),
    ].join("\n")
  },
})
