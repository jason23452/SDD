#!/usr/bin/env node
const { existsSync, readdirSync } = require("node:fs")
const path = require("node:path")
const { ROOT, readText } = require("./lib/artifact-utils")

const scriptsDir = path.join(ROOT, ".opencode", "scripts")
const findings = []

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, "/")
}

for (const name of readdirSync(scriptsDir).filter((item) => item.endsWith(".js")).sort()) {
  const file = path.join(scriptsDir, name)
  const text = readText(file)
  if (name.startsWith("build-") && !text.includes("flags.check")) findings.push({ code: "BUILD_SCRIPT_NO_CHECK", file: rel(file) })
  if (name.startsWith("build-") && !text.includes("flags.json") && !text.includes("output(")) findings.push({ code: "BUILD_SCRIPT_NO_JSON_OUTPUT", file: rel(file) })
  if (name.startsWith("build-") && !text.includes("resolveOutPath")) findings.push({ code: "BUILD_SCRIPT_NO_OUT", file: rel(file) })
  if (name.startsWith("build-") && !text.includes("exitForStatus")) findings.push({ code: "BUILD_SCRIPT_NO_STRICT_EXIT", file: rel(file) })
  if (name.startsWith("build-") && !text.includes("writeJson(")) findings.push({ code: "BUILD_SCRIPT_NO_WRITEJSON", file: rel(file) })
  if (name.startsWith("build-") && !/Usage: .*--check/.test(text)) findings.push({ code: "BUILD_USAGE_NO_CHECK", file: rel(file) })
  if (name.startsWith("build-") && !/Usage: .*--out <path>/.test(text)) findings.push({ code: "BUILD_USAGE_NO_OUT", file: rel(file) })
  if (name.startsWith("build-") && !/Usage: .*--strict/.test(text)) findings.push({ code: "BUILD_USAGE_NO_STRICT", file: rel(file) })
  const isContractFixture = name === "check-script-contracts.js" || name === "test-checkers.js"
  if (!isContractFixture && text.includes(".opencode/skills") && /writeFileSync|rmSync|unlinkSync|mkdirSync/.test(text)) findings.push({ code: "SCRIPT_MAY_WRITE_SKILLS", file: rel(file) })
  if (/git\s+commit|git\s+merge|git\s+reset|git\s+checkout|git\s+push/.test(text)) findings.push({ code: "SCRIPT_CONTAINS_GIT_MUTATION", file: rel(file) })
  if (!isContractFixture && /writeFileSync|mkdirSync|rmSync|unlinkSync/.test(text) && text.includes(".worktree")) findings.push({ code: "SCRIPT_MAY_WRITE_WORKTREE", file: rel(file) })
  if (!isContractFixture && /Start-Process|Stop-Process|Get-CimInstance|Get-NetTCPConnection/.test(text)) findings.push({ code: "SCRIPT_CONTAINS_POWERSHELL_LIFECYCLE", file: rel(file) })
  if (name.startsWith("build-") && !text.includes(".opencode/run-artifacts") && !text.includes("artifactDir(")) findings.push({ code: "BUILD_SCRIPT_OUTPUT_SCOPE_UNKNOWN", file: rel(file) })
  if (!text.includes("schemaVersion") && !text.includes("commonArtifact(") && name !== "agent-contract-check.js" && name !== "test-checkers.js" && name !== "artifact-scope-check.js") findings.push({ code: "SCRIPT_OUTPUT_SCHEMA_UNKNOWN", file: rel(file) })
  if (name.startsWith("check-") && !text.includes("findings")) findings.push({ code: "CHECK_SCRIPT_NO_FINDINGS", file: rel(file) })
}

if (!existsSync(path.join(scriptsDir, "lib", "artifact-utils.js"))) findings.push({ code: "ARTIFACT_UTILS_MISSING", file: ".opencode/scripts/lib/artifact-utils.js" })

const status = findings.length ? "failed" : "passed"
console.log(JSON.stringify({ schemaVersion: "schema-validation/v1", status, checkedAt: new Date().toISOString(), findings }, null, 2))
process.exit(status === "passed" ? 0 : 1)
