const ALLOWED_ARTIFACT_STATUSES = new Set(["passed", "completed", "blocked", "failed", "stale", "missing", "skipped", "planned", "in_progress", "not_needed"])
const BLOCKING_ARTIFACT_STATUSES = new Set(["failed", "blocked", "stale", "missing"])

const COMMON_REQUIRED_SCHEMA_PATTERNS = [
  /-index\/v1$/,
  /-lock\/v1$/,
  /-summary\/v1$/,
  /-compact\/v1$/,
  /-packet\/v1$/,
  /^resume-cursor\/v1$/,
  /^handoff-next-step\/v1$/,
  /^cleanup-plan\/v1$/,
  /^cleanup-locks\/v1$/,
  /^barrier-preflight\/v1$/,
  /^schema-validation\/v1$/,
  /^port-registry\/v1$/,
  /^bug-search-packet\/v1$/,
  /^culprit-score\/v1$/,
  /^run-preflight-packet\/v1$/,
  /^verification-matrix\/v1$/,
  /^package-decision-record\/v1$/,
  /^experience-contract\/v1$/,
  /^context-slice\/v1$/,
  /^openspec-template-contract\/v1$/,
  /^apply-readiness-checklist\/v1$/,
  /^snapshot-manifest\/v1$/,
  /^commit-metadata-summary\/v1$/,
  /^run-metrics-summary\/v1$/,
]

const COMMON_SUMMARY_FIELDS = ["schemaVersion", "run_id", "status", "blockers", "detailRefs", "fallbackAction"]
const DISPATCH_LEDGER_TOP_FIELDS = ["run_id", "createdAt", "updatedAt", "bootstrapBranch", "bootstrapCommit", "plannerPath", "projectRulesHash", "dependencySnapshotManifest"]
const DISPATCH_LEDGER_STAGE_FIELDS = ["stage", "baseline", "baselineSource", "status"]
const DISPATCH_LEDGER_STAGE_ARRAY_FIELDS = ["readyWaves", "readyEligibleSetIds", "eligibleSets"]
const DISPATCH_LEDGER_WAVE_FIELDS = ["readyWaveId", "stage", "baseline", "laneSelection", "prioritySelection", "readyEligibleSetIds", "status", "timestamps", "error"]
const DISPATCH_LEDGER_SET_FIELDS = ["eligibleSetId", "parallelGroupId", "lane", "priority", "readyWaveId", "status", "expectedWorktrees", "runnerDispatchPackets", "runnerEventPaths", "timestamps", "error", "retryCount"]
const DISPATCH_LEDGER_SET_ARRAY_FIELDS = ["expectedWorktrees", "runnerDispatchPackets", "runnerEventPaths"]
const DISPATCH_LEDGER_WORKTREE_FIELDS = ["classificationId", "name", "worktreePath", "branch", "openspecChange", "runnerEventPath", "ports", "status", "commits", "verification", "error"]
const RUNNER_EVENT_FIELDS = ["schemaVersion", "run_id", "classificationId", "readyWaveId", "eligibleSetId", "parallelGroupId", "worktreePath", "branch", "openspecChange", "status", "timestamps", "projectRulesReadBack", "dependencySync", "commits", "verification", "error"]
const RUNNER_EVENT_COMMIT_FIELDS = ["specCommit", "implementationCommits", "testCommits", "fixCommits", "documentationCommits"]

function needsCommonFields(schemaVersion) {
  return COMMON_REQUIRED_SCHEMA_PATTERNS.some((pattern) => pattern.test(schemaVersion))
}

module.exports = {
  ALLOWED_ARTIFACT_STATUSES,
  BLOCKING_ARTIFACT_STATUSES,
  COMMON_REQUIRED_SCHEMA_PATTERNS,
  COMMON_SUMMARY_FIELDS,
  DISPATCH_LEDGER_SET_ARRAY_FIELDS,
  DISPATCH_LEDGER_SET_FIELDS,
  DISPATCH_LEDGER_STAGE_ARRAY_FIELDS,
  DISPATCH_LEDGER_STAGE_FIELDS,
  DISPATCH_LEDGER_TOP_FIELDS,
  DISPATCH_LEDGER_WAVE_FIELDS,
  DISPATCH_LEDGER_WORKTREE_FIELDS,
  RUNNER_EVENT_COMMIT_FIELDS,
  RUNNER_EVENT_FIELDS,
  needsCommonFields,
}
