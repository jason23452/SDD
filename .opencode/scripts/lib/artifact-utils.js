const { createHash } = require("node:crypto")
const { execFileSync } = require("node:child_process")
const { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } = require("node:fs")
const path = require("node:path")

const ROOT = process.cwd()

function parseArgs(argv) {
  const positional = []
  const flags = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith("--")) {
      positional.push(arg)
      continue
    }
    const key = arg.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith("--")) flags[key] = true
    else {
      flags[key] = next
      index += 1
    }
  }
  return { positional, flags }
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/") || "."
}

function resolveRoot(input) {
  return path.resolve(ROOT, input)
}

function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex")
}

function sha256File(filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return null
  return sha256Text(readFileSync(filePath))
}

function readJson(filePath) {
  if (!existsSync(filePath)) return null
  return JSON.parse(readFileSync(filePath, "utf8"))
}

function writeJson(filePath, value, checkOnly = false) {
  if (checkOnly) return
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function resolveOutPath(defaultOut, flags = {}) {
  return flags.out ? path.resolve(ROOT, flags.out) : defaultOut
}

function output(flags, text, jsonValue) {
  if (flags && flags.json) console.log(JSON.stringify(jsonValue || { status: "completed", message: text }, null, 2))
  else console.log(text)
}

function exitForStatus(status, flags = {}) {
  const failed = ["failed", "blocked", "stale", "missing"].includes(status)
  if (failed && flags.strict) process.exit(1)
}

function git(args, options = {}) {
  try {
    return execFileSync("git", args, { cwd: options.cwd || ROOT, encoding: "utf8" }).trim()
  } catch (_error) {
    return ""
  }
}

function head(cwd = ROOT) {
  return git(["rev-parse", "HEAD"], { cwd }) || null
}

function now() {
  return new Date().toISOString()
}

function commonArtifact(schemaVersion, runId, status, fallbackAction, extras = {}) {
  return {
    schemaVersion,
    run_id: runId,
    createdAt: now(),
    status,
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: head() },
    detailRefs: [],
    fallbackAction,
    ...extras,
  }
}

function artifactDir(runId) {
  return path.join(ROOT, ".opencode", "run-artifacts", runId)
}

function walkFiles(dir, options = {}) {
  if (!existsSync(dir)) return []
  const skip = options.skip || new Set([".git", "node_modules", ".venv", ".worktree", "dist", "build", "coverage", "test-results", "playwright-report"])
  const out = []
  function walk(current) {
    for (const entry of readdirSync(current)) {
      if (skip.has(entry)) continue
      const full = path.join(current, entry)
      const info = statSync(full)
      if (info.isDirectory()) walk(full)
      else if (info.isFile()) out.push(full)
    }
  }
  walk(dir)
  return out.sort()
}

function printAndExitUsage(text) {
  console.log(text.trim())
  process.exit(0)
}

module.exports = {
  ROOT,
  artifactDir,
  commonArtifact,
  git,
  head,
  now,
  output,
  parseArgs,
  printAndExitUsage,
  readJson,
  rel,
  resolveRoot,
  resolveOutPath,
  sha256File,
  sha256Text,
  walkFiles,
  writeJson,
  exitForStatus,
}
