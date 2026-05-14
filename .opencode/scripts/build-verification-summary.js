#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, commonArtifact, exitForStatus, output, parseArgs, printAndExitUsage, rel, resolveOutPath, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-verification-summary.js <run_id> --scope <scope> --check-id <id> --status <status> [--command <cmd>] [--log-ref <path>] [--check] [--json] [--out <path>] [--strict]")

const runId = positional[0]
const scope = flags.scope || "local"
const checkId = flags["check-id"] || flags.id || "unknown-check"
const checkStatus = flags.status || "planned"
const out = resolveOutPath(path.join(artifactDir(runId), "verification-summary", `${scope}-${checkId}.json`), flags)
const blockers = ["blocked", "failed", "stale", "missing"].includes(checkStatus) ? [`VERIFICATION_${String(checkStatus).toUpperCase()}`] : []
const summary = commonArtifact("verification-summary/v1", runId, blockers.length ? "blocked" : checkStatus === "passed" ? "passed" : "planned", "read full verification command output and logs", {
  blockers,
  scope,
  checkId,
  checks: [{ id: checkId, status: checkStatus, command: flags.command || null, logRef: flags["log-ref"] || null }],
  logRefs: flags["log-ref"] ? [flags["log-ref"]] : [],
})
writeJson(out, summary, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${summary.status}`, { schemaVersion: "script-result/v1", status: summary.status, path: rel(out), artifact: summary })
exitForStatus(summary.status, flags)
