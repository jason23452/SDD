#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, commonArtifact, parseArgs, printAndExitUsage, rel, resolveRoot, sha256File, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-package-decision-record.js <run_id> [--planner <path>] [--check]")

const runId = positional[0]
const planner = flags.planner ? resolveRoot(flags.planner) : null
const plannerHash = planner ? sha256File(planner) : null
const blockers = planner && !plannerHash ? ["PLANNER_MISSING"] : []
const out = path.join(artifactDir(runId), "package-decision-record.json")
const record = commonArtifact("package-decision-record/v1", runId, blockers.length ? "blocked" : "planned", "read full planner package decision section", {
  blockers,
  sourceRefs: planner ? [{ kind: "planner", path: rel(planner), sha256: plannerHash, requiredFor: "package decisions", fallbackAction: "read full planner" }] : [],
  sourceHashes: { planner: plannerHash },
  frontend: [],
  backend: [],
  unresolved: [],
})
writeJson(out, record, Boolean(flags.check))
console.log(`${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${record.status}`)
