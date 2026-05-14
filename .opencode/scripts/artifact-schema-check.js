#!/usr/bin/env node

const { existsSync, readdirSync, readFileSync, statSync } = require("node:fs")
const path = require("node:path")
const { ALLOWED_ARTIFACT_STATUSES, BLOCKING_ARTIFACT_STATUSES } = require("./lib/artifact-utils")

const ROOT = process.cwd()
const DEFAULT_ARTIFACTS_DIR = path.join(ROOT, ".opencode", "run-artifacts")
const JSON_MODE = process.argv.includes("--json")
const STRICT_MODE = process.argv.includes("--strict")
const TARGET_ARG = process.argv.slice(2).find((arg) => !arg.startsWith("--"))
const TARGET = TARGET_ARG ? path.resolve(ROOT, TARGET_ARG) : DEFAULT_ARTIFACTS_DIR
const MAX_JSON_BYTES = 5 * 1024 * 1024
const SKIP_DIRS = new Set([".git", "node_modules", ".worktree", "dist", "build", "coverage", "test-results"])

const COMMON_REQUIRED_SCHEMAS = [
  /-index\/v1$/,
  /-lock\/v1$/,
  /-summary\/v1$/,
  /-compact\/v1$/,
  /-packet\/v1$/,
  /^resume-cursor\/v1$/,
  /^handoff-next-step\/v1$/,
  /^cleanup-plan\/v1$/,
  /^cleanup-locks\/v1$/,
  /^barrier-preflight\/v1$/,
  /^schema-validation\/v1$/,
  /^port-registry\/v1$/,
  /^bug-search-packet\/v1$/,
  /^culprit-score\/v1$/,
  /^run-preflight-packet\/v1$/,
  /^verification-matrix\/v1$/,
  /^package-decision-record\/v1$/,
  /^experience-contract\/v1$/,
  /^context-slice\/v1$/,
  /^openspec-template-contract\/v1$/,
  /^apply-readiness-checklist\/v1$/,
  /^snapshot-manifest\/v1$/,
  /^commit-metadata-summary\/v1$/,
  /^run-metrics-summary\/v1$/,
]

const COMMON_FIELDS = [
  "schemaVersion",
  "run_id",
  "status",
  "blockers",
  "detailRefs",
  "fallbackAction",
]

const results = {
  status: "passed",
  checkedAt: new Date().toISOString(),
  target: path.relative(ROOT, TARGET).replace(/\\/g, "/") || ".",
  checkedFiles: 0,
  skippedFiles: 0,
  findings: [],
}

function addFinding(severity, code, file, message) {
  results.findings.push({ severity, code, file, message })
  if (severity === "error") results.status = "failed"
  if (severity === "warning" && results.status === "passed") results.status = "warning"
}

function walkJsonFiles(dir) {
  if (!existsSync(dir)) return []
  const info = statSync(dir)
  if (info.isFile()) return dir.endsWith(".json") ? [dir] : []
  if (!info.isDirectory()) return []

  const files = []
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const entryPath = path.join(dir, entry)
    const entryInfo = statSync(entryPath)
    if (entryInfo.isDirectory()) files.push(...walkJsonFiles(entryPath))
    if (entryInfo.isFile() && entry.endsWith(".json")) files.push(entryPath)
  }
  return files.sort()
}

function hasAny(obj, keys) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(obj, key))
}

function needsCommonFields(schemaVersion) {
  return COMMON_REQUIRED_SCHEMAS.some((pattern) => pattern.test(schemaVersion))
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/")
}

function checkCommonFields(file, data) {
  for (const field of COMMON_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(data, field)) {
      addFinding("error", "SUMMARY_FIELD_MISSING", rel(file), `Missing required field: ${field}`)
    }
  }

  if (!hasAny(data, ["sourceRefs", "sourceRef", "source"])) {
    addFinding("error", "SOURCE_REFS_MISSING", rel(file), "Missing sourceRefs/sourceRef/source.")
  }

  if (!hasAny(data, ["sourceHashes", "sourceHash", "sourceHead", "head", "HEAD"])) {
    addFinding("error", "SOURCE_HASH_MISSING", rel(file), "Missing sourceHashes/sourceHash/sourceHead/head.")
  }

  if (Object.prototype.hasOwnProperty.call(data, "blockers") && !Array.isArray(data.blockers)) {
    addFinding("error", "BLOCKERS_NOT_ARRAY", rel(file), "blockers must be an array.")
  }

  if (Object.prototype.hasOwnProperty.call(data, "detailRefs") && !Array.isArray(data.detailRefs)) {
    addFinding("error", "DETAIL_REFS_NOT_ARRAY", rel(file), "detailRefs must be an array.")
  }

  if (Object.prototype.hasOwnProperty.call(data, "sourceRefs") && !Array.isArray(data.sourceRefs)) {
    addFinding("error", "SOURCE_REFS_NOT_ARRAY", rel(file), "sourceRefs must be an array when present.")
  }

  if (Object.prototype.hasOwnProperty.call(data, "fallbackAction") && typeof data.fallbackAction !== "string") {
    addFinding("error", "FALLBACK_ACTION_INVALID", rel(file), "fallbackAction must be a string.")
  }

  if (typeof data.fallbackAction === "string" && data.fallbackAction.trim() === "") {
    addFinding("error", "FALLBACK_ACTION_EMPTY", rel(file), "fallbackAction must not be empty.")
  }

  if (typeof data.status === "string" && !ALLOWED_ARTIFACT_STATUSES.has(data.status)) {
    addFinding("warning", "STATUS_UNKNOWN", rel(file), `Unknown status value: ${data.status}`)
  }

  if (!hasAny(data, ["createdAt", "updatedAt", "created_at", "updated_at", "scanTimestamp"])) {
    addFinding("warning", "TIMESTAMP_MISSING", rel(file), "Missing createdAt/updatedAt or equivalent timestamp.")
  }

  if (BLOCKING_ARTIFACT_STATUSES.has(data.status) && Array.isArray(data.blockers) && data.blockers.length === 0) {
    addFinding("warning", "BLOCKED_WITHOUT_BLOCKERS", rel(file), `status=${data.status} but blockers[] is empty.`)
  }
}

function requireField(file, obj, field, code, message) {
  if (!Object.prototype.hasOwnProperty.call(obj, field)) {
    addFinding("error", code, rel(file), message || `Missing required field: ${field}`)
    return false
  }
  return true
}

function requireArray(file, obj, field, code) {
  if (!requireField(file, obj, field, code, `Missing required array field: ${field}`)) return
  if (!Array.isArray(obj[field])) addFinding("error", code, rel(file), `${field} must be an array.`)
}

function checkDispatchLedger(file, data) {
  for (const field of ["run_id", "createdAt", "updatedAt", "bootstrapBranch", "bootstrapCommit", "plannerPath", "projectRulesHash", "dependencySnapshotManifest"]) {
    requireField(file, data, field, "DISPATCH_LEDGER_FIELD_MISSING")
  }
  requireArray(file, data, "stages", "DISPATCH_LEDGER_STAGES_INVALID")

  if (!Array.isArray(data.stages)) return
  data.stages.forEach((stage, stageIndex) => {
    const prefix = `stages[${stageIndex}]`
    for (const field of ["stage", "baseline", "baselineSource", "status"]) {
      if (!Object.prototype.hasOwnProperty.call(stage, field)) addFinding("error", "DISPATCH_LEDGER_STAGE_FIELD_MISSING", rel(file), `${prefix}.${field} is missing.`)
    }
    for (const field of ["readyWaves", "readyEligibleSetIds", "eligibleSets"]) {
      if (!Array.isArray(stage[field])) addFinding("error", "DISPATCH_LEDGER_STAGE_ARRAY_INVALID", rel(file), `${prefix}.${field} must be an array.`)
    }

    if (Array.isArray(stage.readyWaves)) {
      stage.readyWaves.forEach((wave, waveIndex) => {
        for (const field of ["readyWaveId", "stage", "baseline", "laneSelection", "prioritySelection", "readyEligibleSetIds", "status", "timestamps", "error"]) {
          if (!Object.prototype.hasOwnProperty.call(wave, field)) addFinding("error", "DISPATCH_LEDGER_WAVE_FIELD_MISSING", rel(file), `${prefix}.readyWaves[${waveIndex}].${field} is missing.`)
        }
      })
    }

    if (Array.isArray(stage.eligibleSets)) {
      stage.eligibleSets.forEach((set, setIndex) => {
        for (const field of ["eligibleSetId", "parallelGroupId", "lane", "priority", "readyWaveId", "status", "expectedWorktrees", "runnerDispatchPackets", "runnerEventPaths", "timestamps", "error", "retryCount"]) {
          if (!Object.prototype.hasOwnProperty.call(set, field)) addFinding("error", "DISPATCH_LEDGER_SET_FIELD_MISSING", rel(file), `${prefix}.eligibleSets[${setIndex}].${field} is missing.`)
        }
        for (const field of ["expectedWorktrees", "runnerDispatchPackets", "runnerEventPaths"]) {
          if (Object.prototype.hasOwnProperty.call(set, field) && !Array.isArray(set[field])) addFinding("error", "DISPATCH_LEDGER_SET_ARRAY_INVALID", rel(file), `${prefix}.eligibleSets[${setIndex}].${field} must be an array.`)
        }
        if (Array.isArray(set.expectedWorktrees)) {
          set.expectedWorktrees.forEach((worktree, worktreeIndex) => {
            for (const field of ["classificationId", "name", "worktreePath", "branch", "openspecChange", "runnerEventPath", "ports", "status", "commits", "verification", "error"]) {
              if (!Object.prototype.hasOwnProperty.call(worktree, field)) addFinding("error", "DISPATCH_LEDGER_WORKTREE_FIELD_MISSING", rel(file), `${prefix}.eligibleSets[${setIndex}].expectedWorktrees[${worktreeIndex}].${field} is missing.`)
            }
            if (typeof worktree.branch === "string" && !worktree.branch.startsWith(`worktree/${data.run_id}/`)) {
              addFinding("error", "WORKTREE_BRANCH_NAMESPACE_INVALID", rel(file), `${prefix}.eligibleSets[${setIndex}].expectedWorktrees[${worktreeIndex}].branch is not worktree/<run_id>/*.`)
            }
          })
        }
      })
    }
  })
}

function checkRunnerEvent(file, data) {
  for (const field of ["schemaVersion", "run_id", "classificationId", "readyWaveId", "eligibleSetId", "parallelGroupId", "worktreePath", "branch", "openspecChange", "status", "timestamps", "projectRulesReadBack", "dependencySync", "commits", "verification", "error"]) {
    requireField(file, data, field, "RUNNER_EVENT_FIELD_MISSING")
  }
  if (data.commits && typeof data.commits === "object") {
    for (const field of ["specCommit", "implementationCommits", "testCommits", "fixCommits", "documentationCommits"]) {
      if (!Object.prototype.hasOwnProperty.call(data.commits, field)) addFinding("error", "RUNNER_EVENT_COMMITS_FIELD_MISSING", rel(file), `commits.${field} is missing.`)
    }
  }
  if (data.verification && typeof data.verification === "object" && !Object.prototype.hasOwnProperty.call(data.verification, "local")) {
    addFinding("error", "RUNNER_EVENT_VERIFICATION_LOCAL_MISSING", rel(file), "verification.local is missing.")
  }
  if (typeof data.branch === "string" && data.run_id && !data.branch.startsWith(`worktree/${data.run_id}/`)) {
    addFinding("error", "WORKTREE_BRANCH_NAMESPACE_INVALID", rel(file), "runner event branch is not worktree/<run_id>/*.")
  }
}

function checkFile(file) {
  const info = statSync(file)
  if (info.size > MAX_JSON_BYTES) {
    results.skippedFiles += 1
    addFinding("warning", "JSON_TOO_LARGE", rel(file), `Skipped JSON larger than ${MAX_JSON_BYTES} bytes.`)
    return
  }

  let data
  try {
    data = JSON.parse(readFileSync(file, "utf8"))
  } catch (error) {
    addFinding("error", "JSON_PARSE_FAILED", rel(file), error.message)
    return
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    results.skippedFiles += 1
    addFinding("warning", "JSON_NOT_OBJECT", rel(file), "Top-level JSON is not an object; skipped schema checks.")
    return
  }

  const schemaVersion = data.schemaVersion
  if (!schemaVersion) {
    addFinding("warning", "SCHEMA_VERSION_MISSING", rel(file), "schemaVersion is missing; skipped common summary checks.")
    return
  }

  if (typeof schemaVersion !== "string") {
    addFinding("error", "SCHEMA_VERSION_INVALID", rel(file), "schemaVersion must be a string.")
    return
  }

  if (schemaVersion === "dispatch-ledger/v1") checkDispatchLedger(file, data)
  else if (schemaVersion === "runner-event/v1") checkRunnerEvent(file, data)
  else if (needsCommonFields(schemaVersion)) checkCommonFields(file, data)
}

function printSummary() {
  if (JSON_MODE) {
    console.log(JSON.stringify(results, null, 2))
    return
  }

  console.log(`artifact-schema-check: ${results.status}`)
  console.log(`strict: ${STRICT_MODE ? "enabled" : "disabled"}`)
  console.log(`target: ${results.target}`)
  console.log(`checked files: ${results.checkedFiles}`)
  console.log(`skipped files: ${results.skippedFiles}`)
  console.log(`findings: ${results.findings.length}`)
  for (const finding of results.findings) {
    console.log(`- [${finding.severity}] ${finding.code} ${finding.file} - ${finding.message}`)
  }
}

try {
  if (!existsSync(TARGET)) {
    results.status = "skipped"
    addFinding("warning", "ARTIFACT_TARGET_MISSING", results.target, "Target does not exist; nothing to check.")
    printSummary()
    process.exit(STRICT_MODE ? 1 : 0)
  }

  const files = walkJsonFiles(TARGET)
  results.checkedFiles = files.length
  for (const file of files) checkFile(file)
  printSummary()
  process.exit(results.status === "failed" || (STRICT_MODE && results.status === "warning") ? 1 : 0)
} catch (error) {
  results.status = "failed"
  addFinding("error", "CHECKER_CRASHED", "artifact-schema-check.js", error && error.stack ? error.stack : String(error))
  printSummary()
  process.exit(1)
}
