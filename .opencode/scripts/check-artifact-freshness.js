#!/usr/bin/env node
const path = require("node:path")
const { existsSync, readdirSync, readFileSync, statSync } = require("node:fs")
const { ROOT, head, parseArgs, printAndExitUsage, rel, resolveRoot, sha256File } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/check-artifact-freshness.js <artifact-or-dir> [--strict] [--gate runner|merge|final]")
const target = resolveRoot(positional[0])
const findings = []
const gate = flags.gate || null
function files(input) {
  if (!existsSync(input)) return []
  const info = statSync(input)
  if (info.isFile()) return input.endsWith(".json") ? [input] : []
  return readdirSync(input).flatMap((entry) => files(path.join(input, entry))).sort()
}
function checkFile(file) {
  let data
  try { data = JSON.parse(readFileSync(file, "utf8")) } catch (error) { findings.push({ code: "JSON_PARSE_FAILED", file: rel(file), message: error.message }); return }
  if (!data.schemaVersion) findings.push({ code: "SCHEMA_VERSION_MISSING", file: rel(file), fallbackAction: data.fallbackAction || "read full source artifacts" })
  const needsSummaryFallback = data.schemaVersion && data.schemaVersion !== "dispatch-ledger/v1" && data.schemaVersion !== "runner-event/v1"
  if (needsSummaryFallback && (!data.fallbackAction || typeof data.fallbackAction !== "string")) findings.push({ code: "FALLBACK_ACTION_MISSING", file: rel(file) })
  if (["blocked", "failed", "stale", "missing"].includes(data.status)) findings.push({ code: "ARTIFACT_STATUS_NOT_USABLE", file: rel(file), status: data.status, fallbackAction: data.fallbackAction })
  if (gate && needsSummaryFallback && data.status === "planned") findings.push({ code: "PLANNED_ARTIFACT_NOT_GATE_READY", file: rel(file), gate, fallbackAction: data.fallbackAction })
  if (data.sourceHashes && typeof data.sourceHashes.HEAD === "string" && /^[0-9a-f]{40}$/i.test(data.sourceHashes.HEAD)) {
    const currentHead = head()
    if (currentHead && currentHead !== data.sourceHashes.HEAD) findings.push({ code: "HEAD_MISMATCH", file: rel(file), expected: data.sourceHashes.HEAD, actual: currentHead, fallbackAction: data.fallbackAction })
  }
  for (const ref of data.sourceRefs || []) {
    if (!ref.requiredFor) findings.push({ code: "SOURCE_REF_REQUIREDFOR_MISSING", file: rel(file), source: ref.path || null, fallbackAction: ref.fallbackAction || data.fallbackAction })
    if (!ref.path || !ref.sha256) continue
    const source = path.resolve(ROOT, ref.path)
    const current = sha256File(source)
    if (!current) findings.push({ code: "SOURCE_MISSING", file: rel(file), source: ref.path, fallbackAction: ref.fallbackAction || data.fallbackAction })
    else if (current !== ref.sha256) findings.push({ code: "SOURCE_HASH_MISMATCH", file: rel(file), source: ref.path, expected: ref.sha256, actual: current, fallbackAction: ref.fallbackAction || data.fallbackAction })
  }
  for (const ref of data.detailRefs || []) {
    const detailPath = typeof ref === "string" ? ref : ref && ref.path
    if (detailPath && !existsSync(path.resolve(ROOT, detailPath))) findings.push({ code: "DETAIL_REF_MISSING", file: rel(file), detailRef: detailPath, fallbackAction: data.fallbackAction })
  }
}
if (!existsSync(target)) findings.push({ code: "TARGET_MISSING", file: rel(target), fallbackAction: "read full source artifacts" })
for (const file of files(target)) checkFile(file)
const status = findings.length ? "stale" : "passed"
console.log(JSON.stringify({ schemaVersion: "schema-validation/v1", status, target: rel(target), findings }, null, 2))
process.exit(status === "passed" || !flags.strict ? 0 : 1)
