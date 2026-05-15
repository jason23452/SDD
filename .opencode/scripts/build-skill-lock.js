#!/usr/bin/env node
const path = require("node:path")
const { ROOT, artifactDir, commonArtifact, exitForStatus, git, output, parseArgs, printAndExitUsage, rel, resolveOutPath, sha256File, walkFiles, writeJson } = require("./lib/artifact-utils")
const { discoverSkills } = require("./lib/skill-registry")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help) printAndExitUsage("Usage: node .opencode/scripts/build-skill-lock.js <run_id> [--check] [--json] [--out <path>] [--strict]")
const runId = positional[0] || "local"
const skillsDir = path.join(ROOT, ".opencode", "skills")
const files = walkFiles(skillsDir).filter((file) => file.endsWith("SKILL.md"))
const discoveredSkills = discoverSkills({ root: ROOT, skillsDir })
const diff = git(["diff", "--name-only", "--", ".opencode/skills"])
const cachedDiff = git(["diff", "--cached", "--name-only", "--", ".opencode/skills"])
const blockers = []
if (diff || cachedDiff) blockers.push("SKILL_DIFF_PRESENT")
const out = resolveOutPath(path.join(artifactDir(runId), "skill-lock.json"), flags)
const lock = commonArtifact("skill-lock/v1", runId, blockers.length ? "blocked" : "passed", "run git diff against .opencode/skills and read changed skill files", {
  blockers,
  sourceRefs: discoveredSkills.map((skill) => ({ kind: "skill", name: skill.name, path: skill.path, sha256: skill.sha256, description: skill.description, requiredFor: "skill immutable gate", fallbackAction: "read full skill file" })),
  sourceHashes: Object.fromEntries(discoveredSkills.map((skill) => [skill.path, skill.sha256])),
  diffStatus: blockers.length ? "dirty" : "clean",
  diffFiles: `${diff}\n${cachedDiff}`.trim().split(/\r?\n/).filter(Boolean),
})
writeJson(out, lock, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${lock.status}`, { schemaVersion: "script-result/v1", status: lock.status, path: rel(out), artifact: lock })
exitForStatus(lock.status, flags)
