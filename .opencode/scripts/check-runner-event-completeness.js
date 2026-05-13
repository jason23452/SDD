#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, parseArgs, printAndExitUsage, readJson, rel } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 2) printAndExitUsage("Usage: node .opencode/scripts/check-runner-event-completeness.js <run_id> <classification_id>")
const [runId, classificationId] = positional
const file = path.join(artifactDir(runId), "runner-events", `${classificationId}.json`)
const data = readJson(file)
const findings = []
if (!data) findings.push({ code: "RUNNER_EVENT_MISSING" })
else {
  for (const field of ["schemaVersion", "run_id", "classificationId", "readyWaveId", "eligibleSetId", "parallelGroupId", "worktreePath", "branch", "openspecChange", "status", "timestamps", "projectRulesReadBack", "dependencySync", "commits", "verification", "error"]) if (!(field in data)) findings.push({ code: "RUNNER_EVENT_FIELD_MISSING", field })
  if (data.schemaVersion !== "runner-event/v1") findings.push({ code: "SCHEMA_VERSION_INVALID" })
  if (data.run_id !== runId || data.classificationId !== classificationId) findings.push({ code: "RUNNER_EVENT_ID_MISMATCH" })
  if (data.branch && !String(data.branch).startsWith(`worktree/${runId}/`)) findings.push({ code: "WORKTREE_BRANCH_NAMESPACE_INVALID" })
  for (const field of ["specCommit", "implementationCommits", "testCommits", "fixCommits", "documentationCommits"]) if (!data.commits || !(field in data.commits)) findings.push({ code: "RUNNER_EVENT_COMMITS_FIELD_MISSING", field })
  if (!data.verification || !Array.isArray(data.verification.local)) findings.push({ code: "RUNNER_EVENT_VERIFICATION_LOCAL_MISSING" })
}
const status = findings.length ? "failed" : "passed"
console.log(JSON.stringify({ schemaVersion: "schema-validation/v1", run_id: runId, status, target: rel(file), findings }, null, 2))
process.exit(status === "passed" ? 0 : 1)
