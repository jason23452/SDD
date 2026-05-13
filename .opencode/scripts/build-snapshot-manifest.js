#!/usr/bin/env node
const path = require("node:path")
const { ROOT, artifactDir, commonArtifact, parseArgs, printAndExitUsage, rel, sha256File, walkFiles, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-snapshot-manifest.js <run_id> --stage <n> --wave <id> [--check]")
const runId = positional[0]
const files = walkFiles(ROOT).filter((file) => !rel(file).startsWith(".opencode/run-artifacts/"))
const entries = files.map((file) => ({ path: rel(file), sha256: sha256File(file), action: "include" }))
const out = path.join(artifactDir(runId), "snapshot-manifest.json")
const manifest = commonArtifact("snapshot-manifest/v1", runId, "passed", "rebuild full snapshot from source worktree", {
  stage: flags.stage || null,
  readyWaveId: flags.wave || null,
  includedCount: entries.length,
  entries,
})
writeJson(out, manifest, Boolean(flags.check))
console.log(`${flags.check ? "would write" : "wrote"}: ${rel(out)} files=${entries.length}`)
