#!/usr/bin/env node
const path = require("node:path")
const {
  artifactDir,
  commonArtifact,
  exitForStatus,
  output,
  parseArgs,
  printAndExitUsage,
  readJson,
  readText,
  rel,
  resolveOutPath,
  resolveRoot,
  sha256File,
  writeJson,
} = require("./lib/artifact-utils")

const { positional, flags } = parseArgs(process.argv.slice(2))
if (flags.help || positional.length < 1) {
  printAndExitUsage("Usage: node .opencode/scripts/build-active-skill-selection-contract.js <run_id> --planner <path> [--planner-index <path>] [--skill-lock <path>] [--check] [--json] [--out <path>] [--strict]")
}

const runId = positional[0]
const planner = flags.planner ? resolveRoot(flags.planner) : null
const plannerHash = planner ? sha256File(planner) : null
const plannerText = planner ? readText(planner) : ""
const plannerIndexPath = flags["planner-index"] ? resolveRoot(flags["planner-index"]) : path.join(artifactDir(runId), "planner-index.json")
const skillLockPath = flags["skill-lock"] ? resolveRoot(flags["skill-lock"]) : path.join(artifactDir(runId), "skill-lock.json")

const plannerIndex = readJson(plannerIndexPath)
const skillLock = readJson(skillLockPath)

function extractExplicitActiveSkills(text, plannerIndexData) {
  const lines = text.split(/\r?\n/)
  const activeSections = plannerIndexData && plannerIndexData.sectionRefs && Array.isArray(plannerIndexData.sectionRefs.activeSkills)
    ? plannerIndexData.sectionRefs.activeSkills
    : []
  if (activeSections.length === 0) return []
  const names = []
  for (const section of activeSections) {
    const sectionText = lines.slice(section.line - 1, section.endLine).join("\n")
    for (const match of sectionText.matchAll(/`([a-z0-9-]+)`/g)) names.push(match[1])
  }
  return [...new Set(names)]
}

const availableSkills = (skillLock && Array.isArray(skillLock.sourceRefs) ? skillLock.sourceRefs : [])
  .map((ref) => ({
    name: ref.path ? ref.path.split("/").slice(-2, -1)[0] : null,
    path: ref.path,
    sha256: ref.sha256 || null,
  }))
  .filter((item) => item.name && item.path)

const explicitActiveSkillNames = extractExplicitActiveSkills(plannerText, plannerIndex)
const activeSkills = explicitActiveSkillNames.length
  ? availableSkills.filter((skill) => explicitActiveSkillNames.includes(skill.name))
  : []

const blockers = []
if (!plannerHash) blockers.push("PLANNER_MISSING")
if (!skillLock) blockers.push("SKILL_LOCK_MISSING")
if (skillLock && skillLock.status !== "passed") blockers.push("SKILL_LOCK_BLOCKED")
if (plannerIndex && plannerIndex.status && plannerIndex.status !== "passed") blockers.push("PLANNER_INDEX_BLOCKED")
if (plannerHash && explicitActiveSkillNames.length === 0) blockers.push("ACTIVE_SKILLS_SECTION_MISSING")
if (plannerHash && explicitActiveSkillNames.length > 0 && activeSkills.length === 0) blockers.push("ACTIVE_SKILLS_UNRESOLVED")

const out = resolveOutPath(path.join(artifactDir(runId), "active-skill-selection-contract.json"), flags)
const artifact = commonArtifact("active-skill-selection-contract/v1", runId, blockers.length ? "blocked" : "passed", "read full planner and skill-lock to resolve active skills", {
  blockers,
  sourceRefs: [
    ...(planner ? [{ kind: "planner", path: rel(planner), sha256: plannerHash, requiredFor: "active skill selection", fallbackAction: "read full planner" }] : []),
    ...(plannerIndex ? [{ kind: "planner-index", path: rel(plannerIndexPath), sha256: sha256File(plannerIndexPath), requiredFor: "active skill selection", fallbackAction: "read planner index" }] : []),
    ...(skillLock ? [{ kind: "skill-lock", path: rel(skillLockPath), sha256: sha256File(skillLockPath), requiredFor: "active skill selection", fallbackAction: "read active skills and rebuild skill-lock" }] : []),
  ],
  sourceHashes: {
    planner: plannerHash,
    plannerIndex: sha256File(plannerIndexPath),
    skillLock: sha256File(skillLockPath),
  },
  plannerIndexRef: plannerIndex ? rel(plannerIndexPath) : null,
  skillLockRef: skillLock ? rel(skillLockPath) : null,
  selectionPolicy: "skills-first; active skill names must resolve only from an explicit planner `Active Skills` or `Active Skill Adoption` section matched against skill-lock inventory. Downstream agents/scripts must not infer tools outside selected skills.",
  explicitActiveSkillNames,
  activeSkills: activeSkills.map((skill) => ({
    name: skill.name,
    path: skill.path,
    sha256: skill.sha256,
    source: "planner-active-skills-section+skill-lock",
  })),
})

writeJson(out, artifact, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${artifact.status}`, {
  schemaVersion: "script-result/v1",
  status: artifact.status,
  path: rel(out),
  artifact,
})
exitForStatus(artifact.status, flags)
