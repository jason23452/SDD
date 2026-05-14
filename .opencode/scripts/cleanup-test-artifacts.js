#!/usr/bin/env node
const path = require("node:path")
const { existsSync, readdirSync, rmSync, statSync } = require("node:fs")
const { ROOT, output, parseArgs, rel } = require("./lib/artifact-utils")

const { flags } = parseArgs(process.argv.slice(2))
const artifactsDir = path.join(ROOT, ".opencode", "run-artifacts")
const removed = []
const skipped = []
const olderThanMinutes = flags["older-than-minutes"] === true || flags["older-than-minutes"] === undefined ? null : Number(flags["older-than-minutes"])
const now = Date.now()

if (existsSync(artifactsDir)) {
  for (const entry of readdirSync(artifactsDir)) {
    if (!entry.startsWith("run-test-")) continue
    const target = path.join(artifactsDir, entry)
    if (Number.isFinite(olderThanMinutes)) {
      const ageMinutes = (now - statSync(target).mtimeMs) / 60000
      if (ageMinutes < olderThanMinutes) {
        skipped.push({ path: rel(target), ageMinutes: Number(ageMinutes.toFixed(3)) })
        continue
      }
    }
    removed.push(rel(target))
    if (!flags.check) rmSync(target, { recursive: true, force: true })
  }
}

output(flags, `${flags.check ? "would remove" : "removed"}: ${removed.length} test artifact dirs`, {
  schemaVersion: "script-result/v1",
  status: "passed",
  removed,
  skipped,
  olderThanMinutes: Number.isFinite(olderThanMinutes) ? olderThanMinutes : null,
})
