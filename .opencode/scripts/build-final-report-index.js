#!/usr/bin/env node
const path = require("node:path")
const { existsSync, readFileSync } = require("node:fs")
const { artifactDir, commonArtifact, parseArgs, printAndExitUsage, rel, resolveRoot, sha256File, walkFiles, readJson, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-final-report-index.js <run_id> [--report <path>] [--check]")
const runId = positional[0]
const report = flags.report ? resolveRoot(flags.report) : path.join(artifactDir(runId), "final-merge-report.md")
const summariesDir = path.join(artifactDir(runId), "commit-metadata-summary")
const summaries = walkFiles(summariesDir).filter((file) => file.endsWith(".json")).map((file) => readJson(file)).filter(Boolean)
const commits = summaries.flatMap((summary) => summary.commits || [])
const touchedFiles = [...new Set(commits.flatMap((commit) => commit.touchedFiles || []))].sort()
const keywords = existsSync(report) ? readFileSync(report, "utf8").split(/\W+/).filter((word) => word.length > 3).slice(0, 100) : []
const out = path.join(artifactDir(runId), "final-report-index.json")
const index = commonArtifact("final-report-index/v1", runId, sha256File(report) ? "passed" : "blocked", "read full final maintained report and git history", {
  blockers: sha256File(report) ? [] : ["FINAL_REPORT_MISSING"],
  sourceRefs: [{ kind: "final-report", path: rel(report), sha256: sha256File(report), requiredFor: "final report index", fallbackAction: "read full final report" }],
  sourceHashes: { finalReport: sha256File(report) },
  commitMap: commits,
  touchedFiles,
  bugFixLocatorIndex: { keywords, touchedFiles },
  verificationRefs: [],
})
writeJson(out, index, Boolean(flags.check))
console.log(`${flags.check ? "would write" : "wrote"}: ${rel(out)} commits=${commits.length} status=${index.status}`)
