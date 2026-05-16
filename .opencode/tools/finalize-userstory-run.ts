import { readFile, writeFile } from "node:fs/promises"
import { tool } from "@opencode-ai/plugin"
import {
  DEFAULT_USERSTORY_DIR,
  buildRunPaths,
  ensureRunDirs,
  escapeAttribute,
  escapeHtml,
  listScreenshots,
  normalizeText,
  relativeScreenshotPath,
} from "../lib/userstory-runs"

type DraftData = {
  title?: string
  summary?: string
  actors?: string[]
  userStories?: string[]
  acceptanceCriteria?: string[]
  flows?: string[]
  assumptions?: string[]
  openQuestions?: string[]
  revisionNote?: string
  updatedAt?: string
  screenshots?: string[]
}

function extractDraftData(html: string): DraftData {
  const match = html.match(/<script\s+id=["']userstory-data["']\s+type=["']application\/json["']>([\s\S]*?)<\/script>/i)
  if (!match?.[1]) throw new Error("draft.html 缺少 userstory-data，請先呼叫 write-userstory-html 產生草稿")

  try {
    return JSON.parse(match[1]) as DraftData
  } catch {
    throw new Error("draft.html 內的 userstory-data 無法解析，請重新產生草稿 HTML")
  }
}

function cleanItems(items?: string[]): string[] {
  return Array.isArray(items) ? items.map((item) => normalizeText(item)).filter((item) => item.length > 0) : []
}

function markdownList(items: string[], emptyText = "無"): string {
  if (items.length === 0) return `- ${emptyText}`
  return items.map((item) => `- ${item}`).join("\n")
}

function assertReady(data: DraftData, screenshots: string[]): void {
  const issues: string[] = []
  if (!normalizeText(data.title)) issues.push("缺少標題")
  if (!normalizeText(data.summary)) issues.push("缺少摘要")
  if (cleanItems(data.userStories).length === 0) issues.push("缺少 User Story")
  if (cleanItems(data.acceptanceCriteria).length === 0) issues.push("缺少驗收條件")
  if (screenshots.length === 0) issues.push("缺少已複製截圖")

  if (issues.length > 0) {
    throw new Error(`User Story 尚未可定稿：${issues.join("；")}。請先補齊並重新產生 draft.html。`)
  }
}

function buildMarkdown(data: DraftData, screenshots: string[], approvalNote: string): string {
  const title = normalizeText(data.title) || "User Story"
  const generatedAt = new Date().toISOString()

  return `# ${title}

## 摘要
${normalizeText(data.summary)}

## 截圖
${screenshots.map((fileName) => `![${fileName}](${relativeScreenshotPath(fileName)})`).join("\n\n")}

## 角色
${markdownList(cleanItems(data.actors), "未特別標示角色")}

## User Stories
${markdownList(cleanItems(data.userStories))}

## 驗收條件
${markdownList(cleanItems(data.acceptanceCriteria))}

## 使用流程與情境
${markdownList(cleanItems(data.flows), "未補充流程")}

## 假設
${markdownList(cleanItems(data.assumptions), "無額外假設")}

## 待確認問題
${markdownList(cleanItems(data.openQuestions), "使用者已接受目前內容")}

## 定稿資訊
- 使用者確認：${approvalNote || "使用者已確認可接受"}
- 草稿更新時間：${normalizeText(data.updatedAt) || "未知"}
- 定稿輸出時間：${generatedAt}
`
}

function buildImagesOnlyHtml(screenshots: string[], title: string): string {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; background: #0f172a; display: grid; gap: 16px; }
    img { display: block; width: 100%; max-width: 1280px; margin: 0 auto; height: auto; border-radius: 12px; background: #fff; }
  </style>
</head>
<body>
${screenshots.map((fileName) => `<img src="${escapeAttribute(relativeScreenshotPath(fileName))}" alt="${escapeAttribute(fileName)}">`).join("\n")}
</body>
</html>
`
}

export default tool({
  description: "在使用者確認後，依草稿 HTML 產生最終 User Story Markdown 與只顯示圖片的 final.html。",
  args: {
    runId: tool.schema.string().describe("init-userstory-run 回傳的 run_id").default(""),
    outputDir: tool.schema.string().describe("User Story 輸出根目錄").default(DEFAULT_USERSTORY_DIR),
    approvalNote: tool.schema.string().describe("使用者確認文字或定稿備註").default("使用者已確認可接受"),
    force: tool.schema.boolean().describe("若為 true，允許在草稿缺少部分欄位時仍強制產出最終檔案").default(false),
  },
  async execute(args, context) {
    const worktree = context?.worktree ? context.worktree : process.cwd()
    const paths = buildRunPaths(worktree, args.outputDir, args.runId)
    await ensureRunDirs(paths)

    const draftHtml = await readFile(paths.draftHtmlPath, "utf-8")
    const data = extractDraftData(draftHtml)
    const screenshots = await listScreenshots(paths.runDir)

    // Collect issues but allow forcing the finalize step if requested.
    const issues = [] as string[]
    if (!normalizeText(data.title)) issues.push("缺少標題")
    if (!normalizeText(data.summary)) issues.push("缺少摘要")
    if (cleanItems(data.userStories).length === 0) issues.push("缺少 User Story")
    if (cleanItems(data.acceptanceCriteria).length === 0) issues.push("缺少驗收條件")
    if (screenshots.length === 0) issues.push("缺少已複製截圖")

    if (issues.length > 0 && !args.force) {
      throw new Error(`User Story 尚未可定稿：${issues.join("；")}。請先補齊並重新產生 draft.html，或使用 force=true 強制產出。`)
    }

    const title = normalizeText(data.title) || "User Story"

    // If there were issues, inject a warning block into the approval note so
    // the produced markdown makes it explicit why the finalize was forced.
    const approvalNote = normalizeText(args.approvalNote) || "使用者已確認可接受"
    const approvalWithWarnings = issues.length > 0 ? `${approvalNote} （定稿時發現缺項：${issues.join("、")}）` : approvalNote

    await writeFile(paths.markdownPath, buildMarkdown(data, screenshots, approvalWithWarnings), "utf-8")
    await writeFile(paths.finalHtmlPath, buildImagesOnlyHtml(screenshots, title), "utf-8")

    return [
      "User Story 已定稿。",
      `- run_id：${paths.runId}`,
      `- Markdown：${paths.markdownPath}`,
      `- 最終圖片 HTML：${paths.finalHtmlPath}`,
      `- 截圖數：${screenshots.length}`,
    ].join("\n")
  },
})
