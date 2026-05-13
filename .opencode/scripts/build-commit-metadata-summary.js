#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, commonArtifact, git, parseArgs, printAndExitUsage, rel, sha256Text, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 2) printAndExitUsage("Usage: node .opencode/scripts/build-commit-metadata-summary.js <run_id> <classification_id> [--check]")
const [runId, classificationId] = positional
const commits = git(["log", "--format=%H%x09%s", "-20"]).split(/\r?\n/).filter(Boolean).map((line) => {
  const [hash, ...subject] = line.split("\t")
  const files = git(["show", "--name-only", "--format=", hash]).split(/\r?\n/).filter(Boolean)
  return { hash, subject: subject.join("\t"), subjectDigest: sha256Text(subject.join("\t")), touchedFiles: files }
})
const out = path.join(artifactDir(runId), "commit-metadata-summary", `${classificationId}.json`)
const summary = commonArtifact("commit-metadata-summary/v1", runId, "passed", "rebuild commit metadata from git show", {
  classificationId,
  commits,
  commitCount: commits.length,
})
writeJson(out, summary, Boolean(flags.check))
console.log(`${flags.check ? "would write" : "wrote"}: ${rel(out)} commits=${commits.length}`)
