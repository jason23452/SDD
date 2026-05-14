#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, exitForStatus, head, output, parseArgs, printAndExitUsage, rel, resolveOutPath, resolveRoot, sha256File, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-dispatch-ledger-skeleton.js <run_id> --planner <path> [--stage <n>] [--check] [--json] [--out <path>] [--strict]")
const runId = positional[0]
const planner = flags.planner ? resolveRoot(flags.planner) : null
const stage = Number(flags.stage || 1)
const now = new Date().toISOString()
const out = resolveOutPath(path.join(artifactDir(runId), "dispatch-ledger.json"), flags)
const ledger = {
  schemaVersion: "dispatch-ledger/v1",
  run_id: runId,
  createdAt: now,
  updatedAt: now,
  bootstrapBranch: null,
  bootstrapCommit: head(),
  plannerPath: planner ? rel(planner) : null,
  projectRulesHash: sha256File(path.resolve(".opencode/project-rules.md")),
  dependencySnapshotManifest: `.opencode/run-artifacts/${runId}/dependency-readiness.json`,
  stages: [{ stage, baseline: head(), baselineSource: "bootstrap", readyWaves: [], readyEligibleSetIds: [], status: "planned", eligibleSets: [] }],
}
writeJson(out, ledger, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} stage=${stage}`, { schemaVersion: "script-result/v1", status: "planned", path: rel(out), artifact: ledger })
exitForStatus("planned", flags)
