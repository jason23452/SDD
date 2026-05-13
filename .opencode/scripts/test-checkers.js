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
const BUILD_CONTEXT = path.join(ROOT, ".opencode", "scripts", "build-context-slices.js")
const BUILD_SNAPSHOT = path.join(ROOT, ".opencode", "scripts", "build-snapshot-manifest.js")
const BUILD_PORT_MAP = path.join(ROOT, ".opencode", "scripts", "build-port-map.js")
const BUILD_OPENSPEC_TEMPLATE = path.join(ROOT, ".opencode", "scripts", "build-openspec-template.js")
const BUILD_COMMIT_METADATA = path.join(ROOT, ".opencode", "scripts", "build-commit-metadata-summary.js")

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
    verification: { local: [] },
    error: null,
  }
}

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "opencode-checkers-"))

try {
  const runId = "run-test"
  const validDir = path.join(tempRoot, "valid")
  const invalidDir = path.join(tempRoot, "invalid")

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

  runCase("agent checker strict", [AGENT_CHECKER, "--strict"], 0)
  runCase("artifact checker valid fixtures", [ARTIFACT_CHECKER, validDir, "--strict"], 0)
  runCase("artifact checker rejects alias branch", [ARTIFACT_CHECKER, invalidDir], 1)
  const planner = path.join(tempRoot, "planner.md")
  writeFileSync(planner, "# planner\n", "utf8")
  runCase("build preflight dry-run", [BUILD_PREFLIGHT, runId, "--planner", planner, "--check"], 0)
  runCase("build matrix dry-run", [BUILD_MATRIX, runId, "--planner", planner, "--check"], 0)
  runCase("build context dry-run", [BUILD_CONTEXT, runId, "--ready-wave", "wave-1", "--check"], 0)
  runCase("build snapshot dry-run", [BUILD_SNAPSHOT, runId, "--stage", "1", "--wave", "wave-1", "--check"], 0)
  runCase("build port map dry-run", [BUILD_PORT_MAP, runId, "--stage", "1", "--wave", "wave-1", "--check"], 0)
  runCase("build openspec template dry-run", [BUILD_OPENSPEC_TEMPLATE, runId, "class-1", "--check"], 0)
  runCase("build commit metadata dry-run", [BUILD_COMMIT_METADATA, runId, "class-1", "--check"], 0)
} finally {
  rmSync(tempRoot, { recursive: true, force: true })
}

const failed = results.filter((result) => !result.passed)
console.log(`test-checkers: ${failed.length === 0 ? "passed" : "failed"}`)
for (const result of results) {
  console.log(`- ${result.passed ? "passed" : "failed"}: ${result.name} (exit ${result.status})`)
  if (!result.passed && result.output) console.log(result.output)
}

process.exit(failed.length === 0 ? 0 : 1)
