import { access, copyFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { tool } from "@opencode-ai/plugin"
import {
  DEFAULT_USERSTORY_DIR,
  buildRunPaths,
  createRunId,
  ensureRunDirs,
  imageExtension,
  listScreenshots,
  parseDelimited,
  jsonForHtmlScript,
  relativeScreenshotPath,
  escapeHtml,
} from "../lib/userstory-runs"

function resolveInputPath(inputPath: string, baseDir: string): string {
  if (inputPath.startsWith("file://")) return fileURLToPath(inputPath)
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(baseDir, inputPath)
}

async function copyScreenshots(imagePaths: string[], screenshotsDir: string, baseDir: string, startIndex: number): Promise<{ copied: string[]; missing: string[] }> {
  const copied: string[] = []
  const missing: string[] = []

  for (const [index, inputPath] of imagePaths.entries()) {
    const sourcePath = resolveInputPath(inputPath, baseDir)

    try {
      await access(sourcePath)
    } catch {
      missing.push(inputPath)
      continue
    }

    const targetName = `image-${String(startIndex + index + 1).padStart(3, "0")}${imageExtension(sourcePath)}`
    await copyFile(sourcePath, path.join(screenshotsDir, targetName))
    copied.push(targetName)
  }

  return { copied, missing }
}

export default tool({
  description: "啟動 User Story 圖片流程並建立 run_id 輸出資料夾。",
  args: {
    imagePaths: tool.schema
      .string()
      .describe("使用者提供的本機圖片路徑；多張可用換行、逗號或分號分隔。若只有對話貼圖且沒有檔案路徑，先留空。")
      .default(""),
    outputDir: tool.schema
      .string()
      .describe("User Story 輸出根目錄")
      .default(DEFAULT_USERSTORY_DIR),
    runId: tool.schema
      .string()
      .describe("可選；指定既有或自訂 run_id。留空會自動產生。")
      .default(""),
  },
  async execute(args, context) {
    const worktree = context?.worktree ? context.worktree : process.cwd()
    const baseDir = context?.directory || worktree
    const runId = createRunId(args.runId)
    const paths = buildRunPaths(worktree, args.outputDir, runId)
    const imagePaths = parseDelimited(args.imagePaths)

    await ensureRunDirs(paths)
    const existingScreenshots = await listScreenshots(paths.runDir)
    const result = await copyScreenshots(imagePaths, paths.screenshotsDir, baseDir, existingScreenshots.length)

    // Generate a minimal draft.html so the run has an immediate preview and
    // a userstory-data JSON blob. The full draft (with detailed user stories
    // and questions) should still be produced by write-userstory-html, but
    // creating this placeholder avoids a missing-draft situation.
    const screenshots = await listScreenshots(paths.runDir)
    const data = {
      title: "User Story",
      summary: "",
      actors: [],
      userStories: [],
      acceptanceCriteria: [],
      flows: [],
      assumptions: [],
      openQuestions: [],
      revisionNote: "",
      updatedAt: new Date().toISOString(),
      screenshots,
    }

    const screenshotHtml = screenshots
      .map((fileName) => `
        <figure>
          <img src="${relativeScreenshotPath(fileName)}" alt="${escapeHtml(fileName)}">
          <figcaption>${escapeHtml(fileName)}</figcaption>
        </figure>`)
      .join("\n")

    const draftHtml = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(data.title)}</title>
  <style>body{font-family:Arial,Helvetica,sans-serif;padding:12px}figure{margin:0 0 12px;border:1px solid #ddd;padding:8px;border-radius:8px}img{max-width:100%;height:auto;display:block}</style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(data.title)}</h1>
      <p>${escapeHtml(data.summary || "")}</p>
    </header>
    <section>
      <h2>截圖</h2>
      ${screenshotHtml || '<p class="empty">尚未複製截圖。</p>'}
    </section>
  </main>
  <script id="userstory-data" type="application/json">${jsonForHtmlScript(data)}</script>
</body>
</html>`

    await writeFile(paths.draftHtmlPath, draftHtml, "utf-8")

    return [
      "User Story run 已建立。",
      `- run_id：${paths.runId}`,
      `- 資料夾：${paths.runDir}`,
      `- 草稿 HTML：${paths.draftHtmlPath}`,
      `- 最終 Markdown：${paths.markdownPath}`,
      `- 最終圖片 HTML：${paths.finalHtmlPath}`,
      `- 既有截圖：${existingScreenshots.length} 張`,
      result.copied.length > 0 ? `- 本次複製截圖：${result.copied.join("、")}` : "- 本次複製截圖：0 張",
      result.missing.length > 0 ? `- 找不到圖片路徑：${result.missing.join("、")}` : "",
      existingScreenshots.length + result.copied.length === 0 ? "- 注意：最終產檔前需要至少一張可複製的本機圖片路徑。" : "",
    ].filter(Boolean).join("\n")
  },
})
