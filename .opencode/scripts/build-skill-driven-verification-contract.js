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
  printAndExitUsage("Usage: node .opencode/scripts/build-skill-driven-verification-contract.js <run_id> --planner <path> [--planner-index <path>] [--project-rules-lock <path>] [--skill-lock <path>] [--check] [--json] [--out <path>] [--strict]")
}

const runId = positional[0]
const planner = flags.planner ? resolveRoot(flags.planner) : null
const plannerHash = planner ? sha256File(planner) : null
const plannerIndexPath = flags["planner-index"] ? resolveRoot(flags["planner-index"]) : path.join(artifactDir(runId), "planner-index.json")
const projectRulesLockPath = flags["project-rules-lock"] ? resolveRoot(flags["project-rules-lock"]) : path.join(artifactDir(runId), "project-rules-lock.json")
const skillLockPath = flags["skill-lock"] ? resolveRoot(flags["skill-lock"]) : path.join(artifactDir(runId), "skill-lock.json")

const plannerIndex = readJson(plannerIndexPath)
const projectRulesLock = readJson(projectRulesLockPath)
const skillLock = readJson(skillLockPath)
const plannerText = planner ? readText(planner) : ""
const verificationSections = plannerIndex && plannerIndex.sectionRefs && Array.isArray(plannerIndex.sectionRefs.verification)
  ? plannerIndex.sectionRefs.verification
  : []

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function parseSections(text) {
  const lines = text.split(/\r?\n/)
  const headers = []
  lines.forEach((line, index) => {
    const match = /^(#{1,6})\s+(.+)$/.exec(line)
    if (match) headers.push({ level: match[1].length, title: match[2].trim(), line: index + 1 })
  })
  headers.forEach((section, index) => {
    section.endLine = index + 1 < headers.length ? headers[index + 1].line - 1 : lines.length
    section.text = lines.slice(section.line - 1, section.endLine).join("\n")
  })
  return headers
}

function extractCommandSamples(sectionText) {
  const commands = []
  for (const match of sectionText.matchAll(/```(?:bash|json)?\n([\s\S]*?)```/g)) {
    const block = match[1].split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    for (const line of block) {
      if (line.startsWith("npm ") || line.startsWith("pnpm ") || line.startsWith("yarn ") || line.startsWith("uv ") || line.startsWith("docker ")) commands.push(line)
    }
  }
  return [...new Set(commands)]
}

const availableSkills = (skillLock && Array.isArray(skillLock.sourceRefs) ? skillLock.sourceRefs : [])
  .map((ref) => ({
    name: ref.path ? ref.path.split("/").slice(-2, -1)[0] : null,
    path: ref.path,
    sha256: ref.sha256 || null,
  }))
  .filter((item) => item.name && item.path)

const activeSkillNames = availableSkills
  .map((item) => item.name)
  .filter((name, index, array) => array.indexOf(name) === index)
  .filter((name) => new RegExp(`(^|[^a-z0-9-])${escapeRegex(name)}([^a-z0-9-]|$)`, "i").test(plannerText))

const activeSkillRefs = availableSkills.filter((item) => activeSkillNames.includes(item.name))

function classifyCheckType(section) {
  const text = section.text.toLowerCase()
  const title = section.title.toLowerCase()
  if (/(browser|playwright|e2e|browser smoke|瀏覽器)/.test(text) || /(browser|e2e|驗證門檻)/.test(title)) return "stage-integration"
  if (/(testing|測試|pytest|vitest|test)/.test(text) || /(testing|測試與驗證|testing)/.test(title)) return "runner-local"
  if (/(完成定義|未完成條件|final|整體)/.test(section.title)) return "final-only"
  return "runner-local"
}

const extractedSkillSections = []
for (const skill of activeSkillRefs) {
  const skillPath = resolveRoot(skill.path)
  const text = readText(skillPath)
  const sections = parseSections(text)
  for (const section of sections) {
    if (!/(測試|驗證|testing|validation|command patterns|驗證門檻|完成定義|未完成條件)/i.test(section.title)) continue
    extractedSkillSections.push({
      skill: skill.name,
      path: skill.path,
      sha256: skill.sha256,
      title: section.title,
      line: section.line,
      endLine: section.endLine,
      checkType: classifyCheckType(section),
      commandSamples: extractCommandSamples(section.text),
    })
  }
}

const blockers = []
if (!plannerHash) blockers.push("PLANNER_MISSING")
if (plannerHash && verificationSections.length === 0) blockers.push("VERIFICATION_SECTION_MISSING")
if (!projectRulesLock) blockers.push("PROJECT_RULES_LOCK_MISSING")
if (!skillLock) blockers.push("SKILL_LOCK_MISSING")
if (projectRulesLock && projectRulesLock.status !== "passed") blockers.push("PROJECT_RULES_LOCK_BLOCKED")
if (skillLock && skillLock.status !== "passed") blockers.push("SKILL_LOCK_BLOCKED")
if (plannerHash && activeSkillNames.length === 0) blockers.push("ACTIVE_SKILLS_UNRESOLVED")
if (plannerHash && activeSkillNames.length > 0 && extractedSkillSections.length === 0) blockers.push("SKILL_VERIFICATION_SECTIONS_MISSING")

const out = resolveOutPath(path.join(artifactDir(runId), "skill-driven-verification-contract.json"), flags)
const artifact = commonArtifact(
  "skill-driven-verification-contract/v1",
  runId,
  blockers.length ? "blocked" : "planned",
  "read active skills, project-rules lock, skill-lock, and full planner verification section",
  {
    blockers,
    sourceRefs: [
      ...(planner ? [{ kind: "planner", path: rel(planner), sha256: plannerHash, requiredFor: "skill-driven verification contract", fallbackAction: "read full planner" }] : []),
      ...(plannerIndex ? [{ kind: "planner-index", path: rel(plannerIndexPath), sha256: sha256File(plannerIndexPath), requiredFor: "skill-driven verification contract", fallbackAction: "read planner index" }] : []),
      ...(projectRulesLock ? [{ kind: "project-rules-lock", path: rel(projectRulesLockPath), sha256: sha256File(projectRulesLockPath), requiredFor: "project-rules-driven verification authority", fallbackAction: "read full project rules and rebuild project-rules lock" }] : []),
      ...(skillLock ? [{ kind: "skill-lock", path: rel(skillLockPath), sha256: sha256File(skillLockPath), requiredFor: "active skill-driven verification authority", fallbackAction: "read active skills and rebuild skill-lock" }] : []),
      ...activeSkillRefs.map((skill) => ({ kind: "active-skill", path: skill.path, sha256: skill.sha256, requiredFor: "skill-driven verification extraction", fallbackAction: "read full skill file" })),
    ],
    sourceHashes: {
      planner: plannerHash,
      projectRulesLock: sha256File(projectRulesLockPath),
      skillLock: sha256File(skillLockPath),
    },
    plannerIndexRef: plannerIndex ? rel(plannerIndexPath) : null,
    projectRulesLockRef: projectRulesLock ? rel(projectRulesLockPath) : null,
    skillLockRef: skillLock ? rel(skillLockPath) : null,
    contractPolicy: "skills-first, project-rules-second, existing-project-entry-third; agent and script layers must not infer or hardcode tool selection. If skill-lock or project-rules-lock is missing/blocked, this contract is blocked.",
    verificationSections,
    activeSkillNames,
    extractedSkillSections,
    runnerLocalChecks: extractedSkillSections.filter((section) => section.checkType === "runner-local").map((section, index) => ({ id: `runner-local-${index + 1}`, commandHint: `resolved from skill ${section.skill}:${section.title}`, requiredWhen: "defined by active skill verification section", sourceSkill: section.skill, sourceSection: section.title, commandSamples: section.commandSamples })),
    stageIntegrationChecks: extractedSkillSections.filter((section) => section.checkType === "stage-integration").map((section, index) => ({ id: `stage-integration-${index + 1}`, commandHint: `resolved from skill ${section.skill}:${section.title}`, requiredWhen: "defined by active skill verification section", sourceSkill: section.skill, sourceSection: section.title, commandSamples: section.commandSamples })),
    finalOnlyChecks: extractedSkillSections.filter((section) => section.checkType === "final-only").map((section, index) => ({ id: `final-only-${index + 1}`, commandHint: `resolved from skill ${section.skill}:${section.title}`, requiredWhen: "defined by active skill verification section", sourceSkill: section.skill, sourceSection: section.title, commandSamples: section.commandSamples })),
  },
)

writeJson(out, artifact, Boolean(flags.check))
output(flags, `${flags.check ? "would write" : "wrote"}: ${rel(out)} status=${artifact.status}`, {
  schemaVersion: "script-result/v1",
  status: artifact.status,
  path: rel(out),
  artifact,
})
exitForStatus(artifact.status, flags)
