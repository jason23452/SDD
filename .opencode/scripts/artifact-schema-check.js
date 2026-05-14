#!/usr/bin/env node

const { existsSync, readdirSync, readFileSync, statSync } = require("node:fs")
const path = require("node:path")
const {
  ALLOWED_ARTIFACT_STATUSES,
  BLOCKING_ARTIFACT_STATUSES,
  COMMON_SUMMARY_FIELDS,
  DISPATCH_LEDGER_SET_ARRAY_FIELDS,
  DISPATCH_LEDGER_SET_FIELDS,
  DISPATCH_LEDGER_STAGE_ARRAY_FIELDS,
  DISPATCH_LEDGER_STAGE_FIELDS,
  DISPATCH_LEDGER_TOP_FIELDS,
  DISPATCH_LEDGER_WAVE_FIELDS,
  DISPATCH_LEDGER_WORKTREE_FIELDS,
  RUNNER_EVENT_COMMIT_FIELDS,
  RUNNER_EVENT_FIELDS,
  needsCommonFields,
} = require("./lib/artifact-schema-rules")
const { ROOT, normalizeRefs, parseArgs, stripBom } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
const DEFAULT_ARTIFACTS_DIR = path.join(ROOT, ".opencode", "run-artifacts")
const JSON_MODE = Boolean(flags.json)
const STRICT_MODE = Boolean(flags.strict)
const REPORT_ONLY_MODE = Boolean(flags["report-only"])
const LEGACY_REPORT_MODE = Boolean(flags["legacy-report"])
const LEGACY_SUMMARY_ONLY = Boolean(flags["legacy-summary-only"])
const BY_FILE_MODE = Boolean(flags["by-file"])
const MAX_FINDINGS = flags["max-findings"] ? Number(flags["max-findings"]) : null
const TARGET_ARG = positional[0]
const TARGET = TARGET_ARG ? path.resolve(ROOT, TARGET_ARG) : DEFAULT_ARTIFACTS_DIR
const MAX_JSON_BYTES = 5 * 1024 * 1024
const SKIP_DIRS = new Set([".git", "node_modules", ".worktree", "dist", "build", "coverage", "test-results"])

const results = {
  status: "passed",
  checkedAt: new Date().toISOString(),
  target: path.relative(ROOT, TARGET).replace(/\\/g, "/") || ".",
  checkedFiles: 0,
  skippedFiles: 0,
  legacySummary: {},
  byFile: {},
  findings: [],
}

function addLegacy(code, file) {
  if (!results.legacySummary[code]) results.legacySummary[code] = { count: 0, files: [] }
  results.legacySummary[code].count += 1
  if (file && results.legacySummary[code].files.length < 20) results.legacySummary[code].files.push(file)
}

function addFinding(severity, code, file, message) {
  const finding = { severity, code, file, message }
  if (!LEGACY_SUMMARY_ONLY && (!MAX_FINDINGS || results.findings.length < MAX_FINDINGS)) results.findings.push(finding)
  if (BY_FILE_MODE && file) {
    if (!results.byFile[file]) results.byFile[file] = []
    results.byFile[file].push({ severity, code, message })
  }
  if (LEGACY_REPORT_MODE) addLegacy(code, file)
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

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/")
}

function checkCommonFields(file, data) {
  for (const field of COMMON_SUMMARY_FIELDS) {
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

  if (Object.prototype.hasOwnProperty.call(data, "sourceRefs") && !Array.isArray(data.sourceRefs) && typeof data.sourceRefs !== "object") {
    addFinding("error", "SOURCE_REFS_NOT_ARRAY", rel(file), "sourceRefs must be an array or object when present.")
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
  for (const field of DISPATCH_LEDGER_TOP_FIELDS) {
    requireField(file, data, field, "DISPATCH_LEDGER_FIELD_MISSING")
  }
  requireArray(file, data, "stages", "DISPATCH_LEDGER_STAGES_INVALID")

  if (!Array.isArray(data.stages)) return
  data.stages.forEach((stage, stageIndex) => {
    const prefix = `stages[${stageIndex}]`
    for (const field of DISPATCH_LEDGER_STAGE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(stage, field)) addFinding("error", "DISPATCH_LEDGER_STAGE_FIELD_MISSING", rel(file), `${prefix}.${field} is missing.`)
    }
    for (const field of DISPATCH_LEDGER_STAGE_ARRAY_FIELDS) {
      if (!Array.isArray(stage[field])) addFinding("error", "DISPATCH_LEDGER_STAGE_ARRAY_INVALID", rel(file), `${prefix}.${field} must be an array.`)
    }

    if (Array.isArray(stage.readyWaves)) {
      stage.readyWaves.forEach((wave, waveIndex) => {
        for (const field of DISPATCH_LEDGER_WAVE_FIELDS) {
          if (!Object.prototype.hasOwnProperty.call(wave, field)) addFinding("error", "DISPATCH_LEDGER_WAVE_FIELD_MISSING", rel(file), `${prefix}.readyWaves[${waveIndex}].${field} is missing.`)
        }
      })
    }

    if (Array.isArray(stage.eligibleSets)) {
      stage.eligibleSets.forEach((set, setIndex) => {
        for (const field of DISPATCH_LEDGER_SET_FIELDS) {
          if (!Object.prototype.hasOwnProperty.call(set, field)) addFinding("error", "DISPATCH_LEDGER_SET_FIELD_MISSING", rel(file), `${prefix}.eligibleSets[${setIndex}].${field} is missing.`)
        }
        for (const field of DISPATCH_LEDGER_SET_ARRAY_FIELDS) {
          if (Object.prototype.hasOwnProperty.call(set, field) && !Array.isArray(set[field])) addFinding("error", "DISPATCH_LEDGER_SET_ARRAY_INVALID", rel(file), `${prefix}.eligibleSets[${setIndex}].${field} must be an array.`)
        }
        if (Array.isArray(set.expectedWorktrees)) {
          set.expectedWorktrees.forEach((worktree, worktreeIndex) => {
            for (const field of DISPATCH_LEDGER_WORKTREE_FIELDS) {
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
  for (const field of RUNNER_EVENT_FIELDS) {
    requireField(file, data, field, "RUNNER_EVENT_FIELD_MISSING")
  }
  if (data.commits && typeof data.commits === "object") {
    for (const field of RUNNER_EVENT_COMMIT_FIELDS) {
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
    const raw = readFileSync(file, "utf8")
    const text = stripBom(raw)
    if (raw !== text) addLegacy("UTF8_BOM_STRIPPED", rel(file))
    data = JSON.parse(text)
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
  if (data.sourceRefs && !Array.isArray(data.sourceRefs) && typeof data.sourceRefs === "object") {
    addLegacy("SOURCE_REFS_OBJECT_LEGACY", rel(file))
    data.sourceRefs = normalizeRefs(data.sourceRefs)
  }
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
  if (MAX_FINDINGS) console.log(`max findings shown: ${MAX_FINDINGS}`)
  if (LEGACY_REPORT_MODE) {
    console.log("legacy summary:")
    for (const [code, value] of Object.entries(results.legacySummary).sort()) console.log(`- ${code}: ${value.count}`)
  }
  if (BY_FILE_MODE) {
    console.log("by file:")
    for (const [file, findings] of Object.entries(results.byFile).sort()) console.log(`- ${file}: ${findings.length}`)
  }
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
  process.exit(!REPORT_ONLY_MODE && (results.status === "failed" || (STRICT_MODE && results.status === "warning")) ? 1 : 0)
} catch (error) {
  results.status = "failed"
  addFinding("error", "CHECKER_CRASHED", "artifact-schema-check.js", error && error.stack ? error.stack : String(error))
  printSummary()
  process.exit(1)
}
