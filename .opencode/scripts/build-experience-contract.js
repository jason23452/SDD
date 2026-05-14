#!/usr/bin/env node
const path = require("node:path")
const { existsSync, readFileSync } = require("node:fs")
const { ROOT, artifactDir, commonArtifact, exitForStatus, output, parseArgs, printAndExitUsage, rel, resolveOutPath, resolveRoot, sha256File, walkFiles, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) printAndExitUsage("Usage: node .opencode/scripts/build-experience-contract.js <run_id> [--planner <path>] [--check] [--json] [--out <path>] [--strict]")

const runId = positional[0]
const planner = flags.planner ? resolveRoot(flags.planner) : null
const plannerHash = planner ? sha256File(planner) : null
const blockers = planner && !plannerHash ? ["PLANNER_MISSING"] : []
const routes = new Set()
const routeRefs = []
if (plannerHash) {
  const text = readFileSync(planner, "utf8")
  for (const match of text.matchAll(/(?:route|path|page|頁面|路由)[:：\s`'"]+(\/[A-Za-z0-9_./:-]*)/gi)) routes.add(match[1])
}
const frontendSrc = path.join(ROOT, "frontend", "src")
if (existsSync(frontendSrc)) {
  for (const file of walkFiles(frontendSrc).filter((item) => /\.(jsx?|tsx?)$/.test(item))) {
    const text = readFileSync(file, "utf8")
    let matched = false
    for (const match of text.matchAll(/(?:path|to)=['"](\/[A-Za-z0-9_./:-]*)['"]/g)) { routes.add(match[1]); matched = true }
    if (matched) routeRefs.push({ kind: "frontend-route", path: rel(file), sha256: sha256File(file), requiredFor: "experience contract", fallbackAction: "read route source file" })
  }
}
const out = resolveOutPath(path.join(artifactDir(runId), "experience-contract.json"), flags)
const contract = commonArtifact("experience-contract/v1", runId, blockers.length ? "blocked" : "planned", "read full planner experience contract section", {
  blockers,
  sourceRefs: [...(planner ? [{ kind: "planner", path: rel(planner), sha256: plannerHash, requiredFor: "experience contract", fallbackAction: "read full planner" }] : []), ...routeRefs],
  sourceHashes: { planner: plannerHash },
  routes: [...routes].sort(),
  flows: [],
  states: ["loading", "empty", "error", "success", "disabled"],
  responsiveTargets: ["mobile", "desktop"],
  accessibility: ["focus-visible", "keyboard", "screen-reader labels where applicable"],
  visualVerification: "required when frontend/fullstack active; skipped/blocked must state reason",
})
writeJson(out, contract, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${contract.status}`, { schemaVersion: "script-result/v1", status: contract.status, path: rel(out), artifact: contract })
exitForStatus(contract.status, flags)
