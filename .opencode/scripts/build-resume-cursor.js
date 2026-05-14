#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, commonArtifact, exitForStatus, output, parseArgs, printAndExitUsage, readJson, rel, resolveOutPath, sha256File, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-resume-cursor.js <run_id> [--check] [--json] [--out <path>] [--strict]")

const runId = positional[0]
const ledgerPath = path.join(artifactDir(runId), "dispatch-ledger.json")
const ledger = readJson(ledgerPath)
const blockers = []
let next = null
if (!ledger) blockers.push("DISPATCH_LEDGER_MISSING")
else {
  for (const stage of ledger.stages || []) for (const set of stage.eligibleSets || []) for (const wt of set.expectedWorktrees || []) {
    if (!next && wt.status !== "completed") next = { stage: stage.stage, readyWaveId: set.readyWaveId, eligibleSetId: set.eligibleSetId, classificationId: wt.classificationId, worktreePath: wt.worktreePath, branch: wt.branch, status: wt.status, runnerEventPath: wt.runnerEventPath }
  }
}
const out = resolveOutPath(path.join(artifactDir(runId), "resume-cursor.json"), flags)
const cursor = commonArtifact("resume-cursor/v1", runId, blockers.length ? "blocked" : "planned", "read dispatch ledger and runner events", {
  blockers,
  sourceRefs: [{ kind: "dispatch-ledger", path: rel(ledgerPath), sha256: sha256File(ledgerPath), requiredFor: "resume cursor", fallbackAction: "read full dispatch ledger" }],
  sourceHashes: { dispatchLedger: sha256File(ledgerPath) },
  nextAction: next ? "resume-worktree" : "nothing-to-resume",
  cursor: next,
})
writeJson(out, cursor, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${cursor.status}`, { schemaVersion: "script-result/v1", status: cursor.status, path: rel(out), artifact: cursor })
exitForStatus(cursor.status, flags)
