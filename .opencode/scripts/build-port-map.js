#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, commonArtifact, output, parseArgs, printAndExitUsage, readJson, rel, sha256File, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-port-map.js <run_id> --stage <n> --wave <id> [--check]")
const runId = positional[0]
const stage = Number(flags.stage || 1)
const base = 15000 + stage * 100
const wave = flags.wave || null
const ledgerPath = path.join(artifactDir(runId), "dispatch-ledger.json")
const ledger = readJson(ledgerPath)
const expected = []
if (ledger && Array.isArray(ledger.stages)) {
  for (const stageEntry of ledger.stages.filter((item) => Number(item.stage) === stage)) {
    for (const set of stageEntry.eligibleSets || []) {
      if (wave && set.readyWaveId !== wave) continue
      for (const wt of set.expectedWorktrees || []) expected.push({ set, wt })
    }
  }
}
const blockers = []
if (!ledger) blockers.push("DISPATCH_LEDGER_MISSING")
if (ledger && expected.length === 0) blockers.push("EXPECTED_WORKTREES_MISSING")
const ports = expected.map((item, index) => {
  const offset = base + index * 10
  return {
    owner: item.wt.classificationId || item.wt.name,
    classificationId: item.wt.classificationId || null,
    eligibleSetId: item.set.eligibleSetId || null,
    readyWaveId: item.set.readyWaveId || wave,
    frontendDev: offset + 1,
    frontendPreview: offset + 2,
    backendApi: offset + 3,
    e2eBase: offset + 4,
    postgresHost: offset + 5,
    redisHost: offset + 6,
  }
})
ports.push({ owner: "integration", readyWaveId: wave, frontendDev: base + 91, frontendPreview: base + 92, backendApi: base + 93, e2eBase: base + 94, postgresHost: base + 95, redisHost: base + 96 })
const out = path.join(artifactDir(runId), "port-map.json")
const portMap = commonArtifact("port-registry/v1", runId, blockers.length ? "blocked" : "planned", "recompute deterministic port map from planner", {
  blockers,
  sourceRefs: [{ kind: "dispatch-ledger", path: rel(ledgerPath), sha256: sha256File(ledgerPath), requiredFor: "port map", fallbackAction: "read full dispatch ledger" }],
  sourceHashes: { dispatchLedger: sha256File(ledgerPath) },
  stage,
  readyWaveId: wave,
  ports,
})
writeJson(out, portMap, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} base=${base}`, { schemaVersion: "script-result/v1", status: portMap.status, path: rel(out), artifact: portMap })
