#!/usr/bin/env node
const path = require("node:path")
const { ROOT, artifactDir, commonArtifact, exitForStatus, output, parseArgs, printAndExitUsage, rel, resolveOutPath, sha256File, walkFiles, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-snapshot-manifest.js <run_id> --stage <n> --wave <id> [--check] [--json] [--out <path>] [--strict]")
const runId = positional[0]
const excludedPrefixes = [
  ".opencode/run-artifacts/",
  ".opencode/skills/",
  ".opencode/local-docs/",
  ".opencode/outputs/",
  ".opencode/run/",
  "spec-flow/",
]
const excludedNames = new Set([".env", ".env.local", "credentials.json", "secrets.json"])
const files = walkFiles(ROOT).filter((file) => {
  const relative = rel(file)
  const name = path.basename(relative)
  if (excludedNames.has(name)) return false
  if (/\.env\..*\.local$/.test(name)) return false
  if (/\.(log|tmp|temp|sqlite|sqlite3|db)$/.test(name)) return false
  return !excludedPrefixes.some((prefix) => relative.startsWith(prefix))
})
const entries = files.map((file) => ({ path: rel(file), sha256: sha256File(file), action: "include" }))
const out = resolveOutPath(path.join(artifactDir(runId), "snapshot-manifest.json"), flags)
const manifest = commonArtifact("snapshot-manifest/v1", runId, "passed", "rebuild full snapshot from source worktree", {
  stage: flags.stage || null,
  readyWaveId: flags.wave || null,
  includedCount: entries.length,
  entries,
})
writeJson(out, manifest, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} files=${entries.length}`, { schemaVersion: "script-result/v1", status: manifest.status, path: rel(out), artifact: manifest })
exitForStatus(manifest.status, flags)
