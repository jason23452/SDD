#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, commonArtifact, exitForStatus, output, parseArgs, printAndExitUsage, readJson, rel, resolveOutPath, resolveRoot, sha256File, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) {
  printAndExitUsage("Usage: node .opencode/scripts/build-verification-matrix.js <run_id> --planner <path> [--planner-index <path>] [--verification-contract <path>] [--check] [--json] [--out <path>] [--strict]")
}

const runId = positional[0]
const planner = flags.planner ? resolveRoot(flags.planner) : null
const plannerHash = planner ? sha256File(planner) : null
const plannerIndexPath = flags["planner-index"] ? resolveRoot(flags["planner-index"]) : path.join(artifactDir(runId), "planner-index.json")
const verificationContractPath = flags["verification-contract"] ? resolveRoot(flags["verification-contract"]) : path.join(artifactDir(runId), "skill-driven-verification-contract.json")

const plannerIndex = readJson(plannerIndexPath)
const verificationContract = readJson(verificationContractPath)
const verificationSections = verificationContract && Array.isArray(verificationContract.verificationSections)
  ? verificationContract.verificationSections
  : []
const runnerLocal = verificationContract && Array.isArray(verificationContract.runnerLocalChecks) ? verificationContract.runnerLocalChecks : []
const stageIntegration = verificationContract && Array.isArray(verificationContract.stageIntegrationChecks) ? verificationContract.stageIntegrationChecks : []
const finalOnly = verificationContract && Array.isArray(verificationContract.finalOnlyChecks) ? verificationContract.finalOnlyChecks : []

const blockers = []
if (!plannerHash) blockers.push("PLANNER_MISSING")
if (!verificationContract) blockers.push("SKILL_DRIVEN_VERIFICATION_CONTRACT_MISSING")
if (verificationContract && verificationContract.status !== "planned" && verificationContract.status !== "passed") blockers.push("SKILL_DRIVEN_VERIFICATION_CONTRACT_BLOCKED")
if (verificationContract && verificationSections.length === 0) blockers.push("SKILL_DRIVEN_VERIFICATION_CONTRACT_EMPTY")
if (plannerHash && runnerLocal.length + stageIntegration.length + finalOnly.length === 0) blockers.push("VERIFICATION_MATRIX_EMPTY")

const out = resolveOutPath(path.join(artifactDir(runId), "verification-matrix.json"), flags)
const matrix = commonArtifact(
  "verification-matrix/v1",
  runId,
  blockers.length ? "blocked" : "planned",
  "read skill-driven verification contract or full planner verification section",
  {
    blockers,
    sourceRefs: [
      ...(planner ? [{ kind: "planner", path: rel(planner), sha256: plannerHash, requiredFor: "verification matrix context", fallbackAction: "read full planner" }] : []),
      ...(plannerIndex ? [{ kind: "planner-index", path: rel(plannerIndexPath), sha256: sha256File(plannerIndexPath), requiredFor: "verification matrix context", fallbackAction: "read planner index" }] : []),
      ...(verificationContract ? [{ kind: "skill-driven-verification-contract", path: rel(verificationContractPath), sha256: sha256File(verificationContractPath), requiredFor: "verification matrix authority", fallbackAction: "read active skill selection contract, active skills, project-rules lock, skill-lock, and planner verification section" }] : []),
    ],
    plannerIndexRef: plannerIndex ? rel(plannerIndexPath) : null,
    verificationContractRef: verificationContract ? rel(verificationContractPath) : null,
    verificationSections,
    runnerLocal,
    stageIntegration,
    finalOnly,
  },
)

writeJson(out, matrix, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${matrix.status}`, {
  schemaVersion: "script-result/v1",
  status: matrix.status,
  path: rel(out),
  artifact: matrix,
})
exitForStatus(matrix.status, flags)
