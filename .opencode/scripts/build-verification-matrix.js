#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, commonArtifact, exitForStatus, output, parseArgs, printAndExitUsage, readJson, readText, rel, resolveOutPath, resolveRoot, sha256File, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-verification-matrix.js <run_id> --planner <path> [--planner-index <path>] [--check] [--json] [--out <path>] [--strict]")
const runId = positional[0]
const planner = flags.planner ? resolveRoot(flags.planner) : null
const plannerHash = planner ? sha256File(planner) : null
const plannerIndexPath = flags["planner-index"] ? resolveRoot(flags["planner-index"]) : path.join(artifactDir(runId), "planner-index.json")
const plannerIndex = readJson(plannerIndexPath)
const verificationSections = plannerIndex && plannerIndex.sectionRefs && Array.isArray(plannerIndex.sectionRefs.verification) ? plannerIndex.sectionRefs.verification : []
const plannerText = plannerHash ? readText(planner) : ""
const text = verificationSections.length && plannerHash ? verificationSections.map((section) => plannerText.split(/\r?\n/).slice(section.line - 1, section.endLine).join("\n")).join("\n").toLowerCase() : plannerText.toLowerCase()
function includesAny(words) {
  return words.some((word) => text.includes(word))
}
const runnerLocal = []
const stageIntegration = []
const finalOnly = []
if (includesAny(["frontend", "react", "vite", "ui", "tailwind", "browser"])) runnerLocal.push({ id: "frontend-local", commandHint: "frontend local/unit test command resolved from project rules, package scripts, and test config", requiredWhen: "frontend/fullstack files changed" })
if (includesAny(["backend", "fastapi", "api", "pytest", "database", "migration"])) runnerLocal.push({ id: "backend-local", commandHint: "backend/Python test command resolved from active backend skill and backend test entry", requiredWhen: "backend/fullstack files changed" })
if (includesAny(["fullstack", "e2e", "playwright", "browser", "contract"])) stageIntegration.push({ id: "fullstack-contract", commandHint: "browser/E2E/integration verification resolved from active frontend skill and detected browser config", requiredWhen: "frontend and backend contract touched" })
if (includesAny(["final", "全量", "整體", "regression", "release"])) finalOnly.push({ id: "final-regression", commandHint: "final-only full verification from planner", requiredWhen: "final integration" })
const blockers = []
if (!plannerHash) blockers.push("PLANNER_MISSING")
if (plannerHash && verificationSections.length === 0) blockers.push("VERIFICATION_SECTION_MISSING")
if (plannerHash && runnerLocal.length + stageIntegration.length + finalOnly.length === 0) blockers.push("VERIFICATION_MATRIX_EMPTY")
const out = resolveOutPath(path.join(artifactDir(runId), "verification-matrix.json"), flags)
const matrix = commonArtifact("verification-matrix/v1", runId, blockers.length ? "blocked" : "planned", "read full planner verification section", {
  blockers,
  sourceRefs: planner ? [{ kind: "planner", path: rel(planner), sha256: plannerHash, requiredFor: "verification matrix", fallbackAction: "read full planner" }, ...(plannerIndex ? [{ kind: "planner-index", path: rel(plannerIndexPath), sha256: sha256File(plannerIndexPath), requiredFor: "verification matrix", fallbackAction: "read planner index" }] : [])] : [],
  plannerIndexRef: plannerIndex ? rel(plannerIndexPath) : null,
  verificationSections,
  runnerLocal,
  stageIntegration,
  finalOnly,
})
writeJson(out, matrix, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${matrix.status}`, { schemaVersion: "script-result/v1", status: matrix.status, path: rel(out), artifact: matrix })
exitForStatus(matrix.status, flags)
