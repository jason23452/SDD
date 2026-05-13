#!/usr/bin/env node

const { existsSync, readdirSync, readFileSync, statSync } = require("node:fs")
const path = require("node:path")

const ROOT = process.cwd()
const DEFAULT_ARTIFACTS_DIR = path.join(ROOT, ".opencode", "run-artifacts")
const JSON_MODE = process.argv.includes("--json")
const TARGET_ARG = process.argv.find((arg) => !arg.startsWith("--") && arg !== process.argv[0] && arg !== process.argv[1])
const TARGET = TARGET_ARG ? path.resolve(ROOT, TARGET_ARG) : DEFAULT_ARTIFACTS_DIR

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

  if (["blocked", "failed", "stale"].includes(data.status) && Array.isArray(data.blockers) && data.blockers.length === 0) {
    addFinding("warning", "BLOCKED_WITHOUT_BLOCKERS", rel(file), `status=${data.status} but blockers[] is empty.`)
  }
}

function checkFile(file) {
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

  if (needsCommonFields(schemaVersion)) checkCommonFields(file, data)
}

function printSummary() {
  if (JSON_MODE) {
    console.log(JSON.stringify(results, null, 2))
    return
  }

  console.log(`artifact-schema-check: ${results.status}`)
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
    process.exit(0)
  }

  const files = walkJsonFiles(TARGET)
  results.checkedFiles = files.length
  for (const file of files) checkFile(file)
  printSummary()
  process.exit(results.status === "failed" ? 1 : 0)
} catch (error) {
  results.status = "failed"
  addFinding("error", "CHECKER_CRASHED", "artifact-schema-check.js", error && error.stack ? error.stack : String(error))
  printSummary()
  process.exit(1)
}
