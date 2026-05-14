#!/usr/bin/env node
const path = require("node:path")
const { BLOCKING_ARTIFACT_STATUSES, artifactDir, parseArgs, printAndExitUsage, readJson, rel } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/check-verification-matrix.js <run_id>")
const runId = positional[0]
const file = path.join(artifactDir(runId), "verification-matrix.json")
const data = readJson(file)
const findings = []
if (!data) findings.push({ code: "VERIFICATION_MATRIX_MISSING", message: "verification-matrix.json is missing." })
else {
  if (data.schemaVersion !== "verification-matrix/v1") findings.push({ code: "SCHEMA_VERSION_INVALID", message: "Expected verification-matrix/v1." })
  if (data.run_id !== runId) findings.push({ code: "RUN_ID_MISMATCH", message: "run_id does not match input." })
  for (const field of ["runnerLocal", "stageIntegration", "finalOnly"]) if (!Array.isArray(data[field])) findings.push({ code: "VERIFICATION_MATRIX_FIELD_INVALID", message: `${field} must be an array.` })
  if (["runnerLocal", "stageIntegration", "finalOnly"].every((field) => Array.isArray(data[field]) && data[field].length === 0)) findings.push({ code: "VERIFICATION_MATRIX_EMPTY", message: "At least one verification scope must be present or matrix must be blocked with fallback." })
  if (BLOCKING_ARTIFACT_STATUSES.has(data.status)) findings.push({ code: "VERIFICATION_MATRIX_NOT_READY", message: `status=${data.status}` })
}
const status = findings.length === 0 ? "passed" : "failed"
console.log(JSON.stringify({ schemaVersion: "schema-validation/v1", run_id: runId, status, target: rel(file), findings }, null, 2))
process.exit(status === "passed" ? 0 : 1)
