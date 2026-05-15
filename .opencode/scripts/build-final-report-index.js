#!/usr/bin/env node
const path = require("node:path")
const { existsSync } = require("node:fs")
const { artifactDir, commonArtifact, exitForStatus, output, parseArgs, printAndExitUsage, readText, rel, resolveOutPath, resolveRoot, sha256File, walkFiles, readJson, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-final-report-index.js <run_id> [--report <path>] [--check] [--json] [--out <path>] [--strict]")
const runId = positional[0]
const report = flags.report ? resolveRoot(flags.report) : path.join(artifactDir(runId), "final-merge-report.md")
const summariesDir = path.join(artifactDir(runId), "commit-metadata-summary")
const summaries = walkFiles(summariesDir).filter((file) => file.endsWith(".json")).map((file) => ({ file, data: readJson(file) })).filter((item) => item.data)
const blockers = []
const seenHashes = new Set()
const commitMap = []
for (const item of summaries) {
  const summary = item.data
  const classificationId = summary.classificationId || "unknown"
  for (let index = 0; index < (summary.commits || []).length; index += 1) {
    const commit = summary.commits[index]
    const hash = commit && commit.hash
    if (!hash) {
      blockers.push(`COMMIT_HASH_MISSING:${classificationId}:${index}`)
      continue
    }
    if (seenHashes.has(hash)) {
      blockers.push(`COMMIT_HASH_DUPLICATE:${hash}`)
      continue
    }
    seenHashes.add(hash)
    commitMap.push({ ...commit, hash, run_id: commit.run_id || runId, classificationId: commit.classificationId || classificationId })
  }
}
const commits = commitMap
const touchedFiles = [...new Set(commits.flatMap((commit) => commit.touchedFiles || []))].sort()
const fileToCommits = {}
const classificationToCommits = {}
for (const commit of commits) {
  const classificationId = commit.classificationId || "unknown"
  if (!classificationToCommits[classificationId]) classificationToCommits[classificationId] = []
  classificationToCommits[classificationId].push(commit.hash)
    for (const file of commit.touchedFiles || []) {
      if (!fileToCommits[file]) fileToCommits[file] = []
      fileToCommits[file].push(commit.hash)
    }
}
const keywords = existsSync(report) ? readText(report).split(/\W+/).filter((word) => word.length > 3).slice(0, 100) : []
const keywordToCommits = Object.fromEntries(keywords.slice(0, 50).map((word) => [word, commits.map((commit) => commit.hash).filter(Boolean).slice(0, 20)]))
const commitMapByHash = Object.fromEntries(commits.map((commit) => [commit.hash, commit]))
const reportHash = sha256File(report)
const out = resolveOutPath(path.join(artifactDir(runId), "final-report-index.json"), flags)
const index = commonArtifact("final-report-index/v1", runId, reportHash && blockers.length === 0 ? "passed" : "blocked", "read full final maintained report and git history", {
  blockers: [...(reportHash ? [] : ["FINAL_REPORT_MISSING"]), ...blockers],
  sourceRefs: [{ kind: "final-report", path: rel(report), sha256: reportHash, requiredFor: "final report index", fallbackAction: "read full final report" }],
  sourceHashes: { finalReport: reportHash },
  commitMapKey: "hash",
  commitMap,
  commitMapByHash,
  commitHashes: commits.map((commit) => commit.hash),
  touchedFiles,
  fileToCommits,
  classificationToCommits,
  bugFixLocatorIndex: { commitMapKey: "hash", keywords, touchedFiles, fileToCommits, keywordToCommits, classificationToCommits },
  verificationRefs: [],
})
writeJson(out, index, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} commits=${commits.length} status=${index.status}`, { schemaVersion: "script-result/v1", status: index.status, path: rel(out), artifact: index })
exitForStatus(index.status, flags)
