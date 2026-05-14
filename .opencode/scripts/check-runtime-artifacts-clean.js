#!/usr/bin/env node
const { git, parseArgs, printAndExitUsage } = require("./lib/artifact-utils")

const { flags } = parseArgs(process.argv.slice(2))
if (flags.help) printAndExitUsage("Usage: node .opencode/scripts/check-runtime-artifacts-clean.js [--strict]")

const findings = []
const staged = git(["diff", "--cached", "--name-only"]).split(/\r?\n/).filter(Boolean)
for (const file of staged) {
  if (!file.startsWith(".opencode/run-artifacts/")) continue
  if (/^\.opencode\/run-artifacts\/[^/]+\/final-merge-report\.md$/.test(file)) continue
  findings.push({ code: "RUNTIME_ARTIFACT_STAGED", file })
}
const status = findings.length ? "failed" : "passed"
console.log(JSON.stringify({ schemaVersion: "schema-validation/v1", status, checkedAt: new Date().toISOString(), findings }, null, 2))
process.exit(status === "passed" || !flags.strict ? 0 : 1)
