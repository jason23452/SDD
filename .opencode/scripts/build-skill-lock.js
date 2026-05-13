#!/usr/bin/env node
const path = require("node:path")
const { ROOT, artifactDir, commonArtifact, git, parseArgs, rel, sha256File, walkFiles, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
const runId = positional[0] || "local"
const skillsDir = path.join(ROOT, ".opencode", "skills")
const files = walkFiles(skillsDir).filter((file) => file.endsWith("SKILL.md"))
const diff = git(["diff", "--name-only", "--", ".opencode/skills"])
const cachedDiff = git(["diff", "--cached", "--name-only", "--", ".opencode/skills"])
const blockers = []
if (diff || cachedDiff) blockers.push("SKILL_DIFF_PRESENT")
const out = path.join(artifactDir(runId), "skill-lock.json")
const lock = commonArtifact("skill-lock/v1", runId, blockers.length ? "blocked" : "passed", "run git diff against .opencode/skills and read changed skill files", {
  blockers,
  sourceRefs: files.map((file) => ({ kind: "skill", path: rel(file), sha256: sha256File(file), requiredFor: "skill immutable gate", fallbackAction: "read full skill file" })),
  sourceHashes: Object.fromEntries(files.map((file) => [rel(file), sha256File(file)])),
  diffStatus: blockers.length ? "dirty" : "clean",
  diffFiles: `${diff}\n${cachedDiff}`.trim().split(/\r?\n/).filter(Boolean),
})
writeJson(out, lock, Boolean(flags.check))
console.log(`${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${lock.status}`)
