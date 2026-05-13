#!/usr/bin/env node

const { execFileSync } = require("node:child_process")
const { existsSync, readdirSync, readFileSync } = require("node:fs")
const path = require("node:path")

const ROOT = process.cwd()
const AGENTS_DIR = path.join(ROOT, ".opencode", "agents")
const JSON_MODE = process.argv.includes("--json")

const REQUIRED_REGISTRY_SCHEMAS = [
  "project-rules-lock/v1",
  "skill-lock/v1",
  "dependency-readiness/v1",
  "resume-cursor/v1",
  "planner-index/v1",
  "openspec-change-index/v1",
  "final-report-index/v1",
  "run-lock-packet/v1",
  "bug-search-packet/v1",
  "culprit-score/v1",
  "verification-summary/v1",
  "classification-compact/v1",
  "handoff-next-step/v1",
  "cleanup-locks/v1",
  "cleanup-plan/v1",
]

const COMPACT_FIELDS = [
  "status",
  "blockers",
  "commits",
  "verification",
  "contextRefs",
  "artifactRefs",
  "nextAction",
  "fallbackUsed",
]

const STALE_PATTERNS = [
  /status、blocker、commit、verification summary、artifact refs/,
  /source hash、row count/,
  /contextRefs=`/,
  /blocker 與 nextAction/,
  /detailRefs：\.\.\./,
  /artifactRefs：\.\.\./,
  /contextRefs：\.\.\./,
]

const results = {
  status: "passed",
  checkedAt: new Date().toISOString(),
  agentsDir: path.relative(ROOT, AGENTS_DIR),
  checkedFiles: 0,
  findings: [],
}

function addFinding(severity, code, file, message, line) {
  results.findings.push({ severity, code, file, line, message })
  if (severity === "error") results.status = "failed"
  if (severity === "warning" && results.status === "passed") results.status = "warning"
}

function readAgents() {
  if (!existsSync(AGENTS_DIR)) {
    addFinding("error", "AGENTS_DIR_MISSING", ".opencode/agents", "Agents directory is missing.")
    return []
  }

  return readdirSync(AGENTS_DIR)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => {
      const filePath = path.join(AGENTS_DIR, name)
      return {
        name,
        rel: path.relative(ROOT, filePath).replace(/\\/g, "/"),
        text: readFileSync(filePath, "utf8"),
      }
    })
}

function lineNumber(text, index) {
  return text.slice(0, index).split(/\r?\n/).length
}

function checkGitSkillsDiff() {
  for (const args of [
    ["diff", "--name-only", "--", ".opencode/skills"],
    ["diff", "--cached", "--name-only", "--", ".opencode/skills"],
  ]) {
    const output = execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim()
    if (output) {
      addFinding(
        "error",
        "SKILL_DIFF_PRESENT",
        ".opencode/skills",
        `Skill files have git diff and must stay immutable: ${output.replace(/\r?\n/g, ", ")}`,
      )
    }
  }
}

function checkInitRegistry(agents) {
  const init = agents.find((agent) => agent.name === "init-project.md")
  if (!init) {
    addFinding("error", "INIT_PROJECT_MISSING", ".opencode/agents/init-project.md", "Canonical registry owner is missing.")
    return
  }

  for (const schema of REQUIRED_REGISTRY_SCHEMAS) {
    if (!init.text.includes(schema)) {
      addFinding("error", "REGISTRY_SCHEMA_MISSING", init.rel, `Missing registry schema: ${schema}`)
    }
  }

  for (const field of COMPACT_FIELDS) {
    if (!init.text.includes(field)) {
      addFinding("error", "COMPACT_FIELD_MISSING", init.rel, `Missing canonical compact field: ${field}`)
    }
  }
}

function checkAgentText(agent) {
  for (const pattern of STALE_PATTERNS) {
    const match = pattern.exec(agent.text)
    if (match) {
      addFinding("error", "STALE_PLACEHOLDER", agent.rel, `Stale compact/context wording matched ${pattern}.`, lineNumber(agent.text, match.index))
    }
  }

  const compactLines = agent.text.split(/\r?\n/)
  compactLines.forEach((line, index) => {
    if (!line.includes("compact output：enabled")) return
    for (const field of COMPACT_FIELDS) {
      if (!line.includes(field)) {
        addFinding("error", "COMPACT_OUTPUT_FIELD_MISSING", agent.rel, `compact output line is missing ${field}.`, index + 1)
      }
    }
  })

  const hasAliasBlocker =
    agent.text.includes("WORKTREE_BRANCH_NAMESPACE_INVALID") ||
    agent.text.includes("不一致") ||
    agent.text.includes("不通過")

  if (agent.text.includes("work/<run_id>") && !hasAliasBlocker) {
    addFinding(
      "warning",
      "ALIAS_WITHOUT_BLOCKER",
      agent.rel,
      "Mentions work/<run_id> alias without WORKTREE_BRANCH_NAMESPACE_INVALID in the same file.",
    )
  }

  if (agent.text.includes("worktrees/<run_id>") && !hasAliasBlocker) {
    addFinding(
      "warning",
      "ALIASES_WITHOUT_BLOCKER",
      agent.rel,
      "Mentions worktrees/<run_id> alias without WORKTREE_BRANCH_NAMESPACE_INVALID in the same file.",
    )
  }
}

function printSummary() {
  if (JSON_MODE) {
    console.log(JSON.stringify(results, null, 2))
    return
  }

  console.log(`agent-contract-check: ${results.status}`)
  console.log(`checked files: ${results.checkedFiles}`)
  console.log(`findings: ${results.findings.length}`)
  for (const finding of results.findings) {
    const location = finding.line ? `${finding.file}:${finding.line}` : finding.file
    console.log(`- [${finding.severity}] ${finding.code} ${location} - ${finding.message}`)
  }
}

try {
  const agents = readAgents()
  results.checkedFiles = agents.length
  checkGitSkillsDiff()
  checkInitRegistry(agents)
  for (const agent of agents) checkAgentText(agent)
  printSummary()
  process.exit(results.status === "failed" ? 1 : 0)
} catch (error) {
  results.status = "failed"
  addFinding("error", "CHECKER_CRASHED", "agent-contract-check.js", error && error.stack ? error.stack : String(error))
  printSummary()
  process.exit(1)
}
