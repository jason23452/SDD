#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, commonArtifact, parseArgs, printAndExitUsage, rel, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-port-map.js <run_id> --stage <n> --wave <id> [--check]")
const runId = positional[0]
const stage = Number(flags.stage || 1)
const base = 15000 + stage * 100
const out = path.join(artifactDir(runId), "port-map.json")
const portMap = commonArtifact("port-registry/v1", runId, "planned", "recompute deterministic port map from planner", {
  readyWaveId: flags.wave || null,
  ports: [{ owner: "integration", frontendDev: base + 1, frontendPreview: base + 2, backendApi: base + 3, e2eBase: base + 4, postgresHost: base + 5, redisHost: base + 6 }],
})
writeJson(out, portMap, Boolean(flags.check))
console.log(`${flags.check ? "would write" : "wrote"}: ${rel(out)} base=${base}`)
