#!/usr/bin/env node
const { execFileSync } = require("node:child_process")
const path = require("node:path")
const { artifactDir, parseArgs, printAndExitUsage, rel } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/artifact-scope-check.js <run_id> --scope runner|wave|final [--classification <id>] [--stage <n>] [--wave <id>] [--strict]")
const runId = positional[0]
const scope = flags.scope || "final"
let target = artifactDir(runId)
if (scope === "runner") {
  if (!flags.classification) printAndExitUsage("runner scope requires --classification <id>")
  target = path.join(artifactDir(runId), "runner-events", `${flags.classification}.json`)
} else if (scope === "wave") {
  const stage = flags.stage || "1"
  const wave = String(flags.wave || "wave-1").replace(/[\\/]/g, "-")
  target = path.join(artifactDir(runId), "barrier-preflight", `stage-${stage}-wave-${wave}.json`)
}
const args = [path.join(".opencode", "scripts", "artifact-schema-check.js"), rel(target)]
if (flags.strict) args.push("--strict")
try {
  const output = execFileSync(process.execPath, args, { encoding: "utf8" })
  process.stdout.write(output)
} catch (error) {
  process.stdout.write(error.stdout || "")
  process.stderr.write(error.stderr || "")
  process.exit(typeof error.status === "number" ? error.status : 1)
}
