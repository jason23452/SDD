#!/usr/bin/env node
const path = require("node:path")
const { existsSync } = require("node:fs")
const { artifactDir, parseArgs, printAndExitUsage, readJson, rel, resolveRoot } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/check-artifact-crossrefs.js <run_id> [--strict]")

const runId = positional[0]
const root = artifactDir(runId)
const findings = []
const ledger = readJson(path.join(root, "dispatch-ledger.json"))
const portMap = readJson(path.join(root, "port-map.json")) || readJson(path.join(root, "port-registry.json"))

function existsRef(ref, code, owner) {
  if (!ref) return
  const file = resolveRoot(ref)
  if (!existsSync(file)) findings.push({ code, owner, ref })
}

function existsAnyRef(refs, code, owner) {
  if (refs.some((ref) => ref && existsSync(resolveRoot(ref)))) return
  findings.push({ code, owner, ref: refs.filter(Boolean).join(" | ") })
}

if (ledger && Array.isArray(ledger.stages)) {
  const expected = []
  for (const stage of ledger.stages) for (const set of stage.eligibleSets || []) for (const wt of set.expectedWorktrees || []) expected.push({ set, wt })
  const portOwners = new Set((portMap && portMap.ports || []).map((port) => port.classificationId || port.owner).filter(Boolean))
  for (const item of expected) {
    const id = item.wt.classificationId || item.wt.name
    existsRef(`.opencode/run-artifacts/${runId}/context-slices/${id}.json`, "CONTEXT_SLICE_MISSING", id)
    existsAnyRef([item.wt.runnerEventPath, `.opencode/run-artifacts/${runId}/runner-events/${id}.json`], "RUNNER_EVENT_REF_MISSING", id)
    if (item.wt.branch && !item.wt.branch.startsWith(`worktree/${runId}/`)) findings.push({ code: "WORKTREE_BRANCH_NAMESPACE_INVALID", owner: id, branch: item.wt.branch })
    if (portMap && !portOwners.has(id)) findings.push({ code: "PORT_OWNER_MISSING", owner: id })
  }
}

for (const ref of ["package-decision-record.json", "experience-contract.json", "verification-matrix.json"]) existsRef(`.opencode/run-artifacts/${runId}/${ref}`, "RUN_LEVEL_REF_MISSING", ref)

const status = findings.length ? "failed" : "passed"
console.log(JSON.stringify({ schemaVersion: "schema-validation/v1", run_id: runId, status, checkedAt: new Date().toISOString(), findings }, null, 2))
process.exit(status === "passed" || !flags.strict ? 0 : 1)
