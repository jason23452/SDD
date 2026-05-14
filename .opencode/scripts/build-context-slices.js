#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, commonArtifact, exitForStatus, output, parseArgs, printAndExitUsage, readJson, rel, resolveOutPath, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-context-slices.js <run_id> --ready-wave <id> [--check] [--json] [--out <path>] [--strict]")
const runId = positional[0]
const readyWave = flags["ready-wave"] || null
const ledgerPath = path.join(artifactDir(runId), "dispatch-ledger.json")
const ledger = readJson(ledgerPath)
const packageDecision = readJson(path.join(artifactDir(runId), "package-decision-record.json"))
const experienceContract = readJson(path.join(artifactDir(runId), "experience-contract.json"))
const verificationMatrix = readJson(path.join(artifactDir(runId), "verification-matrix.json"))
const expected = []
if (ledger && Array.isArray(ledger.stages)) {
  for (const stage of ledger.stages) {
    for (const set of stage.eligibleSets || []) {
      if (readyWave && set.readyWaveId !== readyWave) continue
      for (const wt of set.expectedWorktrees || []) expected.push({ stage: stage.stage, set, wt })
    }
  }
}
if (expected.length === 0) {
  const out = resolveOutPath(path.join(artifactDir(runId), "context-slices", "_blocked.json"), flags)
  const blockers = []
  if (!readyWave) blockers.push("READY_WAVE_MISSING")
  if (!ledger) blockers.push("DISPATCH_LEDGER_MISSING")
  else blockers.push("EXPECTED_WORKTREES_MISSING")
  const slice = commonArtifact("context-slice/v1", runId, "blocked", "read full planner and dispatch ledger", {
    blockers,
    sourceRefs: [{ kind: "dispatch-ledger", path: rel(ledgerPath), requiredFor: "context slices", fallbackAction: "read full dispatch ledger" }],
    classificationId: null,
    readyWaveId: readyWave,
    eligibleSetId: null,
  })
  writeJson(out, slice, Boolean(flags.check))
  output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${slice.status}`, { schemaVersion: "script-result/v1", status: slice.status, path: rel(out), artifact: slice })
  exitForStatus(slice.status, flags)
}
for (const item of expected) {
  const id = item.wt.classificationId || item.wt.name
  const out = resolveOutPath(path.join(artifactDir(runId), "context-slices", `${id}.json`), flags)
  const blockers = readyWave ? [] : ["READY_WAVE_MISSING"]
  const slice = commonArtifact("context-slice/v1", runId, blockers.length ? "blocked" : "planned", "read full planner and dispatch ledger", {
    sourceRefs: [{ kind: "dispatch-ledger", path: rel(ledgerPath), requiredFor: "context slice", fallbackAction: "read full dispatch ledger" }],
    blockers: readyWave ? [] : ["READY_WAVE_MISSING"],
    classificationId: id,
    readyWaveId: item.set.readyWaveId || readyWave,
    eligibleSetId: item.set.eligibleSetId || null,
    parallelGroupId: item.set.parallelGroupId || null,
    stage: item.stage,
    name: item.wt.name || null,
    worktreePath: item.wt.worktreePath || null,
    branch: item.wt.branch || null,
    openspecChange: item.wt.openspecChange || null,
    runnerEventPath: item.wt.runnerEventPath || null,
    ports: item.wt.ports || [],
    packageDecisionRef: packageDecision ? `.opencode/run-artifacts/${runId}/package-decision-record.json` : null,
    experienceContractRef: experienceContract ? `.opencode/run-artifacts/${runId}/experience-contract.json` : null,
    verificationMatrixRef: verificationMatrix ? `.opencode/run-artifacts/${runId}/verification-matrix.json` : null,
  })
  writeJson(out, slice, Boolean(flags.check))
  output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${slice.status}`, { schemaVersion: "script-result/v1", status: slice.status, path: rel(out), artifact: slice })
  exitForStatus(slice.status, flags)
}
