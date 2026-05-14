#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, commonArtifact, exitForStatus, output, parseArgs, printAndExitUsage, readJson, rel, resolveOutPath, walkFiles, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-run-metrics-summary.js <run_id> [--check] [--json] [--out <path>] [--strict]")

const runId = positional[0]
const root = artifactDir(runId)
const jsonFiles = walkFiles(root).filter((file) => file.endsWith(".json"))
const statusCounts = {}
const schemaCounts = {}
let fallbackRiskCount = 0
for (const file of jsonFiles) {
  const data = readJson(file)
  if (!data) continue
  if (data.schemaVersion) schemaCounts[data.schemaVersion] = (schemaCounts[data.schemaVersion] || 0) + 1
  if (data.status) statusCounts[data.status] = (statusCounts[data.status] || 0) + 1
  if (["blocked", "failed", "stale", "missing"].includes(data.status)) fallbackRiskCount += 1
}
const out = resolveOutPath(path.join(root, "run-metrics-summary.json"), flags)
const summary = commonArtifact("run-metrics-summary/v1", runId, fallbackRiskCount ? "blocked" : "passed", "read full run artifacts and logs", {
  blockers: fallbackRiskCount ? ["RUN_ARTIFACTS_REQUIRE_FALLBACK"] : [],
  artifactCount: jsonFiles.length,
  schemaCounts,
  statusCounts,
  fallbackRiskCount,
  summaryHitRate: jsonFiles.length ? Number(((jsonFiles.length - fallbackRiskCount) / jsonFiles.length).toFixed(3)) : null,
  tokenSavingsEstimate: "summaryHitRate is a proxy only; compare with real token logs when available",
})
writeJson(out, summary, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${summary.status}`, { schemaVersion: "script-result/v1", status: summary.status, path: rel(out), artifact: summary })
exitForStatus(summary.status, flags)
