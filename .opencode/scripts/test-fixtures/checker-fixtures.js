const { execFileSync } = require("node:child_process")
const { mkdirSync, writeFileSync } = require("node:fs")
const path = require("node:path")
const { ROOT } = require("../lib/artifact-utils")

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function rootRel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/")
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
  let head = "abc123"
  try {
    head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim()
  } catch (_error) {
    head = "abc123"
  }
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
      specCommit: head,
      implementationCommits: [],
      testCommits: [],
      fixCommits: [],
      documentationCommits: [],
    },
    verification: { local: [{ command: "test", status: "passed" }] },
    error: null,
  }
}

module.exports = {
  rootRel,
  validDispatchLedger,
  validRunnerEvent,
  writeJson,
}
