#!/usr/bin/env node
const path = require("node:path")
const { existsSync } = require("node:fs")
const { artifactDir, parseArgs, printAndExitUsage, readJson, rel } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 3) printAndExitUsage("Usage: node .opencode/scripts/check-apply-readiness.js <worktree> <run_id> <classification_id>")

const [_worktree, runId, classificationId] = positional
const file = path.join(artifactDir(runId), "apply-readiness-checklist", `${classificationId}.json`)
const data = readJson(file)
const findings = []
if (!existsSync(file)) findings.push({ code: "APPLY_READINESS_MISSING", message: "Checklist file is missing." })
if (data) {
  if (data.schemaVersion !== "apply-readiness-checklist/v1") findings.push({ code: "SCHEMA_VERSION_INVALID", message: "Expected apply-readiness-checklist/v1." })
  if (data.run_id !== runId) findings.push({ code: "RUN_ID_MISMATCH", message: "run_id does not match input." })
  if (data.classificationId !== classificationId) findings.push({ code: "CLASSIFICATION_ID_MISMATCH", message: "classificationId does not match input." })
  if (data.status !== "passed" && data.status !== "completed") findings.push({ code: "APPLY_READINESS_NOT_PASSED", message: `status=${data.status || "missing"}` })
  if (Array.isArray(data.blockers) && data.blockers.length > 0) findings.push({ code: "APPLY_READINESS_BLOCKED", message: data.blockers.join(", ") })
}
const status = findings.length === 0 ? "passed" : "failed"
console.log(JSON.stringify({ schemaVersion: "schema-validation/v1", run_id: runId, status, target: rel(file), findings }, null, 2))
process.exit(status === "passed" ? 0 : 1)
