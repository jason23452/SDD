#!/usr/bin/env node
const path = require("node:path")
const { ROOT, artifactDir, commonArtifact, parseArgs, rel, sha256File, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
const runId = positional[0] || "local"
function frontend() {
  const packageJson = path.join(ROOT, "frontend", "package.json")
  const lockfiles = ["pnpm-lock.yaml", "yarn.lock", "package-lock.json"].map((name) => path.join(ROOT, "frontend", name))
  const lock = lockfiles.find((file) => sha256File(file))
  return { packageJson: rel(packageJson), packageJsonHash: sha256File(packageJson), lockfile: lock ? rel(lock) : null, lockfileHash: lock ? sha256File(lock) : null, dependencyDir: "frontend/node_modules", ready: Boolean(sha256File(packageJson)) }
}
function backend() {
  const pyproject = path.join(ROOT, "backend", "pyproject.toml")
  const uvlock = path.join(ROOT, "backend", "uv.lock")
  return { pyproject: rel(pyproject), pyprojectHash: sha256File(pyproject), lockfile: sha256File(uvlock) ? rel(uvlock) : null, lockfileHash: sha256File(uvlock), dependencyDir: "backend/.venv", ready: Boolean(sha256File(pyproject)) }
}
const out = path.join(artifactDir(runId), "dependency-readiness.json")
const dependency = commonArtifact("dependency-readiness/v1", runId, "planned", "read package manifests and run full dependency gate", {
  frontend: frontend(),
  backend: backend(),
  sourceRefs: [],
  sourceHashes: {},
  fallbackCommands: ["frontend package manager install from lockfile", "backend uv sync or project README command"],
})
writeJson(out, dependency, Boolean(flags.check))
console.log(`${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${dependency.status}`)
