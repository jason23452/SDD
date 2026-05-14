#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, commonArtifact, exitForStatus, output, parseArgs, printAndExitUsage, readJson, rel, resolveOutPath, resolveRoot, sha256File, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-skill-driven-verification-contract.js <run_id> --planner <path> [--planner-index <path>] [--check] [--json] [--out <path>] [--strict]")

const runId = positional[0]
const planner = flags.planner ? resolveRoot(flags.planner) : null
const plannerHash = planner ? sha256File(planner) : null
const plannerIndexPath = flags["planner-index"] ? resolveRoot(flags["planner-index"]) : path.join(artifactDir(runId), "planner-index.json")
const plannerIndex = readJson(plannerIndexPath)
const verificationSections = plannerIndex && plannerIndex.sectionRefs && Array.isArray(plannerIndex.sectionRefs.verification) ? plannerIndex.sectionRefs.verification : []

const blockers = []
if (!plannerHash) blockers.push("PLANNER_MISSING")
if (plannerHash && verificationSections.length === 0) blockers.push("VERIFICATION_SECTION_MISSING")

const out = resolveOutPath(path.join(artifactDir(runId), "skill-driven-verification-contract.json"), flags)
const artifact = commonArtifact("skill-driven-verification-contract/v1", runId, blockers.length ? "blocked" : "planned", "read active skills, project rules, and full planner verification section", {
  blockers,
  sourceRefs: [
    ...(planner ? [{ kind: "planner", path: rel(planner), sha256: plannerHash, requiredFor: "skill-driven verification contract", fallbackAction: "read full planner" }] : []),
    ...(plannerIndex ? [{ kind: "planner-index", path: rel(plannerIndexPath), sha256: sha256File(plannerIndexPath), requiredFor: "skill-driven verification contract", fallbackAction: "read planner index" }] : []),
  ],
  sourceHashes: { planner: plannerHash },
  plannerIndexRef: plannerIndex ? rel(plannerIndexPath) : null,
  contractPolicy: "skills-first, project-rules-second, existing-project-entry-third; agent and script layers must not infer or hardcode tool selection",
  verificationSections,
  runnerLocalChecks: verificationSections.length ? [{ id: "runner-local-skill-driven", commandHint: "resolved from active skills and explicit project verification inputs", requiredWhen: "defined by active skill and planner verification section" }] : [],
  stageIntegrationChecks: verificationSections.length ? [{ id: "stage-integration-skill-driven", commandHint: "resolved from active skills and explicit project verification inputs", requiredWhen: "defined by active skill and planner verification section" }] : [],
  finalOnlyChecks: verificationSections.length ? [{ id: "final-verification-skill-driven", commandHint: "resolved from active skills and explicit project verification inputs", requiredWhen: "defined by active skill and planner verification section" }] : [],
})

writeJson(out, artifact, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${artifact.status}`, { schemaVersion: "script-result/v1", status: artifact.status, path: rel(out), artifact })
exitForStatus(artifact.status, flags)
