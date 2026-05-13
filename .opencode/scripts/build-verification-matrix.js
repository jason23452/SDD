#!/usr/bin/env node
const path = require("node:path")
const { readFileSync } = require("node:fs")
const { artifactDir, commonArtifact, output, parseArgs, printAndExitUsage, rel, resolveRoot, sha256File, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-verification-matrix.js <run_id> --planner <path> [--check]")
const runId = positional[0]
const planner = flags.planner ? resolveRoot(flags.planner) : null
const plannerHash = planner ? sha256File(planner) : null
const text = plannerHash ? readFileSync(planner, "utf8").toLowerCase() : ""
function includesAny(words) {
  return words.some((word) => text.includes(word))
}
const runnerLocal = []
const stageIntegration = []
const finalOnly = []
if (includesAny(["frontend", "react", "vite", "ui", "tailwind", "browser"])) runnerLocal.push({ id: "frontend-local", commandHint: "package script typecheck/build/test when available", requiredWhen: "frontend/fullstack files changed" })
if (includesAny(["backend", "fastapi", "api", "pytest", "database", "migration"])) runnerLocal.push({ id: "backend-local", commandHint: "pytest or existing backend test script", requiredWhen: "backend/fullstack files changed" })
if (includesAny(["fullstack", "e2e", "playwright", "browser", "contract"])) stageIntegration.push({ id: "fullstack-contract", commandHint: "integration contract/browser verification when available", requiredWhen: "frontend and backend contract touched" })
if (includesAny(["final", "全量", "整體", "regression", "release"])) finalOnly.push({ id: "final-regression", commandHint: "final-only full verification from planner", requiredWhen: "final integration" })
const blockers = []
if (!plannerHash) blockers.push("PLANNER_MISSING")
if (plannerHash && runnerLocal.length + stageIntegration.length + finalOnly.length === 0) blockers.push("VERIFICATION_MATRIX_EMPTY")
const out = path.join(artifactDir(runId), "verification-matrix.json")
const matrix = commonArtifact("verification-matrix/v1", runId, blockers.length ? "blocked" : "planned", "read full planner verification section", {
  blockers,
  sourceRefs: planner ? [{ kind: "planner", path: rel(planner), sha256: plannerHash, requiredFor: "verification matrix", fallbackAction: "read full planner" }] : [],
  runnerLocal,
  stageIntegration,
  finalOnly,
})
writeJson(out, matrix, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${matrix.status}`, { schemaVersion: "script-result/v1", status: matrix.status, path: rel(out), artifact: matrix })
