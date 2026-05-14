#!/usr/bin/env node
const path = require("node:path")
const { existsSync } = require("node:fs")
const { artifactDir, commonArtifact, exitForStatus, output, parseArgs, printAndExitUsage, readText, rel, resolveOutPath, resolveRoot, sha256File, walkFiles, readJson, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-final-report-index.js <run_id> [--report <path>] [--check] [--json] [--out <path>] [--strict]")
const runId = positional[0]
const report = flags.report ? resolveRoot(flags.report) : path.join(artifactDir(runId), "final-merge-report.md")
const summariesDir = path.join(artifactDir(runId), "commit-metadata-summary")
const summaries = walkFiles(summariesDir).filter((file) => file.endsWith(".json")).map((file) => readJson(file)).filter(Boolean)
const commits = summaries.flatMap((summary) => summary.commits || [])
const touchedFiles = [...new Set(commits.flatMap((commit) => commit.touchedFiles || []))].sort()
const fileToCommits = {}
const classificationToCommits = {}
for (const summary of summaries) {
  const classificationId = summary.classificationId || "unknown"
  for (const commit of summary.commits || []) {
    if (!classificationToCommits[classificationId]) classificationToCommits[classificationId] = []
    classificationToCommits[classificationId].push(commit.hash)
    for (const file of commit.touchedFiles || []) {
      if (!fileToCommits[file]) fileToCommits[file] = []
      fileToCommits[file].push(commit.hash)
    }
  }
}
const keywords = existsSync(report) ? readText(report).split(/\W+/).filter((word) => word.length > 3).slice(0, 100) : []
const keywordToCommits = Object.fromEntries(keywords.slice(0, 50).map((word) => [word, commits.map((commit) => commit.hash).filter(Boolean).slice(0, 20)]))
const out = resolveOutPath(path.join(artifactDir(runId), "final-report-index.json"), flags)
const index = commonArtifact("final-report-index/v1", runId, sha256File(report) ? "passed" : "blocked", "read full final maintained report and git history", {
  blockers: sha256File(report) ? [] : ["FINAL_REPORT_MISSING"],
  sourceRefs: [{ kind: "final-report", path: rel(report), sha256: sha256File(report), requiredFor: "final report index", fallbackAction: "read full final report" }],
  sourceHashes: { finalReport: sha256File(report) },
  commitMap: commits,
  touchedFiles,
  fileToCommits,
  classificationToCommits,
  bugFixLocatorIndex: { keywords, touchedFiles, fileToCommits, keywordToCommits, classificationToCommits },
  verificationRefs: [],
})
writeJson(out, index, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} commits=${commits.length} status=${index.status}`, { schemaVersion: "script-result/v1", status: index.status, path: rel(out), artifact: index })
exitForStatus(index.status, flags)
