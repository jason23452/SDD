#!/usr/bin/env node
const path = require("node:path")
const { existsSync, readFileSync } = require("node:fs")
const { artifactDir, commonArtifact, parseArgs, printAndExitUsage, rel, resolveRoot, sha256File, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1 || !flags.planner) printAndExitUsage("Usage: node .opencode/scripts/build-planner-index.js <run_id> --planner <path> [--check]")

const runId = positional[0]
const planner = resolveRoot(flags.planner)
const hash = sha256File(planner)
const sections = []
if (existsSync(planner)) {
  const lines = readFileSync(planner, "utf8").split(/\r?\n/)
  lines.forEach((line, index) => {
    const match = /^(#{1,6})\s+(.+)$/.exec(line)
    if (match) sections.push({ level: match[1].length, title: match[2].trim(), line: index + 1 })
  })
}
const out = path.join(artifactDir(runId), "planner-index.json")
const index = commonArtifact("planner-index/v1", runId, hash ? "passed" : "blocked", "read full development-detail-planner", {
  blockers: hash ? [] : ["PLANNER_MISSING"],
  sourceRefs: [{ kind: "planner", path: rel(planner), sha256: hash, requiredFor: "planner index", fallbackAction: "read full planner" }],
  sourceHashes: { planner: hash },
  sections,
})
writeJson(out, index, Boolean(flags.check))
console.log(`${flags.check ? "would write" : "wrote"}: ${rel(out)} sections=${sections.length} status=${index.status}`)
