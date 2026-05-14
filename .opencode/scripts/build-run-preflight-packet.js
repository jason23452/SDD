#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, commonArtifact, exitForStatus, output, parseArgs, printAndExitUsage, rel, resolveOutPath, resolveRoot, sha256File, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-run-preflight-packet.js <run_id> --planner <path> [--check] [--json] [--out <path>] [--strict]")
const runId = positional[0]
const planner = flags.planner ? resolveRoot(flags.planner) : null
const out = resolveOutPath(path.join(artifactDir(runId), "run-preflight-packet.json"), flags)
const packet = commonArtifact("run-preflight-packet/v1", runId, planner && sha256File(planner) ? "passed" : "blocked", "read full planner and project rules", {
  blockers: planner && sha256File(planner) ? [] : ["PLANNER_MISSING"],
  sourceRefs: planner ? [{ kind: "planner", path: rel(planner), sha256: sha256File(planner), requiredFor: "run preflight", fallbackAction: "read full planner" }] : [],
  sourceHashes: { planner: planner ? sha256File(planner) : null },
  activeSkillsRef: ".opencode/project-rules.md",
  packageDecisionRecordRef: `.opencode/run-artifacts/${runId}/package-decision-record.json`,
  experienceContractRef: `.opencode/run-artifacts/${runId}/experience-contract.json`,
  verificationMatrixRef: `.opencode/run-artifacts/${runId}/verification-matrix.json`,
  contextSlicesDir: `.opencode/run-artifacts/${runId}/context-slices`,
})
writeJson(out, packet, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${packet.status}`, { schemaVersion: "script-result/v1", status: packet.status, path: rel(out), artifact: packet })
exitForStatus(packet.status, flags)
