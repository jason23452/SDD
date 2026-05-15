import { writeFile } from "node:fs/promises"
import { tool } from "@opencode-ai/plugin"
import {
  DEFAULT_USERSTORY_DIR,
  buildRunPaths,
  ensureRunDirs,
  escapeAttribute,
  escapeHtml,
  jsonForHtmlScript,
  listScreenshots,
  normalizeText,
  parseLines,
  relativeScreenshotPath,
} from "../lib/userstory-runs"

type DraftData = {
  title: string
  summary: string
  actors: string[]
  userStories: string[]
  acceptanceCriteria: string[]
  flows: string[]
  assumptions: string[]
  openQuestions: string[]
  revisionNote: string
  updatedAt: string
  screenshots: string[]
}

function renderList(items: string[], emptyText: string): string {
  if (items.length === 0) return `<p class="empty">${escapeHtml(emptyText)}</p>`
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
}

function renderStoryCards(items: string[]): string {
  if (items.length === 0) return `<p class="empty">尚未整理 User Story。</p>`
  return items.map((item, index) => [
    `<article class="story-card">`,
    `<span class="story-id">US-${String(index + 1).padStart(2, "0")}</span>`,
    `<p>${escapeHtml(item)}</p>`,
    `</article>`,
  ].join("\n")).join("\n")
}

function renderScreenshots(screenshots: string[]): string {
  if (screenshots.length === 0) {
    return `<p class="empty">尚未複製截圖。若圖片只貼在對話中，最終產檔前請提供本機圖片路徑。</p>`
  }

  return `<div class="shot-grid">${screenshots.map((fileName) => {
    const relativePath = relativeScreenshotPath(fileName)
    return [
      `<figure>`,
      `<img src="${escapeAttribute(relativePath)}" alt="${escapeAttribute(fileName)}">`,
      `<figcaption>${escapeHtml(fileName)}</figcaption>`,
      `</figure>`,
    ].join("\n")
  }).join("\n")}</div>`
}

function buildDraftHtml(data: DraftData): string {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(data.title || "User Story Draft")}</title>
  <style>
    :root { color-scheme: light; --ink: #1f2937; --muted: #667085; --line: #d0d5dd; --bg: #f6f7fb; --card: #ffffff; --accent: #4f46e5; --soft: #eef2ff; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Inter", "Noto Sans TC", Arial, sans-serif; color: var(--ink); background: radial-gradient(circle at top left, #eef2ff 0, transparent 30rem), var(--bg); }
    main { width: min(1120px, calc(100% - 32px)); margin: 32px auto 48px; }
    header { display: grid; gap: 12px; padding: 28px; border: 1px solid var(--line); border-radius: 28px; background: rgba(255, 255, 255, 0.86); box-shadow: 0 18px 50px rgba(31, 41, 55, 0.08); backdrop-filter: blur(12px); }
    h1 { margin: 0; font-size: clamp(2rem, 5vw, 4.6rem); line-height: 0.95; letter-spacing: -0.06em; }
    h2 { margin: 0 0 14px; font-size: 1.1rem; }
    p { line-height: 1.72; }
    .meta { color: var(--muted); font-size: 0.92rem; }
    .summary { margin: 0; max-width: 820px; font-size: 1.06rem; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 20px; margin-top: 20px; align-items: start; }
    section { padding: 22px; border: 1px solid var(--line); border-radius: 24px; background: var(--card); box-shadow: 0 10px 28px rgba(31, 41, 55, 0.05); }
    .stack { display: grid; gap: 20px; }
    .story-list { display: grid; gap: 12px; }
    .story-card { position: relative; padding: 18px 18px 18px 72px; border: 1px solid #c7d2fe; border-radius: 18px; background: linear-gradient(135deg, #ffffff, var(--soft)); }
    .story-id { position: absolute; left: 16px; top: 18px; color: var(--accent); font-weight: 800; font-size: 0.84rem; }
    .story-card p { margin: 0; }
    ul { margin: 0; padding-left: 1.1rem; }
    li + li { margin-top: 0.55rem; }
    .shot-grid { display: grid; gap: 14px; }
    figure { margin: 0; border: 1px solid var(--line); border-radius: 18px; overflow: hidden; background: #fff; }
    img { display: block; width: 100%; height: auto; }
    figcaption { padding: 10px 12px; color: var(--muted); font-size: 0.82rem; }
    .empty { margin: 0; color: var(--muted); }
    .pill { display: inline-flex; align-items: center; width: fit-content; padding: 6px 10px; border-radius: 999px; color: #3730a3; background: var(--soft); font-weight: 700; font-size: 0.82rem; }
    @media (max-width: 860px) { main { width: min(100% - 20px, 720px); margin-top: 16px; } header, section { border-radius: 20px; padding: 18px; } .layout { grid-template-columns: 1fr; } .story-card { padding-left: 18px; } .story-id { position: static; display: inline-block; margin-bottom: 8px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <span class="pill">User Story Draft</span>
      <h1>${escapeHtml(data.title || "User Story")}</h1>
      <p class="summary">${escapeHtml(data.summary || "尚未提供摘要。")}</p>
      <div class="meta">更新時間：${escapeHtml(data.updatedAt)}${data.revisionNote ? `｜${escapeHtml(data.revisionNote)}` : ""}</div>
    </header>
    <div class="layout">
      <div class="stack">
        <section>
          <h2>使用者故事</h2>
          <div class="story-list">${renderStoryCards(data.userStories)}</div>
        </section>
        <section>
          <h2>驗收條件</h2>
          ${renderList(data.acceptanceCriteria, "尚未整理驗收條件。")}
        </section>
        <section>
          <h2>流程與情境</h2>
          ${renderList(data.flows, "尚未整理流程。")}
        </section>
        <section>
          <h2>假設與待確認</h2>
          ${renderList([...data.assumptions, ...data.openQuestions], "目前沒有待確認項。")}
        </section>
      </div>
      <aside class="stack">
        <section>
          <h2>截圖</h2>
          ${renderScreenshots(data.screenshots)}
        </section>
        <section>
          <h2>角色</h2>
          ${renderList(data.actors, "尚未整理角色。")}
        </section>
      </aside>
    </div>
  </main>
  <script id="userstory-data" type="application/json">${jsonForHtmlScript(data)}</script>
</body>
</html>
`
}

export default tool({
  description: "產生或覆寫 User Story 草稿 HTML，供使用者閱讀與迭代確認。",
  args: {
    runId: tool.schema.string().describe("init-userstory-run 回傳的 run_id").default(""),
    outputDir: tool.schema.string().describe("User Story 輸出根目錄").default(DEFAULT_USERSTORY_DIR),
    title: tool.schema.string().describe("User Story 標題").default(""),
    summary: tool.schema.string().describe("根據圖片整理的一段摘要").default(""),
    actors: tool.schema.string().describe("角色清單；每行一項").default(""),
    userStories: tool.schema.string().describe("User Story 清單；每行一條，建議用『作為...我想要...以便...』").default(""),
    acceptanceCriteria: tool.schema.string().describe("驗收條件；每行一項").default(""),
    flows: tool.schema.string().describe("使用流程或情境；每行一項").default(""),
    assumptions: tool.schema.string().describe("根據圖片推得但需標示為假設的內容；每行一項").default(""),
    openQuestions: tool.schema.string().describe("仍需使用者確認的問題；每行一項").default(""),
    revisionNote: tool.schema.string().describe("本版調整說明").default(""),
  },
  async execute(args, context) {
    const worktree = context?.worktree ? context.worktree : process.cwd()
    const paths = buildRunPaths(worktree, args.outputDir, args.runId)
    await ensureRunDirs(paths)

    const data: DraftData = {
      title: normalizeText(args.title) || "User Story",
      summary: normalizeText(args.summary),
      actors: parseLines(args.actors),
      userStories: parseLines(args.userStories),
      acceptanceCriteria: parseLines(args.acceptanceCriteria),
      flows: parseLines(args.flows),
      assumptions: parseLines(args.assumptions),
      openQuestions: parseLines(args.openQuestions),
      revisionNote: normalizeText(args.revisionNote),
      updatedAt: new Date().toISOString(),
      screenshots: await listScreenshots(paths.runDir),
    }

    await writeFile(paths.draftHtmlPath, buildDraftHtml(data), "utf-8")

    return [
      "User Story 草稿 HTML 已更新。",
      `- run_id：${paths.runId}`,
      `- HTML：${paths.draftHtmlPath}`,
      `- 截圖數：${data.screenshots.length}`,
      "下一步：請詢問使用者是否可接受；不可在使用者明確同意前 final。",
    ].join("\n")
  },
})
