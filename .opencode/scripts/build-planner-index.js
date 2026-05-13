#!/usr/bin/env node
const path = require("node:path")
const { existsSync, readFileSync } = require("node:fs")
const { artifactDir, commonArtifact, output, parseArgs, printAndExitUsage, rel, resolveRoot, sha256File, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1 || !flags.planner) printAndExitUsage("Usage: node .opencode/scripts/build-planner-index.js <run_id> --planner <path> [--check]")

const runId = positional[0]
const planner = resolveRoot(flags.planner)
const hash = sha256File(planner)
const sections = []
const keywords = new Map()
if (existsSync(planner)) {
  const lines = readFileSync(planner, "utf8").split(/\r?\n/)
  lines.forEach((line, index) => {
    const match = /^(#{1,6})\s+(.+)$/.exec(line)
    if (match) sections.push({ level: match[1].length, title: match[2].trim(), line: index + 1 })
    for (const word of line.toLowerCase().match(/[a-z][a-z0-9_-]{2,}|[\u4e00-\u9fff]{2,}/g) || []) {
      if (!keywords.has(word)) keywords.set(word, [])
      if (keywords.get(word).length < 20) keywords.get(word).push(index + 1)
    }
  })
  sections.forEach((section, index) => {
    section.endLine = index + 1 < sections.length ? sections[index + 1].line - 1 : lines.length
    section.sha256 = require("node:crypto").createHash("sha256").update(lines.slice(section.line - 1, section.endLine).join("\n")).digest("hex")
    const title = section.title.toLowerCase()
    section.kind = title.includes("verification") || title.includes("驗證") ? "verification" : title.includes("package") || title.includes("套件") ? "package" : title.includes("experience") || title.includes("ux") || title.includes("ui") ? "experience" : "general"
  })
}
const out = path.join(artifactDir(runId), "planner-index.json")
const index = commonArtifact("planner-index/v1", runId, hash ? "passed" : "blocked", "read full development-detail-planner", {
  blockers: hash ? [] : ["PLANNER_MISSING"],
  sourceRefs: [{ kind: "planner", path: rel(planner), sha256: hash, requiredFor: "planner index", fallbackAction: "read full planner" }],
  sourceHashes: { planner: hash },
  sections,
  keywordIndex: Object.fromEntries([...keywords.entries()].sort()),
  sectionRefs: {
    verification: sections.filter((section) => section.kind === "verification"),
    package: sections.filter((section) => section.kind === "package"),
    experience: sections.filter((section) => section.kind === "experience"),
  },
})
writeJson(out, index, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} sections=${sections.length} status=${index.status}`, { schemaVersion: "script-result/v1", status: index.status, path: rel(out), artifact: index })
