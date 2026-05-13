#!/usr/bin/env node
const path = require("node:path")
const { existsSync } = require("node:fs")
const { artifactDir, commonArtifact, output, parseArgs, printAndExitUsage, readJson, rel, sha256File, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-barrier-preflight.js <run_id> --stage <n> --wave <id> [--check]")
const runId = positional[0]
const stage = Number(flags.stage || 1)
const wave = flags.wave || `stage-${stage}/wave-1`
const ledgerPath = path.join(artifactDir(runId), "dispatch-ledger.json")
const ledger = readJson(ledgerPath)
const expected = []
if (ledger && Array.isArray(ledger.stages)) {
  for (const stageEntry of ledger.stages.filter((item) => Number(item.stage) === stage)) {
    for (const set of stageEntry.eligibleSets || []) {
      if (!wave || set.readyWaveId === wave) expected.push(...(set.expectedWorktrees || []))
    }
  }
}
const blockers = []
if (!ledger) blockers.push("DISPATCH_LEDGER_MISSING")
if (ledger && expected.length === 0) blockers.push("EXPECTED_WORKTREES_MISSING")
const runnerEvents = expected.map((worktree) => ({ classificationId: worktree.classificationId, path: worktree.runnerEventPath || null, exists: worktree.runnerEventPath ? existsSync(path.resolve(worktree.runnerEventPath)) : false }))
if (runnerEvents.some((event) => !event.exists)) blockers.push("RUNNER_EVENT_MISSING")
const out = path.join(artifactDir(runId), "barrier-preflight", `stage-${stage}-wave-${String(wave).replace(/[\\/]/g, "-")}.json`)
const preflight = commonArtifact("barrier-preflight/v1", runId, blockers.length ? "blocked" : "passed", "read full dispatch ledger and runner events", {
  blockers,
  sourceRefs: [{ kind: "dispatch-ledger", path: rel(ledgerPath), sha256: sha256File(ledgerPath), requiredFor: "barrier" }],
  sourceHashes: { dispatchLedger: sha256File(ledgerPath) },
  stage,
  readyWaveId: wave,
  expectedWorktreeCount: expected.length,
  runnerEvents,
})
writeJson(out, preflight, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${preflight.status}`, { schemaVersion: "script-result/v1", status: preflight.status, path: rel(out), artifact: preflight })
