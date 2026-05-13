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
  const classificationIds = new Set()
  const branches = new Set()
  if (Array.isArray(data.stages)) data.stages.forEach((stage, stageIndex) => {
    for (const field of ["stage", "baseline", "baselineSource", "readyWaves", "readyEligibleSetIds", "status", "eligibleSets"]) if (!(field in stage)) findings.push({ code: "DISPATCH_LEDGER_STAGE_FIELD_MISSING", stageIndex, field })
    if (!Array.isArray(stage.readyWaves)) findings.push({ code: "DISPATCH_LEDGER_READY_WAVES_INVALID", stageIndex })
    if (!Array.isArray(stage.eligibleSets)) findings.push({ code: "DISPATCH_LEDGER_ELIGIBLE_SETS_INVALID", stageIndex })
    for (const set of stage.eligibleSets || []) {
      for (const field of ["eligibleSetId", "parallelGroupId", "lane", "priority", "readyWaveId", "status", "expectedWorktrees", "runnerDispatchPackets", "runnerEventPaths", "timestamps", "error", "retryCount"]) if (!(field in set)) findings.push({ code: "DISPATCH_LEDGER_SET_FIELD_MISSING", stage: stage.stage, field })
      if (!Array.isArray(set.expectedWorktrees)) findings.push({ code: "DISPATCH_LEDGER_EXPECTED_WORKTREES_INVALID", eligibleSetId: set.eligibleSetId })
      for (const wt of set.expectedWorktrees || []) {
        for (const field of ["classificationId", "name", "worktreePath", "branch", "openspecChange", "runnerEventPath", "ports", "status", "commits", "verification", "error"]) if (!(field in wt)) findings.push({ code: "DISPATCH_LEDGER_WORKTREE_FIELD_MISSING", eligibleSetId: set.eligibleSetId, field })
        if (wt.classificationId) {
          if (classificationIds.has(wt.classificationId)) findings.push({ code: "DISPATCH_LEDGER_DUPLICATE_CLASSIFICATION", classificationId: wt.classificationId })
          classificationIds.add(wt.classificationId)
        }
        if (wt.branch) {
          if (!String(wt.branch).startsWith(`worktree/${runId}/`)) findings.push({ code: "WORKTREE_BRANCH_NAMESPACE_INVALID", branch: wt.branch })
          if (branches.has(wt.branch)) findings.push({ code: "DISPATCH_LEDGER_DUPLICATE_BRANCH", branch: wt.branch })
          branches.add(wt.branch)
        }
        if (!wt.runnerEventPath) findings.push({ code: "DISPATCH_LEDGER_RUNNER_EVENT_PATH_MISSING", classificationId: wt.classificationId })
      }
    }
  })
}
const status = findings.length ? "failed" : "passed"
console.log(JSON.stringify({ schemaVersion: "schema-validation/v1", run_id: runId, status, target: rel(file), findings }, null, 2))
process.exit(status === "passed" ? 0 : 1)
