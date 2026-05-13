#!/usr/bin/env node

const { execFileSync } = require("node:child_process")
const { mkdtempSync, rmSync, mkdirSync, writeFileSync } = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const ROOT = process.cwd()
const ARTIFACT_CHECKER = path.join(ROOT, ".opencode", "scripts", "artifact-schema-check.js")
const AGENT_CHECKER = path.join(ROOT, ".opencode", "scripts", "agent-contract-check.js")
const BUILD_PREFLIGHT = path.join(ROOT, ".opencode", "scripts", "build-run-preflight-packet.js")
const BUILD_MATRIX = path.join(ROOT, ".opencode", "scripts", "build-verification-matrix.js")
const CHECK_MATRIX = path.join(ROOT, ".opencode", "scripts", "check-verification-matrix.js")
const BUILD_CONTEXT = path.join(ROOT, ".opencode", "scripts", "build-context-slices.js")
const BUILD_SNAPSHOT = path.join(ROOT, ".opencode", "scripts", "build-snapshot-manifest.js")
const BUILD_PORT_MAP = path.join(ROOT, ".opencode", "scripts", "build-port-map.js")
const BUILD_OPENSPEC_TEMPLATE = path.join(ROOT, ".opencode", "scripts", "build-openspec-template.js")
const BUILD_COMMIT_METADATA = path.join(ROOT, ".opencode", "scripts", "build-commit-metadata-summary.js")
const BUILD_PACKAGE_DECISION = path.join(ROOT, ".opencode", "scripts", "build-package-decision-record.js")
const BUILD_EXPERIENCE = path.join(ROOT, ".opencode", "scripts", "build-experience-contract.js")
const BUILD_PROJECT_RULES_LOCK = path.join(ROOT, ".opencode", "scripts", "build-project-rules-lock.js")
const BUILD_SKILL_LOCK = path.join(ROOT, ".opencode", "scripts", "build-skill-lock.js")
const BUILD_DEPENDENCY = path.join(ROOT, ".opencode", "scripts", "build-dependency-readiness.js")
const BUILD_PLANNER_INDEX = path.join(ROOT, ".opencode", "scripts", "build-planner-index.js")
const CHECK_FRESHNESS = path.join(ROOT, ".opencode", "scripts", "check-artifact-freshness.js")
const CHECK_CROSSREFS = path.join(ROOT, ".opencode", "scripts", "check-artifact-crossrefs.js")
const CHECK_SCRIPT_CONTRACTS = path.join(ROOT, ".opencode", "scripts", "check-script-contracts.js")
const BUILD_DISPATCH_LEDGER = path.join(ROOT, ".opencode", "scripts", "build-dispatch-ledger-skeleton.js")
const CHECK_DISPATCH_LEDGER = path.join(ROOT, ".opencode", "scripts", "check-dispatch-ledger-readiness.js")
const BUILD_RUNNER_EVENT = path.join(ROOT, ".opencode", "scripts", "build-runner-event-skeleton.js")
const CHECK_RUNNER_EVENT = path.join(ROOT, ".opencode", "scripts", "check-runner-event-completeness.js")
const BUILD_FINAL_INDEX = path.join(ROOT, ".opencode", "scripts", "build-final-report-index.js")

const results = []

function runCase(name, command, expectedStatus) {
  try {
    const output = execFileSync(process.execPath, command, { cwd: ROOT, encoding: "utf8" })
    results.push({ name, passed: expectedStatus === 0, status: 0, output: output.trim() })
  } catch (error) {
    const status = typeof error.status === "number" ? error.status : 1
    const output = `${error.stdout || ""}${error.stderr || ""}`.trim()
    results.push({ name, passed: status === expectedStatus, status, output })
  }
}

function runJsonCase(name, command, expectedStatus, assertFn) {
  try {
    const output = execFileSync(process.execPath, command, { cwd: ROOT, encoding: "utf8" })
    const data = JSON.parse(output)
    const assertion = assertFn ? assertFn(data) : true
    results.push({ name, passed: expectedStatus === 0 && assertion === true, status: 0, output: assertion === true ? output.trim() : `assertion failed: ${assertion}` })
  } catch (error) {
    const status = typeof error.status === "number" ? error.status : 1
    const output = `${error.stdout || ""}${error.stderr || ""}`.trim()
    results.push({ name, passed: status === expectedStatus, status, output })
  }
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function validDispatchLedger(runId) {
  return {
    schemaVersion: "dispatch-ledger/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    updatedAt: "2026-05-13T00:00:00.000Z",
    bootstrapBranch: "bootstrap/test",
    bootstrapCommit: "abc123",
    plannerPath: ".opencode/local-docs/development-detail-planner/test.md",
    projectRulesHash: "hash",
    dependencySnapshotManifest: ".opencode/run-artifacts/test/dependency-snapshot.json",
    stages: [
      {
        stage: 1,
        baseline: "abc123",
        baselineSource: "bootstrap",
        readyWaves: [
          {
            readyWaveId: "wave-1",
            stage: 1,
            baseline: "abc123",
            laneSelection: "no-priority",
            prioritySelection: null,
            readyEligibleSetIds: ["set-1"],
            status: "planned",
            timestamps: {},
            error: null,
          },
        ],
        readyEligibleSetIds: ["set-1"],
        status: "planned",
        eligibleSets: [
          {
            eligibleSetId: "set-1",
            parallelGroupId: "group-1",
            lane: "no-priority",
            priority: null,
            readyWaveId: "wave-1",
            status: "planned",
            expectedWorktrees: [
              {
                classificationId: "class-1",
                name: "sample",
                worktreePath: `.worktree/${runId}/stage-1/sample`,
                branch: `worktree/${runId}/stage-1/sample`,
                openspecChange: "change-sample",
                runnerEventPath: `.worktree/${runId}/stage-1/sample/.opencode/run-artifacts/${runId}/runner-events/class-1.json`,
                ports: [],
                status: "planned",
                commits: {},
                verification: {},
                error: null,
              },
            ],
            runnerDispatchPackets: [],
            runnerEventPaths: [],
            timestamps: {},
            error: null,
            retryCount: 0,
          },
        ],
      },
    ],
  }
}

function validRunnerEvent(runId) {
  return {
    schemaVersion: "runner-event/v1",
    run_id: runId,
    classificationId: "class-1",
    readyWaveId: "wave-1",
    eligibleSetId: "set-1",
    parallelGroupId: "group-1",
    worktreePath: `.worktree/${runId}/stage-1/sample`,
    branch: `worktree/${runId}/stage-1/sample`,
    openspecChange: "change-sample",
    status: "completed",
    timestamps: {},
    projectRulesReadBack: [],
    dependencySync: {},
    commits: {
      specCommit: "abc123",
      implementationCommits: [],
      testCommits: [],
      fixCommits: [],
      documentationCommits: [],
    },
    verification: { local: [{ command: "test", status: "passed" }] },
    error: null,
  }
}

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "opencode-checkers-"))

try {
  const runId = "run-test"
  const validDir = path.join(tempRoot, "valid")
  const invalidDir = path.join(tempRoot, "invalid")
  const staleDir = path.join(tempRoot, "stale")

  writeJson(path.join(validDir, "dispatch-ledger.json"), validDispatchLedger(runId))
  writeJson(path.join(validDir, "runner-event.json"), validRunnerEvent(runId))
  writeJson(path.join(validDir, "run-preflight-packet.json"), {
    schemaVersion: "run-preflight-packet/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "passed",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read full planner and project rules",
  })
  writeJson(path.join(validDir, "verification-matrix.json"), {
    schemaVersion: "verification-matrix/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "passed",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read full verification plan",
  })
  writeJson(path.join(validDir, "snapshot-manifest.json"), {
    schemaVersion: "snapshot-manifest/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "passed",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "rebuild full snapshot from source worktree",
  })
  writeJson(path.join(validDir, "commit-metadata-summary.json"), {
    schemaVersion: "commit-metadata-summary/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "passed",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "rebuild commit metadata from git show",
  })
  writeJson(path.join(validDir, "port-registry.json"), {
    schemaVersion: "port-registry/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "planned",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "recompute deterministic port map from planner",
  })
  writeJson(path.join(validDir, "openspec-template-contract.json"), {
    schemaVersion: "openspec-template-contract/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "planned",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read full OpenSpec proposal/design/tasks/specs artifacts",
  })
  writeJson(path.join(validDir, "apply-readiness-checklist.json"), {
    schemaVersion: "apply-readiness-checklist/v1",
    run_id: runId,
    classificationId: "class-1",
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "passed",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read full OpenSpec artifacts and alignment-check",
  })
  writeJson(path.join(validDir, "package-decision-record.json"), {
    schemaVersion: "package-decision-record/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "planned",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read full planner package decision section",
  })
  writeJson(path.join(validDir, "experience-contract.json"), {
    schemaVersion: "experience-contract/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "planned",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read full planner experience contract section",
  })
  writeJson(path.join(validDir, "planner-index.json"), {
    schemaVersion: "planner-index/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "passed",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read full development-detail-planner",
  })
  writeJson(path.join(validDir, "final-report-index.json"), {
    schemaVersion: "final-report-index/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "passed",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read full final maintained report and git history",
  })
  writeJson(path.join(invalidDir, "dispatch-ledger.json"), {
    ...validDispatchLedger(runId),
    stages: [
      {
        ...validDispatchLedger(runId).stages[0],
        eligibleSets: [
          {
            ...validDispatchLedger(runId).stages[0].eligibleSets[0],
            expectedWorktrees: [
              {
                ...validDispatchLedger(runId).stages[0].eligibleSets[0].expectedWorktrees[0],
                branch: `work/${runId}/stage-1/sample`,
              },
            ],
          },
        ],
      },
    ],
  })
  writeJson(path.join(staleDir, "blocked-summary.json"), {
    schemaVersion: "run-preflight-packet/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "blocked",
    blockers: ["PLANNER_MISSING"],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read full planner",
  })
  writeJson(path.join(staleDir, "bad-source-ref.json"), {
    schemaVersion: "planner-index/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "passed",
    blockers: [],
    sourceRefs: [{ path: "missing.md", sha256: "abc123" }],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: ["missing-detail.md"],
    fallbackAction: "read full planner",
  })

  runCase("agent checker strict", [AGENT_CHECKER, "--strict"], 0)
  runCase("artifact checker valid fixtures", [ARTIFACT_CHECKER, validDir, "--strict"], 0)
  runJsonCase("artifact checker json output", [ARTIFACT_CHECKER, validDir, "--json"], 0, (data) => data.schemaVersion ? "unexpected schemaVersion" : data.status === "passed" || `status=${data.status}`)
  runCase("artifact checker rejects alias branch", [ARTIFACT_CHECKER, invalidDir], 1)
  const planner = path.join(tempRoot, "planner.md")
  writeFileSync(planner, "# planner\n", "utf8")
  writeJson(path.join(ROOT, ".opencode", "run-artifacts", runId, "dispatch-ledger.json"), validDispatchLedger(runId))
  writeJson(path.join(ROOT, ".opencode", "run-artifacts", runId, "runner-events", "class-1.json"), validRunnerEvent(runId))
  writeJson(path.join(ROOT, ".opencode", "run-artifacts", runId, "context-slices", "class-1.json"), {
    schemaVersion: "context-slice/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "planned",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read full planner and dispatch ledger",
  })
  writeJson(path.join(ROOT, ".opencode", "run-artifacts", runId, "package-decision-record.json"), {
    schemaVersion: "package-decision-record/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "planned",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read full planner package decision section",
  })
  writeJson(path.join(ROOT, ".opencode", "run-artifacts", runId, "experience-contract.json"), {
    schemaVersion: "experience-contract/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "planned",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read full planner experience contract section",
  })
  writeJson(path.join(ROOT, ".opencode", "run-artifacts", runId, "verification-matrix.json"), {
    schemaVersion: "verification-matrix/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "planned",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read full verification plan",
    runnerLocal: [],
    stageIntegration: [],
    finalOnly: [],
  })
  runCase("build preflight dry-run", [BUILD_PREFLIGHT, runId, "--planner", planner, "--check"], 0)
  runJsonCase("build preflight json dry-run", [BUILD_PREFLIGHT, runId, "--planner", planner, "--check", "--json"], 0, (data) => data.schemaVersion === "script-result/v1" && data.artifact && data.artifact.schemaVersion === "run-preflight-packet/v1" || "invalid script-result")
  runCase("build matrix dry-run", [BUILD_MATRIX, runId, "--planner", planner, "--check"], 0)
  runCase("build context dry-run", [BUILD_CONTEXT, runId, "--ready-wave", "wave-1", "--check"], 0)
  runCase("build snapshot dry-run", [BUILD_SNAPSHOT, runId, "--stage", "1", "--wave", "wave-1", "--check"], 0)
  runCase("build port map dry-run", [BUILD_PORT_MAP, runId, "--stage", "1", "--wave", "wave-1", "--check"], 0)
  runCase("build openspec template dry-run", [BUILD_OPENSPEC_TEMPLATE, runId, "class-1", "--check"], 0)
  runCase("build commit metadata dry-run", [BUILD_COMMIT_METADATA, runId, "class-1", "--check"], 0)
  runCase("build package decision dry-run", [BUILD_PACKAGE_DECISION, runId, "--planner", planner, "--check"], 0)
  runCase("build experience dry-run", [BUILD_EXPERIENCE, runId, "--planner", planner, "--check"], 0)
  runCase("build project rules lock dry-run", [BUILD_PROJECT_RULES_LOCK, runId, "--check"], 0)
  runCase("build skill lock dry-run", [BUILD_SKILL_LOCK, runId, "--check"], 0)
  runCase("build dependency dry-run", [BUILD_DEPENDENCY, runId, "--check"], 0)
  runCase("build planner index dry-run", [BUILD_PLANNER_INDEX, runId, "--planner", planner, "--check"], 0)
  runCase("freshness valid fixtures", [CHECK_FRESHNESS, validDir, "--strict"], 0)
  runCase("freshness rejects blocked summary", [CHECK_FRESHNESS, staleDir, "--strict"], 1)
  runCase("freshness gate rejects planned", [CHECK_FRESHNESS, validDir, "--strict", "--gate", "runner"], 1)
  runCase("verification matrix rejects empty", [CHECK_MATRIX, runId], 1)
  runCase("build dispatch ledger dry-run", [BUILD_DISPATCH_LEDGER, runId, "--planner", planner, "--check"], 0)
  runCase("check dispatch ledger", [CHECK_DISPATCH_LEDGER, runId], 0)
  runCase("build runner event dry-run", [BUILD_RUNNER_EVENT, runId, "class-1", "--check"], 0)
  runCase("check runner event", [CHECK_RUNNER_EVENT, runId, "class-1"], 0)
  writeJson(path.join(ROOT, ".opencode", "run-artifacts", runId, "runner-events", "bad-completed.json"), {
    ...validRunnerEvent(runId),
    classificationId: "bad-completed",
    commits: { specCommit: null, implementationCommits: [], testCommits: [], fixCommits: [], documentationCommits: [] },
    verification: { local: [] },
  })
  runCase("runner event rejects completed without spec", [CHECK_RUNNER_EVENT, runId, "bad-completed"], 1)
  runCase("build final report index dry-run", [BUILD_FINAL_INDEX, runId, "--check"], 0)
  runCase("script contracts", [CHECK_SCRIPT_CONTRACTS], 0)
  writeJson(path.join(ROOT, ".opencode", "run-artifacts", runId, "port-map.json"), {
    schemaVersion: "port-registry/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "planned",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "recompute deterministic port map from planner",
    ports: [{ owner: "class-1", classificationId: "class-1" }],
  })
  runCase("artifact crossrefs", [CHECK_CROSSREFS, runId, "--strict"], 0)
  writeJson(path.join(ROOT, ".opencode", "run-artifacts", runId, "context-slices", "class-1.json"), {
    schemaVersion: "context-slice/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "planned",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read full planner and dispatch ledger",
    branch: `worktree/${runId}/stage-1/different`,
    eligibleSetId: "set-1",
  })
  runCase("artifact crossrefs rejects branch mismatch", [CHECK_CROSSREFS, runId, "--strict"], 1)
  writeJson(path.join(ROOT, ".opencode", "run-artifacts", runId, "dispatch-ledger.json"), {
    ...validDispatchLedger(runId),
    stages: [{ ...validDispatchLedger(runId).stages[0], eligibleSets: [{ ...validDispatchLedger(runId).stages[0].eligibleSets[0], expectedWorktrees: [validDispatchLedger(runId).stages[0].eligibleSets[0].expectedWorktrees[0], { ...validDispatchLedger(runId).stages[0].eligibleSets[0].expectedWorktrees[0], name: "dup" }] }] }],
  })
  runCase("dispatch ledger rejects duplicate branch", [CHECK_DISPATCH_LEDGER, runId], 1)
} finally {
  rmSync(path.join(ROOT, ".opencode", "run-artifacts", "run-test"), { recursive: true, force: true })
  rmSync(tempRoot, { recursive: true, force: true })
}

const failed = results.filter((result) => !result.passed)
console.log(`test-checkers: ${failed.length === 0 ? "passed" : "failed"}`)
for (const result of results) {
  console.log(`- ${result.passed ? "passed" : "failed"}: ${result.name} (exit ${result.status})`)
  if (!result.passed && result.output) console.log(result.output)
}

process.exit(failed.length === 0 ? 0 : 1)
