#!/usr/bin/env node
const path = require("node:path")
const { existsSync } = require("node:fs")
const { artifactDir, git, parseArgs, printAndExitUsage, readJson, rel, resolveRoot, walkFiles } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/check-artifact-crossrefs.js <run_id> [--strict]")

const runId = positional[0]
const root = artifactDir(runId)
const findings = []
const ledger = readJson(path.join(root, "dispatch-ledger.json"))
const portMap = readJson(path.join(root, "port-map.json")) || readJson(path.join(root, "port-registry.json"))
const commitSummaryDir = path.join(root, "commit-metadata-summary")
const verificationMatrix = readJson(path.join(root, "verification-matrix.json"))
const finalReportIndex = readJson(path.join(root, "final-report-index.json"))

function existsRef(ref, code, owner) {
  if (!ref) return
  const file = resolveRoot(ref)
  if (!existsSync(file)) findings.push({ code, owner, ref })
}

function existsAnyRef(refs, code, owner) {
  if (refs.some((ref) => ref && existsSync(resolveRoot(ref)))) return
  findings.push({ code, owner, ref: refs.filter(Boolean).join(" | ") })
}

function firstExistingRef(refs) {
  return refs.find((ref) => ref && existsSync(resolveRoot(ref))) || null
}

function commitExists(hash) {
  return git(["cat-file", "-t", hash]) === "commit"
}

if (ledger && Array.isArray(ledger.stages)) {
  const expected = []
  for (const stage of ledger.stages) for (const set of stage.eligibleSets || []) for (const wt of set.expectedWorktrees || []) expected.push({ set, wt })
  const portOwners = new Set((portMap && portMap.ports || []).map((port) => port.classificationId || port.owner).filter(Boolean))
  for (const item of expected) {
    const id = item.wt.classificationId || item.wt.name
    const contextPath = `.opencode/run-artifacts/${runId}/context-slices/${id}.json`
    existsRef(contextPath, "CONTEXT_SLICE_MISSING", id)
    const context = readJson(resolveRoot(contextPath))
    if (context) {
      if (context.branch && item.wt.branch && context.branch !== item.wt.branch) findings.push({ code: "CONTEXT_BRANCH_MISMATCH", owner: id, expected: item.wt.branch, actual: context.branch })
      if (context.eligibleSetId && context.eligibleSetId !== item.set.eligibleSetId) findings.push({ code: "CONTEXT_ELIGIBLE_SET_MISMATCH", owner: id, expected: item.set.eligibleSetId, actual: context.eligibleSetId })
    }
    const runnerRefs = [item.wt.runnerEventPath, `.opencode/run-artifacts/${runId}/runner-events/${id}.json`]
    existsAnyRef(runnerRefs, "RUNNER_EVENT_REF_MISSING", id)
    const runnerRef = firstExistingRef(runnerRefs)
    const runner = runnerRef ? readJson(resolveRoot(runnerRef)) : null
    if (runner) {
      if (runner.branch && item.wt.branch && runner.branch !== item.wt.branch) findings.push({ code: "RUNNER_BRANCH_MISMATCH", owner: id, expected: item.wt.branch, actual: runner.branch })
      if (runner.eligibleSetId && runner.eligibleSetId !== item.set.eligibleSetId) findings.push({ code: "RUNNER_ELIGIBLE_SET_MISMATCH", owner: id, expected: item.set.eligibleSetId, actual: runner.eligibleSetId })
      if (runner.status === "completed" && (!runner.commits || !runner.commits.specCommit)) findings.push({ code: "RUNNER_SPEC_COMMIT_MISSING", owner: id })
      const summary = readJson(path.join(commitSummaryDir, `${id}.json`))
      if (runner.status === "completed" && summary) {
        const summaryCommits = new Set((summary.commits || []).map((commit) => commit.hash).filter(Boolean))
        const runnerCommits = [runner.commits && runner.commits.specCommit, ...((runner.commits && runner.commits.implementationCommits) || []), ...((runner.commits && runner.commits.testCommits) || []), ...((runner.commits && runner.commits.fixCommits) || []), ...((runner.commits && runner.commits.documentationCommits) || [])].filter(Boolean)
        for (const commit of runnerCommits) if (!summaryCommits.has(commit)) findings.push({ code: "COMMIT_SUMMARY_MISSING_RUNNER_COMMIT", owner: id, commit })
      }
      if (runner.status === "completed" && !summary) findings.push({ code: "COMMIT_SUMMARY_MISSING", owner: id })
    }
    if (item.wt.branch && !item.wt.branch.startsWith(`worktree/${runId}/`)) findings.push({ code: "WORKTREE_BRANCH_NAMESPACE_INVALID", owner: id, branch: item.wt.branch })
    if (portMap && !portOwners.has(id)) findings.push({ code: "PORT_OWNER_MISSING", owner: id })
  }
}

for (const ref of ["package-decision-record.json", "experience-contract.json", "verification-matrix.json"]) existsRef(`.opencode/run-artifacts/${runId}/${ref}`, "RUN_LEVEL_REF_MISSING", ref)

const commitSummaries = walkFiles(commitSummaryDir).filter((file) => file.endsWith(".json")).map((file) => ({ file, data: readJson(file) })).filter((item) => item.data)
for (const item of commitSummaries) {
  for (const commit of item.data.commits || []) {
    if (commit.hash && !commitExists(commit.hash)) findings.push({ code: "COMMIT_METADATA_COMMIT_NOT_FOUND", file: rel(item.file), commit: commit.hash })
  }
}

if (finalReportIndex && commitSummaries.length > 0) {
  const indexed = new Set((finalReportIndex.commitMap || []).map((commit) => commit.hash).filter(Boolean))
  for (const item of commitSummaries) for (const commit of item.data.commits || []) if (commit.hash && !indexed.has(commit.hash)) findings.push({ code: "FINAL_REPORT_INDEX_MISSING_COMMIT", file: rel(item.file), commit: commit.hash })
}

if (verificationMatrix) {
  const required = [...(verificationMatrix.runnerLocal || []), ...(verificationMatrix.stageIntegration || []), ...(verificationMatrix.finalOnly || [])].map((check) => check.id).filter(Boolean)
  if (required.length > 0) {
    const summaries = walkFiles(path.join(root, "verification-summary")).filter((file) => file.endsWith(".json")).map((file) => readJson(file)).filter(Boolean)
    const covered = new Set()
    for (const summary of summaries) {
      for (const check of summary.checks || summary.verification || summary.results || []) if (check.id) covered.add(check.id)
      if (summary.checkId) covered.add(summary.checkId)
    }
    for (const id of required) if (!covered.has(id)) findings.push({ code: "VERIFICATION_SUMMARY_MISSING_MATRIX_CHECK", checkId: id })
  }
}

const status = findings.length ? "failed" : "passed"
console.log(JSON.stringify({ schemaVersion: "schema-validation/v1", run_id: runId, status, checkedAt: new Date().toISOString(), findings }, null, 2))
process.exit(status === "passed" || !flags.strict ? 0 : 1)
