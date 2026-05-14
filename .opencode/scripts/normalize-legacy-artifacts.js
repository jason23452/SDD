#!/usr/bin/env node
const path = require("node:path")
const { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } = require("node:fs")
const { COMMON_SUMMARY_FIELDS, needsCommonFields } = require("./lib/artifact-schema-rules")
const { ROOT, normalizeRefs, output, parseArgs, printAndExitUsage, rel, resolveRoot, stripBom } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/normalize-legacy-artifacts.js <artifact-dir> [--run-id <id>] [--apply] [--json] [--out <path>]")

const target = resolveRoot(positional[0])
const runId = flags["run-id"] || path.basename(target)
const apply = Boolean(flags.apply)
const changed = []
const skipped = []
const blockers = []

function jsonFiles(input) {
  if (!existsSync(input)) return []
  const info = statSync(input)
  if (info.isFile()) return input.endsWith(".json") ? [input] : []
  return readdirSync(input).flatMap((entry) => jsonFiles(path.join(input, entry))).sort()
}

function normalizeFile(file) {
  const raw = readFileSync(file, "utf8")
  const withoutBom = stripBom(raw)
  let data
  try {
    data = JSON.parse(withoutBom)
  } catch (error) {
    blockers.push({ file: rel(file), code: "JSON_PARSE_FAILED", message: error.message })
    return
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    skipped.push({ file: rel(file), reason: "JSON_NOT_OBJECT" })
    return
  }

  const before = JSON.stringify(data)
  const actions = []
  if (raw !== withoutBom) actions.push("strip-bom")
  if (data.schemaVersion && needsCommonFields(data.schemaVersion)) {
    for (const field of COMMON_SUMMARY_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(data, field)) continue
      if (field === "run_id") data[field] = runId
      else if (field === "status") data[field] = "planned"
      else if (field === "blockers") data[field] = []
      else if (field === "detailRefs") data[field] = []
      else if (field === "fallbackAction") data[field] = "read full source artifact"
      actions.push(`add-${field}`)
    }
    if (!Object.prototype.hasOwnProperty.call(data, "sourceRefs")) { data.sourceRefs = []; actions.push("add-sourceRefs") }
    else if (!Array.isArray(data.sourceRefs) && typeof data.sourceRefs === "object") { data.sourceRefs = normalizeRefs(data.sourceRefs); actions.push("normalize-sourceRefs") }
    if (!Object.prototype.hasOwnProperty.call(data, "sourceHashes")) { data.sourceHashes = {}; actions.push("add-sourceHashes") }
    if (!Object.prototype.hasOwnProperty.call(data, "updatedAt") && !Object.prototype.hasOwnProperty.call(data, "createdAt")) { data.updatedAt = new Date().toISOString(); actions.push("add-updatedAt") }
  }
  const after = JSON.stringify(data)
  if (actions.length === 0 && before === after && raw === withoutBom) return
  changed.push({ file: rel(file), actions })
  if (apply) writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8")
}

if (!existsSync(target)) blockers.push({ file: rel(target), code: "TARGET_MISSING" })
for (const file of jsonFiles(target)) normalizeFile(file)

const result = {
  schemaVersion: "script-result/v1",
  status: blockers.length ? "blocked" : "passed",
  mode: apply ? "apply" : "check",
  target: rel(target),
  run_id: runId,
  changedCount: changed.length,
  changed,
  skipped,
  blockers,
}
if (flags.out) { const out = resolveRoot(flags.out); mkdirSync(path.dirname(out), { recursive: true }); writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`, "utf8") }
output(flags, `${apply ? "normalized" : "would normalize"}: ${changed.length} files`, result)
process.exit(blockers.length ? 1 : 0)
