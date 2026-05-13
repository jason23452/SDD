#!/usr/bin/env node
const path = require("node:path")
const { existsSync, readdirSync, readFileSync, statSync } = require("node:fs")
const { ROOT, parseArgs, printAndExitUsage, rel, resolveRoot, sha256File } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/check-artifact-freshness.js <artifact-or-dir> [--strict]")
const target = resolveRoot(positional[0])
const findings = []
function files(input) {
  if (!existsSync(input)) return []
  const info = statSync(input)
  if (info.isFile()) return input.endsWith(".json") ? [input] : []
  return readdirSync(input).flatMap((entry) => files(path.join(input, entry))).sort()
}
function checkFile(file) {
  let data
  try { data = JSON.parse(readFileSync(file, "utf8")) } catch (error) { findings.push({ code: "JSON_PARSE_FAILED", file: rel(file), message: error.message }); return }
  for (const ref of data.sourceRefs || []) {
    if (!ref.path || !ref.sha256) continue
    const source = path.resolve(ROOT, ref.path)
    const current = sha256File(source)
    if (!current) findings.push({ code: "SOURCE_MISSING", file: rel(file), source: ref.path, fallbackAction: ref.fallbackAction || data.fallbackAction })
    else if (current !== ref.sha256) findings.push({ code: "SOURCE_HASH_MISMATCH", file: rel(file), source: ref.path, expected: ref.sha256, actual: current, fallbackAction: ref.fallbackAction || data.fallbackAction })
  }
}
if (!existsSync(target)) findings.push({ code: "TARGET_MISSING", file: rel(target), fallbackAction: "read full source artifacts" })
for (const file of files(target)) checkFile(file)
const status = findings.length ? "stale" : "passed"
console.log(JSON.stringify({ schemaVersion: "schema-validation/v1", status, target: rel(target), findings }, null, 2))
process.exit(status === "passed" || !flags.strict ? 0 : 1)
