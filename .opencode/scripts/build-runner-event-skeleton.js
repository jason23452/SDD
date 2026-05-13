#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, parseArgs, printAndExitUsage, rel, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 2) printAndExitUsage("Usage: node .opencode/scripts/build-runner-event-skeleton.js <run_id> <classification_id> [--wave <id>] [--eligible-set <id>] [--branch <branch>] [--check]")
const [runId, classificationId] = positional
const out = path.join(artifactDir(runId), "runner-events", `${classificationId}.json`)
const event = {
  schemaVersion: "runner-event/v1",
  run_id: runId,
  classificationId,
  readyWaveId: flags.wave || null,
  eligibleSetId: flags["eligible-set"] || null,
  parallelGroupId: flags["parallel-group"] || null,
  worktreePath: flags.worktree || null,
  branch: flags.branch || `worktree/${runId}/${classificationId}`,
  openspecChange: flags.change || null,
  status: "planned",
  timestamps: { createdAt: new Date().toISOString() },
  projectRulesReadBack: [],
  dependencySync: {},
  commits: { specCommit: null, implementationCommits: [], testCommits: [], fixCommits: [], documentationCommits: [] },
  verification: { local: [] },
  error: null,
}
writeJson(out, event, Boolean(flags.check))
console.log(`${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${event.status}`)
