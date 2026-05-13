#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, commonArtifact, parseArgs, printAndExitUsage, rel, resolveRoot, sha256File, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-experience-contract.js <run_id> [--planner <path>] [--check]")

const runId = positional[0]
const planner = flags.planner ? resolveRoot(flags.planner) : null
const plannerHash = planner ? sha256File(planner) : null
const blockers = planner && !plannerHash ? ["PLANNER_MISSING"] : []
const out = path.join(artifactDir(runId), "experience-contract.json")
const contract = commonArtifact("experience-contract/v1", runId, blockers.length ? "blocked" : "planned", "read full planner experience contract section", {
  blockers,
  sourceRefs: planner ? [{ kind: "planner", path: rel(planner), sha256: plannerHash, requiredFor: "experience contract", fallbackAction: "read full planner" }] : [],
  sourceHashes: { planner: plannerHash },
  routes: [],
  states: ["loading", "empty", "error", "success", "disabled"],
  responsiveTargets: ["mobile", "desktop"],
  accessibility: ["focus-visible", "keyboard", "screen-reader labels where applicable"],
  visualVerification: "required when frontend/fullstack active; skipped/blocked must state reason",
})
writeJson(out, contract, Boolean(flags.check))
console.log(`${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${contract.status}`)
