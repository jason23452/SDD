#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, parseArgs, printAndExitUsage, readJson, rel, sha256File } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/check-resume-readiness.js <run_id> [--strict]")

const runId = positional[0]
const file = path.join(artifactDir(runId), "resume-cursor.json")
const cursor = readJson(file)
const findings = []
if (!cursor) findings.push({ code: "RESUME_CURSOR_MISSING" })
else {
  if (cursor.schemaVersion !== "resume-cursor/v1") findings.push({ code: "SCHEMA_VERSION_INVALID" })
  if (cursor.run_id !== runId) findings.push({ code: "RUN_ID_MISMATCH" })
  if (["blocked", "failed", "stale", "missing"].includes(cursor.status)) findings.push({ code: "RESUME_CURSOR_NOT_READY", status: cursor.status })
  const expectedHash = cursor.sourceHashes && cursor.sourceHashes.dispatchLedger
  const actualHash = sha256File(path.join(artifactDir(runId), "dispatch-ledger.json"))
  if (expectedHash && actualHash && expectedHash !== actualHash) findings.push({ code: "DISPATCH_LEDGER_HASH_MISMATCH" })
  if (cursor.nextAction === "resume-worktree" && !cursor.cursor) findings.push({ code: "RESUME_CURSOR_TARGET_MISSING" })
}
const status = findings.length ? "failed" : "passed"
console.log(JSON.stringify({ schemaVersion: "schema-validation/v1", run_id: runId, status, target: rel(file), findings }, null, 2))
process.exit(status === "passed" || !flags.strict ? 0 : 1)
