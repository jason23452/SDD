#!/usr/bin/env node
const path = require("node:path")
const { ROOT, artifactDir, commonArtifact, parseArgs, printAndExitUsage, rel, sha256File, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help) printAndExitUsage("Usage: node .opencode/scripts/build-project-rules-lock.js <run_id> [--check]")
const runId = positional[0] || "local"
const rulesPath = path.join(ROOT, ".opencode", "project-rules.md")
const hash = sha256File(rulesPath)
const out = path.join(artifactDir(runId), "project-rules-lock.json")
const lock = commonArtifact("project-rules-lock/v1", runId, hash ? "passed" : "blocked", "read full .opencode/project-rules.md", {
  blockers: hash ? [] : ["PROJECT_RULES_MISSING"],
  sourceRefs: [{ kind: "project-rules", path: rel(rulesPath), sha256: hash, requiredFor: "rules read-back", fallbackAction: "read full project rules" }],
  sourceHashes: { projectRules: hash },
  relevantRulesDigest: hash,
})
writeJson(out, lock, Boolean(flags.check))
console.log(`${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${lock.status}`)
