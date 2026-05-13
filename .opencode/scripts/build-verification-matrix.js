#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, commonArtifact, parseArgs, printAndExitUsage, rel, resolveRoot, sha256File, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-verification-matrix.js <run_id> --planner <path> [--check]")
const runId = positional[0]
const planner = flags.planner ? resolveRoot(flags.planner) : null
const out = path.join(artifactDir(runId), "verification-matrix.json")
const matrix = commonArtifact("verification-matrix/v1", runId, planner && sha256File(planner) ? "planned" : "blocked", "read full planner verification section", {
  blockers: planner && sha256File(planner) ? [] : ["PLANNER_MISSING"],
  sourceRefs: planner ? [{ kind: "planner", path: rel(planner), sha256: sha256File(planner), requiredFor: "verification matrix", fallbackAction: "read full planner" }] : [],
  runnerLocal: [],
  stageIntegration: [],
  finalOnly: [],
})
writeJson(out, matrix, Boolean(flags.check))
console.log(`${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${matrix.status}`)
