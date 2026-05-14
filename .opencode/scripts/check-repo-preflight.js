#!/usr/bin/env node
const { execFileSync } = require("node:child_process")
const path = require("node:path")
const { ROOT, parseArgs } = require("./lib/artifact-utils")

const { flags } = parseArgs(process.argv.slice(2))
const STRICT_MODE = Boolean(flags.strict)
const findings = []

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, "/")
}

function addFinding(severity, code, file, message) {
  findings.push({ severity, code, file, message })
}

function runGit(args) {
  try {
    return { status: 0, output: execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim() }
  } catch (error) {
    return { status: typeof error.status === "number" ? error.status : 1, output: `${error.stdout || ""}${error.stderr || ""}`.trim() }
  }
}

function runNode(script, args) {
  try {
    execFileSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    return true
  } catch (error) {
    addFinding("error", "CONTRACT_CHECK_FAILED", rel(script), `${path.basename(script)} exited ${typeof error.status === "number" ? error.status : 1}`)
    return false
  }
}

function checkContracts() {
  runNode(path.join(ROOT, ".opencode", "scripts", "agent-contract-check.js"), ["--strict"])
  runNode(path.join(ROOT, ".opencode", "scripts", "check-script-contracts.js"), [])
}

function checkIgnoredPackageFiles() {
  for (const file of [".opencode/package.json", ".opencode/package-lock.json"]) {
    const ignored = runGit(["check-ignore", "-q", "--", file])
    if (ignored.status === 0) addFinding("error", "PACKAGE_FILE_IGNORED", file, `${file} must remain trackable.`)
    else if (ignored.status !== 1) addFinding("warning", "GIT_CHECK_IGNORE_FAILED", file, ignored.output || "git check-ignore failed.")
  }
}

function checkStagedRuntimeArtifacts() {
  const staged = runGit(["diff", "--cached", "--name-only", "--", ".opencode/run-artifacts"])
  if (staged.status !== 0) {
    addFinding("warning", "GIT_STAGED_CHECK_FAILED", ".opencode/run-artifacts", staged.output || "git diff --cached failed.")
    return
  }
  for (const file of staged.output.split(/\r?\n/).filter(Boolean)) {
    if (file.endsWith("/final-merge-report.md")) continue
    addFinding("error", "RUNTIME_ARTIFACT_STAGED", file, "Runtime run artifact is staged; only final maintained reports should be staged.")
  }
}

function checkSkillDirtyDiff() {
  const status = runGit(["status", "--short", "--", ".opencode/skills"])
  if (status.status !== 0) {
    addFinding("warning", "GIT_SKILL_STATUS_FAILED", ".opencode/skills", status.output || "git status failed.")
    return
  }
  for (const line of status.output.split(/\r?\n/).filter(Boolean)) {
    addFinding("error", "SKILL_DIRTY_DIFF", line.slice(3), "Skill files are immutable for this toolchain; do not edit skill content.")
  }
}

checkContracts()
checkIgnoredPackageFiles()
checkStagedRuntimeArtifacts()
checkSkillDirtyDiff()

const hasError = findings.some((finding) => finding.severity === "error")
const hasWarning = findings.some((finding) => finding.severity === "warning")
const status = hasError ? "failed" : hasWarning ? "warning" : "passed"

console.log(JSON.stringify({ schemaVersion: "repo-preflight/v1", status, checkedAt: new Date().toISOString(), strict: STRICT_MODE, findings }, null, 2))
process.exit(status === "failed" || (STRICT_MODE && status === "warning") ? 1 : 0)
