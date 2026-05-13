#!/usr/bin/env node
const path = require("node:path")
const { artifactDir, commonArtifact, parseArgs, printAndExitUsage, rel, writeJson } = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 2) printAndExitUsage("Usage: node .opencode/scripts/build-openspec-template.js <run_id> <classification_id> [--check]")

const [runId, classificationId] = positional
const out = path.join(artifactDir(runId), "openspec-template-contract.json")
const template = commonArtifact("openspec-template-contract/v1", runId, "planned", "read full OpenSpec proposal/design/tasks/specs artifacts", {
  classificationId,
  requiredSections: ["proposal", "design", "tasks", "specs", "alignment-check"],
  taskLabels: ["Package", "Experience", "Fullstack", "Verification", "OpenSpec"],
  checklistRef: `.opencode/run-artifacts/${runId}/apply-readiness-checklist/${classificationId}.json`,
  template: {
    proposal: ["Why", "What changes", "Impact", "Package decision", "Experience contract", "Fullstack contract"],
    design: ["Context", "Decisions", "Risks", "Alternatives"],
    tasks: ["Spec commit", "Implementation", "Local verification", "Commit metadata summary"],
    specs: ["Acceptance scenarios", "API/UI contracts", "Migration/backward compatibility notes"],
  },
})
writeJson(out, template, Boolean(flags.check))
console.log(`${flags.check ? "would write" : "wrote"}: ${rel(out)} classification=${classificationId}`)
