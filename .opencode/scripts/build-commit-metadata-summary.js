#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, commonArtifact, exitForStatus, git, output, parseArgs, printAndExitUsage, readJson, rel, resolveOutPath, sha256Text, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 2) printAndExitUsage("Usage: node .opencode/scripts/build-commit-metadata-summary.js <run_id> <classification_id> [--runner-event <path>] [--from <commit>] [--to <commit>] [--commits <hashes>] [--check] [--json] [--out <path>] [--strict]")
const [runId, classificationId] = positional
const runnerEventPath = flags["runner-event"] || path.join(artifactDir(runId), "runner-events", `${classificationId}.json`)
const runnerEvent = readJson(runnerEventPath)
function unique(values) {
  return [...new Set(values.filter(Boolean))]
}
let commitHashes = []
if (flags.commits) commitHashes = String(flags.commits).split(/[,\s]+/).filter(Boolean)
else if (runnerEvent && runnerEvent.commits) commitHashes = unique([runnerEvent.commits.specCommit, ...(runnerEvent.commits.implementationCommits || []), ...(runnerEvent.commits.testCommits || []), ...(runnerEvent.commits.fixCommits || []), ...(runnerEvent.commits.documentationCommits || [])])
else if (flags.from || flags.to) commitHashes = git(["log", "--format=%H", `${flags.from || "HEAD~20"}..${flags.to || "HEAD"}`]).split(/\r?\n/).filter(Boolean)
const lines = commitHashes.length ? commitHashes.map((hash) => `${hash}\t${git(["log", "-1", "--format=%s", hash])}`) : git(["log", "--format=%H%x09%s", "-20"]).split(/\r?\n/).filter(Boolean)
const blockers = []
const commits = lines.filter(Boolean).map((line) => {
  const [hash, ...subject] = line.split("\t")
  if (git(["cat-file", "-t", hash]) !== "commit") blockers.push(`COMMIT_NOT_FOUND:${hash}`)
  const files = git(["show", "--name-only", "--format=", hash]).split(/\r?\n/).filter(Boolean)
  return { hash, subject: subject.join("\t"), subjectDigest: sha256Text(subject.join("\t")), touchedFiles: files }
})
const out = resolveOutPath(path.join(artifactDir(runId), "commit-metadata-summary", `${classificationId}.json`), flags)
const summary = commonArtifact("commit-metadata-summary/v1", runId, blockers.length ? "blocked" : "passed", "rebuild commit metadata from git show", {
  blockers,
  classificationId,
  runnerEventRef: runnerEvent ? rel(runnerEventPath) : null,
  commits,
  commitCount: commits.length,
})
writeJson(out, summary, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} commits=${commits.length}`, { schemaVersion: "script-result/v1", status: summary.status, path: rel(out), artifact: summary })
exitForStatus(summary.status, flags)
