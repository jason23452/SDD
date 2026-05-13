#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, parseArgs, printAndExitUsage, readJson, rel } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/check-dispatch-ledger-readiness.js <run_id>")
const runId = positional[0]
const file = path.join(artifactDir(runId), "dispatch-ledger.json")
const data = readJson(file)
const findings = []
if (!data) findings.push({ code: "DISPATCH_LEDGER_MISSING", message: "dispatch-ledger.json is missing." })
else {
  for (const field of ["schemaVersion", "run_id", "createdAt", "updatedAt", "bootstrapCommit", "plannerPath", "projectRulesHash", "dependencySnapshotManifest", "stages"]) if (!(field in data)) findings.push({ code: "DISPATCH_LEDGER_FIELD_MISSING", field })
  if (data.schemaVersion !== "dispatch-ledger/v1") findings.push({ code: "SCHEMA_VERSION_INVALID", message: "Expected dispatch-ledger/v1." })
  if (data.run_id !== runId) findings.push({ code: "RUN_ID_MISMATCH" })
  if (!Array.isArray(data.stages) || data.stages.length === 0) findings.push({ code: "DISPATCH_LEDGER_STAGES_INVALID" })
}
const status = findings.length ? "failed" : "passed"
console.log(JSON.stringify({ schemaVersion: "schema-validation/v1", run_id: runId, status, target: rel(file), findings }, null, 2))
process.exit(status === "passed" ? 0 : 1)
