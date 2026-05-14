#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, exitForStatus, output, parseArgs, printAndExitUsage, readJson, rel, resolveOutPath, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 2) printAndExitUsage("Usage: node .opencode/scripts/build-runner-event-skeleton.js <run_id> <classification_id> [--wave <id>] [--eligible-set <id>] [--branch <branch>] [--check] [--json] [--out <path>] [--strict]")
const [runId, classificationId] = positional
const ledger = readJson(path.join(artifactDir(runId), "dispatch-ledger.json"))
let found = null
if (ledger && Array.isArray(ledger.stages)) {
  for (const stage of ledger.stages) for (const set of stage.eligibleSets || []) for (const wt of set.expectedWorktrees || []) {
    if (wt.classificationId === classificationId || wt.name === classificationId) found = { stage, set, wt }
  }
}
const out = resolveOutPath(path.join(artifactDir(runId), "runner-events", `${classificationId}.json`), flags)
const event = {
  schemaVersion: "runner-event/v1",
  run_id: runId,
  classificationId,
  readyWaveId: flags.wave || (found && found.set.readyWaveId) || null,
  eligibleSetId: flags["eligible-set"] || (found && found.set.eligibleSetId) || null,
  parallelGroupId: flags["parallel-group"] || (found && found.set.parallelGroupId) || null,
  worktreePath: flags.worktree || (found && found.wt.worktreePath) || null,
  branch: flags.branch || (found && found.wt.branch) || `worktree/${runId}/${classificationId}`,
  openspecChange: flags.change || (found && found.wt.openspecChange) || null,
  status: "planned",
  timestamps: { createdAt: new Date().toISOString() },
  projectRulesReadBack: [],
  dependencySync: {},
  commits: { specCommit: null, implementationCommits: [], testCommits: [], fixCommits: [], documentationCommits: [] },
  verification: { local: [] },
  error: null,
}
writeJson(out, event, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${event.status}`, { schemaVersion: "script-result/v1", status: event.status, path: rel(out), artifact: event })
exitForStatus(event.status, flags)
