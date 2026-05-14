#!/usr/bin/env node
const path = require("node:path")
const { existsSync, readFileSync } = require("node:fs")
const { ROOT, artifactDir, commonArtifact, exitForStatus, output, parseArgs, printAndExitUsage, rel, resolveOutPath, resolveRoot, sha256File, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-package-decision-record.js <run_id> [--planner <path>] [--check] [--json] [--out <path>] [--strict]")

const runId = positional[0]
const planner = flags.planner ? resolveRoot(flags.planner) : null
const plannerHash = planner ? sha256File(planner) : null
const blockers = planner && !plannerHash ? ["PLANNER_MISSING"] : []
function readPackageJson(dir) {
  const file = path.join(ROOT, dir, "package.json")
  if (!existsSync(file)) return null
  const data = JSON.parse(readFileSync(file, "utf8"))
  return {
    manifest: rel(file),
    manifestHash: sha256File(file),
    dependencies: Object.keys(data.dependencies || {}).sort(),
    devDependencies: Object.keys(data.devDependencies || {}).sort(),
  }
}
function readPyproject() {
  const file = path.join(ROOT, "backend", "pyproject.toml")
  if (!existsSync(file)) return null
  const text = readFileSync(file, "utf8")
  const dependencies = []
  for (const match of text.matchAll(/^\s*"([A-Za-z0-9_.-]+)/gm)) dependencies.push(match[1])
  return { manifest: rel(file), manifestHash: sha256File(file), dependencies: [...new Set(dependencies)].sort() }
}
const frontend = readPackageJson("frontend")
const backend = readPyproject()
const sourceRefs = []
if (planner) sourceRefs.push({ kind: "planner", path: rel(planner), sha256: plannerHash, requiredFor: "package decisions", fallbackAction: "read full planner" })
if (frontend) sourceRefs.push({ kind: "frontend-package", path: frontend.manifest, sha256: frontend.manifestHash, requiredFor: "package decisions", fallbackAction: "read frontend package manifest" })
if (backend) sourceRefs.push({ kind: "backend-package", path: backend.manifest, sha256: backend.manifestHash, requiredFor: "package decisions", fallbackAction: "read backend package manifest" })
const out = resolveOutPath(path.join(artifactDir(runId), "package-decision-record.json"), flags)
const record = commonArtifact("package-decision-record/v1", runId, blockers.length ? "blocked" : "planned", "read full planner package decision section", {
  blockers,
  sourceRefs,
  sourceHashes: { planner: plannerHash, frontendPackage: frontend && frontend.manifestHash, backendPackage: backend && backend.manifestHash },
  frontend: frontend ? [frontend] : [],
  backend: backend ? [backend] : [],
  unresolved: [],
  policy: "runner must not add unconfirmed packages; report PACKAGE_DECISION_REQUIRED when a new package is needed",
})
writeJson(out, record, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${record.status}`, { schemaVersion: "script-result/v1", status: record.status, path: rel(out), artifact: record })
exitForStatus(record.status, flags)
