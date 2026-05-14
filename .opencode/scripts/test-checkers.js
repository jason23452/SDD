#!/usr/bin/env node

const { execFileSync } = require("node:child_process")
const { existsSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { ROOT } = require("./lib/artifact-utils")
const { rootRel, validDispatchLedger, validRunnerEvent, writeJson } = require("./test-fixtures/checker-fixtures")

const ARTIFACT_CHECKER = path.join(ROOT, ".opencode", "scripts", "artifact-schema-check.js")
const AGENT_CHECKER = path.join(ROOT, ".opencode", "scripts", "agent-contract-check.js")
const BUILD_PREFLIGHT = path.join(ROOT, ".opencode", "scripts", "build-run-preflight-packet.js")
const BUILD_ACTIVE_SKILL_SELECTION = path.join(ROOT, ".opencode", "scripts", "build-active-skill-selection-contract.js")
const BUILD_SKILL_VERIFICATION = path.join(ROOT, ".opencode", "scripts", "build-skill-driven-verification-contract.js")
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
const BUILD_RUN_METRICS = path.join(ROOT, ".opencode", "scripts", "build-run-metrics-summary.js")
const BUILD_RESUME_CURSOR = path.join(ROOT, ".opencode", "scripts", "build-resume-cursor.js")
const CHECK_RESUME = path.join(ROOT, ".opencode", "scripts", "check-resume-readiness.js")
const BUILD_VERIFICATION_SUMMARY = path.join(ROOT, ".opencode", "scripts", "build-verification-summary.js")
const CHECK_RUNTIME_CLEAN = path.join(ROOT, ".opencode", "scripts", "check-runtime-artifacts-clean.js")
const CLEAN_TEST_ARTIFACTS = path.join(ROOT, ".opencode", "scripts", "cleanup-test-artifacts.js")
const NORMALIZE_LEGACY = path.join(ROOT, ".opencode", "scripts", "normalize-legacy-artifacts.js")

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

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "opencode-checkers-"))
const runId = `run-test-${process.pid}-${Date.now()}`

try {
  execFileSync(process.execPath, [CLEAN_TEST_ARTIFACTS], { cwd: ROOT, encoding: "utf8" })
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
  writeJson(path.join(validDir, "run-metrics-summary.json"), {
    schemaVersion: "run-metrics-summary/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "passed",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read full run artifacts and logs",
  })
  writeFileSync(path.join(validDir, "bom-summary.json"), `\uFEFF${JSON.stringify({
    schemaVersion: "run-preflight-packet/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "passed",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read full planner and project rules",
  }, null, 2)}\n`, "utf8")
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
  const sourceRefFile = path.join(tempRoot, "source-ref.md")
  writeFileSync(sourceRefFile, "source ref\n", "utf8")
  const sourceObjectDir = path.join(tempRoot, "source-object")
  writeJson(path.join(sourceObjectDir, "source-object-summary.json"), {
    schemaVersion: "planner-index/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "passed",
    blockers: [],
    sourceRefs: { planner: { path: rootRel(sourceRefFile), sha256: require("crypto").createHash("sha256").update(require("fs").readFileSync(sourceRefFile)).digest("hex"), requiredFor: "source refs object", fallbackAction: "read source ref" } },
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read full planner",
  })
  runCase("artifact checker accepts sourceRefs object", [ARTIFACT_CHECKER, sourceObjectDir, "--strict"], 0)
  runJsonCase("artifact checker legacy summary only", [ARTIFACT_CHECKER, sourceObjectDir, "--legacy-report", "--legacy-summary-only", "--max-findings", "1", "--by-file", "--json"], 0, (data) => data.legacySummary && data.findings.length === 0 || "legacy summary only failed")
  runCase("artifact checker report-only exits zero", [ARTIFACT_CHECKER, invalidDir, "--report-only"], 0)
  runJsonCase("normalize legacy artifacts dry-run", [NORMALIZE_LEGACY, sourceObjectDir, "--run-id", runId, "--json"], 0, (data) => data.schemaVersion === "script-result/v1" && data.mode === "check" || "invalid normalize result")
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
  writeJson(path.join(ROOT, ".opencode", "run-artifacts", runId, "project-rules-lock.json"), {
    schemaVersion: "project-rules-lock/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "passed",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read full project rules",
  })
  writeJson(path.join(ROOT, ".opencode", "run-artifacts", runId, "skill-lock.json"), {
    schemaVersion: "skill-lock/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "passed",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read active skills and rebuild skill lock",
  })
  writeJson(path.join(ROOT, ".opencode", "run-artifacts", runId, "active-skill-selection-contract.json"), {
    schemaVersion: "active-skill-selection-contract/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "passed",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read full planner and skill-lock to resolve active skills",
    activeSkills: [{ name: "react-spa-feature-based", path: ".opencode/skills/frontend/react-spa-feature-based/SKILL.md", sha256: "abc123", source: "planner-confirmed-scope+skill-lock" }],
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
  writeJson(path.join(ROOT, ".opencode", "run-artifacts", runId, "skill-driven-verification-contract.json"), {
    schemaVersion: "skill-driven-verification-contract/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "planned",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "read active skills, project rules, and full planner verification section",
    verificationSections: [],
    runnerLocalChecks: [],
    stageIntegrationChecks: [],
    finalOnlyChecks: [],
  })
  runCase("build preflight dry-run", [BUILD_PREFLIGHT, runId, "--planner", planner, "--check"], 0)
  runJsonCase("build preflight json dry-run", [BUILD_PREFLIGHT, runId, "--planner", planner, "--check", "--json"], 0, (data) => data.schemaVersion === "script-result/v1" && data.artifact && data.artifact.schemaVersion === "run-preflight-packet/v1" || "invalid script-result")
  const outPath = path.join(tempRoot, "preflight-out.json")
  runCase("build preflight custom out", [BUILD_PREFLIGHT, runId, "--planner", planner, "--out", outPath], 0)
  runCase("build active skill selection dry-run", [BUILD_ACTIVE_SKILL_SELECTION, runId, "--planner", planner, "--skill-lock", rootRel(path.join(".opencode", "run-artifacts", runId, "skill-lock.json")), "--check"], 0)
  runCase("build skill verification dry-run", [BUILD_SKILL_VERIFICATION, runId, "--planner", planner, "--project-rules-lock", rootRel(path.join(".opencode", "run-artifacts", runId, "project-rules-lock.json")), "--skill-lock", rootRel(path.join(".opencode", "run-artifacts", runId, "skill-lock.json")), "--active-skill-selection", rootRel(path.join(".opencode", "run-artifacts", runId, "active-skill-selection-contract.json")), "--check"], 0)
  runJsonCase("build matrix strict rejects missing verification", [BUILD_MATRIX, runId, "--planner", planner, "--check", "--json", "--strict"], 1)
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
  runCase("freshness accepts sourceRefs object", [CHECK_FRESHNESS, sourceObjectDir, "--strict"], 0)
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
  runCase("build verification summary dry-run", [BUILD_VERIFICATION_SUMMARY, runId, "--scope", "runner", "--check-id", "frontend-local", "--status", "passed", "--check"], 0)
  runCase("build resume cursor dry-run", [BUILD_RESUME_CURSOR, runId, "--check"], 0)
  writeJson(path.join(ROOT, ".opencode", "run-artifacts", runId, "resume-cursor.json"), {
    schemaVersion: "resume-cursor/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "planned",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { dispatchLedger: require("crypto").createHash("sha256").update(require("fs").readFileSync(path.join(ROOT, ".opencode", "run-artifacts", runId, "dispatch-ledger.json"))).digest("hex") },
    detailRefs: [],
    fallbackAction: "read dispatch ledger and runner events",
    nextAction: "resume-worktree",
    cursor: { classificationId: "class-1" },
  })
  runCase("check resume readiness", [CHECK_RESUME, runId, "--strict"], 0)
  runCase("build run metrics dry-run", [BUILD_RUN_METRICS, runId, "--check"], 0)
  runCase("runtime artifacts clean", [CHECK_RUNTIME_CLEAN, "--strict"], 0)
  runCase("script contracts", [CHECK_SCRIPT_CONTRACTS], 0)
  runCase("cleanup test artifacts dry-run", [CLEAN_TEST_ARTIFACTS, "--check"], 0)
  runCase("cleanup test artifacts age dry-run", [CLEAN_TEST_ARTIFACTS, "--check", "--older-than-minutes", "5"], 0)
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
  writeJson(path.join(ROOT, ".opencode", "run-artifacts", runId, "commit-metadata-summary", "class-1.json"), {
    schemaVersion: "commit-metadata-summary/v1",
    run_id: runId,
    createdAt: "2026-05-13T00:00:00.000Z",
    status: "passed",
    blockers: [],
    sourceRefs: [],
    sourceHashes: { HEAD: "abc123" },
    detailRefs: [],
    fallbackAction: "rebuild commit metadata from git show",
    classificationId: "class-1",
    commits: [{ hash: validRunnerEvent(runId).commits.specCommit, touchedFiles: [] }],
  })
  runCase("artifact crossrefs", [CHECK_CROSSREFS, runId, "--strict"], 0)
  const alternateRunnerEventPath = path.join(tempRoot, "runner-event-alt.json")
  writeJson(alternateRunnerEventPath, validRunnerEvent(runId))
  rmSync(path.join(ROOT, ".opencode", "run-artifacts", runId, "runner-events", "class-1.json"), { force: true })
  const ledgerWithAlternateRunnerEvent = validDispatchLedger(runId)
  ledgerWithAlternateRunnerEvent.stages[0].eligibleSets[0].expectedWorktrees[0].runnerEventPath = alternateRunnerEventPath
  writeJson(path.join(ROOT, ".opencode", "run-artifacts", runId, "dispatch-ledger.json"), ledgerWithAlternateRunnerEvent)
  runCase("artifact crossrefs reads runnerEventPath", [CHECK_CROSSREFS, runId, "--strict"], 0)
  if (!existsSync(path.join(ROOT, ".opencode", "run-artifacts", runId, "runner-events", "class-1.json"))) writeJson(path.join(ROOT, ".opencode", "run-artifacts", runId, "runner-events", "class-1.json"), validRunnerEvent(runId))
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
  rmSync(path.join(ROOT, ".opencode", "run-artifacts", runId), { recursive: true, force: true })
  rmSync(tempRoot, { recursive: true, force: true })
}

const failed = results.filter((result) => !result.passed)
console.log(`test-checkers: ${failed.length === 0 ? "passed" : "failed"}`)
for (const result of results) {
  console.log(`- ${result.passed ? "passed" : "failed"}: ${result.name} (exit ${result.status})`)
  if (!result.passed && result.output) console.log(result.output)
}

process.exit(failed.length === 0 ? 0 : 1)
