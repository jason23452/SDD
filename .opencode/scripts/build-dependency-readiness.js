#!/usr/bin/env node
const path = require("node:path")
const { existsSync } = require("node:fs")
const { ROOT, artifactDir, commonArtifact, output, parseArgs, printAndExitUsage, rel, sha256File, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help) printAndExitUsage("Usage: node .opencode/scripts/build-dependency-readiness.js <run_id> [--check]")
const runId = positional[0] || "local"
function frontend() {
  const packageJson = path.join(ROOT, "frontend", "package.json")
  const lockfiles = ["pnpm-lock.yaml", "yarn.lock", "package-lock.json"].map((name) => path.join(ROOT, "frontend", name))
  const lock = lockfiles.find((file) => sha256File(file))
  const manager = lock && lock.endsWith("pnpm-lock.yaml") ? "pnpm" : lock && lock.endsWith("yarn.lock") ? "yarn" : lock && lock.endsWith("package-lock.json") ? "npm" : null
  return { packageJson: rel(packageJson), packageJsonHash: sha256File(packageJson), lockfile: lock ? rel(lock) : null, lockfileHash: lock ? sha256File(lock) : null, packageManager: manager, dependencyDir: "frontend/node_modules", dependencyDirExists: existsSync(path.join(ROOT, "frontend", "node_modules")), ready: Boolean(sha256File(packageJson)) }
}
function backend() {
  const pyproject = path.join(ROOT, "backend", "pyproject.toml")
  const uvlock = path.join(ROOT, "backend", "uv.lock")
  return { pyproject: rel(pyproject), pyprojectHash: sha256File(pyproject), lockfile: sha256File(uvlock) ? rel(uvlock) : null, lockfileHash: sha256File(uvlock), packageManager: sha256File(uvlock) ? "uv" : null, dependencyDir: "backend/.venv", dependencyDirExists: existsSync(path.join(ROOT, "backend", ".venv")), ready: Boolean(sha256File(pyproject)) }
}
const frontendInfo = frontend()
const backendInfo = backend()
const sourceRefs = []
if (frontendInfo.packageJsonHash) sourceRefs.push({ kind: "frontend-package", path: frontendInfo.packageJson, sha256: frontendInfo.packageJsonHash, requiredFor: "dependency readiness", fallbackAction: "read frontend package manifest" })
if (frontendInfo.lockfileHash) sourceRefs.push({ kind: "frontend-lockfile", path: frontendInfo.lockfile, sha256: frontendInfo.lockfileHash, requiredFor: "dependency readiness", fallbackAction: "read frontend lockfile" })
if (backendInfo.pyprojectHash) sourceRefs.push({ kind: "backend-package", path: backendInfo.pyproject, sha256: backendInfo.pyprojectHash, requiredFor: "dependency readiness", fallbackAction: "read backend package manifest" })
if (backendInfo.lockfileHash) sourceRefs.push({ kind: "backend-lockfile", path: backendInfo.lockfile, sha256: backendInfo.lockfileHash, requiredFor: "dependency readiness", fallbackAction: "read backend lockfile" })
const out = path.join(artifactDir(runId), "dependency-readiness.json")
const dependency = commonArtifact("dependency-readiness/v1", runId, "planned", "read package manifests and run full dependency gate", {
  frontend: frontendInfo,
  backend: backendInfo,
  sourceRefs,
  sourceHashes: { frontendPackage: frontendInfo.packageJsonHash, frontendLockfile: frontendInfo.lockfileHash, backendPackage: backendInfo.pyprojectHash, backendLockfile: backendInfo.lockfileHash },
  fallbackCommands: [frontendInfo.packageManager ? `${frontendInfo.packageManager} install` : "frontend package manager install from lockfile", backendInfo.packageManager === "uv" ? "uv sync" : "backend uv sync or project README command"],
})
writeJson(out, dependency, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${dependency.status}`, { schemaVersion: "script-result/v1", status: dependency.status, path: rel(out), artifact: dependency })
