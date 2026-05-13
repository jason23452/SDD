#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, commonArtifact, parseArgs, printAndExitUsage, readJson, rel, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-context-slices.js <run_id> --ready-wave <id> [--check]")
const runId = positional[0]
const readyWave = flags["ready-wave"] || null
const ledger = readJson(path.join(artifactDir(runId), "dispatch-ledger.json"))
const expected = []
if (ledger && Array.isArray(ledger.stages)) {
  for (const stage of ledger.stages) for (const set of stage.eligibleSets || []) for (const wt of set.expectedWorktrees || []) expected.push({ stage: stage.stage, set, wt })
}
if (expected.length === 0) expected.push({ stage: null, set: {}, wt: { classificationId: "placeholder", name: "placeholder" } })
for (const item of expected) {
  const id = item.wt.classificationId || item.wt.name
  const out = path.join(artifactDir(runId), "context-slices", `${id}.json`)
  const slice = commonArtifact("context-slice/v1", runId, readyWave ? "planned" : "blocked", "read full planner and dispatch ledger", {
    blockers: readyWave ? [] : ["READY_WAVE_MISSING"],
    classificationId: id,
    readyWaveId: item.set.readyWaveId || readyWave,
    eligibleSetId: item.set.eligibleSetId || null,
    worktreePath: item.wt.worktreePath || null,
    branch: item.wt.branch || null,
  })
  writeJson(out, slice, Boolean(flags.check))
  console.log(`${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${slice.status}`)
}
